// Qualification uses the application's renderer and its canonical arrays. Keep
// the accepted canvas mounted while the next native job runs.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { WallArtPreview } from '../../../src/tools/wall-art/editor/WallArtPreview.tsx';

const root = createRoot(document.getElementById('preview'));
let revision = 0;
export async function renderLayout(layout, remainingMs) {
  const started = performance.now();
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let meshBytes = 0, triangles = 0;
  for (const { part, assemblyBounds } of layout.parts) {
    for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], assemblyBounds.min[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], assemblyBounds.max[axis]);
    }
    meshBytes += part.mesh.positions.byteLength + part.mesh.indices.byteLength;
    triangles += part.mesh.indices.length / 3;
  }
  const result = { revision: ++revision, digest: `qualification-${revision}`, units: 'mm',
    parts: layout.parts.map(item => item.part), bounds, diagnostics: [],
    budget: { triangles, meshBytes, wasmBytes: 0, elapsedMs: 0 } };
  const host = document.getElementById('preview');
  // Clear the old framebuffer so the readiness check cannot accept a stale frame.
  const previous = host.querySelector('canvas');
  if (previous) {
    const gl = previous.getContext('webgl2');
    if (gl) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
  root.render(<WallArtPreview result={result} />);
  const sample=document.createElement('canvas');sample.width=16;sample.height=16;
  const context=sample.getContext('2d',{willReadFrequently:true});
  return await new Promise((resolve, reject) => {
    const frame = () => {
      if (performance.now() - started >= remainingMs) return reject(Error('120-second real geometry/render watchdog'));
      // R3F keeps fallback HTML inside the canvas even when WebGL succeeds.
      // Only a fallback outside the canvas establishes a renderer failure.
      if ([...host.querySelectorAll('.empty-preview')].some(node=>!node.closest('canvas')) && performance.now()-started>5000) return reject(Error('Actual preview renderer failed'));
      const canvas = host.querySelector('canvas');
      // Do not create the context before Three does: that would replace the
      // application's preserveDrawingBuffer options with browser defaults.
      const gl = canvas?.dataset.engine ? canvas.getContext('webgl2') : null;
      if (gl && !gl.isContextLost()) {
        // Read a coarse grid of actual GPU pixels. A mounted but blank canvas is
        // not successful rendering; the demand renderer preserves its last frame.
        context.clearRect(0,0,16,16);context.drawImage(canvas,0,0,16,16);
        const pixels=context.getImageData(0,0,16,16).data;
        let occupied = 0;
        for (let i=0;i<pixels.length;i+=4) {
          if (pixels[i+3] && pixels[i]+pixels[i+1]+pixels[i+2]) occupied++;
        }
        if (occupied > 5) return resolve({ elapsedMs: performance.now()-started, occupiedSamples: occupied,
          width: canvas.width, height: canvas.height, parts: result.parts.length, triangles, meshBytes });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
