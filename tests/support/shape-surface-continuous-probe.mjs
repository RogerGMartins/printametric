/** One isolated native heap per outline. Independent field/contour volume checks
 * verify the curved cap and shared flank map, not only CAD/mesh self-consistency. */
import { parentPort, workerData } from 'node:worker_threads';
import assert from 'node:assert/strict';
import { importSTEP } from 'replicad';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { validateMesh } from '../../src/shared/geometry/validate-mesh.ts';
import { serializeSTEP } from '../../src/shared/export/step.ts';
import { serializeSTL } from '../../src/shared/export/stl.ts';
import { loadKernel } from './wall-art-kernel.mjs';
import { partitionLayout } from '../../src/tools/wall-art/geometry/layouts/partition.ts';
import { DEFAULT_PARAMETERS_V2, LAYOUTS } from '../../src/tools/wall-art/model/parameters-v2.ts';
import { DEFAULT_PARAMETERS_V3 } from '../../src/tools/wall-art/model/parameters-v3.ts';
import { createSurfaceField } from '../../src/tools/wall-art/geometry/surface-fields.ts';
import { contourPointAt } from '../../src/tools/wall-art/geometry/surface-contour-derivatives.ts';
import { buildBoundarySurface } from './shape-surface-boundary-native.mjs';
import { nativeFootprintMoments, prepareFootprint } from './shape-surface-footprint-native.mjs';
import { meshBoundarySurface } from './shape-surface-boundary-mesh.mjs';

