'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CARD_EXPORT_HEIGHT,
  CARD_EXPORT_WIDTH,
  CapsuleCard,
} from './CapsuleCard';
import { BrandMark } from './BrandMark';
import { resolveArtistImage } from '@/lib/artistImage';
import { renderCardToBlob } from '@/lib/exportCard';
import {
  fetchCapsule,
  fetchUserInfo,
  isLastfmError,
  isValidLastfmUsername,
  type CapsuleData,
  type FetchProgress,
  type LastfmUser,
} from '@/lib/lastfmClient';
import { normalizeLastfmUsernameInput } from '@/lib/username';
import {
  MAX_CUSTOM_RANGE_DAYS,
  addDays,
  formatDateInput,
  formatDateRange,
  formatFullDate,
  formatMonth,
  formatPeriodLabel,
  getMonthRange,
  getWeekRange,
  parseDateInput,
  resolvePeriod,
  validateCustomRange,
  type DateRange,
  type PeriodKind,
  type ResolvedPeriod,
} from '@/lib/periods';

type Status = 'idle' | 'loading' | 'ready' | 'error';
type UiPhase = FetchProgress | { phase: 'preparing' };
type ExportState = 'idle' | 'downloading' | 'sharing';

interface ResultState {
  data: CapsuleData;
  periodKind: PeriodKind;
  range: DateRange;
  periodLabel: string;
  heroImageUrl: string | null;
}

interface ErrorState {
  code: string;
  params?: Record<string, string | number>;
}

interface StudioCopy {
  periodWeek: string;
  periodMonth: string;
  periodCustom: string;
  customHint: string;
}

class ValidationUiError extends Error {
  readonly code: string;
  readonly params?: Record<string, string | number>;

  constructor(code: string, params?: Record<string, string | number>) {
    super(code);
    this.name = 'ValidationUiError';
    this.code = code;
    this.params = params;
  }
}

function mapLastfmError(error: unknown): ErrorState {
  if (isLastfmError(error)) {
    switch (error.code) {
      case 'invalid_user':
      case 'private':
      case 'no_scrobbles':
      case 'rate_limit':
      case 'network':
      case 'missing_api_key':
      case 'server_error':
        return { code: error.code };
      default:
        return { code: 'unknown' };
    }
  }

  return { code: 'unknown' };
}

