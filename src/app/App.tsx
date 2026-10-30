// Compose shell state, browser lifecycles, and tool content. Shared UI only sends actions.
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { bootstrapFoundation } from './bootstrap';
import { FOUNDATION_FOOTER, WORKSPACE_VIEWS } from './content';
import { VIEW_TITLES } from './navigation';
import type { NavigationUpdate } from './navigation';
import { transitionFoundation, validatePreference } from './state';
import type { PreferenceField, View } from './state';
import { applyColorScheme, effectiveScheme, readSystemScheme, subscribeSystemScheme, THEME_NOTICES, writeThemePreference } from './theme';
import { Workspace } from '../shared/workspace/Workspace';
import { WALL_ART_CONTENT } from '../tools/wall-art/content';

type AppProps = ReturnType<typeof bootstrapFoundation>;
const matchMedia = (query: string) => window.matchMedia(query);

export function App({ initialState, initialSystemScheme, navigation }: AppProps) {
  const [state, dispatch] = useReducer(transitionFoundation, initialState);
  const [systemScheme, setSystemScheme] = useState(initialSystemScheme);
  const main = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const { preferences, fieldErrors, navigationNotice, storageNotice } = state;
  const scheme = effectiveScheme(preferences.themePreference, systemScheme);

  const applyNavigation = useCallback((update: NavigationUpdate) => {
    focusHeading.current = update.focusHeading;
    dispatch({ type: 'navigation', view: update.view, notice: update.notice ?? null, closePanel: update.closePanel });
  }, []);
  useEffect(() => navigation.subscribe(applyNavigation), [navigation, applyNavigation]);
  useEffect(() => subscribeSystemScheme(preferences.themePreference, matchMedia, setSystemScheme), [preferences.themePreference]);
  useLayoutEffect(() => applyColorScheme(document.documentElement, scheme), [scheme]);
  useLayoutEffect(() => { document.title = VIEW_TITLES[preferences.view]; }, [preferences.view]);
  // Consume each navigation request after commit, including clicks on the active view.
  // Initial rendering and unrelated settings never request heading focus.
  useLayoutEffect(() => {
    if (focusHeading.current) {
      focusHeading.current = false;
      heading.current?.focus();
    }
  });

  function changePreference(field: PreferenceField, value: unknown) {
    dispatch({ type: 'preference', field, value });
    if (field !== 'themePreference') return;
    const result = validatePreference('themePreference', value);
    if (!result.ok) return;
    // Refresh the OS snapshot on System selection; persistence is action-only.
    if (result.value === 'system') setSystemScheme(readSystemScheme(matchMedia));
    const write = writeThemePreference(result.value, () => window.localStorage);
    if (write.ok || write.reason === 'storage') dispatch({ type: 'storage-notice', notice: write.notice });
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>, view: View) {
    // Preserve ordinary browser open-in-new-tab/window behavior for modified clicks.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const result = navigation.navigate(view);
    if (result.ok) applyNavigation(result.value);
  }

  const themeDescription = [storageNotice ? 'theme-notice' : '', fieldErrors.themePreference ? 'theme-error' : ''].filter(Boolean).join(' ') || undefined;
  return (
    <>
      <a className="skip-link" href="#workspace" onClick={event => {
        event.preventDefault();
        main.current?.focus();
      }}>Skip to workspace</a>
      <div className="app-shell">
        <header className="app-header">
          <span className="brand">Printametric</span>
          <div className="header-actions">
            <label className="theme-control">Theme
              <select value={preferences.themePreference} aria-describedby={themeDescription}
                aria-invalid={Boolean(fieldErrors.themePreference)}
                onChange={event => changePreference('themePreference', event.currentTarget.value)}>
                <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
              </select>
            </label>
            <span className="support-pending">Help and About are not available yet.</span>
          </div>
        </header>
        <nav className="workspace-navigation" aria-label="Workspace views">
          {WORKSPACE_VIEWS.map(view => <a key={view.id} href={`#${view.id}`}
            aria-current={preferences.view === view.id ? 'page' : undefined}
            onClick={event => navigate(event, view.id)}>{view.label}</a>)}
        </nav>
        <main id="workspace" ref={main} tabIndex={-1}>
          <h1 ref={heading} tabIndex={-1}>{WORKSPACE_VIEWS.find(view => view.id === preferences.view)?.label}</h1>
          <div className="workspace-notices" role="status">
            {navigationNotice && <section className="notice"><h2>View notice</h2><p>{navigationNotice}</p></section>}
            {storageNotice && <section className="notice"><h2>Theme notice</h2><p id="theme-notice">{THEME_NOTICES[storageNotice]}</p>
              <button type="button" onClick={() => changePreference('themePreference', preferences.themePreference)}>Retry theme storage</button>
            </section>}
            {fieldErrors.themePreference && <section className="notice field-error"><h2>Error</h2><p id="theme-error">{fieldErrors.themePreference}</p></section>}
            {fieldErrors.view && <section className="notice field-error"><h2>Error</h2><p>{fieldErrors.view}</p></section>}
          </div>
          <Workspace content={WALL_ART_CONTENT[preferences.view]} preferences={preferences} errors={fieldErrors} onChange={changePreference} />
        </main>
        <footer className="app-footer">{FOUNDATION_FOOTER}</footer>
      </div>
    </>
  );
}
