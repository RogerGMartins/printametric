import assert from 'node:assert/strict';
import test from 'node:test';
import { check, definition } from '../scripts/check-scaffold.mjs';

test('repository definitions and workflow references are valid', async () => {
  await check();
});

test('definitions reject malformed metadata and empty prompts', () => {
  for (const text of ['no frontmatter', '---\nname: missing-description\n---\nBody',
    '---\ndescription: example\n---\n   ', '---\ndescription: [broken\n---\nBody']) {
    assert.throws(() => definition(text, 'fixture'));
  }
  assert.equal(definition('---\r\ndescription: Works\r\n---\r\nPrompt', 'fixture').description, 'Works');
});
