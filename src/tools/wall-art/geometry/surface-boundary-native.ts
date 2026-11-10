/** Native continuous tops and shared-boundary flanks. Footprint results are local
 * to the selected anchor; their translation is mandatory in preview and exports.
 * Rectangular diagnostics retain world coordinates and an explicit center mode. */
import { cast, makePolygon, deserializeShape, Face, Shell, type AnyShape, type Shape3D } from 'replicad';
import type { Geom_BSplineSurface } from 'replicad-opencascadejs';
import { validateSolid, type Kernel } from '../../../shared/geometry/kernel.ts';
import { nativeBoolean, nativeExtrude, nativeScale, nativeTranslate, requireSolid } from './native-operations.ts';
import { nativeResources } from './native-resources.ts';
import { createBoundaryPatches } from './surface-sampling.ts';
import { fitPowerProfile } from './surface-fit.ts';
import { reduceBoundaryCurve } from './surface-boundary-curve.ts';
import type { BoundaryWork } from './surface-boundary-reparameterize.ts';
import { rectangleSurfaceMoments } from './surface-moments.ts';
import { validateParametersV3 } from '../model/validation-v3.ts';
import { prepareFootprint, nativeFootprintMoments } from './surface-footprint.ts';
import { selectNativeAnchor, type SurfaceAnchor } from './surface-anchor.ts';
import { classifySpan } from './layouts/span.ts';
import { meshWithNativeVertices, type SurfaceMeshOptions } from './surface-vertex-mesh.ts';
import type { BaseContour } from './layout-metadata.ts';
import type { XY } from './layouts/cells.ts';
import type { SpiralCenter } from './spiral-center.ts';

export type BoundarySurfaceOptions = { width?: number; origin?: XY; footprint?: BaseContour;
  progress?: (stage: string) => void; boundaryReduction?: boolean; spiralCenter?: SpiralCenter; charge?: (count: number) => void };
