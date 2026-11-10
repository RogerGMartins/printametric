/** Canonical tessellation of the accepted native solid. Only exactly collapsed
 * Float32 triangles may be removed; no near-vertex weld or hole repair is allowed. */
import { getOC, type Shape3D } from 'replicad';
import { weldMesh, validateMesh } from '../../../shared/geometry/validate-mesh.ts';
import type { SurfaceMeshOptions } from './surface-vertex-mesh.ts';

type RawMesh = { vertices: number[]; triangles: number[]; maximumVertexAdjustmentMm?: number };
export interface SurfaceMeshCandidate {
  solid: Shape3D; physicalHeightErrorMm: number; profilePositionErrorMm: number;
  mesh?: (options: SurfaceMeshOptions) => RawMesh;
}
export function removeCollapsedTriangles(raw: RawMesh) {
  const welded = weldMesh(raw.vertices, raw.triangles), indices: number[] = [], positions: number[] = [], remap = new Map<number, number>();
  let collapsedTriangles = 0;
  for (let i = 0; i < welded.indices.length; i += 3) {
    const triangle = [...welded.indices.slice(i, i + 3)];
    if (new Set(triangle).size < 3) { collapsedTriangles++; continue; }
    for (const index of triangle) {
      if (!remap.has(index)) { remap.set(index, positions.length / 3); positions.push(...welded.positions.slice(index * 3, index * 3 + 3)); }
      indices.push(remap.get(index)!);
    }
  }
  return { mesh: { positions: new Float32Array(positions), indices: new Uint32Array(indices) }, collapsedTriangles };
}

/** Adaptive integration bounds the native reference before mesh comparison. */
export function measureBoundaryVolume(solid: Shape3D) {
  const kernel = getOC(), properties = new kernel.GProp_GProps();
  try {
    const nativeVolumeRelativeError = kernel.BRepGProp.VolumeProperties(solid.wrapped, properties, 1e-9, true, false);
    const nativeVolume = properties.Mass();
    if (!Number.isFinite(nativeVolumeRelativeError) || nativeVolumeRelativeError < 0 || nativeVolumeRelativeError > 1e-9 ||
      !Number.isFinite(nativeVolume) || nativeVolume <= 0) throw Error('Native volume integration did not establish a positive bounded reference.');
    return { nativeVolume, nativeVolumeRelativeError };
  } finally { properties.delete(); }
}

export function meshBoundarySurface(candidate: SurfaceMeshCandidate, progress: (stage: string) => void = () => {}) {
  for (const key of ['physicalHeightErrorMm', 'profilePositionErrorMm'] as const) {
    if (!Number.isFinite(candidate[key]) || candidate[key] < 0 || candidate[key] > .0002) throw Error('Boundary approximation was not qualified before meshing.');
  }
  const { nativeVolume, nativeVolumeRelativeError } = measureBoundaryVolume(candidate.solid), failures: string[] = [];
  for (const tolerance of [.05, .01, .002, .0004]) {
    progress(`meshing-${tolerance}`);
    const options = { tolerance, angularTolerance: Math.PI / 36 };
    const raw: RawMesh = candidate.mesh ? candidate.mesh(options) : candidate.solid.mesh(options);
    if (raw.triangles.length / 3 > 100_000) throw Error(`Boundary mesh exceeds the part triangle budget. Earlier attempts: ${failures.join('; ')}`);
    const { mesh, collapsedTriangles } = removeCollapsedTriangles(raw);
    let checked;
    try { checked = validateMesh(mesh); }
    catch (error) { failures.push(`${tolerance}: ${error instanceof Error ? error.message : String(error)}`); continue; }
    const volumeError = (Math.abs(checked.volume - nativeVolume) / nativeVolume + nativeVolumeRelativeError) / (1 - nativeVolumeRelativeError);
    if (volumeError <= .001) return { mesh, collapsedTriangles, tolerance, volumeError, nativeVolume, nativeVolumeRelativeError, bounds: checked.bounds,
      maximumVertexAdjustmentMm: raw.maximumVertexAdjustmentMm ?? 0 };
    failures.push(`${tolerance}: mesh/native volume difference ${volumeError}`);
  }
  throw Error(`Boundary mesh qualification failed: ${failures.join('; ')}`);
}
