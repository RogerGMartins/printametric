/** The accepted worker retains actual final CAD and canonical meshes until retired. */
import initOpenCascade from 'replicad-opencascadejs';
import { setOC } from 'replicad';
import { buildSurfaceReview } from '../../support/shape-surface-review.mjs';
import { serializeSTEP } from '../../../src/shared/export/step.ts';
import { streamSTL } from '../../../src/shared/export/stream-stl.ts';
import { stream3MF } from '../../../src/shared/export/stream-three-mf.ts';
let retained;
self.onmessage = async ({ data }) => {
  try {
    if (data.kind === 'build') {
      if (retained) throw Error('One native candidate per qualification worker.');
      const kernel = await initOpenCascade({ print: () => {}, instantiateWasm(imports, ready) {
        const instance = new WebAssembly.Instance(data.module, imports); ready(instance, data.module); return instance.exports;
      } });
      setOC(kernel);
      retained = buildSurfaceReview(kernel, data.parameters, progress => self.postMessage({ progress }));
      const { candidates, ...canonical } = retained;
      self.postMessage({ result: { ...canonical, wasmBytes: kernel.wasmMemory.buffer.byteLength } });
    } else if (data.kind === 'export') {
      if (!retained) throw Error('No accepted native assembly.');
      let bytes;
      if (data.format === 'step') bytes = await serializeSTEP(retained.parts, retained.candidates.map(candidate => candidate.solid));
      else {
        const writer = { stl: streamSTL, '3mf': stream3MF }[data.format];
        if (!writer) throw Error('Unknown export format.');
        const chunks = []; await writer(retained.parts, { async write(chunk) { chunks.push(chunk); } });
        bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      }
      self.postMessage({ bytes }, [bytes.buffer]);
    } else throw Error('Unknown qualification request.');
  } catch (error) { self.postMessage({ error: error.message }); }
};
