/** R2 isolated capability helper: trim bounded R1 patches, then derive flanks from
 * the actual sewn top boundary. No application integration or material certificate.
 * The returned solid is caller-owned; all temporary native wrappers are disposed. */
import { cast, makePolygon } from 'replicad';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { nativeBoolean, nativeExtrude } from '../../src/tools/wall-art/geometry/native-operations.ts';
import { createBoundaryPatches } from '../../src/tools/wall-art/geometry/surface-sampling.ts';
import { fitPowerProfile } from '../../src/tools/wall-art/geometry/surface-fit.ts';
import { reduceBoundaryCurve } from './shape-surface-boundary-curve.mjs';
import { rectangleSurfaceMoments } from '../../src/tools/wall-art/geometry/surface-moments.ts';
import { validateParametersV3 } from '../../src/tools/wall-art/model/validation-v3.ts';

export function buildBoundarySurface(kernel, parameters, { width = 47.5, origin = [0, 0], progress = () => {}, boundaryReduction = true, spiralCenter = 'linear' } = {}) {
  parameters = validateParametersV3(parameters);
  if (parameters.planarTops) throw Error('Planar tops require the constrained plane builder.');
  if (!Number.isFinite(width) || width <= 0 || width > 2000 || origin.length !== 2 || !origin.every(Number.isFinite)) throw Error('Invalid boundary fixture dimensions.');
  const half = width * parameters.topRatio / 2;
  const baseZ = parameters.plinthEnabled ? parameters.baseThickness : 0;
  const baseline = baseZ + parameters.minimumRelief;
  const mean = parameters.stepBlend ? rectangleSurfaceMoments(parameters, {
    minX: origin[0] - width / 2, maxX: origin[0] + width / 2,
    minY: origin[1] - width / 2, maxY: origin[1] + width / 2,
  }, spiralCenter) : { mean: 0, error: 0 };
  // Pad the covering charts, then trim to the exact rectangle. The padding exceeds
  // the R1 coordinate error and avoids losing a corner at a circumscribed arc.
  const patches = createBoundaryPatches({ ...parameters, stepBlend: 0 }, { minX: origin[0] - half - .00001, maxX: origin[0] + half + .00001, minY: origin[1] - half - .00001, maxY: origin[1] + half + .00001 }, spiralCenter);
  const physicalHeightErrorMm = (1 - parameters.stepBlend) * Math.max(...patches.map(p => p.physicalHeightErrorMm)) + parameters.depth * parameters.stepBlend * mean.error;
  if (physicalHeightErrorMm > .0002) throw Error('Blended surface exceeds the existing height-error allocation.');
  const resources = [], own = object => { resources.push(object); return object; };
  const topFaces = [], faces = [], boundaryCurves = [];
  const boundaryTolerance = Math.min(.00001, parameters.topRatio * .00005), work = { comparisons: 0 };
  let solid, maximumBoundaryReductionMm = 0, originalBoundaryPoles = 0, poles = patches.reduce((sum, patch) => sum + patch.poles.length / 3, 0);
  function knots(values, multiplicities) {
    const result = own(new kernel.NCollection_Array1_double(1, values.length)), mults = own(new kernel.NCollection_Array1_int(1, values.length));
    values.forEach((value, i) => { result.SetValue(i + 1, value); mults.SetValue(i + 1, multiplicities[i]); });
    return [result, mults];
  }
  function face(surface) {
    const maker = own(new kernel.BRepBuilderAPI_MakeFace(surface, .000001));
    if (!maker.IsDone()) throw Error('Patch face construction failed.');
    return own(cast(own(maker.Face())));
  }
  try {
    const rectangle = own(makePolygon([[origin[0] - half, origin[1] - half, -1], [origin[0] + half, origin[1] - half, -1], [origin[0] + half, origin[1] + half, -1], [origin[0] - half, origin[1] + half, -1]]));
    const clip = own(nativeExtrude(kernel, rectangle, 500));
    for (const patch of patches) {
      progress(`top-patch-${patch.id}`);
      const net = own(new kernel.NCollection_Array2_gp_Pnt(1, patch.degreeU + 1, 1, patch.degreeV + 1));
      for (let i = 0; i <= patch.degreeU; i++) for (let j = 0; j <= patch.degreeV; j++) {
        const offset = 3 * (i * (patch.degreeV + 1) + j), xyz = patch.poles.slice(offset, offset + 3);
        xyz[2] = baseline + parameters.depth * parameters.stepBlend * mean.mean + (1 - parameters.stepBlend) * (xyz[2] - baseline);
        const point = new kernel.gp_Pnt(...xyz);
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
    const freeEdges = topSewing.NbFreeEdges();
    progress(`top-sewn-${freeEdges}-boundary-edges`);
    const profile = fitPowerProfile(parameters.concavity, .0002 / (width / 2 * Math.SQRT2 * Math.max(1 - parameters.topRatio, .000001)));
    const profileValues = [...profile.coefficients].reverse(), verticalDegree = profileValues.length - 1;
    const [v, vm] = knots([0, 1], [verticalDegree + 1, verticalDegree + 1]);
    for (let edgeIndex = 1; edgeIndex <= freeEdges; edgeIndex++) {
      const edge = own(topSewing.FreeEdge(edgeIndex));
      if (kernel.BRep_Tool.Degenerated(edge)) continue;
      const envelope = own(kernel.BRep_Tool.Curve(edge));
      const trimmed = own(new kernel.Geom_TrimmedCurve(envelope.returnValue, envelope.First, envelope.Last, true, true));
      const original = own(kernel.GeomConvert.CurveToBSplineCurve(trimmed));
      const reduced = boundaryReduction ? reduceBoundaryCurve(kernel, original, boundaryTolerance, work)
        : { curve: null, boundMm: 0, originalPoles: original.NbPoles() };
      const curve = reduced.curve ? own(reduced.curve) : original;
      maximumBoundaryReductionMm = Math.max(maximumBoundaryReductionMm, reduced.boundMm);
      originalBoundaryPoles += reduced.originalPoles;
      const count = curve.NbPoles(); poles += count * (verticalDegree + 1);
      boundaryCurves.push({ originalPoles: reduced.originalPoles, poles: count, degree: curve.Degree(), rational: curve.IsRational() });
      if (poles > 4096) throw Error('Shared-boundary flank control points exceed the 4096-pole budget.');
      const net = own(new kernel.NCollection_Array2_gp_Pnt(1, count, 1, verticalDegree + 1));
      const weights = own(new kernel.NCollection_Array2_double(1, count, 1, verticalDegree + 1));
      for (let i = 1; i <= count; i++) {
        const boundary = curve.Pole(i);
        try {
          for (let j = 0; j <= verticalDegree; j++) {
            const scaling = parameters.topRatio + (1 - parameters.topRatio) * profileValues[j];
            const point = new kernel.gp_Pnt(origin[0] + (boundary.X() - origin[0]) * scaling / parameters.topRatio,
              origin[1] + (boundary.Y() - origin[1]) * scaling / parameters.topRatio, baseZ + (boundary.Z() - baseZ) * j / verticalDegree);
            try { net.SetValue(i, j + 1, point); weights.SetValue(i, j + 1, curve.Weight(i)); } finally { point.delete(); }
          }
        } finally { boundary.delete(); }
      }
      const [u, um] = knots(Array.from({ length: curve.NbKnots() }, (_, i) => curve.Knot(i + 1)), Array.from({ length: curve.NbKnots() }, (_, i) => curve.Multiplicity(i + 1)));
      const flank = own(new kernel.Geom_BSplineSurface(net, weights, u, v, um, vm, curve.Degree(), verticalDegree, false, false));
      faces.push(face(flank));
    }
    const baseHalf = width / 2;
    const bottom = [[origin[0] - baseHalf, origin[1] - baseHalf, baseZ], [origin[0] + baseHalf, origin[1] - baseHalf, baseZ], [origin[0] + baseHalf, origin[1] + baseHalf, baseZ], [origin[0] - baseHalf, origin[1] + baseHalf, baseZ]];
    faces.push(own(makePolygon(bottom)));
    progress('solid-sewing');
    const sewing = own(new kernel.BRepBuilderAPI_Sewing(boundaryTolerance * 2, true, true, true, false));
    for (const item of faces) sewing.Add(item.wrapped);
    sewing.Perform();
    const shell = own(cast(own(sewing.SewedShape())));
    if (shell.constructor.name !== 'Shell' || sewing.NbFreeEdges() || sewing.NbMultipleEdges()) throw Error(`Unclosed boundary shell (${shell.constructor.name}, ${sewing.NbFreeEdges()} free edges).`);
    const maker = own(new kernel.BRepBuilderAPI_MakeSolid(shell.wrapped)), raw = own(maker.Solid());
    if (!kernel.BRepLib.OrientClosedSolid(raw)) throw Error('Cannot orient boundary solid.');
    solid = cast(raw); validateSolid(kernel, solid);
    if (baseZ > 0) {
      const base = own(makePolygon(bottom.map(([x, y]) => [x, y, 0])));
      const plinth = own(nativeExtrude(kernel, base, baseZ));
      const fused = nativeBoolean(kernel, 'fuse', solid, plinth);
      solid.delete(); solid = fused; validateSolid(kernel, solid);
    }
    return { solid, poles, topFaces: topFaces.length, freeEdges, boundaryCurves, originalBoundaryPoles, maximumBoundaryReductionMm, profileDegree: verticalDegree,
      profilePositionErrorMm: profile.error * width / 2 * Math.SQRT2 * (1 - parameters.topRatio),
      boundaryComparisons: work.comparisons, curveRejections: work.rejections, physicalHeightErrorMm };
  } catch (error) { solid?.delete(); throw error; }
  finally { for (const resource of resources.reverse()) { if (resource[Symbol.dispose]) resource[Symbol.dispose](); else resource.delete(); } }
}
