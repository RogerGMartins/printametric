// Presentation only: App owns validated preferences, OS following, and persistence.
import { useRef } from 'react';
import type { ThemePreference } from './state';
import type { ColorScheme } from './theme';

interface ThemeControlProps {
  readonly preference: ThemePreference;
  readonly scheme: ColorScheme;
  readonly description?: string | undefined;
  readonly invalid: boolean;
  readonly onChange: (value: ThemePreference) => void;
}

export function ThemeControl({ preference, scheme, description, invalid, onChange }: ThemeControlProps) {
  const toggle = useRef<HTMLButtonElement>(null);
  return <div className="theme-control">
    <button ref={toggle} className="theme-toggle" type="button"
      aria-label={`Switch to ${scheme === 'dark' ? 'light' : 'dark'} theme`}
      aria-describedby={['theme-mode', description].filter(Boolean).join(' ')} aria-invalid={invalid}
      onClick={() => onChange(scheme === 'dark' ? 'light' : 'dark')}>
      <svg className={scheme === 'light' ? 'selected-icon' : undefined} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
      <svg className={scheme === 'dark' ? 'selected-icon' : undefined} viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14A8.7 8.7 0 0 1 10 3.5 8.7 8.7 0 1 0 20.5 14Z"/></svg>
    </button>
    <span id="theme-mode" role="status">{scheme === 'dark' ? 'Dark' : 'Light'} · {preference === 'system' ? 'System' : 'Manual'}</span>
    {preference !== 'system' && <button className="use-system" type="button" onClick={() => {
      onChange('system');
      toggle.current?.focus();
    }}>Use system</button>}
  </div>;
}
