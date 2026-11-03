/** Isolated R3 flat-top capability for native footprints. Positive rational
 * Bernstein weights and a whole-boundary radial-tangent certificate establish
 * a star-shaped footprint about its area centroid before homothetic tapering.
 * A failed certificate rejects; it does not silently move the anchor or clip
 * protruding sections. General anchor selection and sloping tops remain separate. */
import { Blueprint, Curve2D, Drawing, cast, deserializeDrawing, deserializeShape } from 'replicad';
import { validateSolid } from '../../src/shared/geometry/kernel.ts';
import { nativeBoolean, nativeExtrude, nativeScale, nativeTranslate, requireSolid } from '../../src/tools/wall-art/geometry/native-operations.ts';
import { classifySpan } from '../../src/tools/wall-art/geometry/layouts/span.ts';
import { fitPowerProfile } from '../../src/tools/wall-art/geometry/surface-fit.ts';
import { meshWithNativeVertices } from './shape-surface-vertex-mesh.mjs';

const choose = (n, k) => { let value = 1; for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i; return value; };
const product = (a, b) => Array.from({ length: a.length + b.length - 1 }, (_, k) => {
  let value = 0;
  for (let i = Math.max(0, k - b.length + 1); i <= Math.min(k, a.length - 1); i++) value += a[i] * b[k - i] * choose(a.length - 1, i) * choose(b.length - 1, k - i) / choose(a.length + b.length - 2, k);
  return value;
});
const split = coefficients => {
  let row = coefficients; const left = [row[0]], right = [row.at(-1)];
  while (row.length > 1) { row = row.slice(1).map((value, i) => (row[i] + value) / 2); left.push(row[0]); right.unshift(row.at(-1)); }
  return [left, right];
};

/** Exact rational-curve numerator X*Y'-Y*X'; weights cancel from its sign.
 * Conservative floating allowance and bounded subdivision cover complete spans,
 * rather than evaluating tangents at a collection of points. */
export function radialCurveSign(points, weights, direction = 1) {
  if (points.length < 2 || points.length > 19 || weights.length !== points.length || ![1, -1].includes(direction) ||
    points.some(p => p.length !== 2 || !p.every(Number.isFinite)) || weights.some(w => !Number.isFinite(w) || w <= 0)) throw Error('Invalid rational boundary certificate input.');
  const degree = points.length - 1, x = points.map((p, i) => p[0] * weights[i]), y = points.map((p, i) => p[1] * weights[i]);
  const derivative = a => a.slice(1).map((value, i) => degree * (value - a[i]));
  const xy = product(x, derivative(y)), yx = product(y, derivative(x));
  const residual = xy.map((value, i) => direction * (value - yx[i]));
  const roundoff = 32768 * Number.EPSILON * Math.max(1, ...x.map(Math.abs), ...y.map(Math.abs)) ** 2 * degree;
  if (![roundoff, ...residual].every(Number.isFinite)) throw Error('Rational boundary arithmetic overflowed.');
  const prove = (values, depth) => {
    if (Math.min(...values) > roundoff) return 1;
    if (Math.max(...values) < -roundoff) return -1;
    if (depth === 8) throw Error('Footprint centroid has no certified radial containment.');
    const [left, right] = split(values), a = prove(left, depth + 1), b = prove(right, depth + 1);
    if (a !== b) throw Error('Footprint is not star-shaped about its centroid.');
    return a;
  };
  return prove(residual, 0);
}

