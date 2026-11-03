/** Inject WASM location/bytes at the host boundary; this module is browser/Node neutral. */
import initOpenCascade from 'replicad-opencascadejs';
import { setOC, type Shape3D } from 'replicad';
import type { OpenCascadeInstance } from 'replicad-opencascadejs';

export type Kernel = OpenCascadeInstance;
export async function initializeKernel(options: { locateFile?: (path: string) => string; wasmBinary?: Uint8Array }): Promise<Kernel> {
  // OCCT's transfer statistics include part details; keep routine stdout quiet.
  const kernel = await initOpenCascade({ ...options, print: () => {} });
  setOC(kernel);
  return kernel;
}

export function validateSolid(kernel: Kernel, shape: Shape3D): void {
  const analyzer = new kernel.BRepCheck_Analyzer(shape.wrapped, true);
  const explorer = new kernel.TopExp_Explorer(shape.wrapped, kernel.TopAbs_ShapeEnum.TopAbs_SOLID, kernel.TopAbs_ShapeEnum.TopAbs_SHAPE);
  try {
    let count = 0;
    while (explorer.More() && count < 2) { count++; explorer.Next(); }
    if (!analyzer.IsValid() || count !== 1) throw new Error('Expected exactly one valid CAD solid per part.');
  } finally { explorer.delete(); analyzer.delete(); }
}
