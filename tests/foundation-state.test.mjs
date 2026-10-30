import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFoundationState, SETTING_ERROR, transitionFoundation, validatePreference } from '../src/app/state.ts';
import { createNavigationAdapter, NAVIGATION_NOTICE, resolveHash, VIEW_TITLES } from '../src/app/navigation.ts';
import {
  applyColorScheme, effectiveScheme, readSystemScheme, readThemePreference,
  subscribeSystemScheme, THEME_NOTICES, THEME_STORAGE_KEY, writeThemePreference,
} from '../src/app/theme.ts';

const acceptedValues = {
  view: ['design', 'print-layout', 'assembly'],
  themePreference: ['system', 'light', 'dark'],
  supportPanel: ['none', 'help', 'about'],
  showWorkspaceTips: [true, false],
  previewBackground: ['plain', 'grid'],
  advancedOpen: [true, false],
};
const invalidValues = [undefined, null, '', 'unknown', 'TRUE', 0, 1, NaN, Infinity, [], {}, new Boolean(false)];
const update = (state, field, value) => transitionFoundation(state, { type: 'preference', field, value });

test('state defaults are fresh and page-session preferences reset on reload', () => {
  const initial = createFoundationState();
  assert.deepEqual(initial.preferences, {
    view: 'design', themePreference: 'system', supportPanel: 'none',
    showWorkspaceTips: true, previewBackground: 'plain', advancedOpen: false,
  });
  const edited = update(update(initial, 'previewBackground', 'grid'), 'showWorkspaceTips', false);
  assert.equal(edited.preferences.previewBackground, 'grid');
  assert.deepEqual(createFoundationState(), initial);
  assert.notEqual(createFoundationState().fieldErrors, initial.fieldErrors);
});

for (const [field, values] of Object.entries(acceptedValues)) {
  test(`state validates ${field} without coercion and preserves the last valid value`, () => {
    let state = createFoundationState();
    for (const value of values) {
      assert.deepEqual(validatePreference(field, value), { ok: true, value });
      state = update(state, field, value);
      assert.equal(state.preferences[field], value);
    }
    const valid = state;
    const otherFieldValues = Object.values(acceptedValues).flat().filter((value) => !values.includes(value));
    for (const value of [...invalidValues, 'false', ...otherFieldValues]) {
      const rejected = update(valid, field, value);
      assert.equal(rejected.preferences, valid.preferences);
      assert.equal(rejected.fieldErrors[field], SETTING_ERROR);
      assert.deepEqual(valid.fieldErrors, {});
    }
    const recovered = update(update(valid, field, null), field, values[0]);
    assert.equal(recovered.fieldErrors[field], undefined);
    assert.equal(recovered.preferences[field], values[0]);
  });
}

test('state keeps collapsed errors, independent notices, and settings through navigation', () => {
  let state = update(createFoundationState(), 'previewBackground', 'grid');
  state = update(state, 'previewBackground', 'not-a-background');
  state = update(state, 'themePreference', 'not-a-theme');
  state = transitionFoundation(state, { type: 'storage-notice', notice: 'write-failed' });
  state = update(state, 'advancedOpen', true);
  state = update(state, 'advancedOpen', false);
  state = update(state, 'showWorkspaceTips', false);
  state = update(state, 'supportPanel', 'help');
  const navigated = transitionFoundation(state, {
    type: 'navigation', view: 'assembly', notice: NAVIGATION_NOTICE, closePanel: true,
  });
  assert.equal(navigated.preferences.supportPanel, 'none');
  assert.equal(navigated.preferences.previewBackground, 'grid');
  assert.equal(navigated.preferences.showWorkspaceTips, false);
  assert.equal(navigated.fieldErrors.previewBackground, SETTING_ERROR);
  assert.equal(navigated.fieldErrors.themePreference, SETTING_ERROR);
  const recovered = update(navigated, 'previewBackground', 'plain');
  assert.equal(recovered.fieldErrors.previewBackground, undefined);
  assert.equal(recovered.fieldErrors.themePreference, SETTING_ERROR);
  assert.equal(recovered.storageNotice, 'write-failed');
  assert.equal(recovered.navigationNotice, NAVIGATION_NOTICE);
  const validNavigation = transitionFoundation(recovered, {
    type: 'navigation', view: 'design', notice: null, closePanel: true,
  });
  assert.equal(validNavigation.navigationNotice, null);
  assert.equal(validNavigation.storageNotice, 'write-failed');
  assert.equal(transitionFoundation(state, {
    type: 'navigation', view: 'bad', notice: null, closePanel: true,
  }).preferences, state.preferences);
});

test('hash resolution accepts only known routes and never reflects malformed input', () => {
  for (const [hash, view] of [['', 'design'], ['#', 'design'], ['#design', 'design'], ['#print-layout', 'print-layout'], ['#assembly', 'assembly']]) {
    assert.deepEqual(resolveHash(hash), { view });
  }
  for (const hash of ['#unknown', '#DESIGN', '#design/', '#%64esign', '#%', '#%E0%A4%A', '#<script>alert(1)</script>', '#' + 'x'.repeat(100_000)]) {
    assert.deepEqual(resolveHash(hash), { view: 'design', replaceHash: '#design', notice: NAVIGATION_NOTICE });
  }
  assert.deepEqual(VIEW_TITLES, {
    design: 'Design · Printametric', 'print-layout': 'Print layout · Printametric', assembly: 'Assembly · Printametric',
  });
});

