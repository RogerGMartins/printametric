// Hash routing without decoding or echoing untrusted input. No browser access at import.
import { validatePreference } from './state.ts';
import type { ValidationResult, View } from './state.ts';

export const NAVIGATION_NOTICE = 'This view is not available. Showing Design.';
export const VIEW_TITLES: Readonly<Record<View, string>> = {
  design: 'Design · Printametric',
  'print-layout': 'Print layout · Printametric',
  assembly: 'Assembly · Printametric',
};

export interface NavigationResolution {
  readonly view: View;
  readonly replaceHash?: '#design';
  readonly notice?: string;
}

export function resolveHash(hash: string): NavigationResolution {
  switch (hash) {
    case '':
    case '#':
    case '#design': return { view: 'design' };
    case '#print-layout': return { view: 'print-layout' };
    case '#assembly': return { view: 'assembly' };
    default: return { view: 'design', replaceHash: '#design', notice: NAVIGATION_NOTICE };
  }
}

export interface NavigationUpdate extends NavigationResolution {
  readonly focusHeading: boolean;
  readonly closePanel: boolean;
}

type NavigationBrowser = Pick<Window, 'location' | 'history' | 'addEventListener' | 'removeEventListener'>;

export function createNavigationAdapter(browser: NavigationBrowser) {
  function read(initial = false): NavigationUpdate {
    const resolution = resolveHash(browser.location.hash);
    if (resolution.replaceHash) {
      browser.history.replaceState(browser.history.state, '', resolution.replaceHash);
    }
    return { ...resolution, focusHeading: !initial, closePanel: !initial };
  }

  function navigate(value: unknown): ValidationResult<NavigationUpdate> {
    const result = validatePreference('view', value);
    if (!result.ok) return result;
    // pushState does not emit hashchange. The caller applies this update directly.
    // The empty hash already denotes Design and must not gain a duplicate entry.
    const current = resolveHash(browser.location.hash);
    if (current.replaceHash) read();
    if (current.view !== result.value) {
      browser.history.pushState(browser.history.state, '', `#${result.value}`);
    }
    return { ok: true, value: { view: result.value, focusHeading: true, closePanel: true } };
  }

  function subscribe(onNavigation: (update: NavigationUpdate) => void): () => void {
    // Hash-changing history traversal emits hashchange too. Listening only here
    // avoids applying Back/Forward twice through both popstate and hashchange.
    const listener = () => onNavigation(read());
    browser.addEventListener('hashchange', listener);
    return () => browser.removeEventListener('hashchange', listener);
  }

  return { read, navigate, subscribe };
}
