/** One bounded native heap for each visual comparison, including final-solid exports. */
import { parentPort, workerData } from 'node:worker_threads';
import { loadKernel } from './wall-art-kernel.mjs';
import { buildSurfaceReview, SURFACE_REVIEW_FIXTURES } from './shape-surface-review.mjs';
import { serializeSTEP } from '../../src/shared/export/step.ts';
import { streamSTL } from '../../src/shared/export/stream-stl.ts';
import { stream3MF } from '../../src/shared/export/stream-three-mf.ts';
const fixture = SURFACE_REVIEW_FIXTURES.find(fixture => fixture.id === workerData.id);
if (!fixture) throw Error('Unknown fixed review fixture.');
const start = performance.now(), kernel = await loadKernel(), initializedMs = performance.now() - start;
let result;
try {
  try { result = buildSurfaceReview(kernel, fixture.parameters, progress => parentPort.postMessage({ progress })); }
  catch (error) {
    if (!fixture.expectedError?.test(error.message)) throw error;
    parentPort.postMessage({ id: fixture.id, expectedRejection: error.message, initializedMs, elapsedMs: performance.now() - start });
  }
  if (result) {
    if (fixture.expectedError) throw Error('Invalid review fixture unexpectedly succeeded.');
    if (fixture.id === 'wave-sloping-plane' && !result.candidates.some(candidate => Math.hypot(...candidate.planarCoefficients.slice(1)) > .001)) throw Error('Sloping-plane review fixture has no genuine slope.');
    const generatedMs = performance.now() - start, step = await serializeSTEP(result.parts, result.candidates.map(candidate => candidate.solid));
    const collect = async writer => { const chunks = []; await writer(result.parts, { async write(bytes) { chunks.push(bytes); } }); return new Uint8Array(await new Blob(chunks).arrayBuffer()); };
    const stl = await collect(streamSTL), threeMF = await collect(stream3MF);
    parentPort.postMessage({ id: fixture.id, parameters: result.parameters, parts: result.parts, step, stl, threeMF,
      initializedMs, generatedMs, elapsedMs: performance.now() - start, triangles: result.triangles, meshBytes: result.meshBytes,
      distances: result.distances, meshes: result.meshes, errors: result.errors,
      cadOperations: result.cadOperations, reservedFieldEvaluations: result.reservedFieldEvaluations,
      native: result.candidates.map(candidate => ({ id: candidate.id, poles: candidate.poles, identification: candidate.identification,
        physicalHeightErrorMm: candidate.physicalHeightErrorMm, profilePositionErrorMm: candidate.profilePositionErrorMm,
        maximumContourApproximationMm: candidate.maximumContourApproximationMm, maximumBoundaryReductionMm: candidate.maximumBoundaryReductionMm ?? 0 })) });
  }
} finally { result?.candidates.forEach(candidate => candidate.solid.delete()); }
