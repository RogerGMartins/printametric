import wasmURL from 'replicad-opencascadejs/wasm?url';

// Only this isolated test entry exposes a callable probe, never the application.
let accepted;
window.profileLayouts = async ({ count = 512, workers = 1, memoryMiB = 512, retainAccepted = false } = {}) => {
  if (![1, 2, 3, 4].includes(workers) || ![512, 768, 1024].includes(memoryMiB) || !Number.isInteger(count) || count < 1 || count > 4000) throw Error('Invalid probe limits');
  const memoryLimit = memoryMiB * 1024 * 1024;
  const reservation = (workers === 1 ? 256 : 192) * 1024 * 1024;
  const started = performance.now(), batches = [], parts = [], active = new Set();
  const previous = retainAccepted ? accepted : undefined;
  const acceptedBytes = previous?.bytes ?? 0;
  let next = 1, retainedBytes = 0, failure, maxTimerDelayMs = 0, lastTick = performance.now();
  const timer = setInterval(() => { const now = performance.now(); maxTimerDelayMs = Math.max(maxTimerDelayMs, now - lastTick - 50); lastTick = now; }, 50);
  let module;
  const reservationBytes = () => workers * reservation + acceptedBytes + retainedBytes * 2;
  async function progress(phase) {
    await window.layoutProbeProgress?.({ phase, completed: parts.length, acceptedParts: previous?.parts.length ?? 0,
      acceptedBytes, candidateBytes: retainedBytes, elapsedMs: performance.now() - started });
  }
  async function batch(data) {
    const remaining = 120_000 - (performance.now() - started);
    if (remaining <= 0) throw Error('120-second generation watchdog');
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    active.add(worker);
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('120-second generation watchdog')), remaining);
        worker.onmessage = ({ data: result }) => { clearTimeout(timeout); result.error ? reject(Error(result.error)) : resolve(result); };
        worker.onerror = event => { clearTimeout(timeout); reject(Error(event.message)); };
        worker.postMessage({ ...data, module, batchReservation: reservation });
      });
    } finally { worker.terminate(); active.delete(worker); }
  }
  try {
    await progress('initialize');
    module = await WebAssembly.compile(await (await fetch(wasmURL)).arrayBuffer());
    const { templates } = await batch({ templatesOnly: true });
    retainedBytes = templates.reduce((sum, snapshot) => sum + snapshot.bytes.byteLength, 0);
    async function lane() {
      try {
        while (!failure && next <= count) {
          const start = next; next += 32;
          if (reservationBytes() > memoryLimit) throw Error('Aggregate memory reservation');
          const result = await batch({ start, count: Math.min(32, count - start + 1), mode: 'cut', templates });
          retainedBytes += result.snapshotBytes + result.meshBytes;
          parts.push(...result.parts);
          batches.push({ start, elapsedMs: result.elapsedMs, wasmBytes: result.wasmBytes, timings: result.timings });
          await progress('generation');
          if (reservationBytes() > memoryLimit) throw Error('Retained memory reservation');
        }
      } catch (error) { failure ??= String(error); }
    }
    await Promise.all(Array.from({ length: workers }, lane));
  } catch (error) { failure ??= String(error); }
  finally { clearInterval(timer); active.forEach(worker => worker.terminate()); }
  const elapsedMs = performance.now() - started;
  // Stable part order, independent of worker completion order. Compare mesh bytes
  // and identity/placement rather than native archive serialization order.
  const digests = [];
  for (const part of parts.sort((a, b) => a.mapNumber - b.mapNumber)) {
    const metadata = new TextEncoder().encode(JSON.stringify([part.id, part.translation, part.volume, part.bounds]));
    const bytes = new Uint8Array(metadata.length + part.mesh.positions.byteLength + part.mesh.indices.byteLength);
    bytes.set(metadata); bytes.set(new Uint8Array(part.mesh.positions.buffer), metadata.length);
    bytes.set(new Uint8Array(part.mesh.indices.buffer), metadata.length + part.mesh.positions.byteLength);
    digests.push([...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]);
  }
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(digests))));
  const geometryDigest = [...hash].map(byte => byte.toString(16).padStart(2, '0')).join('');
  let previewBytes = 0;
  if (retainAccepted && !failure && parts.length === count) {
    // Real independent CPU buffers, retained across the next job. This is a lower
    // bound: no renderer, GPU buffers, normals or application shell are present.
    const preview = parts.map(part => ({ positions: part.mesh.positions.slice(), indices: part.mesh.indices.slice() }));
    previewBytes = preview.reduce((sum, mesh) => sum + mesh.positions.byteLength + mesh.indices.byteLength, 0);
    if (acceptedBytes + retainedBytes + previewBytes > memoryLimit) failure = 'Acceptance overlap memory reservation';
    else accepted = { parts, preview, bytes: retainedBytes + previewBytes, geometryDigest };
  }
  await progress(failure ? 'failed' : 'complete');
  return { workers, count, memoryLimit, completed: parts.length, failure, elapsedMs, retainedBytes, maxTimerDelayMs,
    geometryDigest, batches, acceptedParts: previous?.parts.length ?? 0, acceptedBytes, previewBytes,
    previousDigest: previous?.geometryDigest,
    memoryQualification: retainAccepted
      ? 'Actual previous native snapshots/meshes and independent CPU preview buffers; renderer/GPU/application overhead absent'
      : 'Reservations and WASM capacities only; browser native peak and accepted/UI overlap unmeasured' };
};