export function buildBoundarySurface(kernel: Kernel, input: unknown, { width = 47.5, origin = [0, 0], footprint,
  progress = () => {}, boundaryReduction = true, spiralCenter = 'linear', charge }: BoundarySurfaceOptions = {}) {
  const parameters = validateParametersV3(input);
  if (parameters.planarTops) throw Error('Planar tops require the constrained plane builder.');
  if (!Number.isFinite(width) || width <= 0 || width > 2000 || origin.length !== 2 || !origin.every(Number.isFinite)) throw Error('Invalid boundary fixture dimensions.');
  const baseZ = parameters.plinthEnabled ? parameters.baseThickness : 0, baseline = baseZ + parameters.minimumRelief;
  const scope = nativeResources(), own = scope.own;
  const topFaces: Face[] = [], faces: AnyShape[] = [], boundaryCurves: { originalPoles: number; poles: number; degree: number; rational: boolean }[] = [];
  const boundaryTolerance = Math.min(.00001, parameters.topRatio * .00005), work: BoundaryWork = { comparisons: 0 };
  let solid: Shape3D | undefined, maximumBoundaryReductionMm = 0, originalBoundaryPoles = 0;
  function knots(values: number[], multiplicities: number[]) {
    const result = own(new kernel.NCollection_Array1_double(1, values.length)), mults = own(new kernel.NCollection_Array1_int(1, values.length));
    values.forEach((value, i) => { result.SetValue(i + 1, value); mults.SetValue(i + 1, multiplicities[i]!); });
    return [result, mults] as const;
  }
  function face(surface: Geom_BSplineSurface) {
    const maker = own(new kernel.BRepBuilderAPI_MakeFace(surface, .000001));
    if (!maker.IsDone()) throw Error('Patch face construction failed.');
    return own(cast(own(maker.Face())));
  }
  try {
    let baseFace: AnyShape, topFace: AnyShape, anchorCertificate: SurfaceAnchor | undefined, maximumContourApproximationMm = 0, radius = width / 2 * Math.SQRT2;
    if (footprint) {
      const source = own(deserializeShape(footprint.nativeFace));
      if (!(source instanceof Face)) throw Error('Continuous footprint requires a native face.');
      anchorCertificate = selectNativeAnchor(kernel, source, footprint.centroid); origin = anchorCertificate.point;
      const prepared = prepareFootprint(kernel, { ...footprint, centroid: origin }, own, true);
      radius = prepared.radius; maximumContourApproximationMm = prepared.maximumContourApproximationMm;
      baseFace = own(nativeTranslate(kernel, prepared.local, ...origin, 0));
      const localTop = own(nativeScale(kernel, prepared.local, parameters.topRatio));
      if (!(localTop instanceof Face) || classifySpan(kernel, localTop).below) throw Error('Continuous footprint top is narrower than 1.2 mm.');
      topFace = own(nativeTranslate(kernel, localTop, ...origin, 0));
    } else {
      const square = (half: number) => own(makePolygon([[origin[0] - half, origin[1] - half, 0], [origin[0] + half, origin[1] - half, 0], [origin[0] + half, origin[1] + half, 0], [origin[0] - half, origin[1] + half, 0]]));
      baseFace = square(width / 2); topFace = square(width * parameters.topRatio / 2);
    }
    const mean = !parameters.stepBlend ? { mean: 0, error: 0 } : footprint
      ? nativeFootprintMoments(kernel, footprint, parameters, { anchor: origin, spiralCenter, ...(charge ? { charge } : {}) })
      : rectangleSurfaceMoments(parameters, { minX: origin[0] - width / 2, maxX: origin[0] + width / 2,
        minY: origin[1] - width / 2, maxY: origin[1] + width / 2 }, spiralCenter);
    const box = own(topFace.boundingBox), half = width * parameters.topRatio / 2;
    const [min, max] = footprint ? box.bounds : [[origin[0] - half, origin[1] - half], [origin[0] + half, origin[1] + half]] as const;
    const patches = createBoundaryPatches({ ...parameters, stepBlend: 0 }, { minX: min[0] - .00001, maxX: max[0] + .00001, minY: min[1] - .00001, maxY: max[1] + .00001 }, spiralCenter, !!footprint, charge);
    const physicalHeightErrorMm = (1 - parameters.stepBlend) * Math.max(...patches.map(p => p.physicalHeightErrorMm)) + parameters.depth * parameters.stepBlend * mean.error;
    if (physicalHeightErrorMm > .0002) throw Error('Blended surface exceeds the existing height-error allocation.');
    // Analytic [0,1] bounds can be tighter than high-degree control hulls.
    const lowerHeight = baseline + parameters.depth * parameters.stepBlend * mean.mean - physicalHeightErrorMm;
    const upperHeight = baseline + parameters.depth * (parameters.stepBlend * mean.mean + 1 - parameters.stepBlend) + physicalHeightErrorMm;
    const fieldHeightValid = lowerHeight > baseZ && lowerHeight >= 1.2 && upperHeight <= 360;
    let poles = patches.reduce((sum, patch) => sum + patch.poles.length / 3, 0);
    const clip = own(nativeExtrude(kernel, own(nativeTranslate(kernel, topFace, 0, 0, -1)), 500));
    for (const patch of patches) {
      progress(`top-patch-${patch.id}`);
      const net = own(new kernel.NCollection_Array2_gp_Pnt(1, patch.degreeU + 1, 1, patch.degreeV + 1));
      for (let i = 0; i <= patch.degreeU; i++) for (let j = 0; j <= patch.degreeV; j++) {
        const offset = 3 * (i * (patch.degreeV + 1) + j), xyz = patch.poles.slice(offset, offset + 3);
        const height = baseline + parameters.depth * parameters.stepBlend * mean.mean + (1 - parameters.stepBlend) * (xyz[2]! - baseline);
        if (footprint && !fieldHeightValid && (height - physicalHeightErrorMm <= baseZ || height - physicalHeightErrorMm < 1.2 || height + physicalHeightErrorMm > 360)) throw Error('Continuous footprint cannot certify its vertical material bounds.');
        const point = new kernel.gp_Pnt(xyz[0]!, xyz[1]!, height);
        try { net.SetValue(i + 1, j + 1, point); } finally { point.delete(); }
      }
      const [u, um] = knots([0, 1], [patch.degreeU + 1, patch.degreeU + 1]), [v, vm] = knots([0, 1], [patch.degreeV + 1, patch.degreeV + 1]);
      const surface = own(new kernel.Geom_BSplineSurface(net, u, v, um, vm, patch.degreeU, patch.degreeV, false, false));
      const clipped = own(nativeBoolean(kernel, 'common', face(surface), clip));
      for (const item of clipped.faces) topFaces.push(own(item));
    }
    if (!topFaces.length) throw Error('No trimmed top faces.');
    progress('top-sewing');
    const topSewing = own(new kernel.BRepBuilderAPI_Sewing(.000001, true, true, true, false));
    for (const item of topFaces) topSewing.Add(item.wrapped);
    topSewing.Perform();
    if (topSewing.NbMultipleEdges() || !topSewing.NbFreeEdges()) throw Error('Unexpected top boundary topology.');
    const topShell = own(cast(own(topSewing.SewedShape())));
    for (const item of topShell.faces) faces.push(own(item));
    const freeEdges = topSewing.NbFreeEdges(); progress(`top-sewn-${freeEdges}-boundary-edges`);
    const profile = fitPowerProfile(parameters.concavity, .0002 / (radius * Math.max(1 - parameters.topRatio, .000001)), !!footprint);
    const profileValues = [...profile.coefficients].reverse(), verticalDegree = profileValues.length - 1;
    progress(`control-net-top-${poles}-profile-degree-${verticalDegree}`);
    if (footprint && profileValues.some(value => {
      const scale = parameters.topRatio + (1 - parameters.topRatio) * value; return scale <= 0 || scale > 1;
    })) throw Error('Continuous flank profile cannot certify contained scale factors.');
    const [v, vm] = knots([0, 1], [verticalDegree + 1, verticalDegree + 1]);
    for (let edgeIndex = 1; edgeIndex <= freeEdges; edgeIndex++) {
      const edge = own(topSewing.FreeEdge(edgeIndex)); if (kernel.BRep_Tool.Degenerated(edge)) continue;
      const envelope = own(kernel.BRep_Tool.Curve(edge));
      const trimmed = own(new kernel.Geom_TrimmedCurve(envelope.returnValue, envelope.First, envelope.Last, true, true));
      const original = own(kernel.GeomConvert.CurveToBSplineCurve(trimmed));
      // Boundary error grows by 1/topRatio at the wider flank base.
      const reduced = boundaryReduction ? reduceBoundaryCurve(kernel, original, boundaryTolerance * (footprint ? parameters.topRatio : 1), work, !!footprint)
        : { curve: null, boundMm: 0, originalPoles: original.NbPoles() };
      const curve = reduced.curve ? own(reduced.curve) : original;
      maximumBoundaryReductionMm = Math.max(maximumBoundaryReductionMm, reduced.boundMm); originalBoundaryPoles += reduced.originalPoles;
      const count = curve.NbPoles(); poles += count * (verticalDegree + 1);
      boundaryCurves.push({ originalPoles: reduced.originalPoles, poles: count, degree: curve.Degree(), rational: curve.IsRational() });
      progress(`boundary-${edgeIndex}-poles-${reduced.originalPoles}-to-${count}-degree-${curve.Degree()}-total-${poles}`);
      if (poles > 4096) throw Error('Shared-boundary flank control points exceed the 4096-pole budget.');
      const net = own(new kernel.NCollection_Array2_gp_Pnt(1, count, 1, verticalDegree + 1));
      const weights = own(new kernel.NCollection_Array2_double(1, count, 1, verticalDegree + 1));
      for (let i = 1; i <= count; i++) {
        const boundary = curve.Pole(i);
        try { for (let j = 0; j <= verticalDegree; j++) {
          const scaling = parameters.topRatio + (1 - parameters.topRatio) * profileValues[j]!;
          const point = new kernel.gp_Pnt(origin[0] + (boundary.X() - origin[0]) * scaling / parameters.topRatio,
            origin[1] + (boundary.Y() - origin[1]) * scaling / parameters.topRatio, baseZ + (boundary.Z() - baseZ) * j / verticalDegree);
          try { net.SetValue(i, j + 1, point); weights.SetValue(i, j + 1, curve.Weight(i)); } finally { point.delete(); }
        } } finally { boundary.delete(); }
      }
      const [u, um] = knots(Array.from({ length: curve.NbKnots() }, (_, i) => curve.Knot(i + 1)), Array.from({ length: curve.NbKnots() }, (_, i) => curve.Multiplicity(i + 1)));
      faces.push(face(own(new kernel.Geom_BSplineSurface(net, weights, u, v, um, vm, curve.Degree(), verticalDegree, false, false))));
    }
    faces.push(own(nativeTranslate(kernel, baseFace, 0, 0, baseZ))); progress('solid-sewing');
    const sewing = own(new kernel.BRepBuilderAPI_Sewing(boundaryTolerance * 2, true, true, true, false));
    for (const item of faces) sewing.Add(item.wrapped); sewing.Perform();
    const shell = own(cast(own(sewing.SewedShape())));
    if (!(shell instanceof Shell) || sewing.NbFreeEdges() || sewing.NbMultipleEdges()) throw Error(`Unclosed boundary shell (${shell.constructor.name}, ${sewing.NbFreeEdges()} free edges).`);
    const maker = own(new kernel.BRepBuilderAPI_MakeSolid(shell.wrapped)), raw = own(maker.Solid());
    if (!kernel.BRepLib.OrientClosedSolid(raw)) throw Error('Cannot orient boundary solid.');
    solid = requireSolid(cast(raw)); validateSolid(kernel, solid);
    if (baseZ > 0) {
      const plinth = own(nativeExtrude(kernel, baseFace, baseZ)), fused = requireSolid(nativeBoolean(kernel, 'fuse', solid, plinth));
      solid.delete(); solid = fused; validateSolid(kernel, solid);
    }
    if (footprint) { const local = requireSolid(nativeTranslate(kernel, solid, -origin[0], -origin[1], 0)); solid.delete(); solid = local; validateSolid(kernel, solid); }
    const finalSolid = solid;
    return { solid: finalSolid, poles, topFaces: topFaces.length, freeEdges, boundaryCurves, originalBoundaryPoles, maximumBoundaryReductionMm, profileDegree: verticalDegree,
      profilePositionErrorMm: profile.error * radius * (1 - parameters.topRatio), maximumContourApproximationMm,
      boundaryComparisons: work.comparisons, curveRejections: work.rejections, physicalHeightErrorMm,
      ...(footprint ? { anchorCertificate, translation: [...origin, 0] as [number, number, number], mesh: (options: SurfaceMeshOptions) => meshWithNativeVertices(kernel, finalSolid, options) } : {}) };
  } catch (error) { solid?.delete(); throw error; }
  finally { scope.dispose(); }
}
