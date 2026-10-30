// Read browser state once before React mounts, including StrictMode's render checks.
import { createNavigationAdapter } from './navigation.ts';
import { createFoundationState, transitionFoundation } from './state.ts';
import { readSystemScheme, readThemePreference } from './theme.ts';

type BootstrapBrowser = Pick<Window,
  'location' | 'history' | 'addEventListener' | 'removeEventListener' | 'localStorage' | 'matchMedia'>;

export function bootstrapFoundation(browser: BootstrapBrowser) {
  const navigation = createNavigationAdapter(browser);
  const route = navigation.read(true);
  const theme = readThemePreference(() => browser.localStorage);
  let initialState = transitionFoundation(createFoundationState(), {
    type: 'navigation', view: route.view, notice: route.notice ?? null, closePanel: false,
  });
  initialState = transitionFoundation(initialState, {
    type: 'preference', field: 'themePreference', value: theme.preference,
  });
  initialState = transitionFoundation(initialState, { type: 'storage-notice', notice: theme.notice });
  return {
    initialState,
    initialSystemScheme: readSystemScheme(query => browser.matchMedia(query)),
    navigation,
  };
}
