/** Isolated P1 native experiment. Sampled residuals are diagnostics, not a
 * certified global approximation bound or full P2 qualification. */
import { parentPort, workerData } from 'node:worker_threads';
import { measureShapeVolumeProperties } from 'replicad';
import { loadKernel } from './wall-art-kernel.mjs';
import { buildRectangleSurface, meshRectangleSurface } from './shape-surface-native.mjs';
import { validateMesh, weldMesh } from '../../src/shared/geometry/validate-mesh.ts';
import { DEFAULT_PARAMETERS_V3, SURFACE_FAMILIES } from '../../src/tools/wall-art/model/parameters-v3.ts';
import { createSurfaceField } from '../../src/tools/wall-art/geometry/surface-fields.ts';

const started = performance.now(), report = {
  fixtureContract: 'p1-rectangle-continuous-1',
  construction: 'fixed-grid-top-interpolation/shared-boundary-control-nets',
  // Fixed diagnostic inputs, never an imported user design. Keep them in the
  // report so later changes to defaults cannot change the meaning of old evidence.
  parameters: DEFAULT_PARAMETERS_V3, partWidthMm: 47.5, plinthAndIdentification: false,
  sampledComponentAllowanceMm: .00025, fixtures: [],
};
try {
  const kernel = await loadKernel();
  report.initializationMs = performance.now() - started;
  const locations = workerData?.boundaries ? [[0, 0], [250, 0]] : [[62.5, 0], [0, 0], [250, 0]];
  for (const origin of locations) for (const family of workerData?.family ? [workerData.family] : SURFACE_FAMILIES) for (const ratio of [.12, .8]) for (const concavity of [1, 2.2, 4]) {
    const begin = performance.now();
    const field = createSurfaceField({ ...DEFAULT_PARAMETERS_V3, family, topRatio: ratio, stepBlend: 0 });
    const fixture = { id: `p1-${family}-x${origin[0]}-r${ratio}-c${concavity}`, family, ratio, concavity, origin, grid: 33 };
    parentPort.postMessage({ ...report, activeFixture: fixture, complete: false });
    let candidate, properties;
    try {
      candidate = buildRectangleSurface(kernel, { width: 47.5, ratio, concavity,
        height: (x, y) => 20 + 30 * field.evaluate(x + origin[0], y + origin[1]),
        progress: stage => parentPort.postMessage({ ...report, activeFixture: { ...fixture, stage }, complete: false }) });
      const { solid, ...diagnostics } = candidate;
      Object.assign(fixture, diagnostics);
      const nativeMesh = meshRectangleSurface(candidate,
        stage => parentPort.postMessage({ ...report, activeFixture: { ...fixture, stage }, complete: false }));
      properties = measureShapeVolumeProperties(solid);
      const mesh = weldMesh(nativeMesh.vertices, nativeMesh.triangles), checked = validateMesh(mesh);
      fixture.nativeVolume = properties.volume;
      fixture.triangles = mesh.indices.length / 3;
      fixture.volumeError = Math.abs(checked.volume - properties.volume) / properties.volume;
      if (fixture.volumeError > .001) throw Error('Mesh/native volume disagreement exceeds 0.1%.');
    } catch (error) { fixture.failure = error instanceof Error ? error.message : String(error); }
    finally { properties?.delete(); candidate?.solid.delete(); }
    fixture.durationMs = performance.now() - begin;
    report.fixtures.push(fixture);
    parentPort.postMessage({ ...report, complete: false });
  }
  report.wasmCapacityBytes = kernel.wasmMemory.buffer.byteLength;
  if (report.fixtures.some(fixture => fixture.failure)) report.failure = 'One or more native capability fixtures failed. See fixture diagnostics.';
} catch (error) { report.failure = error instanceof Error ? error.message : String(error); }
report.durationMs = performance.now() - started;
parentPort.postMessage({ ...report, complete: true });
