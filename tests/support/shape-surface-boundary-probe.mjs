/** R2 worker; always supervised by the qualification command's time/RSS limits. */
import { parentPort, workerData } from 'node:worker_threads';
import { loadKernel } from './wall-art-kernel.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../../src/tools/wall-art/model/parameters-v3.ts';
import { buildBoundarySurface } from './shape-surface-boundary-native.mjs';
import { meshBoundarySurface } from './shape-surface-boundary-mesh.mjs';
import { writeComparisonView, writeComparisonExports } from './shape-surface-comparison-artifacts.mjs';

const kernel = await loadKernel(), fixtures = [], started = performance.now();
const families = workerData.family ? [workerData.family] : ['spiral', 'ridges', 'dome'];
const spiralCenter = workerData.spiralCenter ?? 'linear';
const publish = (activeFixture, extra = {}) => parentPort.postMessage({ fixtureContract: 'r2-trimmed-boundary-capability-1', spiralCenter, fixtures, activeFixture, ...extra });
for (const family of families) for (const ratio of [.12, .8]) for (const origin of [[0, 0], [250, 0]]) for (const concavity of [1, 2.2, 4]) {
  const id = `r2-${family}-x${origin[0]}-r${ratio}-c${concavity}`, begin = performance.now();
  let candidate;
  try {
    const parameters = { ...DEFAULT_PARAMETERS_V3, family, topRatio: ratio, concavity, stepBlend: 0, plinthEnabled: false };
    candidate = buildBoundarySurface(kernel, parameters, { origin, spiralCenter, progress: stage => publish({ id, stage }) });
    const capture = workerData.comparisonArtifacts && origin[0] === 0 && (concavity === 1 || concavity === 2.2);
    if (capture) await writeComparisonView(candidate, parameters, spiralCenter);
    const meshed = meshBoundarySurface(candidate, stage => publish({ id, stage, poles: candidate.poles }));
    if (capture) await writeComparisonExports(candidate, meshed, parameters, spiralCenter);
    fixtures.push({ id, family, ratio, origin, concavity, poles: candidate.poles, topFaces: candidate.topFaces,
      physicalHeightErrorMm: candidate.physicalHeightErrorMm, boundaryCurves: candidate.boundaryCurves, originalBoundaryPoles: candidate.originalBoundaryPoles,
      maximumBoundaryReductionMm: candidate.maximumBoundaryReductionMm, boundaryComparisons: candidate.boundaryComparisons,
      profileDegree: candidate.profileDegree, profilePositionErrorMm: candidate.profilePositionErrorMm,
      triangles: meshed.mesh.indices.length / 3, nativeVolume: meshed.nativeVolume, volumeError: meshed.volumeError,
      meshTolerance: meshed.tolerance, collapsedTriangles: meshed.collapsedTriangles,
      curveRejections: candidate.curveRejections, durationMs: performance.now() - begin, solidValid: true });
  } catch (error) {
    fixtures.push({ id, family, ratio, origin, concavity, durationMs: performance.now() - begin, failure: error instanceof Error ? error.message : String(error) });
  } finally { candidate?.solid.delete(); }
  publish(null);
}
publish(null, { complete: true, durationMs: performance.now() - started, failure: fixtures.some(f => f.failure) ? 'Piecewise native capability has rejected fixtures.' : null });
