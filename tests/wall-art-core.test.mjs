// Core contract regressions: strict inputs, independent geometry oracles and file readers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMETERS as defaults, PARAMETER_NAMES, PARAMETER_RULES, parameterDigest } from '../src/tools/wall-art/model/parameters.ts';
import { validateParameters } from '../src/tools/wall-art/model/validation.ts';
import { checkPartCount, estimateDesign, LIMITS } from '../src/tools/wall-art/model/budget.ts';
import { parseDesign, serializeDesign } from '../src/tools/wall-art/model/design-file.ts';
import { generateModel } from '../src/tools/wall-art/geometry/generate.ts';
import { validateMesh, weldMesh } from '../src/shared/geometry/validate-mesh.ts';
import { validateSolid } from '../src/shared/geometry/kernel.ts';
import { serializeSTL } from '../src/shared/export/stl.ts';
import { serialize3MF } from '../src/shared/export/three-mf.ts';
import { serializeSTEP } from '../src/shared/export/step.ts';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { makeCylinder, makeBox, importSTEP, measureVolume } from 'replicad';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { unzipSync, strFromU8 } from 'fflate';
import initReader from 'occt-import-js';
import { parameterCases } from './support/wall-art-cases.mjs';

test('core validation: every parameter boundary, finite types, exact keys and synthetic budgets', () => {
  assert.deepEqual(validateParameters(defaults), defaults);
  for (const name of PARAMETER_NAMES) {
    const cases = parameterCases[name];
    for (const value of [cases.normal, ...cases.boundaries, cases.edge]) assert.equal(validateParameters({ ...defaults, [name]: value })[name], value);
    for (const value of cases.invalid) assert.throws(() => validateParameters({ ...defaults, [name]: value }));
    const { min, max } = PARAMETER_RULES[name];
    for (const value of [min, max]) assert.equal(validateParameters({ ...defaults, [name]: value })[name], value);
    for (const value of [NaN, Infinity, -Infinity, '50', null, min - 1, max + 1]) assert.throws(() => validateParameters({ ...defaults, [name]: value }));
    const missing = { ...defaults }; delete missing[name]; assert.throws(() => validateParameters(missing));
  }
  assert.throws(() => validateParameters({ ...defaults, seed: 1.5 }));
  assert.equal(validateParameters({ ...defaults, width: 499.123 }).width, 499.123);
  assert.throws(() => validateParameters({ ...defaults, unsupported: true }));
  assert.throws(() => validateParameters({ ...defaults, get width() { throw new Error('getter must not execute'); } }), /fields/);
  assert.equal(checkPartCount(8, 16), 128); assert.throws(() => checkPartCount(1, 129), /128-part/);
  assert.throws(() => validateParameters(defaults, 99), /99-part/);
  assert.throws(() => estimateDesign({ ...defaults, topRatio: 0.001 }), /1.2 mm/);
  assert.equal(estimateDesign({ ...defaults, width: 125 }).columns, 3);
});

test('editable JSON rejects versions, depth, bytes, types and unsafe keys', () => {
  const bytes = serializeDesign(defaults), envelope = JSON.parse(new TextDecoder().decode(bytes));
  assert.deepEqual(parseDesign(bytes), defaults);
  const encode = value => new TextEncoder().encode(JSON.stringify(value));
  for (const key of ['formatVersion', 'modelSchemaVersion', 'generatorVersion']) assert.throws(() => parseDesign(encode({ ...envelope, [key]: 2 })), /Only wall-art/);
  for (const value of [[], null, { ...envelope, extra: 1 }, { ...envelope, parameters: { ...envelope.parameters, width: '500' } }]) assert.throws(() => parseDesign(encode(value)));
  assert.throws(() => parseDesign(new Uint8Array(LIMITS.fileBytes + 1)), /1 MiB/);
  assert.throws(() => parseDesign(new Uint8Array([255])), /UTF-8/);
  assert.throws(() => parseDesign(encode({ nested: Array(20).fill(0).reduce(a => ({ a }), {}) })), /nesting/);
  assert.throws(() => parseDesign(new TextEncoder().encode('{"__proto__":{}}')), /unsupported/);
  assert.throws(() => parseDesign(bytes.slice(0, -3)), /complete/);
  const padded = new Uint8Array(LIMITS.fileBytes).fill(32); padded.set(bytes); assert.deepEqual(parseDesign(padded), defaults);
});

