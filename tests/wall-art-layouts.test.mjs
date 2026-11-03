// Generator-2 contracts, with v1 kept as an independent compatibility boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMETERS } from '../src/tools/wall-art/model/parameters.ts';
import { DEFAULT_PARAMETERS_V2, LAYOUTS, OUTLINES, NUMERIC_NAMES_V2, PARAMETER_NAMES_V2 } from '../src/tools/wall-art/model/parameters-v2.ts';
import { validateParametersV2, checkLayoutBudget, LIMITS_V2 } from '../src/tools/wall-art/model/validation-v2.ts';
import { validateDesignDefinition, definitionDigest } from '../src/tools/wall-art/model/definition.ts';
import { proposeUpgrade } from '../src/tools/wall-art/model/migrate-v1.ts';
import { parseDesign, serializeDesign, parseVersionedDesign, serializeVersionedDesign } from '../src/tools/wall-art/model/design-file.ts';
import { siteRandomWords, irregularSite } from '../src/tools/wall-art/model/random.ts';
import { layoutParameterCases } from './support/wall-art-layout-cases.mjs';
import { digitPolygons, ORIENTATION_ARROW, MINIMUM_GLYPH_HEIGHT } from '../src/tools/wall-art/geometry/glyphs.ts';

test('layout schema validates all numeric, enum and inactive fields before CAD', () => {
  const p = DEFAULT_PARAMETERS_V2;
  assert.deepEqual(Object.keys(layoutParameterCases).sort(), [...NUMERIC_NAMES_V2].sort());
  for (const [name, [normal, boundaries, invalid, edge]] of Object.entries(layoutParameterCases)) {
    for (const value of [normal, ...boundaries, edge]) assert.equal(validateParametersV2({ ...p, [name]: value })[name], value);
    for (const value of [...invalid, NaN, Infinity, -Infinity, '1', null, true]) assert.throws(() => validateParametersV2({ ...p, [name]: value }));
  }
  for (const outline of OUTLINES) for (const layout of LAYOUTS) for (const straightBoundary of [true, false]) {
    assert.equal(validateParametersV2({ ...p, outline, layout, straightBoundary }).layout, layout);
  }
  for (const name of ['straightBoundary', 'orientationMark']) {
    for (const value of [true, false]) assert.equal(validateParametersV2({ ...p, [name]: value })[name], value);
    for (const value of [0, 1, 'false', null]) assert.throws(() => validateParametersV2({ ...p, [name]: value }));
  }
  for (const name of PARAMETER_NAMES_V2) {
    const missing = { ...p }; delete missing[name]; assert.throws(() => validateParametersV2(missing));
  }
  assert.throws(() => validateParametersV2({ ...p, outline: 'circle' }));
  assert.throws(() => validateParametersV2({ ...p, layout: 'voronoi' }));
  assert.throws(() => validateParametersV2({ ...p, reliefHeight: 0, topRatio: NaN }));
  assert.throws(() => validateParametersV2({ ...p, engravingDepth: 0, orientationMark: 1 }));
  assert.throws(() => validateParametersV2({ ...p, get width() { throw Error('getter executed'); } }), /fields/);
  const counts = { parts: 4000, contourVertices: 100_000, cadOperations: 200_000, triangles: 2_000_000, memoryBytes: 2_000_000_000 };
  checkLayoutBudget(counts);
  for (const name of Object.keys(counts)) for (const value of [counts[name] + 1, -1, NaN, 1.5]) assert.throws(() => checkLayoutBudget({ ...counts, [name]: value }));
});

