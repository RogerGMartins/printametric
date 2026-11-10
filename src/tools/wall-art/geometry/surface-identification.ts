/** Engrave only material-checked candidates. A proven missing floor omits both
 * marks; uncertain native results reject. Shape and glyph anchors stay distinct. */
import { deserializeShape, makePolygon, measureShapeVolumeProperties, isShape3D, type Shape3D } from 'replicad';
import { validateSolid, type Kernel } from '../../../shared/geometry/kernel.ts';
import { validateParametersV3, layoutParametersV3 } from '../model/validation-v3.ts';
import { engravePart, identificationPolygons, type Identification } from './engraving.ts';
import { nativeBoolean, nativeExtrude, nativeTranslate, requireSolid } from './native-operations.ts';
import { nativeResources } from './native-resources.ts';
import type { BaseContour } from './layout-metadata.ts';
import { meshWithNativeVertices, type SurfaceMeshOptions } from './surface-vertex-mesh.ts';
import type { SurfaceMeshCandidate } from './surface-mesh.ts';

type BareIdentification = { solid: Shape3D; identification: Identification & { reason?: 'glyph-fit' | 'residual-floor' }; operations: number };
export function identifyBarePart(kernel: Kernel, input: unknown, base: BaseContour, solid: Shape3D): BareIdentification {
  const p = validateParametersV3(input);
  if (p.plinthEnabled) throw Error('Bare identification requires an actual no-plinth part.');
  validateSolid(kernel, solid);
  const box = solid.boundingBox;
  try {
    const [min, max] = box.bounds;
    if (![...min, ...max].every(Number.isFinite) || Math.abs(min[2]) > 1e-6 || max.some((v, i) => v - min[i]! < 1.2)) throw Error('Bare material is invalid before identification.');
  } finally { box.delete(); }
  let operations = 0;
  const count = () => { if (++operations > 4096) throw Error('Bare identification exceeds its bounded operation allowance.'); };
  if (p.engravingDepth === 0) return { solid: solid.clone(), identification: { status: 'unengraved' }, operations };
  const scope = nativeResources(), own = scope.own;
  let result: Shape3D | undefined;
  try {
    const source = own(deserializeShape(base.nativeFace)), face = own(nativeTranslate(kernel, source, -base.centroid[0], -base.centroid[1], 0));
    const referenceHeight = p.engravingDepth + 1.2;
    count(); const reference = own(nativeExtrude(kernel, face, referenceHeight));
    const placement = engravePart(kernel, { ...layoutParametersV3(p), baseThickness: referenceHeight }, base, reference, count);
    own(placement.solid);
    if (placement.identification.status === 'map-only') return { solid: solid.clone(), identification: { status: 'map-only', reason: 'glyph-fit' }, operations };
    if (placement.identification.status !== 'engraved') throw Error('Unexpected bare identification placement state.');
    const id = placement.identification, polygons = identificationPolygons(base.mapNumber, id.height, p.orientationMark).flat();
    const footprints = polygons.map(points => { count(); return own(makePolygon(points.map(([x, y]) => [x + id.anchor[0], y + id.anchor[1], 0]))); });
    let missingFloor = false, uncertainFloor = false;
    for (const footprint of footprints) {
      count(); const prism = own(nativeExtrude(kernel, footprint, referenceHeight));
      count(); const outside = own(nativeBoolean(kernel, 'cut', prism, solid));
      const outsideFaces = outside.faces;
      try {
        if (!outsideFaces.length) continue;
        if (!isShape3D(outside)) throw Error('Cannot certify the local engraving floor from a nonsolid residue.');
        const mass = own(measureShapeVolumeProperties(outside)), v = mass.volume;
        const box = footprint.boundingBox, bounds = box.bounds; box.delete();
        const dx = bounds[1][0] - bounds[0][0], dy = bounds[1][1] - bounds[0][1];
        const uncertainty = .001 * 2 * (dx * dy + referenceHeight * (dx + dy));
        if (!Number.isFinite(v) || v < 0) throw Error('Invalid native volume while checking the local engraving floor.');
        if (v <= uncertainty) uncertainFloor = true; else missingFloor = true;
      } finally { outsideFaces.forEach(item => item.delete()); }
    }
    if (missingFloor) return { solid: solid.clone(), identification: { status: 'map-only', reason: 'residual-floor' }, operations };
    if (uncertainFloor) throw Error('Cannot certify the local engraving floor within native tolerance.');
    result = solid.clone();
    for (const footprint of footprints) {
      count(); const cutter = own(nativeExtrude(kernel, footprint, p.engravingDepth));
      count(); const cut = requireSolid(nativeBoolean(kernel, 'cut', result, cutter));
      result.delete(); result = cut;
    }
    validateSolid(kernel, result);
    const output = { solid: result, identification: id, operations }; result = undefined; return output;
  } finally { result?.delete(); scope.dispose(); }
}

/** Candidate/source stay caller-owned. The new mesher closes over the identified
 * final solid, never the uncut source; translation remains in the shape frame. */
export function identifyFootprintCandidate<T extends SurfaceMeshCandidate & { translation?: [number, number, number] }>(kernel: Kernel, input: unknown, base: BaseContour, candidate: T) {
  const p = validateParametersV3(input), translation = candidate.translation;
  if (!translation || translation.length !== 3 || !translation.every(Number.isFinite) || translation[2] !== 0 ||
    base.centroid.length !== 2 || !base.centroid.every(Number.isFinite)) throw Error('Identification requires a bounded footprint coordinate frame.');
  const dx = translation[0] - base.centroid[0], dy = translation[1] - base.centroid[1];
  const centered = requireSolid(nativeTranslate(kernel, candidate.solid, dx, dy, 0));
  let identified: { solid: Shape3D; identification: Identification; operations?: number } | undefined, solid: Shape3D | undefined, operations = 0;
  const count = () => { if (++operations > 4096) throw Error('Footprint identification exceeds its bounded operation allowance.'); };
  try {
    identified = p.plinthEnabled ? engravePart(kernel, layoutParametersV3(p), base, centered, count) : identifyBarePart(kernel, p, base, centered);
    operations = identified.operations ?? operations;
    solid = requireSolid(nativeTranslate(kernel, identified.solid, -dx, -dy, 0)); validateSolid(kernel, solid);
    const identification: Identification = identified.identification.status === 'engraved'
      ? { ...identified.identification, anchor: [identified.identification.anchor[0] - dx, identified.identification.anchor[1] - dy] } : { ...identified.identification };
    const finalSolid = solid;
    const result = { ...candidate, solid: finalSolid, translation: [...translation] as [number, number, number], identification, identificationOperations: operations,
      id: base.id, mapNumber: base.mapNumber, mesh: (options: SurfaceMeshOptions) => meshWithNativeVertices(kernel, finalSolid, options) };
    solid = undefined; return result;
  } finally { solid?.delete(); identified?.solid.delete(); centered.delete(); }
}
