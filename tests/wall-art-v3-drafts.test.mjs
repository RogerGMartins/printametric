import test from 'node:test';
import assert from 'node:assert/strict';
import { definitionDrafts, parseDefinitionDrafts } from '../src/tools/wall-art/editor/definition-drafts.ts';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';

test('percentage drafts retain exact imported ratios, decimal entries and inactive fields', () => {
  for (const topRatio of [.1,.12,.12345678901234567,.37000000000000005,1]) for (const stepBlend of [0,1e-16,.12345678901234567,1]) {
    const definition={modelSchemaVersion:3,generatorVersion:3,parameters:{...DEFAULT_PARAMETERS_V3,topRatio,stepBlend}};
    const drafts=definitionDrafts(definition);
    assert.deepEqual(parseDefinitionDrafts(drafts,3),definition);
    assert.equal(drafts.topRatio.startsWith('0'),false);
  }
  const defaults={modelSchemaVersion:3,generatorVersion:3,parameters:{...DEFAULT_PARAMETERS_V3}};
  const draft=definitionDrafts(defaults);assert.equal(draft.topRatio,'12');assert.equal(draft.stepBlend,'100');
  assert.equal(parseDefinitionDrafts({...draft,topRatio:'12.345',stepBlend:'0.00001'},3).parameters.topRatio,.12345);
  for(const value of ['', ' ', 'Infinity', 'abc','9.99','101'])assert.throws(()=>parseDefinitionDrafts({...draft,topRatio:value},3));
  assert.throws(()=>parseDefinitionDrafts({...draft,depth:'0',surfaceSeed:'1.5'},3),{code:'PARAMETER'});
});
