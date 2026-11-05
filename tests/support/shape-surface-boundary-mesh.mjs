/** Checkpoint tessellation of native patches. Collapsed CAD edges can emit
 * triangles with repeated exact float32 positions; removing those zero-area
 * records changes no surface. No near-vertex welding or hole repair is allowed. */
import { measureShapeVolumeProperties } from 'replicad';
import { weldMesh, validateMesh } from '../../src/shared/geometry/validate-mesh.ts';

export function removeCollapsedTriangles(raw) {
  const welded = weldMesh(raw.vertices, raw.triangles), indices = [], positions = [], remap = new Map();
  let collapsedTriangles = 0;
  for (let i = 0; i < welded.indices.length; i += 3) {
    const triangle = [...welded.indices.slice(i, i + 3)];
    if (new Set(triangle).size < 3) { collapsedTriangles++; continue; }
    for (const index of triangle) {
      if (!remap.has(index)) { remap.set(index, positions.length / 3); positions.push(...welded.positions.slice(index * 3, index * 3 + 3)); }
      indices.push(remap.get(index));
    }
  }
  return { mesh: { positions: new Float32Array(positions), indices: new Uint32Array(indices) }, collapsedTriangles };
}

export function meshBoundarySurface(candidate, progress = () => {}) {
  for (const key of ['physicalHeightErrorMm', 'profilePositionErrorMm']) {
    if (!Number.isFinite(candidate[key]) || candidate[key] < 0 || candidate[key] > .0002) throw Error('Boundary approximation was not qualified before meshing.');
  }
  const properties = measureShapeVolumeProperties(candidate.solid);
  const failures = [];
  try {
    for (const tolerance of [.05, .01, .002, .0004]) {
      progress(`meshing-${tolerance}`);
      const options = { tolerance, angularTolerance: Math.PI / 36 };
      const raw = candidate.mesh ? candidate.mesh(options) : candidate.solid.mesh(options);
      if (raw.triangles.length / 3 > 100_000) throw Error(`Boundary mesh exceeds the part triangle budget. Earlier attempts: ${failures.join('; ')}`);
      const { mesh, collapsedTriangles } = removeCollapsedTriangles(raw);
      let checked;
      try { checked = validateMesh(mesh); }
      catch (error) { failures.push(`${tolerance}: ${error.message}`); continue; }
      const volumeError = Math.abs(checked.volume - properties.volume) / properties.volume;
      if (volumeError <= .001) return { mesh, collapsedTriangles, tolerance, volumeError, nativeVolume: properties.volume, bounds: checked.bounds,
        maximumVertexAdjustmentMm: raw.maximumVertexAdjustmentMm ?? 0 };
      failures.push(`${tolerance}: mesh/native volume difference ${volumeError}`);
    }
    throw Error(`Boundary mesh qualification failed: ${failures.join('; ')}`);
  } finally { properties.delete(); }
}