function triggerDownload(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CapsuleStudio() {
  const t = useTranslations('Home');
  const locale = useLocale();

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [username, setUsername] = useState('');
  const [periodKind, setPeriodKind] = useState<PeriodKind>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [phase, setPhase] = useState<UiPhase | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [userInfo, setUserInfo] = useState<LastfmUser | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Dates must be calculated in the visitor's timezone, which only exists after
  // hydration. Rendering them on the server would also bake the build date into
  // the statically generated page.
  useEffect(() => {
    const current = new Date();
    setNow(current);
    setMounted(true);
    setCustomStart(formatDateInput(addDays(current, -30)));
    setCustomEnd(formatDateInput(current));
  }, []);

  // While a custom range is selected, resolve the registration date so the UI
  // can validate and explain the minimum date before the user hits Generate.
  useEffect(() => {
    if (!mounted || periodKind !== 'custom') return;

    const trimmed = normalizeLastfmUsernameInput(username);
    if (!isValidLastfmUsername(trimmed)) {
      setUserInfo(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchUserInfo(trimmed, { signal: controller.signal })
        .then((info) => {
          if (!controller.signal.aborted) setUserInfo(info);
        })
        .catch(() => {
          if (!controller.signal.aborted) setUserInfo(null);
        });
    }, 600);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mounted, periodKind, username]);

  const translateError = useCallback(
    (state: ErrorState): string => {
      const key = `errors.${state.code}`;
      if (t.has(key as never)) {
        return t(key as never, (state.params ?? {}) as never);
      }
      return t('errors.unknown');
    },
    [t],
  );

  const copy: StudioCopy = {
    periodWeek: t('period.week'),
    periodMonth: t('period.month'),
    periodCustom: t('period.custom'),
    customHint: t('period.customHint'),
  };

  const weekLabel = now ? formatPeriodLabel('week', getWeekRange(now), locale) : '';
  const monthLabel = now ? formatMonth(getMonthRange(now).from, locale) : '';
  const parsedCustomStart = parseDateInput(customStart);
  const parsedCustomEnd = parseDateInput(customEnd);
  const customLabel =
    parsedCustomStart && parsedCustomEnd
      ? formatDateRange({ from: parsedCustomStart, to: parsedCustomEnd }, locale)
      : '';

  const liveIssue =
    parsedCustomStart && parsedCustomEnd && now
      ? validateCustomRange({
          start: parsedCustomStart,
          end: parsedCustomEnd,
          registered: userInfo?.registered ?? null,
          now,
        })
      : null;

  const liveIssueText = liveIssue
    ? translateError({
        code: liveIssue.code,
        params: {
          date: liveIssue.registered ? formatFullDate(liveIssue.registered, locale) : '',
          days: liveIssue.maxDays ?? MAX_CUSTOM_RANGE_DAYS,
        },
      })
    : null;

  const registeredLabel = userInfo ? formatFullDate(userInfo.registered, locale) : null;
  const sinceText = registeredLabel
    ? t('custom.since', { date: registeredLabel, days: MAX_CUSTOM_RANGE_DAYS })
    : t('custom.maxOnly', { days: MAX_CUSTOM_RANGE_DAYS });

  function resetErrorOnEdit() {
    if (status === 'error') {
      setError(null);
      setStatus(result ? 'ready' : 'idle');
    }
    setNotice(null);
    setActionError(null);
  }

  function onUsernameChange(event: React.ChangeEvent<HTMLInputElement>) {
    setUsername(event.target.value);
    resetErrorOnEdit();
  }

  function onUsernamePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text');
    const normalized = normalizeLastfmUsernameInput(pasted);

    // Pasting a profile URL should only fill the username, not duplicate the
    // static `last.fm/user/` prefix already shown in the field.
    if (normalized && normalized !== pasted.trim()) {
      event.preventDefault();
      setUsername(normalized);
      resetErrorOnEdit();
    }
  }

  function onUsernameBlur() {
    const normalized = normalizeLastfmUsernameInput(username);
    if (normalized !== username) {
      setUsername(normalized);
      resetErrorOnEdit();
    }
  }

  function onPeriodChange(kind: PeriodKind) {
    setPeriodKind(kind);
    resetErrorOnEdit();
  }

  function onCancel() {
    abortRef.current?.abort();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'loading') return;

    setNotice(null);
    setActionError(null);

    const trimmed = normalizeLastfmUsernameInput(username);
    if (trimmed !== username) {
      setUsername(trimmed);
    }

    if (!isValidLastfmUsername(trimmed)) {
      setResult(null);
      setStatus('error');
      setError({ code: 'invalid_username' });
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    setStatus('loading');
    setPhase({ phase: 'user' });
    setError(null);
    setResult(null);

    const currentNow = new Date();

    try {
      let resolved: ResolvedPeriod;

      if (periodKind === 'custom') {
        const start = parseDateInput(customStart);
        const end = parseDateInput(customEnd);
        if (!start || !end) {
          throw new ValidationUiError('invalid_range');
        }

        let info = userInfo;
        if (!info) {
          info = await fetchUserInfo(trimmed, { signal: controller.signal });
          setUserInfo(info);
        }

        const issue = validateCustomRange({
          start,
          end,
          registered: info.registered,
          now: currentNow,
        });

        if (issue) {
          throw new ValidationUiError(issue.code, {
            date: issue.registered ? formatFullDate(issue.registered, locale) : '',
            days: issue.maxDays ?? MAX_CUSTOM_RANGE_DAYS,
          });
        }

        resolved = resolvePeriod('custom', {
          now: currentNow,
          customStart: start,
          customEnd: end,
        });
      } else {
        resolved = resolvePeriod(periodKind, { now: currentNow });
      }

      const data = await fetchCapsule({
        username: trimmed,
        from: resolved.fromUnix,
        to: resolved.toUnix,
        signal: controller.signal,
        onProgress: setPhase,
      });

      setPhase({ phase: 'preparing' });
      const heroImageUrl = await resolveArtistImage(data.coverArtist, controller.signal);

      if (controller.signal.aborted) {
        throw new Error('aborted');
      }

      setResult({
        data,
        periodKind,
        range: { from: resolved.from, to: resolved.to },
        periodLabel: formatPeriodLabel(periodKind, resolved, locale),
        heroImageUrl,
      });
      setStatus('ready');
      setPhase(null);
    } catch (caught) {
      if (controller.signal.aborted || (isLastfmError(caught) && caught.code === 'cancelled')) {
        setStatus('idle');
        setPhase(null);
        setNotice(t('progress.cancelled'));
        return;
      }

      if (caught instanceof ValidationUiError) {
        setStatus('error');
        setPhase(null);
        setError({ code: caught.code, params: caught.params });
        return;
      }

      setStatus('error');
      setPhase(null);
      setError(mapLastfmError(caught));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  const buildFile = useCallback(async (): Promise<File> => {
    const node = cardRef.current;
    if (!node || !result) throw new Error('The capsule is not ready.');

    const blob = await renderCardToBlob(node);
    const slug =
      result.data.user.username
        .replace(/[^A-Za-z0-9_.-]+/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, '') || 'lastfm';

    return new File([blob], `sound-capsule-${slug}-${formatDateInput(new Date())}.png`, {
      type: 'image/png',
    });
  }, [result]);

  async function handleDownload() {
    if (!result || exportState !== 'idle') return;

    setExportState('downloading');
    setActionError(null);
    setNotice(null);

    try {
      const file = await buildFile();
      triggerDownload(file);
      setNotice(t('actions.downloaded'));
    } catch {
      setActionError(t('actions.exportError'));
    } finally {
      setExportState('idle');
    }
  }

  async function handleShare() {
    if (!result || exportState !== 'idle') return;

    setExportState('sharing');
    setActionError(null);
    setNotice(null);

    try {
      const file = await buildFile();
      const shareData: ShareData = { files: [file], title: 'Sound Capsule' };

      const canShare =
        typeof navigator.share === 'function' &&
        (typeof navigator.canShare !== 'function' || navigator.canShare(shareData));

      if (canShare) {
        try {
          await navigator.share(shareData);
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === 'AbortError') {
            return;
          }
        }
      }

      triggerDownload(file);
      setNotice(t('actions.shareFallback'));
    } catch {
      setActionError(t('actions.exportError'));
    } finally {
      setExportState('idle');
    }
  }

  const progress = phase ? describeProgress(phase, t) : null;
  const isBusy = status === 'loading';
  const canExport = Boolean(result) && status === 'ready' && exportState === 'idle';

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
      <section className="lg:col-span-7" aria-labelledby="capsule-form-title">
        <form
          id="capsule-form"
          onSubmit={handleSubmit}
          noValidate
          aria-busy={isBusy}
          className="space-y-6 rounded-xl border border-line bg-surface p-6 sm:p-7"
        >
          <div>
            <h1
              id="capsule-form-title"
              className="text-xl font-semibold tracking-tight text-fg sm:text-2xl"
            >
              {t('title')}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{t('subtitle')}</p>
          </div>

          {/* Username */}
          <div>
            <label
              htmlFor="lastfm-username"
              className="block text-[11px] font-medium uppercase tracking-wider text-muted"
            >
              {t('usernameLabel')}
            </label>
            <div className="username-field mt-2 flex items-center overflow-hidden rounded-lg border border-line-strong bg-field transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/40">
              <span className="select-none pl-3.5 pr-1 font-mono text-xs text-subtle">
                last.fm/user/
              </span>
              <input
                id="lastfm-username"
                name="username"
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={onUsernameChange}
                onPaste={onUsernamePaste}
                onBlur={onUsernameBlur}
                placeholder={t('usernamePlaceholder')}
                aria-describedby="username-hint"
                aria-invalid={error?.code === 'invalid_username' || undefined}
                className="w-full bg-transparent py-2.5 pr-3.5 text-sm font-medium text-fg placeholder:text-subtle focus:outline-none focus-visible:outline-none"
                disabled={isBusy}
              />
            </div>
            <p id="username-hint" className="mt-1.5 text-[11px] leading-relaxed text-subtle">
              {t('usernameHint')}
            </p>
          </div>

          {/* Period */}
          <fieldset>
            <legend className="block text-[11px] font-medium uppercase tracking-wider text-muted">
              {t('periodLabel')}
            </legend>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {(
                [
                  { kind: 'week' as const, title: copy.periodWeek, sub: weekLabel },
                  { kind: 'month' as const, title: copy.periodMonth, sub: monthLabel },
                  {
                    kind: 'custom' as const,
                    title: copy.periodCustom,
                    sub: customLabel || copy.customHint,
                  },
                ] satisfies Array<{ kind: PeriodKind; title: string; sub: string }>
              ).map((option) => {
                const selected = periodKind === option.kind;
                return (
                  <label
                    key={option.kind}
                    className={`period-card block cursor-pointer rounded-lg border p-3 transition-colors ${
                      selected
                        ? 'border-accent bg-accent-soft'
                        : 'border-line-strong bg-field hover:border-subtle'
                    }`}
                  >
                    <input
                      type="radio"
                      name="period"
                      value={option.kind}
                      checked={selected}
                      onChange={() => onPeriodChange(option.kind)}
                      className="sr-only"
                      disabled={isBusy}
                    />
                    <span className="block text-xs font-semibold text-fg">{option.title}</span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">
                      {option.sub || '—'}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Custom range */}
          {periodKind === 'custom' && (
            <div className="space-y-3 rounded-lg border border-line bg-field p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="custom-start"
                    className="block text-[11px] text-muted"
                  >
                    {t('custom.start')}
                  </label>
                  <input
                    id="custom-start"
                    type="date"
                    value={customStart}
                    onChange={(event) => {
                      setCustomStart(event.target.value);
                      resetErrorOnEdit();
                    }}
                    min={userInfo ? formatDateInput(userInfo.registered) : undefined}
                    max={now ? formatDateInput(now) : undefined}
                    aria-invalid={liveIssue ? true : undefined}
                    aria-describedby="custom-note"
                    className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-xs text-fg focus:border-accent"
                    disabled={isBusy}
                  />
                </div>
                <div>
                  <label htmlFor="custom-end" className="block text-[11px] text-muted">
                    {t('custom.end')}
                  </label>
                  <input
                    id="custom-end"
                    type="date"
                    value={customEnd}
                    onChange={(event) => {
                      setCustomEnd(event.target.value);
                      resetErrorOnEdit();
                    }}
                    min={customStart || undefined}
                    max={now ? formatDateInput(now) : undefined}
                    aria-invalid={liveIssue ? true : undefined}
                    aria-describedby="custom-note"
                    className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-xs text-fg focus:border-accent"
                    disabled={isBusy}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-[11px]">
                <p
                  id="custom-note"
                  className={`font-mono ${liveIssueText ? 'text-accent' : 'text-muted'}`}
                >
                  {liveIssueText ?? sinceText}
                </p>
                <div className="flex items-start gap-2 rounded-md border border-warn-line bg-warn-bg px-3 py-2 text-fg">
                  <span className="mt-px font-mono text-[11px] font-bold text-accent">!</span>
                  <span className="text-[11px] leading-relaxed">{t('custom.warning')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit + progress + feedback */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={isBusy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-[#111113] transition-colors hover:bg-[#f47a5e] disabled:cursor-wait disabled:opacity-70"
            >
              {isBusy ? (
                <>
                  <Spinner />
                  <span>{t('generating')}</span>
                </>
              ) : (
                <>
                  <span>{t('generate')}</span>
                  <ArrowIcon />
                </>
              )}
            </button>

            {isBusy && progress && (
              <div className="space-y-3 rounded-lg border border-line bg-field p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                  <span className="font-medium text-fg">{progress.label}</span>
                  {progress.counter && (
                    <span className="font-mono text-[11px] text-muted">{progress.counter}</span>
                  )}
                </div>
                <div
                  role="progressbar"
                  aria-label={progress.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percent}
                  className="h-2 w-full overflow-hidden rounded-full bg-line"
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] text-subtle">
                    {t('progress.concurrency')}
                  </span>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md border border-line-strong bg-[#1f1f23] px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:border-subtle"
                  >
                    {t('progress.cancel')}
                  </button>
                </div>
              </div>
            )}

            {error && !isBusy && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-warn-line bg-warn-bg px-3 py-2.5 text-xs leading-relaxed text-fg"
              >
                <span className="mt-px font-mono text-sm font-bold text-accent">!</span>
                <p>{translateError(error)}</p>
              </div>
            )}

            {notice && (
              <p role="status" className="text-xs text-muted">
                {notice}
              </p>
            )}
          </div>

          <p className="border-t border-line pt-4 font-mono text-[11px] leading-relaxed text-subtle">
            {t('privacy')}
          </p>
        </form>
      </section>

      {/* Preview + actions */}
      <aside
        className="flex flex-col items-center gap-4 lg:col-span-5"
        aria-label={t('preview.title')}
      >
        <div className="flex w-full max-w-[320px] items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
            {t('preview.title')}
          </span>
          <span className="font-mono text-[11px] text-subtle">{t('preview.dimensions')}</span>
        </div>

        {result && status === 'ready' && (
          <p className="w-full max-w-[320px] truncate font-mono text-[11px] text-subtle">
            @{result.data.user.username} · {result.periodLabel}
          </p>
        )}

        <PreviewShell>
          {(scale) =>
            isBusy ? (
              <PreviewSkeleton />
            ) : result ? (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                <CapsuleCard
                  cardRef={cardRef}
                  periodLabel={result.periodLabel}
                  topArtists={result.data.topArtists}
                  topTracks={result.data.topTracks}
                  minutes={result.data.estimate.minutes}
                  heroImageUrl={result.heroImageUrl}
                  coverArtist={result.data.coverArtist}
                />
              </div>
            ) : (
              <EmptyPreview scale={scale} title={t('preview.emptyTitle')} hint={t('preview.emptyHint')} />
            )
          }
        </PreviewShell>

        <div className="grid w-full max-w-[320px] grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!canExport}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-xs font-semibold text-[#111113] transition-opacity hover:bg-[#f47a5e] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exportState === 'downloading' ? (
              <Spinner />
            ) : (
              <DownloadIcon />
            )}
            <span>
              {exportState === 'downloading' ? t('actions.exporting') : t('actions.download')}
            </span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            disabled={!canExport}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-[#1f1f23] px-3 py-2.5 text-xs font-medium text-fg transition-colors hover:border-subtle disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exportState === 'sharing' ? <Spinner /> : <ShareIcon />}
            <span>{t('actions.share')}</span>
          </button>
        </div>

        {actionError && (
          <p role="alert" className="w-full max-w-[320px] text-xs text-accent">
            {actionError}
          </p>
        )}

        <details className="group relative w-full max-w-[320px] text-xs text-muted">
          <summary className="flex cursor-pointer list-none items-start gap-2 rounded-md text-left transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[10px] leading-none text-muted">
              i
            </span>
            <span>{t('estimate.short')}</span>
          </summary>
          <div className="absolute bottom-full left-0 z-20 mb-2 w-full rounded-lg border border-line-strong bg-field p-3 text-[11px] leading-relaxed text-muted">
            <p className="font-medium text-fg">{t('estimate.label')}</p>
            <p className="mt-1">{t('estimate.tooltip')}</p>
            {result && (
              <p className="mt-2 font-mono text-[10px] text-subtle">
                {t('estimate.details', {
                  known: result.data.estimate.knownTracks,
                  fallback: result.data.estimate.fallbackTracks,
                })}
              </p>
            )}
          </div>
        </details>

        <p className="w-full max-w-[320px] font-mono text-[10px] text-subtle">
          {CARD_EXPORT_WIDTH}×{CARD_EXPORT_HEIGHT} px PNG
        </p>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Preview pieces                                                             */
/* -------------------------------------------------------------------------- */

function PreviewShell({ children }: { children: (scale: number) => React.ReactNode }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.625);

  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;

    const update = () => setScale(element.clientWidth / CARD_WIDTH);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={shellRef}
      className="relative w-full max-w-[320px] overflow-hidden rounded-xl border border-line bg-surface"
      style={{ aspectRatio: '9 / 16' }}
    >
      {children(scale)}
    </div>
  );
}

function EmptyPreview({
  scale,
  title,
  hint,
}: {
  scale: number;
  title: string;
  hint: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#18181b',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          padding: 48,
          textAlign: 'center',
        }}
      >
        <BrandMark size={52} surface="#212121" border="#343438" />
        <p style={{ fontSize: 20, fontWeight: 600, color: '#f4f4f5', margin: 0 }}>{title}</p>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: '#a1a1aa', margin: 0, maxWidth: 260 }}>
          {hint}
        </p>
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col bg-[#1b1b1d]" aria-hidden="true">
      <div className="skeleton-pulse h-[30%] w-full bg-line" />
      <div className="flex flex-1 flex-col justify-between bg-panel p-4">
        <div className="flex items-center justify-between">
          <div className="skeleton-pulse h-2.5 w-24 rounded bg-[#2c2c30]" />
          <div className="skeleton-pulse h-2.5 w-14 rounded bg-[#2c2c30]" />
        </div>
        <div className="space-y-2">
          <div className="skeleton-pulse h-4 w-40 rounded bg-[#2c2c30]" />
          <div className="skeleton-pulse h-4 w-28 rounded bg-[#2c2c30]" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((column) => (
            <div key={column} className="space-y-2">
              <div className="skeleton-pulse h-2 w-14 rounded bg-[#2c2c30]" />
              {[0, 1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="skeleton-pulse h-2.5 rounded bg-[#2c2c30]"
                  style={{ width: `${[92, 78, 86, 68, 80][row]}%` }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-1.5 border-t border-line pt-3">
          <div className="skeleton-pulse h-2 w-16 rounded bg-[#2c2c30]" />
          <div className="skeleton-pulse h-5 w-32 rounded bg-[#2c2c30]" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress narration                                                         */
/* -------------------------------------------------------------------------- */

type Translator = ReturnType<typeof useTranslations>;

function describeProgress(
  phase: UiPhase,
  t: Translator,
): { label: string; counter: string; percent: number } {
  switch (phase.phase) {
    case 'user':
      return { label: t('progress.user'), counter: '', percent: 6 };
    case 'pages': {
      const ratio = phase.totalPages > 0 ? phase.completed / phase.totalPages : 0;
      const pageCounter = t('progress.pageCounter', {
        page: phase.completed,
        totalPages: phase.totalPages,
      });
      const tracksCounter = t('progress.tracksCounter', { count: phase.tracksFetched });
      return {
        label: t('progress.pages'),
        counter: `${pageCounter} · ${tracksCounter}`,
        percent: Math.round(8 + 58 * Math.min(1, ratio)),
      };
    }
    case 'durations': {
      const ratio = phase.total > 0 ? phase.completed / phase.total : 1;
      return {
        label: t('progress.durations'),
        counter: t('progress.durationsCounter', {
          done: phase.completed,
          total: phase.total,
        }),
        percent: Math.round(68 + 28 * Math.min(1, ratio)),
      };
    }
    case 'preparing':
      return { label: t('progress.preparing'), counter: '', percent: 97 };
  }
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

