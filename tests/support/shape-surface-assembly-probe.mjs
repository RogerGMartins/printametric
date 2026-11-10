/** Small retained assemblies use final native solids, canonical meshes and exports. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parentPort } from 'node:worker_threads';
import { importSTEP, measureShapeVolumeProperties } from 'replicad';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { unzipSync, strFromU8 } from 'fflate';
import { loadKernel } from './wall-art-kernel.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../../src/tools/wall-art/model/parameters-v3.ts';
import { layoutParametersV3 } from '../../src/tools/wall-art/model/validation-v3.ts';
import { partitionLayout } from '../../src/tools/wall-art/geometry/layouts/partition.ts';
import { buildBoundarySurface } from './shape-surface-boundary-native.mjs';
import { identifyFootprintCandidate } from './shape-surface-identified-footprint.mjs';
import { qualifyFootprintAssembly } from './shape-surface-assembly.mjs';
import { nativeFootprintMoments } from './shape-surface-footprint-native.mjs';
import { createSurfaceField } from '../../src/tools/wall-art/geometry/surface-fields.ts';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { serializeSTEP } from '../../src/shared/export/step.ts';
import { streamSTL } from '../../src/shared/export/stream-stl.ts';
import { stream3MF } from '../../src/shared/export/stream-three-mf.ts';

const kernel = await loadKernel(), retained = [], rows = [];
const p = { ...DEFAULT_PARAMETERS_V3, width: 100, height: 100, outline: 'ellipse', layout: 'radial', straightBoundary: true,
  family: 'wave', stepBlend: 0, plinthEnabled: false, topRatio: .8, phase: .29, rotation: 37 };
const layout = partitionLayout(kernel, layoutParametersV3(p)), saved = structuredClone(layout.bases);
assert.equal(layout.bases.length, 7);
const digest = parts => {
  const hash = createHash('sha256');
  for (const part of parts) { hash.update(JSON.stringify([part.id, part.mapNumber, part.translation])); hash.update(part.mesh.positions); hash.update(part.mesh.indices); }
  return hash.digest('hex');
};
const closeBounds = (actual, expected) => {
  for (const side of ['min', 'max']) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(actual[side][axis] - expected[side][axis]) < .001,
    `${side}[${axis}]: ${actual[side][axis]} versus ${expected[side][axis]}`);
};
let accepted, acceptedDigest, acceptedSources;
try {
  for (const fixture of [{ minimumRelief: 20, depth: 3, status: 'engraved' }, { minimumRelief: 1.3, depth: .1, status: 'map-only' }]) {
    const parameters = { ...p, minimumRelief: fixture.minimumRelief, depth: fixture.depth }, candidates = [];
    for (const base of layout.bases) {
      const bare = buildBoundarySurface(kernel, parameters, { footprint: base });
      try { const identified = identifyFootprintCandidate(kernel, parameters, base, bare); candidates.push(identified); retained.push(identified); }
      finally { bare.solid.delete(); }
    }
    assert.ok(candidates.every(candidate => candidate.identification.status === fixture.status));
    const assembly = qualifyFootprintAssembly(kernel, candidates);
    if (fixture.status === 'map-only') {
      const index = candidates.findIndex(candidate => candidate.mapNumber === 4), base = layout.bases[index], radius = 23.75;
      assert.ok(Math.abs(base.area - Math.PI * radius ** 2) < 1e-7);
      const field = createSurfaceField(parameters), mean = nativeFootprintMoments(kernel, base, parameters, { ratio: p.topRatio });
      const boundaryMean = count => {
        let sum = 0;
        for (let i = 0; i < count; i++) { const angle = 2 * Math.PI * i / count;
          sum += field.evaluate(p.topRatio * radius * Math.cos(angle), p.topRatio * radius * Math.sin(angle)); }
        return sum / count;
      };
      const boundary = boundaryMean(2048); assert.ok(Math.abs(boundary - boundaryMean(1024)) < 1e-10);
      const r = p.topRatio, c = p.concavity, profileIntegral = r ** 2 + 2 * r * (1 - r) / (c + 1) + (1 - r) ** 2 / (2 * c + 1);
      const expectedVolume = base.area * (r ** 2 * (fixture.minimumRelief + fixture.depth * mean.mean) +
        (profileIntegral - r ** 2) * (fixture.minimumRelief + fixture.depth * boundary));
      const measured = assembly.meshes[index];
      assert.ok(Math.abs(measured.nativeVolume / expectedVolume - 1) < 1e-6 + fixture.depth * mean.error / fixture.minimumRelief);
      assert.ok(measured.tolerance <= .01);
      const coarse = measureShapeVolumeProperties(candidates[index].solid);
      try { assert.ok(Math.abs(coarse.volume / expectedVolume - 1) > .001, 'Retain the inaccurate non-adaptive reference regression.'); }
      finally { coarse.delete(); }
    }
    assert.ok(assembly.distances.length > 0, 'Curved overlapping XY boxes must reach native distance checks.');
    assert.ok(assembly.distances.every(pair => pair.distance >= .81));
    const parts = assembly.parts, expected = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const part of parts) for (let axis = 0; axis < 3; axis++) {
      expected.min[axis] = Math.min(expected.min[axis], part.bounds.min[axis] + part.translation[axis]);
      expected.max[axis] = Math.max(expected.max[axis], part.bounds.max[axis] + part.translation[axis]);
    }
    const nativeBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const candidate of candidates) {
      const box = candidate.solid.boundingBox;
      try {
        const [min, max] = box.bounds;
        for (let axis = 0; axis < 3; axis++) {
          nativeBounds.min[axis] = Math.min(nativeBounds.min[axis], min[axis] + candidate.translation[axis]);
          nativeBounds.max[axis] = Math.max(nativeBounds.max[axis], max[axis] + candidate.translation[axis]);
        }
      } finally { box.delete(); }
    }
    const step = await serializeSTEP(parts, candidates.map(candidate => candidate.solid));
    const restored = await importSTEP(new Blob([step]));
    try {
      const solids = restored.solids, properties = new kernel.GProp_GProps(), box = restored.boundingBox;
      try {
        assert.equal(solids.length, parts.length); solids.forEach(solid => validateSolid(kernel, solid));
        assert.ok(kernel.BRepGProp.VolumeProperties(restored.wrapped, properties, 1e-9, true, false) <= 1e-9);
        assert.ok(Math.abs(properties.Mass() / assembly.meshes.reduce((sum, m) => sum + m.nativeVolume, 0) - 1) < .00001);
        closeBounds({ min: box.bounds[0], max: box.bounds[1] }, nativeBounds);
      } finally { solids.forEach(solid => solid.delete()); properties.delete(); box.delete(); }
    } finally { restored.delete(); }
    const stlChunks = []; await streamSTL(parts, { async write(bytes) { stlChunks.push(bytes); } });
    const stl = new Uint8Array(await new Blob(stlChunks).arrayBuffer()), geometry = new STLLoader().parse(stl.buffer);
    try {
      geometry.computeBoundingBox(); closeBounds({ min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray() }, expected);
      assert.equal(geometry.attributes.position.count, assembly.triangles * 3);
    } finally { geometry.dispose(); }
    const zipChunks = []; await stream3MF(parts, { async write(bytes) { zipChunks.push(bytes); } });
    const threeMF = new Uint8Array(await new Blob(zipChunks).arrayBuffer()), xml = strFromU8(unzipSync(threeMF)['3D/3dmodel.model']);
    assert.match(xml, /unit="millimeter"/);
    const objects = [...xml.matchAll(/<object\b[^>]*>(.*?)<\/object>/gs)];
    assert.equal(objects.length, parts.length);
    for (const [index, part] of parts.entries()) {
      assert.ok(xml.includes(`transform="1 0 0 0 1 0 0 0 1 ${part.translation.join(' ')}"`));
      assert.deepEqual([...objects[index][1].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].flatMap(match => match.slice(1).map(Number)), [...part.mesh.positions]);
      assert.deepEqual([...objects[index][1].matchAll(/<triangle v1="([^"]+)" v2="([^"]+)" v3="([^"]+)"\/>/g)].flatMap(match => match.slice(1).map(Number)), [...part.mesh.indices]);
    }
    rows.push({ status: fixture.status, parts: parts.length, triangles: assembly.triangles, meshBytes: assembly.meshBytes,
      nativePairs: assembly.distances.length, minimumCheckedDistance: Math.min(...assembly.distances.map(pair => pair.distance)),
      stepBytes: step.length, stlBytes: stl.length, threeMFBytes: threeMF.length });
    if (!accepted) {
      accepted = assembly; acceptedDigest = digest(parts); acceptedSources = candidates.map(candidate => candidate.solid.serialize());
      const center = candidates.find(candidate => candidate.mapNumber === 4);
      const duplicate = { ...center, id: 'clearance-fixture', mapNumber: 4000 };
      for (const gap of [0, .8]) {
        const shift = gap === 0 ? 0 : 47.5 + gap;
        assert.throws(() => qualifyFootprintAssembly(kernel, [center, { ...duplicate, translation: [center.translation[0] + shift, center.translation[1], 0] }]), /0.81 mm solid clearance/);
      }
      assert.equal(qualifyFootprintAssembly(kernel, [center, { ...duplicate, translation: [center.translation[0] + 47.5 + .82, center.translation[1], 0] }]).parts.length, 2);
      assert.throws(() => buildBoundarySurface(kernel, { ...parameters, minimumRelief: .5, depth: .1 }, { footprint: layout.bases[0] }), /vertical material bounds/);
    }
    assert.deepEqual(layout.bases, saved); assert.equal(digest(accepted.parts), acceptedDigest);
    assert.deepEqual(retained.slice(0, 7).map(candidate => candidate.solid.serialize()), acceptedSources);
  }
  parentPort.postMessage(rows);
} finally { retained.reverse().forEach(candidate => candidate.solid.delete()); }
