/** Stepped and sloping planar native tops. Caller owns the returned solid and
 * must retain its selected-anchor translation for preview and every export. */
import { cast, deserializeShape, Face, Shell, type Shape3D } from 'replicad';
import { validateSolid, type Kernel } from '../../../shared/geometry/kernel.ts';
import type { BaseContour } from './layout-metadata.ts';
import { nativeBoolean, nativeExtrude, nativeScale, nativeTranslate, requireSolid } from './native-operations.ts';
import { nativeResources } from './native-resources.ts';
import { classifySpan } from './layouts/span.ts';
import { fitPowerProfile } from './surface-fit.ts';
import { meshWithNativeVertices, type SurfaceMeshOptions } from './surface-vertex-mesh.ts';
import { selectNativeAnchor } from './surface-anchor.ts';
import { prepareFootprint, splitProfile } from './surface-footprint.ts';

export type PlanarFootprintOptions = { ratio: number; concavity: number; baseThickness: number; top: [number, number, number] };
export function buildFlatFootprint(kernel: Kernel, base: BaseContour, options: Omit<PlanarFootprintOptions, 'top'> & { topHeight: number }) {
  return buildPlanarFootprint(kernel, base, { ...options, top: [options.topHeight, 0, 0] });
}

/** Input slopes use the source centroid. The selected anchor changes only the
 * local frame, never the physical plane or the retained source metadata. */
export function buildAnchoredPlanarFootprint(kernel: Kernel, base: BaseContour, options: PlanarFootprintOptions) {
  const face = deserializeShape(base.nativeFace);
  let anchor;
  try {
    if (!(face instanceof Face)) throw Error('Planar footprint requires a native face.');
    anchor = selectNativeAnchor(kernel, face, base.centroid);
  } finally { face.delete(); }
  const [height, sx, sy] = options.top;
  const shiftedHeight = height + sx * (anchor.point[0] - base.centroid[0]) + sy * (anchor.point[1] - base.centroid[1]);
  const result = buildPlanarFootprint(kernel, { ...base, centroid: anchor.point }, { ...options, top: [shiftedHeight, sx, sy] });
  return { ...result, anchorCertificate: anchor, translation: [...anchor.point, 0] as [number, number, number] };
}

