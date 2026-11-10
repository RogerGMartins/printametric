/** Reproducible P2 comparison assemblies; this is not production generator dispatch. */
import { deserializeShape } from 'replicad';
import { DEFAULT_PARAMETERS_V3, SURFACE_FAMILIES } from '../../src/tools/wall-art/model/parameters-v3.ts';
import { validateParametersV3, layoutParametersV3 } from '../../src/tools/wall-art/model/validation-v3.ts';
import { partitionLayout } from '../../src/tools/wall-art/geometry/layouts/partition.ts';
import { selectNativeAnchor } from './shape-surface-anchor.mjs';
import { nativeFootprintMoments, buildPlanarFootprint } from './shape-surface-footprint-native.mjs';
import { buildBoundarySurface } from './shape-surface-boundary-native.mjs';
import { identifyFootprintCandidate } from './shape-surface-identified-footprint.mjs';
import { qualifyFootprintAssembly } from './shape-surface-assembly.mjs';
import { surfaceErrorLedger } from './shape-surface-error-ledger.mjs';

const base = { ...DEFAULT_PARAMETERS_V3, width: 100, height: 100, straightBoundary: true, topRatio: .8, concavity: 2.2 };
export const SURFACE_REVIEW_FIXTURES = Object.freeze([
  ...SURFACE_FAMILIES.flatMap(family => [
    ['stepped', { stepBlend: 1 }], ['continuous', { stepBlend: 0 }],
    ['blend', { stepBlend: .5 }], ['planar', { stepBlend: 0, planarTops: true }],
    ['narrow', { stepBlend: 1, topRatio: .12 }],
  ].map(([mode, change]) => ({ id: `${family}-${mode}`, parameters: { ...base, family, ...change } }))),
  { id: 'wave-wide-rotated', parameters: { ...base, width: 200, rotation: 37, stepBlend: 0 } },
  { id: 'wave-tall-rotated', parameters: { ...base, height: 200, rotation: 37, stepBlend: 0 } },
  { id: 'wave-curved-radial', parameters: { ...base, outline: 'ellipse', layout: 'radial', stepBlend: 0 } },
  { id: 'wave-sloping-plane', parameters: { ...base, density: .6, phase: .29, rotation: 37, stepBlend: 0, planarTops: true } },
  { id: 'wave-bare-engraved', parameters: { ...base, outline: 'ellipse', layout: 'radial', stepBlend: 0, plinthEnabled: false, depth: 3 } },
  { id: 'wave-bare-map-only', parameters: { ...base, outline: 'ellipse', layout: 'radial', stepBlend: 0, plinthEnabled: false, minimumRelief: 1.3, depth: .1 } },
  { id: 'wave-bare-invalid', parameters: { ...base, stepBlend: 0, plinthEnabled: false, minimumRelief: .5, depth: .1 }, expectedError: /vertical material bounds/ },
]);

/** Caller owns returned final solids and must dispose them, also after export failure. */
export function buildSurfaceReview(kernel, input, progress = () => {}) {
  const parameters = validateParametersV3(input);
  let cadOperations = 0;
  kernel = new Proxy(kernel, { get(target, key) {
    const value = Reflect.get(target, key);
    if (typeof key !== 'string' || typeof value !== 'function' || !/^(BRepAlgoAPI_|BRepBuilderAPI_|BRepOffsetAPI_|BRepMesh_)/.test(key)) return value;
    return new Proxy(value, { construct(constructor, args) {
      if (++cadOperations > 200000) throw Error('Review native-construction operation budget exceeded.');
      return Reflect.construct(constructor, args);
    } });
  } });
  const layout = partitionLayout(kernel, layoutParametersV3(parameters));
  if (layout.bases.length > 32 || layout.excluded.length) throw Error('Review requires a complete 1–32-part layout without exclusions.');
  // Two moment requests plus one top sampler bound field evaluation work per part.
  const reservedFieldEvaluations = layout.bases.length * 3 * 65536;
  if (reservedFieldEvaluations > 4000000) throw Error('Review aggregate field-work reservation exceeded.');
  const candidates = [];
  try {
    for (const source of layout.bases) {
      let bare;
      try {
        if (parameters.stepBlend === 1 || parameters.planarTops) {
          const face = deserializeShape(source.nativeFace);
          let anchor;
          try { anchor = selectNativeAnchor(kernel, face, source.centroid); } finally { face.delete(); }
          const mean = nativeFootprintMoments(kernel, source, parameters, { anchor: anchor.point, spiralCenter: 'smooth-c2', tolerance: .0001 / Math.max(parameters.depth, 1) });
          const fitted = parameters.planarTops && parameters.stepBlend !== 1
            ? nativeFootprintMoments(kernel, source, parameters, { anchor: anchor.point, ratio: parameters.topRatio, plane: true, spiralCenter: 'smooth-c2' }) : undefined;
          const coefficients = fitted?.fitted.coefficients ?? [mean.mean, 0, 0], blend = parameters.stepBlend;
          const z = (parameters.plinthEnabled ? parameters.baseThickness : 0) + parameters.minimumRelief;
          bare = buildPlanarFootprint(kernel, { ...source, centroid: anchor.point }, { ratio: parameters.topRatio, concavity: parameters.concavity,
            baseThickness: parameters.plinthEnabled ? parameters.baseThickness : 0,
            top: [z + parameters.depth * (blend * mean.mean + (1 - blend) * coefficients[0]),
              parameters.depth * (1 - blend) * coefficients[1] / (fitted?.scale ?? 1), parameters.depth * (1 - blend) * coefficients[2] / (fitted?.scale ?? 1)] });
          bare.translation = [...anchor.point, 0]; bare.anchorCertificate = anchor; bare.planarCoefficients = [...coefficients];
          bare.physicalHeightErrorMm = parameters.depth * (blend * mean.error + (1 - blend) * (fitted?.fitted.error ?? mean.error));
        } else bare = buildBoundarySurface(kernel, parameters, { footprint: source, spiralCenter: 'smooth-c2' });
        candidates.push(identifyFootprintCandidate(kernel, parameters, source, bare));
        progress(source.mapNumber);
      } finally { bare?.solid.delete(); }
    }
    const errors = candidates.map(candidate => surfaceErrorLedger(kernel, candidate, parameters.topRatio));
    const result = qualifyFootprintAssembly(kernel, candidates);
    return { ...result, candidates, parameters, errors, cadOperations, reservedFieldEvaluations };
  } catch (error) { candidates.forEach(candidate => candidate.solid.delete()); throw error; }
}
