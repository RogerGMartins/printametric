import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleSTEP } from './support/step-fragments.mjs';
const encode = text => new TextEncoder().encode(text);
const fixture = (data = "#1 = PRODUCT('part #2 O''Brien','', '',(#2));\n#2 = (LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));") => encode(`ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('fixture'),'2;1');\nFILE_NAME('fixture','',(''),(''),'','','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));\nENDSEC;\nDATA;\n${data}\nENDSEC;\nEND-ISO-10303-21;\n`);
const collect = async (fragments, options) => { let text = ''; const result = await assembleSTEP(fragments, { async write(bytes) { text += new TextDecoder().decode(bytes); } }, options); return { result, text }; };

test('STEP fragment remapping preserves quotes/comments and forward references', async () => {
  const { text, result } = await collect([fixture(), fixture("/* #999 stays a comment */ #1 = PRODUCT('part #2 O''Brien','', '',(#2));\n#2 = (LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));")]);
  assert.equal(result.entities, 4); assert.equal(result.fragments, 2);
  assert.match(text, /#3 = PRODUCT\('part #2 O''Brien','', '',\(#4\)\)/);
  assert.match(text, /\/\* #999 stays a comment \*\//);
  assert.equal((text.match(/HEADER;/g) ?? []).length, 1);
  assert.equal((text.match(/END-ISO-10303-21;/g) ?? []).length, 1);
});

test('STEP assembly fails closed on dangling/duplicate IDs, schema/units, truncation and output limits', async () => {
  const source = new TextDecoder().decode(fixture());
  for (const invalid of [source.replace('(#2)', '(#3)'), source.replace('#2 =', '#1 ='),
    source.replace('AUTOMOTIVE_DESIGN', 'OTHER_SCHEMA'), source.replace('.MILLI.', '$'),
    source.slice(0, -8), `${source}ANCHOR;`, source.replace("'part #2 O''Brien'", "'unclosed"),
    source.replace('#2 =', '/* open #2 ='), source.replace('#2 =', '#9007199254740992 ='),
    source.replace('(#2)', '(#2BAD)'), source.replace('(#2)', '(#0)'), source.replace('(#2)', '(?)'),
    source.replace('(#2)', '(1 2)'), source.replace('(#2)', '(BARE_IDENTIFIER)')]) {
    await assert.rejects(collect([encode(invalid)]));
  }
  await assert.rejects(collect([fixture()], { maxBytes: 8 }), /budget/);
  await assert.rejects(collect([]), /No native/);
  const abort = new AbortController(); let writes = 0;
  await assert.rejects(assembleSTEP([fixture(), fixture()], { async write() { if (++writes === 1) abort.abort(); } }, { signal: abort.signal }));
  assert.equal(writes, 1, 'cancel stops before the next write');
});
