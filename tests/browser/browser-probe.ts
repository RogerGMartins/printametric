// Browser-only instrumentation installed before bootstrap, never bundled into the app.
import type { Page } from '@playwright/test';

export const themeKey = 'printametric.foundation.theme.v1';
export const sentinelKey = 'printametric.test.saved-design-sentinel';

declare global {
  interface Window {
    foundationProbe: {
      reads: string[];
      writes: [string, string][];
      denyWrite: boolean;
      navigationListeners: number;
      mediaListeners: number;
      mediaAdds: number;
      mediaRemoves: number;
    };
  }
}

export async function installBrowserProbe(page: Page, storedTheme: string | null = null) {
  await page.addInitScript(({ themeKey, sentinelKey, storedTheme }) => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem(sentinelKey, 'leave this design untouched');
    if (storedTheme !== null) localStorage.setItem(themeKey, storedTheme);
    const probe = window.foundationProbe = {
      reads: [] as string[], writes: [] as [string, string][], denyWrite: false,
      navigationListeners: 0, mediaListeners: 0, mediaAdds: 0, mediaRemoves: 0,
    };
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      probe.reads.push(key);
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      probe.writes.push([key, value]);
      if (probe.denyWrite) throw new DOMException('Test storage denial', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };

    // Track only app-owned subscriptions; React and Vite have unrelated listeners.
    const subscriptions = new Map<EventTarget, Set<EventListenerOrEventListenerObject>>();
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    function kind(target: EventTarget, type: string) {
      if (target === window && type === 'hashchange') return 'navigationListeners';
      if (target instanceof MediaQueryList && target.media === '(prefers-color-scheme: dark)' && type === 'change') return 'mediaListeners';
      return null;
    }
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      const field = kind(this, type);
      if (field && listener) {
        const listeners = subscriptions.get(this) ?? new Set<EventListenerOrEventListenerObject>();
        if (!listeners.has(listener)) probe[field]++;
        listeners.add(listener);
        subscriptions.set(this, listeners);
        if (field === 'mediaListeners') probe.mediaAdds++;
      }
      return add.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const field = kind(this, type);
      if (field && listener && subscriptions.get(this)?.delete(listener)) {
        probe[field]--;
        if (field === 'mediaListeners') probe.mediaRemoves++;
      }
      return remove.call(this, type, listener, options);
    };
  }, { themeKey, sentinelKey, storedTheme });
}
