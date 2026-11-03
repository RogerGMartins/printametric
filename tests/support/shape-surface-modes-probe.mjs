/** Isolated R3 rectangle-mode capability; no production version dispatch. */
import { parentPort, workerData } from 'node:worker_threads';
import { loadKernel } from './wall-art-kernel.mjs';
import { buildBoundarySurface } from './shape-surface-boundary-native.mjs';
import { buildPlanarRectangle } from './shape-surface-planar-native.mjs';
import { meshBoundarySurface } from './shape-surface-boundary-mesh.mjs';
import { rectangleSurfaceMoments, fitRectanglePlane } from '../../src/tools/wall-art/geometry/surface-moments.ts';
import { DEFAULT_PARAMETERS_V3 } from '../../src/tools/wall-art/model/parameters-v3.ts';

const kernel = await loadKernel(), origin = [62.5, 0], width = 47.5, results = [];
for (const mode of ['stepped', 'blend', 'continuous', 'plane']) {
  const p = { ...DEFAULT_PARAMETERS_V3, family: workerData.family, topRatio: .8,
    stepBlend: mode === 'stepped' ? 1 : mode === 'blend' ? .5 : 0,
    planarTops: mode === 'plane', plinthEnabled: mode === 'stepped' || mode === 'blend' };
  let candidate;
  if (mode === 'stepped' || mode === 'plane') {
    const base = rectangleSurfaceMoments(p, { minX: origin[0] - width / 2, maxX: origin[0] + width / 2, minY: -width / 2, maxY: width / 2 }, 'smooth-c2');
    const half = width * p.topRatio / 2;
    const top = mode === 'plane' ? rectangleSurfaceMoments(p, { minX: origin[0] - half, maxX: origin[0] + half, minY: -half, maxY: half }, 'smooth-c2') : base;
    const coefficients = mode === 'stepped' ? [base.mean, 0, 0] : fitRectanglePlane(top);
    const baseZ = p.plinthEnabled ? p.baseThickness : 0;
    candidate = buildPlanarRectangle(kernel, { width, ratio: p.topRatio, concavity: p.concavity, baseThickness: baseZ,
      top: [baseZ + p.minimumRelief + p.depth * coefficients[0], p.depth * coefficients[1], p.depth * coefficients[2]] });
  } else candidate = buildBoundarySurface(kernel, p, { width, origin, spiralCenter: 'smooth-c2' });
  try {
    const mesh = meshBoundarySurface(candidate);
    results.push({ mode, triangles: mesh.mesh.indices.length / 3, volumeError: mesh.volumeError, poles: candidate.poles });
  } finally { candidate.solid.delete(); }
}
parentPort.postMessage(results);
