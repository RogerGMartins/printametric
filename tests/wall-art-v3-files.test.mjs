/** Version-3 file/migration contracts before native worker and editor integration. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMETERS, parameterDigest } from '../src/tools/wall-art/model/parameters.ts';
import { DEFAULT_PARAMETERS_V2, PARAMETER_NAMES_V2 } from '../src/tools/wall-art/model/parameters-v2.ts';
import { DEFAULT_PARAMETERS_V3, PARAMETER_NAMES_V3, NUMERIC_RULES_V3, SURFACE_FAMILIES } from '../src/tools/wall-art/model/parameters-v3.ts';
import { validateDesignDefinition, definitionDigest } from '../src/tools/wall-art/model/definition.ts';
import { parseDesign, parseVersionedDesign, serializeDesign, serializeVersionedDesign } from '../src/tools/wall-art/model/design-file.ts';
import { proposeUpgradeV3 } from '../src/tools/wall-art/model/migrate-v3.ts';
import { createSurfaceField } from '../src/tools/wall-art/geometry/surface-fields.ts';
import { GENERATOR_3_SPIRAL_CENTER } from '../src/tools/wall-art/geometry/spiral-center.ts';

const encode = value => new TextEncoder().encode(JSON.stringify(value));
const definition = (parameters = DEFAULT_PARAMETERS_V3) => ({ modelSchemaVersion: 3, generatorVersion: 3, parameters: { ...parameters } });
const envelope = () => JSON.parse(new TextDecoder().decode(serializeVersionedDesign(definition())));

test('v3 exact files retain every parameter and both seeds with stable serialization', () => {
  for (const family of SURFACE_FAMILIES) {
    const d = definition({ ...DEFAULT_PARAMETERS_V3, family, seed: 5000, surfaceSeed: 9999,
      depth: 0, plinthEnabled: false, planarTops: true, rotation: 360, phase: 1, concavity: 1.23456789 });
    const original = structuredClone(d), bytes = serializeVersionedDesign(d), json = JSON.parse(new TextDecoder().decode(bytes));
    assert.deepEqual(Object.keys(json), ['format', 'formatVersion', 'modelSchemaVersion', 'generatorVersion', 'seed', 'parameters']);
    assert.equal(json.seed, 5000); assert.equal(json.parameters.surfaceSeed, 9999); assert.ok(!Object.hasOwn(json.parameters, 'seed'));
    assert.deepEqual(Object.keys(json.parameters), PARAMETER_NAMES_V3.filter(name => name !== 'seed'));
    assert.deepEqual(parseVersionedDesign(bytes), d); assert.deepEqual(d, original);
    const reordered = definition(Object.fromEntries(Object.entries(d.parameters).reverse()));
    assert.deepEqual(serializeVersionedDesign(reordered), bytes);
    assert.equal(definitionDigest(reordered), definitionDigest(d));
    for (const name of PARAMETER_NAMES_V3) {
      const value = d.parameters[name];
      const changed = typeof value === 'boolean' ? !value : typeof value === 'number'
        ? (name === 'seed' || name === 'surfaceSeed' ? 1 : name === 'spiralArms' ? 6 : name === 'phase' ? .5 : name === 'rotation' ? 0 : value + (value === NUMERIC_RULES_V3[name].max ? -.000001 : .000001))
        : name === 'family' ? (family === 'wave' ? 'dunes' : 'wave') : name === 'layout' ? 'hexagonal' : 'ellipse';
      assert.notEqual(definitionDigest(definition({ ...d.parameters, [name]: changed })), definitionDigest(d), name);
    }
  }
  assert.equal(GENERATOR_3_SPIRAL_CENTER, 'smooth-c2');
  const p = { ...DEFAULT_PARAMETERS_V3, family: 'spiral', phase: .29 };
  assert.notEqual(createSurfaceField(p, GENERATOR_3_SPIRAL_CENTER).evaluate(.5, .5), createSurfaceField(p, 'linear').evaluate(.5, .5));
});

test('v3 file boundaries reject incomplete, inactive, malformed, mixed and excessive inputs', () => {
  const e = envelope();
  for (const key of Object.keys(e.parameters)) {
    const p = { ...e.parameters }; delete p[key];
    assert.throws(() => parseVersionedDesign(encode({ ...e, parameters: p })), { code: 'FIELDS' });
  }
  for (const extra of ['seed', 'reliefHeight', 'spiralCenter', 'nativeFace'])
    assert.throws(() => parseVersionedDesign(encode({ ...e, parameters: { ...e.parameters, [extra]: 1 } })), { code: 'FIELDS' });
  for (const [modelSchemaVersion, generatorVersion] of [[1, 3], [3, 1], [2, 3], [3, 2], [4, 4], ['3', '3']])
    assert.throws(() => parseVersionedDesign(encode({ ...e, modelSchemaVersion, generatorVersion })), { code: 'VERSION' });
  for (const bad of [NaN, Infinity, -Infinity, '1', null])
    assert.throws(() => validateDesignDefinition(definition({ ...DEFAULT_PARAMETERS_V3, family: 'dome', depth: 0, density: bad })), { code: 'PARAMETER' });
  for (const patch of [{ width: 2001 }, { height: 2001 }, { pitch: 49 }])
    assert.throws(() => parseVersionedDesign(encode({ ...e, parameters: { ...e.parameters, ...patch } })), { code: 'PARAMETER' });
  assert.throws(() => parseVersionedDesign(new Uint8Array(1024 ** 2 + 1)), { code: 'FILE_SIZE' });
  assert.throws(() => parseVersionedDesign(new Uint8Array([0xc3, 0x28])), { code: 'JSON' });
  assert.throws(() => parseVersionedDesign(new TextEncoder().encode('{')), { code: 'JSON' });
  assert.throws(() => parseVersionedDesign(new TextEncoder().encode('{"__proto__":{}}')), { code: 'UNSAFE_KEY' });
  let nested = 0; for (let i = 0; i < 18; i++) nested = { nested };
  assert.throws(() => parseVersionedDesign(encode(nested)), { code: 'DEPTH' });
  assert.throws(() => parseDesign(serializeVersionedDesign(definition())), { code: 'VERSION' });
});

test('old file bytes/digests remain exact and upgrades propose one minimal-change v3 definition', () => {
  const old = [
    { modelSchemaVersion: 1, generatorVersion: 1, parameters: { ...DEFAULT_PARAMETERS, seed: 5000 } },
    { modelSchemaVersion: 2, generatorVersion: 2, parameters: { ...DEFAULT_PARAMETERS_V2, seed: 5000, outline: 'arch', layout: 'irregular', straightBoundary: false } },
  ];
  for (const source of old) {
    const saved = structuredClone(source), bytes = serializeVersionedDesign(source), retained = bytes.slice();
    assert.deepEqual(parseVersionedDesign(bytes), source);
    const expected = source.generatorVersion === 1 ? serializeDesign(source.parameters) : encode({ format: 'printametric-wall-art', formatVersion: 1,
      modelSchemaVersion: 2, generatorVersion: 2, seed: source.parameters.seed, parameters: Object.fromEntries(Object.entries(source.parameters).filter(([key]) => key !== 'seed')) });
    if (source.generatorVersion === 1) assert.deepEqual(bytes, expected);
    else assert.deepEqual(JSON.parse(new TextDecoder().decode(bytes)), JSON.parse(new TextDecoder().decode(expected)));
    assert.equal(definitionDigest(source), source.generatorVersion === 1 ? parameterDigest(source.parameters)
      : `wa-2-2:${PARAMETER_NAMES_V2.map(name => source.parameters[name]).join(',')}`);
    const upgraded = proposeUpgradeV3(source);
    assert.equal(upgraded.generatorVersion, 3); assert.equal(upgraded.modelSchemaVersion, 3);
    for (const key of ['width', 'height', 'pitch', 'gap', 'topRatio', 'baseThickness', 'seed']) assert.equal(upgraded.parameters[key], source.parameters[key]);
    assert.equal(upgraded.parameters.minimumRelief, source.parameters.reliefHeight);
    assert.equal(upgraded.parameters.depth, 0); assert.equal(upgraded.parameters.concavity, 1); assert.equal(upgraded.parameters.plinthEnabled, true);
    assert.equal(upgraded.parameters.surfaceSeed, 1); assert.equal(upgraded.parameters.family, 'wave');
    if (source.generatorVersion === 1) {
      assert.equal(upgraded.parameters.layout, 'square'); assert.equal(upgraded.parameters.outline, 'rectangle');
      assert.equal(upgraded.parameters.engravingDepth, 0); assert.equal(upgraded.parameters.orientationMark, false);
    } else for (const key of ['outline', 'layout', 'straightBoundary', 'engravingDepth', 'numeralRatio', 'orientationMark']) assert.equal(upgraded.parameters[key], source.parameters[key]);
    assert.deepEqual(parseVersionedDesign(serializeVersionedDesign(upgraded)), upgraded);
    assert.deepEqual(source, saved); assert.deepEqual(bytes, retained);
  }
  assert.throws(() => proposeUpgradeV3(definition()), { code: 'VERSION' });
});
