import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrapFoundation } from '../src/app/bootstrap.ts';
import { NAVIGATION_NOTICE } from '../src/app/navigation.ts';
import { THEME_STORAGE_KEY } from '../src/app/theme.ts';
import { transitionFoundation } from '../src/app/state.ts';

test('bootstrap preserves recovery notices, reads theme once, and does not write or subscribe', () => {
  const calls = [];
  const browser = {
    location: { hash: '#<unknown>' },
    history: { state: { retained: true }, replaceState(state, title, hash) {
      calls.push(['replace', state, title, hash]);
      browser.location.hash = hash;
    } },
    localStorage: { getItem(key) { calls.push(['read', key]); return 'invalid'; } },
    matchMedia(query) { calls.push(['media', query]); return { matches: true }; },
    addEventListener() { assert.fail('bootstrap must not subscribe'); },
  };
  const result = bootstrapFoundation(browser);
  assert.equal(result.initialState.navigationNotice, NAVIGATION_NOTICE);
  assert.equal(result.initialState.storageNotice, 'invalid');
  assert.equal(result.initialState.preferences.themePreference, 'system');
  assert.equal(result.initialState.preferences.view, 'design');
  assert.equal(result.initialSystemScheme, 'dark');
  assert.deepEqual(calls, [
    ['replace', { retained: true }, '', '#design'],
    ['read', THEME_STORAGE_KEY], ['media', '(prefers-color-scheme: dark)'],
  ]);
});

test('bootstrap resets session settings while retaining a stored theme and direct route', () => {
  const browser = {
    location: { hash: '#assembly' },
    history: {},
    localStorage: { getItem() { return 'dark'; } },
    matchMedia() { return { matches: false }; },
  };
  const first = bootstrapFoundation(browser).initialState;
  const edited = transitionFoundation(first, { type: 'preference', field: 'previewBackground', value: 'grid' });
  assert.equal(edited.preferences.previewBackground, 'grid');
  const reloaded = bootstrapFoundation(browser).initialState;
  assert.equal(reloaded.preferences.previewBackground, 'plain');
  assert.equal(reloaded.preferences.advancedOpen, false);
  assert.equal(reloaded.preferences.showWorkspaceTips, true);
  assert.equal(reloaded.preferences.view, 'assembly');
  assert.equal(reloaded.preferences.themePreference, 'dark');
  assert.equal(reloaded.navigationNotice, null);
  assert.equal(reloaded.storageNotice, null);
});

test('bootstrap remains usable when browser preference APIs throw', () => {
  const result = bootstrapFoundation({
    location: { hash: '' }, history: {},
    get localStorage() { throw new Error('Denied'); },
    matchMedia() { throw new Error('Unavailable'); },
  });
  assert.equal(result.initialState.preferences.themePreference, 'system');
  assert.equal(result.initialState.storageNotice, 'read-failed');
  assert.equal(result.initialSystemScheme, 'light');
  assert.equal(result.initialState.preferences.view, 'design');
});
