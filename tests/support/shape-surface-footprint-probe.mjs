/** One native heap per outline: bounded native flat-top layout coverage. */
import { parentPort, workerData } from 'node:worker_threads';
import { deserializeShape, measureShapeSurfaceProperties } from 'replicad';
import { loadKernel } from './wall-art-kernel.mjs';
import { buildFlatFootprint } from './shape-surface-footprint-native.mjs';
import { meshBoundarySurface } from './shape-surface-boundary-mesh.mjs';
import { partitionLayout } from '../../src/tools/wall-art/geometry/layouts/partition.ts';
import { DEFAULT_PARAMETERS_V2, LAYOUTS } from '../../src/tools/wall-art/model/parameters-v2.ts';
import { nativeBoolean, nativeTranslate, nativeScale } from '../../src/tools/wall-art/geometry/native-operations.ts';

const kernel = await loadKernel(), rows = [];
for (const layout of LAYOUTS) {
  const p = { ...DEFAULT_PARAMETERS_V2, outline: workerData.outline, layout, width: 160, height: 150, straightBoundary: true };
  const result = partitionLayout(kernel, p);
  // Exercise both an interior-sized cell and a clipped boundary fragment, while
  // avoiding parts whose scaled top is known to violate the material minimum.
  const eligible = result.bases.filter(base => base.area >= 100 && base.span.lower >= 3.1).sort((a, b) => b.area - a.area);
  const selected = [...new Set([eligible[0], eligible.at(-1)])];
  if (!selected[0]) throw Error('Native layout has no diagnostic base.');
  for (const base of selected) {
  let candidate;
  try {
    const ratio = .4, concavity = 2.2, baseThickness = 10, topHeight = 40;
    candidate = buildFlatFootprint(kernel, base, { ratio, concavity, baseThickness, topHeight });
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
    rows.push({ layout, status: 'valid', area: base.area, poles: candidate.poles, triangles: mesh.mesh.indices.length / 3, volumeError: mesh.volumeError, maximumVertexAdjustmentMm: mesh.maximumVertexAdjustmentMm });
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
