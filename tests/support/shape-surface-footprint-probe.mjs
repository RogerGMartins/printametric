/** One native heap per outline: bounded native flat-top layout coverage. */
import { parentPort, workerData } from 'node:worker_threads';
import { deserializeShape, importSTEP, measureShapeSurfaceProperties, measureShapeVolumeProperties } from 'replicad';
import assert from 'node:assert/strict';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { validateMesh } from '../../src/shared/geometry/validate-mesh.ts';
import { serializeSTEP } from '../../src/shared/export/step.ts';
import { serializeSTL } from '../../src/shared/export/stl.ts';
import { loadKernel } from './wall-art-kernel.mjs';
import { buildFlatFootprint, buildPlanarFootprint, nativeFootprintMoments } from './shape-surface-footprint-native.mjs';
import { meshBoundarySurface } from './shape-surface-boundary-mesh.mjs';
import { partitionLayout } from '../../src/tools/wall-art/geometry/layouts/partition.ts';
import { DEFAULT_PARAMETERS_V2, LAYOUTS } from '../../src/tools/wall-art/model/parameters-v2.ts';
import { DEFAULT_PARAMETERS_V3 } from '../../src/tools/wall-art/model/parameters-v3.ts';
import { nativeBoolean, nativeTranslate, nativeScale } from '../../src/tools/wall-art/geometry/native-operations.ts';