// Minimal browser doubles record external effects, not copies of routing logic.
function navigationBrowser(hash = '') {
  const target = new EventTarget();
  const writes = [];
  const location = { hash };
  const history = { state: { sentinel: true } };
  for (const method of ['pushState', 'replaceState']) {
    history[method] = (state, unused, nextHash) => {
      writes.push({ method, state, hash: nextHash });
      location.hash = nextHash;
    };
  }
  return {
    location, history, writes,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    emit: () => target.dispatchEvent(new Event('hashchange')),
  };
}

test('navigation repairs entry with replacement, avoids active-link history, and clears recovery', () => {
  const browser = navigationBrowser('#bad');
  const adapter = createNavigationAdapter(browser);
  assert.equal(browser.writes.length, 0);
  const initial = adapter.read(true);
  assert.equal(initial.notice, NAVIGATION_NOTICE);
  assert.equal(initial.focusHeading, false);
  assert.equal(initial.closePanel, false);
  assert.deepEqual(browser.writes, [{ method: 'replaceState', state: browser.history.state, hash: '#design' }]);
  const repeated = adapter.read(true);
  assert.equal(repeated.focusHeading, false);
  assert.equal(browser.writes.length, 1);
  const same = adapter.navigate('design');
  assert.equal(same.ok, true);
  assert.equal(same.value.notice, undefined);
  assert.equal(browser.writes.length, 1);
  const next = adapter.navigate('print-layout');
  assert.equal(next.value.focusHeading, true);
  assert.equal(next.value.closePanel, true);
  assert.equal(browser.writes.at(-1).method, 'pushState');
  assert.equal(browser.location.hash, '#print-layout');
  adapter.navigate('print-layout');
  assert.equal(browser.writes.length, 2);
  assert.equal(adapter.navigate('<bad>').ok, false);
  assert.equal(browser.writes.length, 2);
  const empty = navigationBrowser();
  createNavigationAdapter(empty).navigate('design');
  assert.equal(empty.writes.length, 0);
});

test('navigation subscription handles history recovery and setup/cleanup without duplicate callbacks', () => {
  const browser = navigationBrowser('#assembly');
  const adapter = createNavigationAdapter(browser);
  const updates = [];
  const firstCleanup = adapter.subscribe((next) => updates.push(next));
  firstCleanup();
  firstCleanup();
  const cleanup = adapter.subscribe((next) => updates.push(next));
  browser.location.hash = '#print-layout';
  browser.emit();
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], { view: 'print-layout', focusHeading: true, closePanel: true });
  browser.location.hash = '#malformed';
  browser.emit();
  assert.equal(updates.at(-1).notice, NAVIGATION_NOTICE);
  assert.equal(browser.writes.at(-1).method, 'replaceState');
  browser.location.hash = '#assembly';
  browser.emit();
  assert.equal(updates.at(-1).notice, undefined);
  cleanup();
  browser.emit();
  assert.equal(updates.length, 3);
});

function themeStorage(initial) {
  const bytes = new Map([['unrelated-design', 'untouched']]);
  if (initial !== undefined) bytes.set(THEME_STORAGE_KEY, initial);
  const calls = [];
  const storage = {
    getItem(key) { calls.push(['read', key]); return bytes.get(key) ?? null; },
    setItem(key, value) { calls.push(['write', key, value]); bytes.set(key, value); },
  };
  return { bytes, calls, storage, getStorage: () => storage };
}

test('theme storage reads one exact key, validates bounds, and preserves corrupt bytes', () => {
  const missing = themeStorage();
  assert.deepEqual(readThemePreference(missing.getStorage), { preference: 'system', status: 'missing', notice: null });
  assert.deepEqual(missing.calls, [['read', THEME_STORAGE_KEY]]);
  for (const preference of ['system', 'light', 'dark']) {
    assert.deepEqual(readThemePreference(themeStorage(preference).getStorage), { preference, status: 'stored', notice: null });
  }
  for (const bytes of ['', 'Dark', ' dark ', '"dark"', '{"theme":"dark"}', 'x'.repeat(16), 'x'.repeat(17), 'x'.repeat(100_000)]) {
    const store = themeStorage(bytes);
    assert.deepEqual(readThemePreference(store.getStorage), { preference: 'system', status: 'invalid', notice: 'invalid' });
    assert.equal(store.bytes.get(THEME_STORAGE_KEY), bytes);
    assert.deepEqual(store.calls, [['read', THEME_STORAGE_KEY]]);
    assert.deepEqual(writeThemePreference('dark', store.getStorage), { ok: true, notice: null });
    assert.equal(store.bytes.get(THEME_STORAGE_KEY), 'dark');
    assert.equal(store.bytes.get('unrelated-design'), 'untouched');
  }
});

