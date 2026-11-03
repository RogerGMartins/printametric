// Environment-neutral capacity experiment; never imported by the application.
import { measureShapeVolumeProperties, setOC } from 'replicad';
import initOpenCascade from 'replicad-opencascadejs';
import { numberedBladeFactory } from './layout-native-fixture.mjs';
import { archiveNative, restoreNative } from './native-snapshot.mjs';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { weldMesh, validateMesh } from '../../src/shared/geometry/validate-mesh.ts';
import { LIMITS_V2 } from '../../src/tools/wall-art/model/validation-v2.ts';

export async function runNativeBatch(data, cpuClock = () => 0) {
  const started = performance.now(), cpuStarted = cpuClock();
  const timings = {}, cpuMs = {};
  let wallMark = started, cpuMark = cpuStarted;
  function mark(stage) {
    const wall = performance.now(), cpu = cpuClock();
    timings[stage] = (timings[stage] ?? 0) + wall - wallMark;
    cpuMs[stage] = (cpuMs[stage] ?? 0) + cpu - cpuMark;
    wallMark = wall; cpuMark = cpu;
  }
  const kernel = await initOpenCascade({ print: () => {}, instantiateWasm(imports, ready) {
    const instance = new WebAssembly.Instance(data.module, imports);
    ready(instance, data.module); return instance.exports;
  } });
  setOC(kernel); mark('initialize');
  const templates = [];
  let factory;
  try {
    for (const snapshot of data.templates ?? []) templates.push(await restoreNative(kernel, snapshot, snapshot.identity));
    factory = numberedBladeFactory(kernel, data.mode, templates.length ? templates : undefined);
    templates.forEach(shape => shape.delete()); templates.length = 0;
    mark('prepare');
    if (data.templatesOnly) {
      const snapshots = [];
      for (const [i, shape] of factory.templates().entries()) snapshots.push(await archiveNative(kernel, shape, `r1-template:${i}`));
      mark('archive');
      return { templates: snapshots, timings, cpuMs, elapsedMs: performance.now() - started, threadCpuMs: cpuClock() - cpuStarted };
    }
    const parts = [];
    let meshBytes = 0, snapshotBytes = 0;
    for (let number = data.start; number < data.start + data.count; number++) {
      const shape = factory.make(number); mark('construct');
      try {
        validateSolid(kernel, shape);
        const raw = shape.mesh({ tolerance: LIMITS_V2.chordTolerance, angularTolerance: LIMITS_V2.angleRadians });
        const mesh = weldMesh(raw.vertices, raw.triangles), checked = validateMesh(mesh), properties = measureShapeVolumeProperties(shape);
        try { if (Math.abs(checked.volume - properties.volume) > properties.volume * 0.001) throw Error('CAD/mesh volume mismatch'); }
        finally { properties.delete(); }
        mark('validateAndMesh');
        const id = `capacity-${number}`, snapshot = await archiveNative(kernel, shape, `r1-fixture:${id}`);
        mark('archive');
        meshBytes += mesh.positions.byteLength + mesh.indices.byteLength; snapshotBytes += snapshot.bytes.byteLength;
        parts.push({ id, mapNumber: number, translation: [((number - 1) % 64) * 50, Math.floor((number - 1) / 64) * 50, 0], ...checked, mesh, snapshot });
        if (kernel.wasmMemory.buffer.byteLength + 4 * meshBytes + snapshotBytes > data.batchReservation) throw Error('Native batch exceeds its reserved memory');
      } finally { shape.delete(); }
    }
    return { parts, meshBytes, snapshotBytes, timings, cpuMs, wasmBytes: kernel.wasmMemory.buffer.byteLength,
      elapsedMs: performance.now() - started, threadCpuMs: cpuClock() - cpuStarted };
  } finally { templates.forEach(shape => shape.delete()); factory?.dispose(); }
}

export function batchTransfers(batch) {
  return batch.templates ? batch.templates.map(snapshot => snapshot.bytes.buffer)
    : batch.parts.flatMap(part => [part.mesh.positions.buffer, part.mesh.indices.buffer, part.snapshot.bytes.buffer]);
}