/** top = [height at centroid, dz/dx, dz/dy], in physical millimeters. */
export function buildPlanarFootprint(kernel: Kernel, base: BaseContour, { ratio, concavity, baseThickness, top }: PlanarFootprintOptions) {
  const [topHeight, slopeX, slopeY] = top;
  if (![ratio, concavity, baseThickness, topHeight, ...base.centroid].every(Number.isFinite) || ratio < .1 || ratio > 1 || concavity < 1 || concavity > 4 ||
    top.length !== 3 || ![slopeX, slopeY].every(Number.isFinite) || baseThickness < 0 || baseThickness > 40 || topHeight <= baseThickness || topHeight < 1.2 || topHeight > 360) throw Error('Invalid planar footprint parameters.');
  const scope = nativeResources(), own = scope.own;
  let solid: Shape3D | undefined;
  try {
    const { local, curves, radius, maximumContourApproximationMm } = prepareFootprint(kernel, base, own, true);
    const topFace = own(nativeScale(kernel, local, ratio));
    if (!(topFace instanceof Face) || classifySpan(kernel, topFace).below) throw Error('Tapered top is narrower than 1.2 mm.');
    const profile = fitPowerProfile(concavity, .0002 / (radius * Math.max(1 - ratio, .000001)));
    const coefficients = [...profile.coefficients].reverse().map(value => ratio + (1 - ratio) * value), degree = coefficients.length - 1;
    if (Math.min(...coefficients) <= 0 || Math.max(...coefficients) > 1) throw Error('Native profile cannot certify contained scale factors.');
    const tilt = ratio * radius * Math.hypot(slopeX, slopeY), centralHeight = topHeight - baseThickness;
    if (topHeight - tilt < 1.2 || centralHeight <= tilt || topHeight + tilt > 360) throw Error('Planar footprint violates its height bounds.');
    const derivatives = coefficients.slice(1).map((v, i) => degree * (v - coefficients[i]!));
    const prove = (sizes: number[], slopes: number[], from: number, to: number, depth: number): void => {
      const lower = Math.min(...sizes), contraction = Math.max(0, ...slopes.map(v => -v));
      if (lower > 0 && centralHeight - tilt - to * contraction * tilt / lower > 1e-10) return;
      if (depth === 8) throw Error('Planar footprint cannot certify unfolded flanks.');
      const [s0, s1] = splitProfile(sizes), [d0, d1] = splitProfile(slopes), mid = (from + to) / 2;
      prove(s0, d0, from, mid, depth + 1); prove(s1, d1, mid, to, depth + 1);
    };
    prove(coefficients, derivatives, 0, 1, 0);
    const sections: { values: number[]; a: number; b: number }[] = [];
    const divide = (values: number[], a: number, b: number, depth: number): void => {
      if (depth === 2) { sections.push({ values, a, b }); return; }
      const [left, right] = splitProfile(values), mid = (a + b) / 2; divide(left, a, mid, depth + 1); divide(right, mid, b, depth + 1);
    };
    divide(coefficients, 0, 1, 0);
    const poles = curves.reduce((sum, curve) => sum + curve.NbPoles() * (degree + 1) * sections.length, 0);
    if (poles > 4096) throw Error('Flat footprint exceeds the 4096-pole budget.');
    let cap;
    if (slopeX === 0 && slopeY === 0) cap = own(nativeTranslate(kernel, topFace, 0, 0, topHeight));
    else {
      const list = own(new kernel.NCollection_List_TopoDS_Shape());
      for (const curve of curves) {
        const copy = own(kernel.GeomConvert.CurveToBSplineCurve(own(new kernel.Geom_TrimmedCurve(curve, curve.FirstParameter(), curve.LastParameter(), true, true))));
        for (let i = 1; i <= copy.NbPoles(); i++) {
          const point = copy.Pole(i), x = ratio * point.X(), y = ratio * point.Y(), next = new kernel.gp_Pnt(x, y, topHeight + slopeX * x + slopeY * y);
          try { copy.SetPole(i, next); } finally { point.delete(); next.delete(); }
        }
        const edge = own(new kernel.BRepBuilderAPI_MakeEdge(copy)); if (!edge.IsDone()) throw Error('Planar top boundary construction failed.');
        list.Append(own(edge.Edge()));
      }
      const wire = own(new kernel.BRepBuilderAPI_MakeWire()); wire.Add(list);
      if (!wire.IsDone()) throw Error('Planar top boundary is not connected.');
      const face = own(new kernel.BRepBuilderAPI_MakeFace(own(wire.Wire()), true));
      if (!face.IsDone()) throw Error('Native sloping cap is not planar.');
      cap = own(cast(own(face.Face())));
    }
    const faces = [own(nativeTranslate(kernel, local, 0, 0, baseThickness)), cap];
    const doubles = (values: number[]) => { const a = own(new kernel.NCollection_Array1_double(1, values.length)); values.forEach((value, i) => a.SetValue(i + 1, value)); return a; };
    const integers = (values: number[]) => { const a = own(new kernel.NCollection_Array1_int(1, values.length)); values.forEach((value, i) => a.SetValue(i + 1, value)); return a; };
    const v = doubles([0, 1]), vm = integers([degree + 1, degree + 1]);
    for (const curve of curves) for (const section of sections) {
      const net = own(new kernel.NCollection_Array2_gp_Pnt(1, curve.NbPoles(), 1, degree + 1)), weights = own(new kernel.NCollection_Array2_double(1, curve.NbPoles(), 1, degree + 1));
      for (let i = 1; i <= curve.NbPoles(); i++) {
        const boundary = curve.Pole(i);
        try { for (let j = 0; j <= degree; j++) {
          const t = section.a + (section.b - section.a) * j / degree;
          const topZ = topHeight + ratio * (slopeX * boundary.X() + slopeY * boundary.Y());
          const point = new kernel.gp_Pnt(boundary.X() * section.values[j]!, boundary.Y() * section.values[j]!, baseThickness + (topZ - baseThickness) * t);
          try { net.SetValue(i, j + 1, point); weights.SetValue(i, j + 1, curve.Weight(i)); } finally { point.delete(); }
        } } finally { boundary.delete(); }
      }
      const u = doubles(Array.from({ length: curve.NbKnots() }, (_, i) => curve.Knot(i + 1))), um = integers(Array.from({ length: curve.NbKnots() }, (_, i) => curve.Multiplicity(i + 1)));
      const surface = own(new kernel.Geom_BSplineSurface(net, weights, u, v, um, vm, curve.Degree(), degree, false, false));
      const maker = own(new kernel.BRepBuilderAPI_MakeFace(surface, 1e-6));
      if (!maker.IsDone()) throw Error('Flat footprint flank failed.');
      faces.push(own(cast(own(maker.Face()))));
    }
    const sewing = own(new kernel.BRepBuilderAPI_Sewing(1e-6, true, true, true, false));
    for (const face of faces) sewing.Add(face.wrapped); sewing.Perform();
    const shell = own(cast(own(sewing.SewedShape())));
    if (!(shell instanceof Shell) || sewing.NbFreeEdges() || sewing.NbMultipleEdges()) throw Error(`Flat footprint has an open native shell (${shell.constructor.name}, ${sewing.NbFreeEdges()} free edges, ${sewing.NbMultipleEdges()} multiple edges).`);
    const maker = own(new kernel.BRepBuilderAPI_MakeSolid(shell.wrapped)), raw = own(maker.Solid());
    if (!kernel.BRepLib.OrientClosedSolid(raw)) throw Error('Cannot orient flat footprint solid.');
    solid = requireSolid(cast(raw)); validateSolid(kernel, solid);
    if (baseThickness > 0) {
      const plinth = own(nativeExtrude(kernel, local, baseThickness)), joined = requireSolid(nativeBoolean(kernel, 'fuse', plinth, solid));
      solid.delete(); solid = joined; validateSolid(kernel, solid);
    }
    const finalSolid = solid;
    return { solid: finalSolid, poles, physicalHeightErrorMm: 0, profilePositionErrorMm: profile.error * radius * (1 - ratio), maximumContourApproximationMm,
      anchor: [...base.centroid], mesh: (options: SurfaceMeshOptions) => meshWithNativeVertices(kernel, finalSolid, options) };
  } catch (error) { solid?.delete(); throw error; }
  finally { scope.dispose(); }
}
