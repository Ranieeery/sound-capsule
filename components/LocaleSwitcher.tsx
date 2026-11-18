'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { localeLabels, localeShorts, locales, type Locale } from '@/lib/locales';

/**
 * Custom language menu that follows the app's dark, square design instead of
 * the OS-styled native <select> popup.
 */
export function LocaleSwitcher() {
  const t = useTranslations('Header');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function focusOption(index: number) {
    const button = optionRefs.current[index];
    if (button) button.focus();
  }

  function openMenu() {
    const index = Math.max(0, locales.indexOf(locale));
    setOpen(true);
    window.requestAnimationFrame(() => focusOption(index));
  }

  function selectLocale(nextLocale: Locale) {
    setOpen(false);
    triggerRef.current?.focus();
    if (nextLocale === locale) return;

    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.replace(pathname, { locale: nextLocale });
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
    }
  }

  function onOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (index + 1) % locales.length;
      focusOption(nextIndex);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = (index - 1 + locales.length) % locales.length;
      focusOption(nextIndex);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusOption(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusOption(locales.length - 1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectLocale(locales[index]);
      return;
    }
    if (event.key === 'Tab') {
      setOpen(false);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('language')}: ${localeLabels[locale]}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-fg hover:border-line-strong focus:border-accent"
      >
        <span className="font-mono text-[10px] tracking-wide text-muted">
          {localeShorts[locale]}
        </span>
        <span className="max-w-[124px] truncate">{localeLabels[locale]}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('language')}
          className="absolute right-0 z-50 mt-2 max-h-[70vh] w-60 overflow-y-auto rounded-lg border border-line-strong bg-surface p-1"
        >
          {locales.map((item, index) => {
            const selected = item === locale;
            return (
              <button
                key={item}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => selectLocale(item)}
                onKeyDown={(event) => onOptionKeyDown(event, index)}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs ${
                  selected
                    ? 'bg-field text-fg'
                    : 'text-muted hover:bg-field hover:text-fg'
                }`}
              >
                <span className="truncate">{localeLabels[item]}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  <span className="font-mono text-[10px] text-subtle">{localeShorts[item]}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`text-muted ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
