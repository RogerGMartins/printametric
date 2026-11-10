import wasmURL from 'replicad-opencascadejs/wasm?url';
import { renderLayout } from '../real-layout-profile/preview.jsx';
import { SURFACE_REVIEW_FIXTURES } from '../../support/shape-surface-review.mjs';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { validateMesh, weldMesh } from '../../../src/shared/geometry/validate-mesh.ts';
import './views.js';
const module = await WebAssembly.compile(await (await fetch(wasmURL)).arrayBuffer());
let accepted, pending, revision = 0;
const status = document.getElementById('status');
const request = (worker, data, progress) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { worker.terminate(); reject(Error('120-second native request watchdog')); }, 120000);
  worker.onmessage = ({ data }) => {
    if ('progress' in data) { progress?.(data.progress); return; }
    clearTimeout(timer); data.error ? reject(Error(data.error)) : resolve(data);
  };
  worker.onerror = event => { clearTimeout(timer); reject(Error(event.message)); };
  worker.postMessage(data);
});
window.surfaceState = () => ({ revision, parts: accepted?.result.parts.length ?? 0, pending: Boolean(pending), progress: pending?.progress ?? 0 });
window.generateSurface = async (id, changes = {}) => {
  if (pending) throw Error('Candidate already running.');
  const fixture = SURFACE_REVIEW_FIXTURES.find(fixture => fixture.id === id);
  if (!fixture) throw Error('Unknown fixture.');
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  const job = { worker, progress: 0 }; pending = job; status.textContent = 'Generating candidate';
  const started = performance.now();
  try {
    const response = await request(worker, { kind: 'build', module, parameters: { ...fixture.parameters, ...changes } }, value => { job.progress = value; });
    if (pending !== job) throw Error('Candidate cancelled.');
    const result = response.result;
    const rendered = await renderLayout({ parts: result.parts.map(part => ({ part, assemblyBounds: Object.fromEntries(['min', 'max'].map(side => [side, part.bounds[side].map((v, axis) => v + part.translation[axis])])) })) }, 120000 - (performance.now() - started));
    accepted?.worker.terminate(); accepted = { worker, result }; revision++; status.textContent = 'Accepted native assembly';
    return { revision, parts: result.parts.length, triangles: result.triangles, meshBytes: result.meshBytes, wasmBytes: result.wasmBytes, elapsedMs: performance.now() - started, rendered };
  } catch (error) { worker.terminate(); status.textContent = error.message; throw error; }
  finally { if (pending === job) pending = undefined; }
};
window.cancelSurface = () => {
  if (!pending) return false;
  const job = pending; pending = undefined; job.worker.terminate();
  // Reject the outstanding promise explicitly; terminating a Worker emits no error.
  job.worker.onerror?.({ message: 'Candidate cancelled.' }); status.textContent = 'Cancelled; accepted assembly retained'; return true;
};
window.surfaceDigest = async () => {
  if (!accepted) throw Error('No accepted assembly.');
  const chunks = accepted.result.parts.flatMap(part => [new TextEncoder().encode(`${part.id}:${part.translation}`), part.mesh.positions, part.mesh.indices]);
  const digest = await crypto.subtle.digest('SHA-256', await new Blob(chunks).arrayBuffer());
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
};
window.exportSurface = async format => {
  if (!accepted || pending) throw Error('Export requires an idle accepted revision.');
  const { bytes } = await request(accepted.worker, { kind: 'export', format });
  if (format === '3mf') {
    const object = new ThreeMFLoader().parse(bytes.buffer); object.updateMatrixWorld(true);
    const seen = new Set();
    object.traverse(mesh => {
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), vertices = geometry.attributes.position.array;
      try {
        const indices = geometry.index?.array ?? Array.from({ length: vertices.length / 3 }, (_, i) => i);
        const checked = validateMesh(weldMesh(vertices, indices));
        const index = accepted.result.parts.findIndex(part => ['min', 'max'].every(side => checked.bounds[side].every((v, axis) => Math.abs(v - part.bounds[side][axis] - part.translation[axis]) < .001)));
        if (index < 0 || seen.has(index)) throw Error('3MF reader lost a placement.');
        seen.add(index);
      } finally { geometry.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); }
    });
    if (seen.size !== accepted.result.parts.length) throw Error('3MF reader lost a part.');
  }
  const blob = new Blob([bytes]), url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `surface-review.${format}`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { bytes: bytes.byteLength, revision, independent3MF: format === '3mf' };
};