export function buildFlatFootprint(kernel, base, { ratio, concavity, baseThickness, topHeight }) {
  if (![ratio, concavity, baseThickness, topHeight, ...base.centroid].every(Number.isFinite) || ratio < .1 || ratio > 1 || concavity < 1 || concavity > 4 ||
    baseThickness < 0 || baseThickness > 40 || topHeight <= baseThickness || topHeight < 1.2 || topHeight > 360) throw Error('Invalid flat footprint parameters.');
  const resources = [], own = object => { resources.push(object); return object; };
  let solid;
  try {
    const restored = own(deserializeShape(base.nativeFace));
    let local = own(nativeTranslate(kernel, restored, -base.centroid[0], -base.centroid[1], 0)), maximumContourApproximationMm = 0;
    const initialEdges = local.edges.map(own);
    if (initialEdges.some(edge => edge.geomType === 'OFFSET_CURVE')) {
      // Generic 3D CurveToBSplineCurve has no exposed approximation certificate
      // for offset ellipses. Use the installed bounded 2D approximation API,
      // then derive caps AND flanks from that same native contour. Its error is
      // explicit and separate from the 0.0002 mm flank allocation.
      if (!base.nativeContour) throw Error('Offset footprint requires its native drawing.');
      const drawing = deserializeDrawing(base.nativeContour); own(drawing.blueprint);
      const translated = drawing.translate(-base.centroid[0], -base.centroid[1]); own(translated.blueprint);
      const curves = [];
      for (const curve of translated.blueprint.curves) {
        if (curve.geomType !== 'OFFSET_CURVE') { curves.push(own(curve.clone())); continue; }
        const adaptor = own(curve.adaptor()), approximation = own(new kernel.Geom2dConvert_ApproxCurve(adaptor, 1e-8, kernel.GeomAbs_Shape.GeomAbs_C1, 200, 8));
        if (!approximation.IsDone() || !Number.isFinite(approximation.MaxError()) || approximation.MaxError() > 1e-8) throw Error('Offset footprint exceeds its native contour error allocation.');
        maximumContourApproximationMm = Math.max(maximumContourApproximationMm, approximation.MaxError());
        curves.push(own(new Curve2D(approximation.Curve())));
      }
      const bounded = new Drawing(own(new Blueprint(curves))), sketch = own(bounded.sketchOnPlane('XY'));
      local = own(sketch.face());
    }
    const wires = local.wires.map(own);
    if (wires.length !== 1) throw Error('Flat footprint requires one simple native boundary.');
    const curves = []; let sign, radius = 0, boundaryPoles = 0;
    for (const edge of wires[0].edges.map(own)) {
      const envelope = own(kernel.BRep_Tool.Curve(edge.wrapped));
      const trimmed = own(new kernel.Geom_TrimmedCurve(envelope.returnValue, envelope.First, envelope.Last, true, true));
      const curve = own(kernel.GeomConvert.CurveToBSplineCurve(trimmed));
      if (curve.Degree() > 18 || curve.NbPoles() > 4096) throw Error('Native footprint boundary exceeds curve budget.');
      // Convert to Bezier spans by exact knot insertion. Keep the original curve
      // for construction; refinement only supports its containment certificate.
      const refined = own(kernel.GeomConvert.CurveToBSplineCurve(own(new kernel.Geom_TrimmedCurve(curve, curve.FirstParameter(), curve.LastParameter(), true, true))));
      const knots = Array.from({ length: refined.NbKnots() - 2 }, (_, i) => refined.Knot(i + 2));
      for (const knot of knots) refined.InsertKnot(knot, refined.Degree(), 0, false);
      boundaryPoles += refined.NbPoles();
      if (boundaryPoles > 4096) throw Error('Native footprint certificate exceeds pole budget.');
      const direction = edge.wrapped.Orientation() === kernel.TopAbs_Orientation.TopAbs_REVERSED ? -1 : 1;
      for (let offset = 0; offset + refined.Degree() < refined.NbPoles(); offset += refined.Degree()) {
        const points = [], weights = [];
        for (let i = 0; i <= refined.Degree(); i++) {
          const point = refined.Pole(offset + i + 1);
          try { points.push([point.X(), point.Y()]); radius = Math.max(radius, Math.hypot(point.X(), point.Y())); } finally { point.delete(); }
          weights.push(refined.Weight(offset + i + 1));
        }
        const current = radialCurveSign(points, weights, direction);
        if (sign !== undefined && sign !== current) throw Error('Footprint centroid cannot contain every homothetic section.');
        sign = current;
      }
      curves.push(curve);
    }
    if (!curves.length || !Number.isFinite(radius) || radius > 4000) throw Error('Invalid bounded footprint.');
    const topFace = own(nativeScale(kernel, local, ratio));
    if (classifySpan(kernel, topFace).below) throw Error('Tapered top is narrower than 1.2 mm.');
    const profile = fitPowerProfile(concavity, .0002 / (radius * Math.max(1 - ratio, .000001)));
    const coefficients = [...profile.coefficients].reverse().map(value => ratio + (1 - ratio) * value), degree = coefficients.length - 1;
    if (Math.min(...coefficients) <= 0 || Math.max(...coefficients) > 1) throw Error('Native profile cannot certify contained scale factors.');
    const sections = []; const divide = (values, a, b, depth) => {
      if (depth === 2) { sections.push({ values, a, b }); return; }
      const [left, right] = split(values), mid = (a + b) / 2; divide(left, a, mid, depth + 1); divide(right, mid, b, depth + 1);
    };
    divide(coefficients, 0, 1, 0);
    const poles = curves.reduce((sum, curve) => sum + curve.NbPoles() * (degree + 1) * sections.length, 0);
    if (poles > 4096) throw Error('Flat footprint exceeds the 4096-pole budget.');
    const faces = [own(nativeTranslate(kernel, local, 0, 0, baseThickness)), own(nativeTranslate(kernel, topFace, 0, 0, topHeight))];
    const doubles = values => { const a = own(new kernel.NCollection_Array1_double(1, values.length)); values.forEach((value, i) => a.SetValue(i + 1, value)); return a; };
    const integers = values => { const a = own(new kernel.NCollection_Array1_int(1, values.length)); values.forEach((value, i) => a.SetValue(i + 1, value)); return a; };
    const v = doubles([0, 1]), vm = integers([degree + 1, degree + 1]);
    for (const curve of curves) for (const section of sections) {
      const net = own(new kernel.NCollection_Array2_gp_Pnt(1, curve.NbPoles(), 1, degree + 1)), weights = own(new kernel.NCollection_Array2_double(1, curve.NbPoles(), 1, degree + 1));
      for (let i = 1; i <= curve.NbPoles(); i++) {
        const boundary = curve.Pole(i);
        try { for (let j = 0; j <= degree; j++) {
          const t = section.a + (section.b - section.a) * j / degree;
          const point = new kernel.gp_Pnt(boundary.X() * section.values[j], boundary.Y() * section.values[j], baseThickness + (topHeight - baseThickness) * t);
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
    if (shell.constructor.name !== 'Shell' || sewing.NbFreeEdges() || sewing.NbMultipleEdges()) throw Error(`Flat footprint has an open native shell (${shell.constructor.name}, ${sewing.NbFreeEdges()} free edges, ${sewing.NbMultipleEdges()} multiple edges).`);
    const maker = own(new kernel.BRepBuilderAPI_MakeSolid(shell.wrapped)), raw = own(maker.Solid());
    if (!kernel.BRepLib.OrientClosedSolid(raw)) throw Error('Cannot orient flat footprint solid.');
    solid = cast(raw); validateSolid(kernel, solid);
    if (baseThickness > 0) {
      const plinth = own(nativeExtrude(kernel, local, baseThickness)), joined = requireSolid(nativeBoolean(kernel, 'fuse', plinth, solid));
      solid.delete(); solid = joined; validateSolid(kernel, solid);
    }
    return { solid, poles, physicalHeightErrorMm: 0, profilePositionErrorMm: profile.error * radius * (1 - ratio), maximumContourApproximationMm,
      anchor: [...base.centroid], mesh: options => meshWithNativeVertices(kernel, solid, options) };
  } catch (error) { solid?.delete(); throw error; }
  finally { for (const resource of resources.reverse()) resource[Symbol.dispose] ? resource[Symbol.dispose]() : resource.delete(); }
}
