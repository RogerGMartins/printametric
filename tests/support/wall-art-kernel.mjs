// Node-only WASM loader. Production code never imports filesystem APIs.
import { readFile } from 'node:fs/promises';
import { initializeKernel } from '../../src/shared/geometry/kernel.ts';
export async function loadKernel() {
  return initializeKernel({ wasmBinary: new Uint8Array(await readFile(new URL(import.meta.resolve('replicad-opencascadejs/wasm')))) });
}
