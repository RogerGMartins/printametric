/** Canonical millimeter geometry. Mesh arrays are the sole preview/mesh-export source. */
export type Vector3 = [number, number, number];
export interface Bounds { min: Vector3; max: Vector3 }
export interface Mesh { positions: Float32Array<ArrayBuffer>; indices: Uint32Array<ArrayBuffer> }
export interface Part {
  id: string;
  mapNumber: number;
  translation: Vector3;
  bounds: Bounds;
  volume: number;
  mesh: Mesh;
}
export interface ModelResult {
  revision: number;
  digest: string;
  units: 'mm';
  parts: Part[];
  bounds: Bounds;
  diagnostics: string[];
  budget: { triangles: number; meshBytes: number; wasmBytes: number; elapsedMs: number };
}
export type ExportFormat = 'stl' | 'step' | '3mf';