test('canonical CAD, deterministic boundaries, shared meshes and independent round trips', { timeout: 120_000 }, async t => {
  const kernel = await loadKernel();
  const first = generateModel(defaults, 1, kernel);
  try {
    assert.equal(first.result.parts.length, 100);
    assert.deepEqual(first.result.bounds, { min: [-248.75, -248.75, 0], max: [248.75, 248.75, 30] });
    assert.equal(first.result.parts[0].id, 'wa-g1-r0-c0');
    assert.equal(first.result.parts[99].id, 'wa-g1-r9-c9');
    assert.deepEqual(first.result.parts[0].translation, [-225, 225, 0]);
    assert.ok(first.result.parts.every(p => p.volume > 0 && p.mesh.indices.length === 60));
    assert.ok(first.result.budget.wasmBytes + first.result.budget.meshBytes * 4 < LIMITS.memoryBytes);
    for (const seed of [1, 5000, 9999]) {
      const next = generateModel({ ...defaults, seed }, seed, kernel);
      try {
        assert.equal(next.result.digest, parameterDigest({ ...defaults, seed }));
        assert.deepEqual(next.result.parts, first.result.parts);
      } finally { next.dispose(); }
    }
    assert.throws(() => generateModel(defaults, 2, null, 99), /99-part/); // CAD-call sentinel
    for (const patch of [{ width: 80, height: 80, pitch: 200, reliefHeight: 0 }, { topRatio: 1, reliefHeight: 120, baseThickness: 40 }, { width: 499.123, height: 80, topRatio: 0.1 }]) {
      const model = generateModel({ ...defaults, ...patch }, 3, kernel);
      try { assert.equal(model.result.parts.length, estimateDesign(model.parameters).count); }
      finally { model.dispose(); }
    }
    const valid = first.result.parts[0].mesh;
    assert.throws(() => validateMesh({ ...valid, indices: valid.indices.slice(3) }), /open/);
    const reversed = valid.indices.slice(); [reversed[0], reversed[1]] = [reversed[1], reversed[0]];
    assert.throws(() => validateMesh({ ...valid, indices: reversed }), /wound/);
    const invalid = valid.positions.slice(); invalid[0] = NaN;
    assert.throws(() => validateMesh({ ...valid, positions: invalid }), /coordinates/);

    const stl = serializeSTL(first.result.parts), parsed = new STLLoader().parse(stl.buffer);
    try { parsed.computeBoundingBox(); assert.deepEqual(parsed.boundingBox.min.toArray(), [-248.75, -248.75, 0]); assert.deepEqual(parsed.boundingBox.max.toArray(), [248.75, 248.75, 30]); assert.equal(parsed.attributes.position.count / 3, first.result.budget.triangles); }
    finally { parsed.dispose(); }

    // Unequal nonzero placements, cylinder analytic surface and a 100 mm coupon.
    const solids = [makeCylinder(10, 25), makeBox([0, 0, 0], [100, 12, 8])];
    try {
      const parts = solids.map((solid, i) => { const raw = solid.mesh({ tolerance: LIMITS.chordTolerance, angularTolerance: LIMITS.angleRadians }); const mesh = weldMesh(raw.vertices, raw.triangles); const checked = validateMesh(mesh); return { id: `fixture-${i}`, mapNumber: i + 1, translation: i ? [137, -46, 9] : [-25, 41, 3], mesh, ...checked }; });
      const packageBytes = serialize3MF(parts), zip = unzipSync(packageBytes);
      assert.deepEqual(Object.keys(zip).sort(), ['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels'].sort());
      const xml = strFromU8(zip['3D/3dmodel.model']);
      assert.match(xml, /unit="millimeter"/); assert.equal((xml.match(/<object /g) ?? []).length, 2);
      assert.match(xml, /137 -46 9/); assert.match(xml, /-25 41 3/);
      const step = await serializeSTEP(parts, solids);
      const reimported = await importSTEP(new Blob([step]));
      try {
        const importedSolids = reimported.solids;
        try { assert.equal(importedSolids.length, 2); importedSolids.forEach(s => validateSolid(kernel, s)); }
        finally { importedSolids.forEach(s => s.delete()); }
        const faces = reimported.faces;
        try { assert.ok(faces.some(f => f.geomType === 'CYLINDRE' || f.geomType === 'CYLINDER'), faces.map(f => f.geomType).join(',')); }
        finally { faces.forEach(f => f.delete()); }
        assert.ok(Math.abs(measureVolume(reimported) - (Math.PI * 100 * 25 + 9600)) < 0.01);
      } finally { reimported.delete(); }
      const reader = await initReader();
      const imported = reader.ReadStepFile(step, { linearUnit: 'millimeter', linearDeflectionType: 'absolute_value', linearDeflection: 0.05, angularDeflection: LIMITS.angleRadians });
      assert.equal(imported.success, true); assert.equal(imported.meshes.length, 2);
      const coords = imported.meshes.flatMap(mesh => mesh.attributes.position.array);
      assert.ok(Math.abs(Math.max(...coords.filter((_, i) => i % 3 === 0)) - 237) < 0.01);
      t.diagnostic(`WASM capacity after geometry and exports: ${kernel.wasmMemory.buffer.byteLength}; default generation ${first.result.budget.elapsedMs.toFixed(1)} ms`);
    } finally { solids.forEach(s => s.delete()); }
  } finally { first.dispose(); }
});