test('theme storage catches property access and method failures without discarding in-memory choices', () => {
  const denied = () => { throw new Error('storage denied'); };
  const readDenied = () => ({ getItem: denied });
  for (const getStorage of [denied, readDenied]) {
    assert.deepEqual(readThemePreference(getStorage), { preference: 'system', status: 'read-failed', notice: 'read-failed' });
  }
  const store = themeStorage('light');
  let state = update(createFoundationState(), 'themePreference', 'light');
  assert.equal(writeThemePreference('light', store.getStorage).ok, true);
  const writeDenied = () => ({ ...store.storage, setItem: denied });
  for (const getStorage of [denied, writeDenied]) {
    state = update(state, 'themePreference', 'dark');
    const result = writeThemePreference(state.preferences.themePreference, getStorage);
    assert.deepEqual(result, { ok: false, reason: 'storage', notice: 'write-failed' });
    state = transitionFoundation(state, { type: 'storage-notice', notice: result.notice });
    assert.equal(state.preferences.themePreference, 'dark');
    assert.equal(store.bytes.get(THEME_STORAGE_KEY), 'light');
  }
  const recovered = writeThemePreference('dark', store.getStorage);
  state = transitionFoundation(state, { type: 'storage-notice', notice: recovered.notice });
  assert.equal(state.storageNotice, null);
  assert.equal(readThemePreference(store.getStorage).preference, 'dark');
  assert.equal(store.bytes.get('unrelated-design'), 'untouched');
  let accessed = false;
  for (const value of invalidValues) {
    const result = writeThemePreference(value, () => { accessed = true; return store.storage; });
    assert.equal(result.reason, 'invalid');
  }
  assert.equal(accessed, false);
  assert.equal(THEME_NOTICES['write-failed'], 'Theme applied for this visit, but it could not be remembered. Choose a theme again to retry.');
});

function systemMedia(dark) {
  const target = new EventTarget();
  let listeners = 0;
  const query = {
    matches: dark,
    addEventListener(type, listener) { listeners++; target.addEventListener(type, listener); },
    removeEventListener(type, listener) { listeners--; target.removeEventListener(type, listener); },
  };
  return {
    matchMedia: (text) => { assert.equal(text, '(prefers-color-scheme: dark)'); return query; },
    change: (dark) => { query.matches = dark; target.dispatchEvent(new Event('change')); },
    listenerCount: () => listeners,
  };
}

test('system theme follows OS only in System mode and cleans up across remounts', () => {
  const media = systemMedia(false);
  assert.equal(readSystemScheme(media.matchMedia), 'light');
  const schemes = [];
  const firstCleanup = subscribeSystemScheme('system', media.matchMedia, (scheme) => schemes.push(scheme));
  assert.deepEqual(schemes, ['light']);
  media.change(true);
  assert.equal(schemes.at(-1), 'dark');
  firstCleanup();
  firstCleanup();
  assert.equal(media.listenerCount(), 0);
  const cleanup = subscribeSystemScheme('system', media.matchMedia, (scheme) => schemes.push(scheme));
  assert.equal(media.listenerCount(), 1);
  media.change(false);
  assert.deepEqual(schemes, ['light', 'dark', 'dark', 'light']);
  cleanup();
  media.change(true);
  assert.equal(schemes.length, 4);
  for (const preference of ['light', 'dark']) {
    const stop = subscribeSystemScheme(preference, () => { throw new Error('must not subscribe'); }, () => assert.fail('explicit theme must ignore OS'));
    stop();
    assert.equal(effectiveScheme(preference, 'light'), preference);
    assert.equal(effectiveScheme(preference, 'dark'), preference);
  }
  assert.equal(effectiveScheme('system', 'dark'), 'dark');
  assert.equal(effectiveScheme('system', 'light'), 'light');
});

test('system theme falls back to Light when media APIs are unavailable', () => {
  const unavailable = () => { throw new Error('media unavailable'); };
  assert.equal(readSystemScheme(unavailable), 'light');
  const schemes = [];
  subscribeSystemScheme('system', unavailable, (scheme) => schemes.push(scheme))();
  assert.deepEqual(schemes, ['light']);
  const noEvents = () => ({ matches: true, addEventListener: unavailable });
  subscribeSystemScheme('system', noEvents, (scheme) => schemes.push(scheme))();
  assert.deepEqual(schemes, ['light', 'light']);
  const unreadable = () => ({
    get matches() { throw new Error('scheme unreadable'); },
    addEventListener() {}, removeEventListener() {},
  });
  assert.equal(readSystemScheme(unreadable), 'light');
  subscribeSystemScheme('system', unreadable, (scheme) => schemes.push(scheme))();
  assert.deepEqual(schemes, ['light', 'light', 'light']);
});

test('theme application updates root tokens and native-control scheme without storage', () => {
  const root = { dataset: { unrelated: 'keep' }, style: { colorScheme: '' } };
  applyColorScheme(root, 'dark');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(root.style.colorScheme, 'dark');
  applyColorScheme(root, 'light');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(root.style.colorScheme, 'light');
  assert.equal(root.dataset.unrelated, 'keep');
});
