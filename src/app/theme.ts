// Storage and system-theme effects are explicit and injectable; no import-time reads.
import { validatePreference } from './state.ts';
import type { StorageNotice, ThemePreference } from './state.ts';

export const THEME_STORAGE_KEY = 'printametric.foundation.theme.v1';
export const THEME_NOTICES = {
  invalid: 'The stored theme preference is invalid. Using System. Choose a theme to replace it.',
  'read-failed': 'The theme preference could not be read. Using System for this visit.',
  'write-failed': 'Theme applied for this visit, but it could not be remembered. Choose a theme again to retry.',
} as const;

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;
// Resolve localStorage inside try/catch: the property getter itself can throw.
type GetStorage = () => ThemeStorage;
export interface StoredTheme {
  readonly preference: ThemePreference;
  readonly status: 'missing' | 'stored' | 'invalid' | 'read-failed';
  readonly notice: StorageNotice;
}

export function readThemePreference(getStorage: GetStorage): StoredTheme {
  try {
    const stored = getStorage().getItem(THEME_STORAGE_KEY);
    if (stored === null) return { preference: 'system', status: 'missing', notice: null };
    // Check size before processing; stored values are exact strings, never JSON.
    if (stored.length <= 16) {
      const result = validatePreference('themePreference', stored);
      if (result.ok) return { preference: result.value, status: 'stored', notice: null };
    }
    return { preference: 'system', status: 'invalid', notice: 'invalid' };
  } catch {
    return { preference: 'system', status: 'read-failed', notice: 'read-failed' };
  }
}

export type ThemeWriteResult =
  | { readonly ok: true; readonly notice: null }
  | { readonly ok: false; readonly reason: 'invalid'; readonly error: string }
  | { readonly ok: false; readonly reason: 'storage'; readonly notice: 'write-failed' };

// Call only after applying a valid explicit selection in memory, never in an Effect.
// Do not roll back that selection on failure or attempt to repair unrelated storage.
export function writeThemePreference(value: unknown, getStorage: GetStorage): ThemeWriteResult {
  const result = validatePreference('themePreference', value);
  if (!result.ok) return { ok: false, reason: 'invalid', error: result.error };
  try {
    getStorage().setItem(THEME_STORAGE_KEY, result.value);
    return { ok: true, notice: null };
  } catch {
    return { ok: false, reason: 'storage', notice: 'write-failed' };
  }
}

export type ColorScheme = 'light' | 'dark';
type SystemQuery = Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>;
type MatchMedia = (query: string) => SystemQuery;
const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readSystemScheme(matchMedia: MatchMedia): ColorScheme {
  try {
    return matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function effectiveScheme(preference: ThemePreference, systemScheme: ColorScheme): ColorScheme {
  return preference === 'system' ? systemScheme : preference;
}

// Mount for System only; cleanup before changing preference or remounting an Effect.
// Subscribe before reading to catch an OS change between bootstrap and mounting.
export function subscribeSystemScheme(
  preference: ThemePreference,
  matchMedia: MatchMedia,
  onScheme: (scheme: ColorScheme) => void,
): () => void {
  if (preference !== 'system') return () => {};
  let active = true;
  let query: SystemQuery;
  const listener = () => {
    if (active) onScheme(readSystemScheme(() => query));
  };
  try {
    query = matchMedia(DARK_QUERY);
    query.addEventListener('change', listener);
  } catch {
    onScheme('light');
    return () => {};
  }
  listener();
  return () => {
    if (!active) return;
    active = false;
    query.removeEventListener('change', listener);
  };
}

export function applyColorScheme(root: HTMLElement, scheme: ColorScheme): void {
  root.dataset.theme = scheme;
  root.style.colorScheme = scheme;
}