const kernel = await loadKernel(), rows = [];
for (const layout of workerData.layout ? [workerData.layout] : LAYOUTS) {
  const p = { ...DEFAULT_PARAMETERS_V3, width: 160, height: 150, family: workerData.family ?? 'wave',
    stepBlend: workerData.blend ?? 0, topRatio: workerData.ratio ?? .8, concavity: 2.2, phase: .29, rotation: 37 };
  const partition = partitionLayout(kernel, { ...DEFAULT_PARAMETERS_V2, outline: workerData.outline, layout, width: 160, height: 150, straightBoundary: true });
  const base = partition.bases.filter(b => b.area >= 100 && b.span.lower >= 3.1).sort((a, b) => b.area - a.area)[0];
  const saved = structuredClone(base), resources = [], own = object => { resources.push(object); return object; };
  let candidate;
  try {
    candidate = buildBoundarySurface(kernel, p, { footprint: base, spiralCenter: 'smooth-c2', boundaryReduction: workerData.boundaryReduction ?? true });
    const mesh = meshBoundarySurface(candidate), anchor = candidate.translation.slice(0, 2);
    const field = createSurfaceField(p, 'smooth-c2');
    const prepared = prepareFootprint(kernel, { ...base, centroid: anchor }, own, true);
    const topMean = nativeFootprintMoments(kernel, base, p, { anchor, ratio: p.topRatio, spiralCenter: 'smooth-c2' });
    const baseMean = p.stepBlend ? nativeFootprintMoments(kernel, base, p, { anchor, spiralCenter: 'smooth-c2' }) : { mean: 0 };
    const boundary = count => {
      let area = 0, flux = 0;
      for (const span of prepared.spans) {
        const points = span.points.map(([x, y], i) => [(x - anchor[0]) * span.weights[i], (y - anchor[1]) * span.weights[i], span.weights[i]]);
        const n = points.length - 1, derivatives = points.slice(1).map((point, i) => point.map((v, axis) => n * (v - points[i][axis])));
        for (let i = 0; i < count; i++) {
          const t = (i + .5) / count, point = contourPointAt(points, t), d = contourPointAt(derivatives, t);
          const x = point[0] / point[2], y = point[1] / point[2];
          const measure = span.direction * (point[0] * d[1] - point[1] * d[0]) / point[2] ** 2 / count;
          const height = p.minimumRelief + p.depth * (p.stepBlend * baseMean.mean + (1 - p.stepBlend) * field.evaluate(anchor[0] + p.topRatio * x, anchor[1] + p.topRatio * y));
          area += measure / 2; flux += height * measure;
        }
      }
      return { area: Math.abs(area), flux: flux * Math.sign(area) };
    };
    const a = boundary(256), b = boundary(512), c = boundary(1024);
    const flux = (4 * c.flux - b.flux) / 3, earlier = (4 * b.flux - a.flux) / 3;
    assert.ok(Math.abs(flux - earlier) < .00001 * Math.max(1, Math.abs(flux)));
    assert.ok(Math.abs((4 * c.area - b.area) / 3 - base.area) < .00001 * base.area);
    // Divergence theorem for the native homothetic flank, using the exact power
    // profile integral. No fitted CAD poles or mesh volumes enter this oracle.
    const ratio = p.topRatio, integral = ratio ** 2 + 2 * ratio * (1 - ratio) / (p.concavity + 1) + (1 - ratio) ** 2 / (2 * p.concavity + 1);
    const heightIntegral = base.area * (p.minimumRelief + p.depth * (p.stepBlend * baseMean.mean + (1 - p.stepBlend) * topMean.mean));
    const expectedVolume = base.area * p.baseThickness + ratio ** 2 * heightIntegral + (integral - ratio ** 2) * flux / 2;
    // The convenience reader uses non-adaptive native quadrature. Tighten only
    // this independent CAD/field comparison, without changing mesh acceptance.
    const properties = own(new kernel.GProp_GProps());
    const nativeIntegrationError = kernel.BRepGProp.VolumeProperties(candidate.solid.wrapped, properties, 1e-9, true, false);
    assert.ok(Number.isFinite(nativeIntegrationError) && nativeIntegrationError <= 1e-9);
    const fieldVolumeError = Math.abs(properties.Mass() / expectedVolume - 1);
    assert.ok(fieldVolumeError < .0001, `Native volume differs from the field oracle: ${fieldVolumeError}`);
    assert.deepEqual(base, saved);
    let exportReaders;
    if (workerData.outline === 'ellipse' && (layout === 'radial' || (layout === 'hexagonal' && p.family === 'spiral')) && p.stepBlend === 0) {
      const checked = validateMesh(mesh.mesh), part = { id: 'checkpoint-continuous-contour', mapNumber: 1,
        translation: candidate.translation, mesh: mesh.mesh, ...checked };
      const restored = own(await importSTEP(new Blob([await serializeSTEP([part], [candidate.solid])])));
      validateSolid(kernel, restored);
      const restoredProperties = own(new kernel.GProp_GProps());
      kernel.BRepGProp.VolumeProperties(restored.wrapped, restoredProperties, 1e-9, true, false);
      assert.ok(Math.abs(restoredProperties.Mass() / properties.Mass() - 1) < .00001);
      const geometry = new STLLoader().parse(serializeSTL([part]).buffer);
      try {
        geometry.computeBoundingBox(); assert.equal(geometry.attributes.position.count, mesh.mesh.indices.length);
        for (const side of ['min', 'max']) geometry.boundingBox[side].toArray().forEach((value, axis) => {
          assert.ok(Math.abs(value - checked.bounds[side][axis] - part.translation[axis]) < .001);
        });
      } finally { geometry.dispose(); }
      exportReaders = ['native-step', 'independent-stl'];
    }
    rows.push({ layout, family: p.family, blend: p.stepBlend, poles: candidate.poles, triangles: mesh.mesh.indices.length / 3,
      boundaryComparisons: candidate.boundaryComparisons, maximumBoundaryReductionMm: candidate.maximumBoundaryReductionMm,
      volumeError: mesh.volumeError, fieldVolumeError, translation: candidate.translation, anchor: candidate.anchorCertificate.method, exportReaders });
  } catch (error) { throw new Error(`${workerData.outline}/${layout}/${p.family}: ${error.message}`, { cause: error }); }
  finally { candidate?.solid.delete(); for (const resource of resources.reverse()) resource[Symbol.dispose] ? resource[Symbol.dispose]() : resource.delete(); }
}
parentPort.postMessage(rows);
