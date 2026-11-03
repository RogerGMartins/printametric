import { reserveTemporaryExport, exportRoot, cleanAbandonedExports } from '../../support/temporary-export.mjs';

// Test-only page API. Each lease remains alive through download and explicit
// release. Tests may open another page to exercise cross-tab ownership.
const leases = new Map();
window.startExport = async options => {
  const lease = await reserveTemporaryExport(options.maxBytes ?? 2 * 1024 ** 3);
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const state = { lease, worker, file: null, url: null };
  leases.set(lease.id, state);
  let timer;
  state.done = new Promise((resolve, reject) => {
    timer = setTimeout(() => { worker.terminate(); reject(Error('120-second export watchdog')); }, 120_000);
    worker.onerror = event => reject(Error(event.message));
    worker.onmessage = event => {
      if (event.data.progress) window.exportProbeProgress?.(event.data.progress);
      else if (event.data.error) reject(Error(event.data.error));
      else if (event.data.file) { state.file = event.data.file; resolve({ id: lease.id, bytes: state.file.size, metrics: event.data.metrics }); }
    };
    worker.postMessage({ ...options, id: lease.id, maxBytes: lease.maxBytes });
  }).finally(() => { clearTimeout(timer); worker.terminate(); });
  // Attach the error handler immediately; waitExport may be called after failure.
  state.done = state.done.catch(async error => { await lease.release(); throw error; });
  state.done.catch(() => {});
  return lease.id;
};
window.waitExport = id => leases.get(id).done;
window.cancelExport = id => leases.get(id).worker.postMessage({ cancel: true });
window.downloadExport = (id, filename) => {
  const state = leases.get(id);
  if (!state?.file) throw Error('Export not ready');
  state.url ??= URL.createObjectURL(state.file);
  const anchor = document.createElement('a'); anchor.href = state.url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
};
window.releaseExport = async id => {
  const state = leases.get(id);
  if (!state) return;
  if (state.url) { URL.revokeObjectURL(state.url); state.url = null; }
  await state.lease.release(); leases.delete(id);
};
window.cleanExports = cleanAbandonedExports;
window.exportIDs = async () => { const root = await exportRoot(), ids = []; for await (const key of root.keys()) ids.push(key); return ids.sort(); };
window.read3MF = async bytes => {
  const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
  const { Box3 } = await import('three');
  const group = new ThreeMFLoader().parse(new Uint8Array(bytes).buffer), bounds = new Box3().setFromObject(group);
  let parts = 0; group.traverse(object => { if (object.isMesh) parts++; });
  return { parts, min: bounds.min.toArray(), max: bounds.max.toArray() };
};