const kernel = await loadKernel(), rows = [];
for (const layout of LAYOUTS) {
  const p = { ...DEFAULT_PARAMETERS_V2, outline: workerData.outline, layout, width: 160, height: 150, straightBoundary: true };
  const result = partitionLayout(kernel, p);
  // Exercise both an interior-sized cell and a clipped boundary fragment, while
  // avoiding parts whose scaled top is known to violate the material minimum.
  const eligible = result.bases.filter(base => base.area >= 100 && base.span.lower >= 3.1).sort((a, b) => b.area - a.area);
  const selected = workerData.planar ? [eligible[0]] : [...new Set([eligible[0], eligible.at(-1)])];
  if (!selected[0]) throw Error('Native layout has no diagnostic base.');
  for (const base of selected) {
  let candidate;
  try {
    // The flat matrix covers every field on every selected contour. Plane runs
    // exercise their own field rather than repeating that entire mean matrix.
    const families = workerData.planar ? [workerData.family ?? 'wave'] : ['wave', 'dunes', 'random', 'ring', 'ridges', 'dome'];
    const moments = families.map(family => nativeFootprintMoments(kernel, base,
      { ...DEFAULT_PARAMETERS_V3, family, rotation: 37, phase: .29, surfaceSeed: 5000, width: 160, height: 150 }));
    for (const m of moments) {
      if (m.error > .00025 / 30 || m.evaluations > 65536 || Math.abs(m.u) > m.error + 1e-7 || Math.abs(m.v) > m.error + 1e-7) throw Error('Native contour centroid/moment certificate failed.');
    }
    const ratio = workerData.planar ? .8 : .4, concavity = 2.2, baseThickness = 10;
    const plane = workerData.planar ? nativeFootprintMoments(kernel, base,
      { ...DEFAULT_PARAMETERS_V3, family: workerData.family ?? 'wave', rotation: 37, phase: .29, width: 160, height: 150 }, { ratio, plane: true }) : undefined;
    const topHeight = 30 + 30 * (plane ? plane.fitted.coefficients[0] : moments[0].mean);
    candidate = plane ? buildPlanarFootprint(kernel, base, { ratio, concavity, baseThickness,
      top: [topHeight, 30 * plane.fitted.coefficients[1] / plane.scale, 30 * plane.fitted.coefficients[2] / plane.scale] })
      : buildFlatFootprint(kernel, base, { ratio, concavity, baseThickness, topHeight });
    const properties = new kernel.GProp_GProps();
    let volume;
    try {
      // The convenience measurement uses non-adaptive integration. The closed
      // form comparison needs an explicitly tighter independent CAD integral.
      const error = kernel.BRepGProp.VolumeProperties(candidate.solid.wrapped, properties, 1e-9, true, false);
      if (!Number.isFinite(error) || error < 0 || error > 1e-8) throw Error('Native volume integration did not converge.');
      volume = properties.Mass();
    } finally { properties.delete(); }
    const expected = base.area * (baseThickness + (topHeight - baseThickness) * (ratio ** 2 + 2 * ratio * (1 - ratio) / (concavity + 1) + (1 - ratio) ** 2 / (2 * concavity + 1)));
    if (Math.abs(volume / expected - 1) > .00005) throw Error(`Native volume disagrees with the independent area integral: part=${base.id}, area=${base.area}, expected=${expected}, actual=${volume}.`);
    const mesh = meshBoundarySurface(candidate);
    let exportReaders;
    if (workerData.planar && workerData.outline === 'ellipse' && layout === 'radial') {
      const checked = validateMesh(mesh.mesh), part = { id: 'checkpoint-native-plane', mapNumber: 1,
        translation: [base.centroid[0], base.centroid[1], 7], mesh: mesh.mesh, ...checked };
      const bytes = await serializeSTEP([part], [candidate.solid]), restored = await importSTEP(new Blob([bytes]));
      try {
        validateSolid(kernel, restored);
        const properties = measureShapeVolumeProperties(restored);
        try { assert.ok(Math.abs(properties.volume / mesh.nativeVolume - 1) < .00001); } finally { properties.delete(); }
      } finally { restored.delete(); }
      const geometry = new STLLoader().parse(serializeSTL([part]).buffer);
      try {
        geometry.computeBoundingBox(); assert.equal(geometry.attributes.position.count, mesh.mesh.indices.length);
        for (const side of ['min', 'max']) geometry.boundingBox[side].toArray().forEach((value, axis) => {
          assert.ok(Math.abs(value - checked.bounds[side][axis] - part.translation[axis]) < .001);
        });
      } finally { geometry.dispose(); }
      exportReaders = ['native-step', 'independent-stl'];
    }
    rows.push({ layout, status: 'valid', area: base.area, poles: candidate.poles, triangles: mesh.mesh.indices.length / 3, volumeError: mesh.volumeError, maximumVertexAdjustmentMm: mesh.maximumVertexAdjustmentMm,
      fieldMeans: moments.map(m => m.mean), momentErrors: moments.map(m => m.error), momentEvaluations: moments.map(m => m.evaluations), planeError: plane?.fitted.error,
      planeCoefficients: plane?.fitted.coefficients, exportReaders });
  } catch (error) {
    if (!/centroid|containment|star-shaped/.test(error.message)) throw new Error(`${workerData.outline}/${layout}: ${error.message}`, { cause: error });
    // A few sampled native differences can disprove containment, never prove it.
    // Require a positive counterexample before classifying a rejected fixture as
    // expected. An inconclusive certificate is not relabelled a successful case.
    const original = deserializeShape(base.nativeFace), local = nativeTranslate(kernel, original, -base.centroid[0], -base.centroid[1], 0);
    let outsideArea = 0;
    try { for (const scale of [.4, .55, .7, .85]) {
      const section = nativeScale(kernel, local, scale), outside = nativeBoolean(kernel, 'cut', section, local);
      try { const properties = measureShapeSurfaceProperties(outside); try { outsideArea = Math.max(outsideArea, properties.area); } finally { properties.delete(); } }
      finally { outside.delete(); section.delete(); }
    } } finally { original.delete(); local.delete(); }
    if (!(outsideArea > 1e-6)) throw new Error(`${workerData.outline}/${layout}: containment certificate is inconclusive, not a proven invalid fixture.`, { cause: error });
    rows.push({ layout, status: 'rejected-protrusion', partId: base.id, outsideArea });
  }
  finally { candidate?.solid.delete(); }
  }
}
parentPort.postMessage(rows);
