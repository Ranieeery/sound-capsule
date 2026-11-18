import type { CapsuleData } from '@/lib/lastfmClient';
import type { DateRange, PeriodKind } from '@/lib/periods';
import { DEFAULT_CARD_THEME_ID, type CardThemeId } from '@/lib/cardThemes';

export interface StudioResultState {
  data: CapsuleData;
  periodKind: PeriodKind;
  range: DateRange;
  heroImageUrl: string | null;
}

/**
 * In-memory session state that must survive a client-side locale navigation.
 * It is deliberately NOT persisted to storage: only the language (cookie) and
 * the card accent (localStorage) are stored by the app.
 */
export interface StudioSessionState {
  username: string;
  periodKind: PeriodKind;
  customStart: string;
  customEnd: string;
  result: StudioResultState | null;
  themeId: CardThemeId;
  showUsername: boolean;
  uploadedPhoto: string | null;
}

export const initialStudioSession: StudioSessionState = {
  username: '',
  periodKind: 'month',
  customStart: '',
  customEnd: '',
  result: null,
  themeId: DEFAULT_CARD_THEME_ID,
  showUsername: true,
  uploadedPhoto: null,
};

let current: StudioSessionState = { ...initialStudioSession };
type Listener = () => void;
const listeners = new Set<Listener>();

export function getStudioSession(): StudioSessionState {
  return current;
}

export function subscribeToStudioSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setStudioSession(
  next:
    | StudioSessionState
    | ((previous: StudioSessionState) => StudioSessionState),
): void {
  current = typeof next === 'function' ? next(current) : next;
  listeners.forEach((listener) => listener());
}

export function patchStudioSession(patch: Partial<StudioSessionState>): void {
  setStudioSession((previous) => ({ ...previous, ...patch }));
}

export function resetStudioSession(): void {
  setStudioSession({ ...initialStudioSession });
}
