/** Approved native generator-3 part path. The caller owns the returned final solid;
 * archived STEP and canonical preview/mesh exports all use this identified solid. */
import { deserializeShape, Face } from 'replicad';
import type { Kernel } from '../../../shared/geometry/kernel.ts';
import type { Bounds } from '../../../shared/geometry/types.ts';
import { DesignError } from '../model/budget.ts';
import { validateParametersV3 } from '../model/validation-v3.ts';
import { partTopologyKey } from '../model/part-identity.ts';
import type { BaseContour } from './layout-metadata.ts';
import type { CanonicalPartV2 } from './generate-v2.ts';
import { selectNativeAnchor } from './surface-anchor.ts';
import { nativeFootprintMoments } from './surface-footprint.ts';
import { buildPlanarFootprint } from './surface-planar-native.ts';
import { buildBoundarySurface } from './surface-boundary-native.ts';
import { identifyFootprintCandidate } from './surface-identification.ts';
import { surfaceErrorLedger } from './surface-error-ledger.ts';
import { meshBoundarySurface, type SurfaceMeshCandidate } from './surface-mesh.ts';
import { GENERATOR_3_SPIRAL_CENTER } from './spiral-center.ts';
import { nativeExtrude, nativeTranslate, requireSolid } from './native-operations.ts';

export function buildPartV3(kernel: Kernel, input: unknown, source: BaseContour, charge: (count: number) => void): CanonicalPartV2 {
  const p = validateParametersV3(input);
  if (!source.id.startsWith('wa-g3-') || !Number.isSafeInteger(source.mapNumber) || source.mapNumber < 1 || source.mapNumber > 4000)
    throw new DesignError('IDENTITY', 'Generator 3 requires a numbered native contour.');
  partTopologyKey(source);
  let bare: (SurfaceMeshCandidate & { translation?: [number, number, number] }) | undefined;
  let final: ReturnType<typeof identifyFootprintCandidate> | undefined;
  try {
    if (p.depth === 0 && p.minimumRelief === 0) {
      const face = deserializeShape(source.nativeFace);
      try {
        const local = nativeTranslate(kernel, face, -source.centroid[0], -source.centroid[1], 0);
        try { bare = { solid: requireSolid(nativeExtrude(kernel, local, p.baseThickness)), translation: [...source.centroid, 0],
          physicalHeightErrorMm: 0, profilePositionErrorMm: 0 }; }
        finally { local.delete(); }
      } finally { face.delete(); }
    } else if (p.depth === 0 || p.stepBlend === 1 || p.planarTops) {
      const face = deserializeShape(source.nativeFace);
      let anchor;
      try {
        if (!(face instanceof Face)) throw new DesignError('CONTOUR', 'Expected a native footprint face.');
        anchor = selectNativeAnchor(kernel, face, source.centroid);
      } finally { face.delete(); }
      const mean = p.depth === 0 ? { mean: 0, error: 0 } : nativeFootprintMoments(kernel, source, p,
        { anchor: anchor.point, spiralCenter: GENERATOR_3_SPIRAL_CENTER, tolerance: .0001 / Math.max(p.depth, 1), charge });
      const fitted = p.depth !== 0 && p.planarTops && p.stepBlend !== 1 ? nativeFootprintMoments(kernel, source, p,
        { anchor: anchor.point, ratio: p.topRatio, plane: true, spiralCenter: GENERATOR_3_SPIRAL_CENTER, charge }) : undefined;
      const coefficients = fitted?.fitted?.coefficients ?? [mean.mean, 0, 0], blend = p.stepBlend;
      const z = (p.plinthEnabled ? p.baseThickness : 0) + p.minimumRelief;
      bare = { ...buildPlanarFootprint(kernel, { ...source, centroid: anchor.point }, {
        ratio: p.topRatio, concavity: p.concavity, baseThickness: p.plinthEnabled ? p.baseThickness : 0,
        top: [z + p.depth * (blend * mean.mean + (1 - blend) * coefficients[0]!),
          p.depth * (1 - blend) * coefficients[1]! / (fitted?.scale ?? 1), p.depth * (1 - blend) * coefficients[2]! / (fitted?.scale ?? 1)],
      }), translation: [...anchor.point, 0], physicalHeightErrorMm: p.depth * (blend * mean.error + (1 - blend) * (fitted?.fitted?.error ?? mean.error)) };
    } else bare = buildBoundarySurface(kernel, p, { footprint: source, spiralCenter: GENERATOR_3_SPIRAL_CENTER, charge });
    final = identifyFootprintCandidate(kernel, p, source, bare);
    surfaceErrorLedger(kernel, final, p.topRatio);
    const checked = meshBoundarySurface(final), translation = final.translation;
    const box = final.solid.boundingBox;
    let assemblyBounds: Bounds;
    try {
      const [min, max] = box.bounds;
      assemblyBounds = { min: [min[0] + translation[0], min[1] + translation[1], min[2]],
        max: [max[0] + translation[0], max[1] + translation[1], max[2]] };
    } finally { box.delete(); }
    const result: CanonicalPartV2 = { solid: final.solid, identification: final.identification, assemblyBounds, clearanceHull: null,
      part: { id: source.id, mapNumber: source.mapNumber, translation, bounds: checked.bounds, volume: checked.nativeVolume, mesh: checked.mesh } };
    final = undefined; return result;
  } catch(error) {
    const message=error instanceof Error?error.message:'Native surface construction failed.';
    throw new DesignError(error instanceof DesignError?error.code:'CAD',`Part ${source.mapNumber} (${source.id}): ${message}`,
      error instanceof DesignError?error.field:!p.plinthEnabled&&/material|height bounds|planar footprint parameters/.test(message)?'plinthEnabled':undefined);
  } finally { final?.solid.delete(); bare?.solid.delete(); }
}
