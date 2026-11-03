import { openTemporarySink } from '../../support/temporary-export.mjs';
import { assembleSTEP } from '../../support/step-fragments.mjs';
import { stream3MF } from '../../support/stream-three-mf.mjs';

const controller = new AbortController();
let active = false;
self.onmessage = async ({ data }) => {
  if (data.cancel) { controller.abort(Error('Export cancelled')); return; }
  if (active) return;
  active = true;
  let sink, sinceYield = 0, written = 0, reported = 0;
  const start = performance.now();
  try {
    sink = await openTemporarySink(data.id, data.maxBytes);
    const output = { async write(bytes) {
      controller.signal.throwIfAborted(); sink.write(bytes);
      written += bytes.length;
      if (written - reported >= 8 * 1024 ** 2) { reported = written; self.postMessage({ progress: { phase: 'writing', bytes: written } }); }
      sinceYield += bytes.length;
      // Allow cancellation messages between bounded writes, including long
      // runs of compressed output which would otherwise stay in microtasks.
      if (sinceYield >= 256 * 1024) { sinceYield = 0; await new Promise(resolve => setTimeout(resolve, 0)); }
    } };
    let metrics;
    if (data.kind === 'step') {
      // Load the bounded fixture bytes directly; serializing byte arrays through
      // the browser automation protocol would measure harness allocation instead.
      const sources = [];
      for (const url of data.fragmentURLs) {
        if (!['/cylinder-fragment.step', '/numbered-fragment.step'].includes(url)) throw Error('Unknown native fragment fixture');
        const response = await fetch(url);
        if (!response.ok) throw Error('Native fixture fetch failed');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > 32 * 1024 ** 2) throw Error('Native fixture too large');
        sources.push(bytes);
      }
      async function* fragments() {
        for (let i = 0; i < data.repeat; i++) for (const fragment of sources) yield fragment;
      }
      metrics = await assembleSTEP(fragments(), output, { signal: controller.signal, maxBytes: data.maxBytes });
    } else if (data.kind === '3mf') {
      metrics = await stream3MF(data.parts, output, { signal: controller.signal, maxBytes: data.maxBytes });
    } else if (data.kind === 'bytes') {
      if (!Number.isSafeInteger(data.bytes) || data.bytes < 0 || data.bytes > 2 * 1024 ** 3) throw Error('Invalid byte fixture');
      const chunk = new Uint8Array(256 * 1024).fill(90);
      for (let i = 0; i < data.bytes; i += chunk.length) await output.write(chunk.subarray(0, Math.min(chunk.length, data.bytes - i)));
      metrics = { bytes: data.bytes };
    } else throw Error('Unknown export fixture');
    controller.signal.throwIfAborted();
    self.postMessage({ progress: { phase: 'creating-file', bytes: written } });
    const file = await sink.finish();
    self.postMessage({ file, metrics: { ...metrics, elapsedMs: performance.now() - start } });
  } catch (error) {
    // The page may terminate this worker as soon as it receives the response.
    // Release the exclusive access handle before acknowledging a failed export.
    sink?.close(); self.postMessage({ error: String(error) });
  }
  finally { sink?.close(); }
};
