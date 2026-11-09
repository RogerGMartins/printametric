/** Isolated identification handoff after the footprint builder's material checks.
 * Shape anchors and phase-02 glyph anchors use different local frames. Preserve
 * the existing area-centroid-first glyph search, then return the final solid in
 * the shape-anchor frame. Source CAD/metadata remain caller-owned and unchanged.
 * Preview and exports must use this result, including its final-solid mesher. */
import { validateParametersV3, layoutParametersV3 } from '../../src/tools/wall-art/model/validation-v3.ts';
import { engravePart } from '../../src/tools/wall-art/geometry/engraving.ts';
import { nativeTranslate } from '../../src/tools/wall-art/geometry/native-operations.ts';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { identifyBarePart } from './shape-surface-bare-identification.mjs';
import { meshWithNativeVertices } from './shape-surface-vertex-mesh.mjs';

export function identifyFootprintCandidate(kernel, input, base, candidate) {
  const p = validateParametersV3(input), translation = candidate.translation;
  if (!translation || translation.length !== 3 || !translation.every(Number.isFinite) || translation[2] !== 0 ||
    base.centroid.length !== 2 || !base.centroid.every(Number.isFinite)) throw Error('Identification requires a bounded footprint coordinate frame.');
  const dx = translation[0] - base.centroid[0], dy = translation[1] - base.centroid[1];
  const centered = nativeTranslate(kernel, candidate.solid, dx, dy, 0);
  let identified, solid, operations = 0;
  const count = () => { if (++operations > 4096) throw Error('Footprint identification exceeds its bounded operation allowance.'); };
  try {
    identified = p.plinthEnabled
      ? engravePart(kernel, layoutParametersV3(p), base, centered, count)
      : identifyBarePart(kernel, p, base, centered);
    operations = identified.operations ?? operations;
    solid = nativeTranslate(kernel, identified.solid, -dx, -dy, 0);
    validateSolid(kernel, solid);
    const identification = identified.identification.status === 'engraved'
      ? { ...identified.identification, anchor: [identified.identification.anchor[0] - dx, identified.identification.anchor[1] - dy] }
      : { ...identified.identification };
    const finalSolid = solid;
    const result = { ...candidate, solid: finalSolid, translation: [...translation], identification, identificationOperations: operations,
      id: base.id, mapNumber: base.mapNumber, mesh: options => meshWithNativeVertices(kernel, finalSolid, options) };
    solid = undefined;
    return result;
  } finally { solid?.delete(); identified?.solid.delete(); centered.delete(); }
}
