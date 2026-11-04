/** Isolated R3 no-plinth identification. A temporary reference prism selects the
 * existing approved 2D glyph placement; it is never joined to the real part.
 * The caller must first accept the builder's bare-material/containment checks.
 * Full cutter prisms then prove the 1.2 mm residual floor in the actual solid.
 * Native uncertainty/errors reject rather than pretending to be Map-only ID. */
import { deserializeShape, makePolygon, measureShapeVolumeProperties } from 'replicad';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { validateParametersV3, layoutParametersV3 } from '../../src/tools/wall-art/model/validation-v3.ts';
import { engravePart, identificationPolygons } from '../../src/tools/wall-art/geometry/engraving.ts';
import { nativeBoolean, nativeExtrude, nativeTranslate, requireSolid } from '../../src/tools/wall-art/geometry/native-operations.ts';

export function identifyBarePart(kernel, input, base, solid) {
  const p = validateParametersV3(input);
  if (p.plinthEnabled) throw Error('Bare identification requires an actual no-plinth part.');
  validateSolid(kernel, solid);
  const box = solid.boundingBox;
  try {
    const [min, max] = box.bounds;
    if (![...min, ...max].every(Number.isFinite) || Math.abs(min[2]) > 1e-6 || max.some((v, i) => v - min[i] < 1.2)) throw Error('Bare material is invalid before identification.');
  } finally { box.delete(); }
  let operations = 0;
  const count = () => { if (++operations > 4096) throw Error('Bare identification exceeds its bounded operation allowance.'); };
  if (p.engravingDepth === 0) return { solid: solid.clone(), identification: { status: 'unengraved' }, operations };
  const resources = [], own = object => { resources.push(object); return object; };
  let result;
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
        // Positive missing volume larger than its tolerance envelope proves a
        // floor violation. A tiny residue is uncertainty, not a fallback reason.
        const mass = own(measureShapeVolumeProperties(outside)), v = mass.volume;
        const box = footprint.boundingBox, bounds = box.bounds; box.delete();
        const dx = bounds[1][0] - bounds[0][0], dy = bounds[1][1] - bounds[0][1];
        const uncertainty = .001 * 2 * (dx * dy + referenceHeight * (dx + dy));
        if (!Number.isFinite(v) || v < 0) throw Error('Invalid native volume while checking the local engraving floor.');
        if (v <= uncertainty) uncertainFloor = true;
        else missingFloor = true;
      } finally { outsideFaces.forEach(item => item.delete()); }
    }
    if (missingFloor) return { solid: solid.clone(), identification: { status: 'map-only', reason: 'residual-floor' }, operations };
    // One definite missing prism proves that both marks must be omitted, even
    // if another prism is ambiguous. Without that proof, uncertainty rejects.
    if (uncertainFloor) throw Error('Cannot certify the local engraving floor within native tolerance.');
    result = solid.clone();
    for (const footprint of footprints) {
      count(); const cutter = own(nativeExtrude(kernel, footprint, p.engravingDepth));
      count(); const cut = requireSolid(nativeBoolean(kernel, 'cut', result, cutter));
      result.delete(); result = cut;
    }
    validateSolid(kernel, result);
    const output = { solid: result, identification: id, operations }; result = undefined; return output;
  } finally {
    result?.delete();
    for (const resource of resources.reverse()) resource[Symbol.dispose] ? resource[Symbol.dispose]() : resource.delete();
  }
}
