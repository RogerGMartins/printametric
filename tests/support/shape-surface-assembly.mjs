/** Isolated assembly qualification of already material-checked, identified parts.
 * This diagnostic retains at most 32 native parts in one heap, not the production
 * 4,000-part tier. Native world bounds select pairs; every remaining pair uses the
 * actual final solids. No v2 taper hull or sampled contour certifies v3 clearance.
 * Source solids remain caller-owned. Results appear only after the whole job passes. */
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { validateMesh } from '../../src/shared/geometry/validate-mesh.ts';
import { checkLayoutBudget } from '../../src/tools/wall-art/model/validation-v2.ts';
import { clearancePairs, checkNativeClearance } from '../../src/tools/wall-art/geometry/clearance.ts';
import { nativeTranslate } from '../../src/tools/wall-art/geometry/native-operations.ts';
import { meshBoundarySurface } from './shape-surface-boundary-mesh.mjs';

export function qualifyFootprintAssembly(kernel, candidates) {
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 32) throw Error('Assembly fixture requires 1–32 native parts.');
  const ids = new Set(), numbers = new Set();
  for (const candidate of candidates) {
    if (typeof candidate.id !== 'string' || !candidate.id || ids.has(candidate.id) ||
      !Number.isSafeInteger(candidate.mapNumber) || candidate.mapNumber < 1 || candidate.mapNumber > 4000 || numbers.has(candidate.mapNumber)) throw Error('Assembly part identity is invalid or duplicated.');
    if (!Array.isArray(candidate.translation) || candidate.translation.length !== 3 ||
      !candidate.translation.every(value => Number.isFinite(value) && Math.abs(value) <= 4000) || candidate.translation[2] !== 0) throw Error(`Invalid assembly placement for ${candidate.id}.`);
    if (!['engraved', 'map-only', 'unengraved'].includes(candidate.identification?.status)) throw Error(`Missing final identification for ${candidate.id}.`);
    ids.add(candidate.id); numbers.add(candidate.mapNumber);
  }
  const placed = [], bounds = [], parts = [], meshes = [];
  let triangles = 0, meshBytes = 0;
  try {
    for (const candidate of candidates) {
      validateSolid(kernel, candidate.solid);
      const solid = nativeTranslate(kernel, candidate.solid, ...candidate.translation);
      placed.push(solid);
      const box = solid.boundingBox;
      try {
        const [min, max] = box.bounds;
        bounds.push({ id: candidate.id, bounds: { min, max } });
      } finally { box.delete(); }
    }
    const pairs = clearancePairs(bounds), distances = [];
    const budget = () => checkLayoutBudget({ parts: candidates.length, contourVertices: 0, cadOperations: pairs.length, triangles, memoryBytes: meshBytes });
    budget();
    for (const [left, right] of pairs) distances.push({ left: candidates[left].id, right: candidates[right].id,
      distance: checkNativeClearance(placed[left], placed[right], candidates[left].id, candidates[right].id) });
    for (const candidate of candidates) {
      let result;
      try { result = meshBoundarySurface(candidate); }
      catch (cause) { throw new Error(`Assembly mesh ${candidate.id}: ${cause.message}`, { cause }); }
      const checked = validateMesh(result.mesh);
      triangles += result.mesh.indices.length / 3;
      meshBytes += result.mesh.positions.byteLength + result.mesh.indices.byteLength;
      // Count retained canonical bytes; native/GPU peak memory needs measurement.
      budget();
      parts.push({ id: candidate.id, mapNumber: candidate.mapNumber, translation: [...candidate.translation], mesh: result.mesh, ...checked });
      meshes.push({ volumeError: result.volumeError, nativeVolume: result.nativeVolume, tolerance: result.tolerance });
    }
    return { parts, meshes, distances, triangles, meshBytes };
  } finally { placed.reverse().forEach(solid => solid.delete()); }
}
