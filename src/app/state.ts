// Pure foundation state: rejected operations preserve values and expose field errors.
import type { WorkspaceDisplayPreferences } from '../shared/workspace/types.ts';

export type View = 'design' | 'print-layout' | 'assembly';
export type ThemePreference = 'system' | 'light' | 'dark';
export type SupportPanel = 'none' | 'help' | 'about';
export type StorageNotice = 'invalid' | 'read-failed' | 'write-failed' | null;

export interface Preferences extends WorkspaceDisplayPreferences {
  readonly view: View;
  readonly themePreference: ThemePreference;
  readonly supportPanel: SupportPanel;
}

export type PreferenceField = keyof Preferences;
export const SETTING_ERROR = 'This setting could not be applied. The previous value is unchanged.';

export interface FoundationState {
  readonly preferences: Preferences;
  readonly fieldErrors: Readonly<Partial<Record<PreferenceField, string>>>;
  readonly navigationNotice: string | null;
  readonly storageNotice: StorageNotice;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

const validators: { [K in PreferenceField]: (value: unknown) => value is Preferences[K] } = {
  view: (value): value is View => value === 'design' || value === 'print-layout' || value === 'assembly',
  themePreference: (value): value is ThemePreference => value === 'system' || value === 'light' || value === 'dark',
  supportPanel: (value): value is SupportPanel => value === 'none' || value === 'help' || value === 'about',
  showWorkspaceTips: (value): value is boolean => typeof value === 'boolean',
  advancedOpen: (value): value is boolean => typeof value === 'boolean',
  previewBackground: (value): value is Preferences['previewBackground'] => value === 'plain' || value === 'grid',
};

export function validatePreference<K extends PreferenceField>(field: K, value: unknown): ValidationResult<Preferences[K]> {
  return validators[field](value) ? { ok: true, value } : { ok: false, error: SETTING_ERROR };
}

export function createFoundationState(): FoundationState {
  return {
    preferences: {
      view: 'design', themePreference: 'system', supportPanel: 'none',
      showWorkspaceTips: true, previewBackground: 'plain', advancedOpen: false,
    },
    fieldErrors: {}, navigationNotice: null, storageNotice: null,
  };
}

export type FoundationAction =
  | { readonly type: 'preference'; readonly field: PreferenceField; readonly value: unknown }
  | { readonly type: 'navigation'; readonly view: View; readonly notice: string | null; readonly closePanel: boolean }
  | { readonly type: 'storage-notice'; readonly notice: StorageNotice };

export function transitionFoundation(state: FoundationState, action: FoundationAction): FoundationState {
  switch (action.type) {
    case 'preference': {
      const result = validatePreference(action.field, action.value);
      if (!result.ok) {
        return { ...state, fieldErrors: { ...state.fieldErrors, [action.field]: result.error } };
      }
      const fieldErrors = { ...state.fieldErrors };
      delete fieldErrors[action.field];
      return { ...state, preferences: { ...state.preferences, [action.field]: result.value }, fieldErrors };
    }
    case 'navigation': {
      // Navigation uses the same boundary as controls; other field errors stay visible.
      const next = transitionFoundation(state, { type: 'preference', field: 'view', value: action.view });
      if (next.fieldErrors.view) return next;
      return {
        ...next,
        preferences: { ...next.preferences, supportPanel: action.closePanel ? 'none' : next.preferences.supportPanel },
        navigationNotice: action.notice,
      };
    }
    case 'storage-notice':
      return { ...state, storageNotice: action.notice };
  }
}