test('exact version pairs and explicit no-cut upgrade preserve old bytes and parameters', () => {
  const original = serializeDesign(DEFAULT_PARAMETERS), retained = original.slice();
  const v1 = parseVersionedDesign(original);
  assert.equal(v1.generatorVersion, 1);
  assert.deepEqual(serializeVersionedDesign(v1), original);
  assert.deepEqual(parseDesign(original), DEFAULT_PARAMETERS);
  const candidate = proposeUpgrade(v1.parameters);
  assert.equal(candidate.generatorVersion, 2);
  for (const [name, value] of Object.entries(DEFAULT_PARAMETERS)) assert.equal(candidate.parameters[name], value);
  assert.equal(candidate.parameters.engravingDepth, 0); assert.equal(candidate.parameters.orientationMark, false);
  assert.deepEqual(original, retained); assert.equal(v1.generatorVersion, 1);
  assert.deepEqual(parseVersionedDesign(serializeVersionedDesign(candidate)), candidate);
  assert.notEqual(definitionDigest(v1), definitionDigest(candidate));
  const v2 = { modelSchemaVersion: 2, generatorVersion: 2, parameters: DEFAULT_PARAMETERS_V2 };
  const bytes = serializeVersionedDesign(v2);
  assert.deepEqual(parseVersionedDesign(bytes), v2);
  assert.throws(() => parseDesign(bytes), /Only wall-art/);
  for (const pair of [[1, 2], [2, 1], [0, 0], [3, 3], ['2', 2]]) assert.throws(() => validateDesignDefinition({ ...v2, modelSchemaVersion: pair[0], generatorVersion: pair[1] }), /pairs/);
  for (const data of [new Uint8Array(LIMITS_V2.fileBytes + 1), new Uint8Array([255]), bytes.slice(0, -5)]) assert.throws(() => parseVersionedDesign(data));
  const envelope = JSON.parse(new TextDecoder().decode(bytes));
  for (const patch of [{ consent: true }, { formatVersion: 2 }, { parameters: { ...envelope.parameters, seed: 1 } }]) {
    assert.throws(() => parseVersionedDesign(new TextEncoder().encode(JSON.stringify({ ...envelope, ...patch }))));
  }
});

test('keyed random streams match frozen vectors and do not depend on site iteration order', () => {
  for (const [seed, expected] of [[1, [3194330800, 1565438069]], [5000, [3837443427, 2391406162]], [9999, [4253378167, 4224923447]]]) {
    assert.deepEqual(siteRandomWords(seed, 0, 0), expected);
    const before = irregularSite(seed, -2, 3, 50);
    for (let i = -10; i < 10; i++) for (let j = -10; j < 10; j++) {
      const [x, y] = irregularSite(seed, i, j, 50);
      assert.ok(Math.abs(x - (i + 0.5) * 50) <= 15);
      assert.ok(Math.abs(y - (j + 0.5) * 50) <= 15);
    }
    assert.deepEqual(irregularSite(seed, -2, 3, 50), before);
  }
  assert.throws(() => siteRandomWords(0, 0, 0)); assert.throws(() => siteRandomWords(1, 0.5, 0));
});

test('original glyph fixtures distinguish digits and preserve the minimum stroke and arrow direction', () => {
  const drawings = Array.from({ length: 10 }, (_, digit) => digitPolygons(digit));
  assert.equal(new Set(drawings.map(drawing => JSON.stringify(drawing))).size, 10);
  assert.equal(drawings[1].length, 2); assert.equal(drawings[8].length, 7);
  assert.notDeepEqual(drawings[6], drawings[9]);
  for (const drawing of drawings) for (const polygon of drawing) {
    const width = Math.max(...polygon.map(p => p[0])) - Math.min(...polygon.map(p => p[0]));
    const height = Math.max(...polygon.map(p => p[1])) - Math.min(...polygon.map(p => p[1]));
    assert.ok(Math.min(width, height) * MINIMUM_GLYPH_HEIGHT / 10 >= 0.8 - 1e-12);
    assert.ok(polygon.every(([x, y]) => x >= 0 && x <= 6 && y >= 0 && y <= 10));
  }
  assert.deepEqual(ORIENTATION_ARROW.filter(p => p[1] === 5), [[0, 5]]);
  assert.equal(Math.max(...ORIENTATION_ARROW.map(p => p[0])) - Math.min(...ORIENTATION_ARROW.map(p => p[0])), 4);
  assert.throws(() => digitPolygons(10)); assert.throws(() => digitPolygons(1.5));
});
