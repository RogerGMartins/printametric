/** Isolated R3 batch: accepted phase-02 square footprints, exact Wave area means,
 * bounded planar relief, plinths and existing physical identification. */
import { parentPort, workerData } from 'node:worker_threads';
import { loadKernel } from './wall-art-kernel.mjs';
import { buildPlanarRectangle } from './shape-surface-planar-native.mjs';
import { meshBoundarySurface } from './shape-surface-boundary-mesh.mjs';
import { DEFAULT_PARAMETERS_V3 } from '../../src/tools/wall-art/model/parameters-v3.ts';
import { layoutParametersV3 } from '../../src/tools/wall-art/model/validation-v3.ts';
import { rectangleSurfaceMoments } from '../../src/tools/wall-art/geometry/surface-moments.ts';
import { partitionLayout } from '../../src/tools/wall-art/geometry/layouts/partition.ts';
import { createGlyphTemplates, engravePart } from '../../src/tools/wall-art/geometry/engraving.ts';
import { serializeSTEP } from '../../src/shared/export/step.ts';
import { surfaceErrorLedger } from './shape-surface-error-ledger.mjs';

const kernel = await loadKernel(), parameters = { ...DEFAULT_PARAMETERS_V3, concavity: workerData.concavity };
const legacy = layoutParametersV3(parameters), { bases, excluded } = partitionLayout(kernel, legacy);
if (bases.length !== 100 || excluded.length) throw Error('Starter partition must contain exactly 100 accepted footprints.');
let operations = 0;
const count = () => { if (++operations > 40000) throw Error('Starter batch operation budget exceeded.'); };
const templates = createGlyphTemplates(kernel, count), solids = [], parts = [], summaries = [];
try {
  for (const base of bases.slice(workerData.start, workerData.start + 20)) {
    // Reserve a conservative bound for the fixed planar builder and partition
    // work in this diagnostic. Engraving calls are counted separately.
    for (let i = 0; i < 1024; i++) count();
    const width = parameters.pitch - parameters.gap, [x, y] = base.centroid;
    if (Math.abs(base.area - width * width) > 1e-5) throw Error('Starter builder requires the exact unclipped square footprint.');
    const moments = rectangleSurfaceMoments(parameters, { minX: x - width / 2, maxX: x + width / 2, minY: y - width / 2, maxY: y + width / 2 });
    const height = parameters.baseThickness + parameters.minimumRelief + parameters.depth * moments.mean;
    const candidate = buildPlanarRectangle(kernel, { width, ratio: parameters.topRatio, concavity: parameters.concavity,
      baseThickness: parameters.baseThickness, top: [height, 0, 0] });
    let engraved;
    try {
      engraved = engravePart(kernel, legacy, base, candidate.solid, count, templates);
      const result = meshBoundarySurface({ ...candidate, solid: engraved.solid, physicalHeightErrorMm: parameters.depth * moments.error });
      const errorLedger = surfaceErrorLedger(kernel, { ...candidate, solid: engraved.solid, physicalHeightErrorMm: parameters.depth * moments.error }, parameters.topRatio);
      if (engraved.identification.status !== 'engraved') throw Error('Starter identification unexpectedly failed.');
      const part = { id: `checkpoint-g3-${base.id}`, mapNumber: base.mapNumber, translation: [x, y, 0],
        mesh: result.mesh, bounds: result.bounds, volume: result.nativeVolume };
      parts.push(part); solids.push(engraved.solid); engraved = undefined;
      summaries.push({ number: base.mapNumber, mean: moments.mean, height, poles: candidate.poles, volumeError: result.volumeError,
        profileErrorMm: candidate.profilePositionErrorMm, triangles: result.mesh.indices.length / 3, errorLedger });
      parentPort.postMessage({ progress: base.mapNumber });
    } finally { engraved?.solid.delete(); candidate.solid.delete(); }
  }
  const step = await serializeSTEP(parts, solids);
  parentPort.postMessage({ parts, step, summaries, operations, parameters });
} finally { solids.forEach(solid => solid.delete()); templates.dispose(); }
