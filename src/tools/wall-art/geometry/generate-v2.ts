/** Headless generator-2 part stage. The coordinator owns numbering, batch lifetime,
 * aggregate budgets, clearance, snapshots and atomic acceptance of the complete job. */
import { measureShapeVolumeProperties, type Shape3D } from 'replicad';
import type { Kernel } from '../../../shared/geometry/kernel.ts';
import type { Bounds, Part } from '../../../shared/geometry/types.ts';
import { validateMesh, weldMesh } from '../../../shared/geometry/validate-mesh.ts';
import { DesignError, LIMITS } from '../model/budget.ts';
import { validateParametersV2 } from '../model/validation-v2.ts';
import type { BaseContour } from './layout-metadata.ts';
import { buildRelief } from './relief-v2.ts';
import { engravePart, createGlyphTemplates, type CountOperation, type Identification } from './engraving.ts';
import { polygonClearanceHull } from './clearance.ts';

export type CanonicalPartV2 = {
  part: Part; solid: Shape3D; identification: Identification; assemblyBounds: Bounds;
  clearanceHull: ReturnType<typeof polygonClearanceHull>;
};

/** BaseContour is trusted internal partition output, never imported design data.
 * The caller owns the returned solid; all failure paths release native temporaries. */
export function buildPartV2(kernel: Kernel, input: unknown, base: BaseContour, count: CountOperation, templates?: ReturnType<typeof createGlyphTemplates>): CanonicalPartV2 {
  const p = validateParametersV2(input);
  if (!Number.isInteger(base.mapNumber) || base.mapNumber < 1 || base.mapNumber > 4000) throw new DesignError('IDENTIFICATION', 'Assign the global map number before building a part.');
  // Reserve the fixed relief/restoration/validation operations before native work.
  for (let i = 0; i < 12; i++) count();
  const relief = buildRelief(kernel, p, base);
  let solid: Shape3D | undefined;
  try {
    const engraved = engravePart(kernel, p, base, relief, count, templates);
    solid = engraved.solid;
    const properties = measureShapeVolumeProperties(solid);
    let volume;
    try { volume = properties.volume; } finally { properties.delete(); }
    if (!Number.isFinite(volume) || volume <= 0) throw new DesignError('CAD_SOLID', `Part ${base.id} has invalid native volume.`);
    // X-only lofts can have nonplanar ruled sides even with straight polygon
    // edges. Refine within the chord limit when a coarse mesh misses C2 volume.
    let mesh, checked;
    for (let attempt = 0; attempt < 4; attempt++) {
      count();
      const raw = solid.mesh({ tolerance: LIMITS.chordTolerance * 0.2 ** attempt, angularTolerance: LIMITS.angleRadians });
      if (raw.triangles.length / 3 > LIMITS.trianglesPerPart) throw new DesignError('GENERATION_BUDGET', `Part ${base.id} exceeds the per-part triangle budget.`);
      mesh = weldMesh(raw.vertices, raw.triangles); checked = validateMesh(mesh);
      if (Math.abs(checked.volume - volume) / volume <= 0.001) break;
    }
    if (!mesh || !checked || Math.abs(checked.volume - volume) / volume > 0.001) throw new DesignError('MESH_VOLUME', `Part ${base.id} mesh differs from its native CAD volume.`);
    const translation: [number, number, number] = [base.centroid[0], base.centroid[1], 0];
    const box = solid.boundingBox;
    let assemblyBounds: Bounds;
    try {
      const [min, max] = box.bounds;
      assemblyBounds = { min: [min[0] + translation[0], min[1] + translation[1], min[2]], max: [max[0] + translation[0], max[1] + translation[1], max[2]] };
    } finally { box.delete(); }
    const result = { solid, identification: engraved.identification, assemblyBounds, clearanceHull: polygonClearanceHull(base,p),
      part: { id: base.id, mapNumber: base.mapNumber, translation, bounds: checked.bounds, volume, mesh } };
    solid = undefined;
    return result;
  } finally { solid?.delete(); relief.delete(); }
}
