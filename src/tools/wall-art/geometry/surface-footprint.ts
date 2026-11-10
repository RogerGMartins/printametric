/** Native contour preparation and moments in assembly mm. Positive rational
 * weights and whole-span radial bounds certify homothetic containment. */
import { Blueprint, Curve2D, Face, deserializeDrawing, deserializeShape } from 'replicad';
import type { Geom_BSplineCurve } from 'replicad-opencascadejs';
import type { Kernel } from '../../../shared/geometry/kernel.ts';
import type { BaseContour } from './layout-metadata.ts';
import type { XY } from './layouts/cells.ts';
import { nativeTranslate } from './native-operations.ts';
import { nativeResources, type OwnNative } from './native-resources.ts';
import { contourSurfaceMoments } from './surface-contour-moments.ts';
import { fitContourPlane } from './surface-contour-plane.ts';
import { validateParametersV3 } from '../model/validation-v3.ts';
import type { SpiralCenter } from './spiral-center.ts';

const choose = (n: number, k: number) => { let value = 1; for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i; return value; };
const product = (a: readonly number[], b: readonly number[]) => Array.from({ length: a.length + b.length - 1 }, (_, k) => {
  let value = 0;
  for (let i = Math.max(0, k - b.length + 1); i <= Math.min(k, a.length - 1); i++) value += a[i]! * b[k - i]! * choose(a.length - 1, i) * choose(b.length - 1, k - i) / choose(a.length + b.length - 2, k);
  return value;
});
export function splitProfile(coefficients: readonly number[]): [number[], number[]] {
  let row = [...coefficients]; const left = [row[0]!], right = [row.at(-1)!];
  while (row.length > 1) { row = row.slice(1).map((value, i) => (row[i]! + value) / 2); left.push(row[0]!); right.unshift(row.at(-1)!); }
  return [left, right];
}

/** Weights cancel from the sign of X*Y'-Y*X'; bounded subdivision covers every
 * complete span, including floating roundoff. Unresolved signs reject. */
export function radialCurveSign(points: readonly XY[], weights: readonly number[], direction = 1): number {
  if (points.length < 2 || points.length > 19 || weights.length !== points.length || ![1, -1].includes(direction) ||
    points.some(p => p.length !== 2 || !p.every(Number.isFinite)) || weights.some(w => !Number.isFinite(w) || w <= 0)) throw Error('Invalid rational boundary certificate input.');
  const degree = points.length - 1, x = points.map((p, i) => p[0] * weights[i]!), y = points.map((p, i) => p[1] * weights[i]!);
  const derivative = (a: readonly number[]) => a.slice(1).map((value, i) => degree * (value - a[i]!));
  const xy = product(x, derivative(y)), yx = product(y, derivative(x));
  const residual = xy.map((value, i) => direction * (value - yx[i]!));
  const roundoff = 32768 * Number.EPSILON * Math.max(1, ...x.map(Math.abs), ...y.map(Math.abs)) ** 2 * degree;
  if (![roundoff, ...residual].every(Number.isFinite)) throw Error('Rational boundary arithmetic overflowed.');
  const prove = (values: readonly number[], depth: number): number => {
    if (Math.min(...values) > roundoff) return 1;
    if (Math.max(...values) < -roundoff) return -1;
    if (depth === 8) throw Error('Footprint centroid has no certified radial containment.');
    const [left, right] = splitProfile(values), a = prove(left, depth + 1), b = prove(right, depth + 1);
    if (a !== b) throw Error('Footprint is not star-shaped about its centroid.');
    return a;
  };
  return prove(residual, 0);
}

/** Own registers returned wrappers in the caller's scope. Local CAD is relative
 * to base.centroid; integration spans retain assembly coordinates. */
export function prepareFootprint(kernel: Kernel, base: BaseContour, own: OwnNative, containment: boolean) {
  const restored = own(deserializeShape(base.nativeFace));
  let local = own(nativeTranslate(kernel, restored, -base.centroid[0], -base.centroid[1], 0)), maximumContourApproximationMm = 0;
  if (!(local instanceof Face)) throw Error('Footprint archive does not contain one native face.');
  const initialEdges = local.edges.map(own);
  if (initialEdges.some(edge => edge.geomType === 'OFFSET_CURVE')) {
    // The 2D offset API exposes an approximation bound; generic 3D conversion does not.
    if (!base.nativeContour) throw Error('Offset footprint requires its native drawing.');
    const drawing = deserializeDrawing(base.nativeContour); own(drawing.blueprint);
    const translated = drawing.translate(-base.centroid[0], -base.centroid[1]); own(translated.blueprint);
    const curves: Curve2D[] = [];
    for (const curve of translated.blueprint.curves) {
      if (curve.geomType !== 'OFFSET_CURVE') { curves.push(own(curve.clone())); continue; }
      const adaptor = own(curve.adaptor()), approximation = own(new kernel.Geom2dConvert_ApproxCurve(adaptor, 1e-8, kernel.GeomAbs_Shape.GeomAbs_C1, 200, 8));
      if (!approximation.IsDone() || !Number.isFinite(approximation.MaxError()) || approximation.MaxError() > 1e-8) throw Error('Offset footprint exceeds its native contour error allocation.');
      maximumContourApproximationMm = Math.max(maximumContourApproximationMm, approximation.MaxError());
      curves.push(own(new Curve2D(approximation.Curve())));
    }
    const bounded = own(new Blueprint(curves)), sketch = own(bounded.sketchOnPlane('XY'));
    local = own(sketch.face());
  }
  const wires = local.wires.map(own);
  if (wires.length !== 1) throw Error('Flat footprint requires one simple native boundary.');
  const curves: Geom_BSplineCurve[] = [], spans: { points: XY[]; weights: number[]; direction: 1 | -1 }[] = [];
  let sign: number | undefined, radius = 0, boundaryPoles = 0;
  for (const edge of wires[0]!.edges.map(own)) {
    const envelope = own(kernel.BRep_Tool.Curve(edge.wrapped));
    const trimmed = own(new kernel.Geom_TrimmedCurve(envelope.returnValue, envelope.First, envelope.Last, true, true));
    const curve = own(kernel.GeomConvert.CurveToBSplineCurve(trimmed));
    if (curve.Degree() > 18 || curve.NbPoles() > 4096) throw Error('Native footprint boundary exceeds curve budget.');
    const refined = own(kernel.GeomConvert.CurveToBSplineCurve(own(new kernel.Geom_TrimmedCurve(curve, curve.FirstParameter(), curve.LastParameter(), true, true))));
    const knots = Array.from({ length: refined.NbKnots() - 2 }, (_, i) => refined.Knot(i + 2));
    for (const knot of knots) refined.InsertKnot(knot, refined.Degree(), 0, false);
    boundaryPoles += refined.NbPoles();
    if (boundaryPoles > 4096) throw Error('Native footprint certificate exceeds pole budget.');
    const direction = edge.wrapped.Orientation() === kernel.TopAbs_Orientation.TopAbs_REVERSED ? -1 : 1;
    for (let offset = 0; offset + refined.Degree() < refined.NbPoles(); offset += refined.Degree()) {
      const points: XY[] = [], weights: number[] = [];
      for (let i = 0; i <= refined.Degree(); i++) {
        const point = refined.Pole(offset + i + 1);
        try { points.push([point.X(), point.Y()]); radius = Math.max(radius, Math.hypot(point.X(), point.Y())); } finally { point.delete(); }
        weights.push(refined.Weight(offset + i + 1));
      }
      if (containment) {
        const current = radialCurveSign(points, weights, direction);
        if (sign !== undefined && sign !== current) throw Error('Footprint centroid cannot contain every homothetic section.');
        sign = current;
      }
      spans.push({ points: points.map(p => [p[0] + base.centroid[0], p[1] + base.centroid[1]]), weights, direction });
    }
    curves.push(curve);
  }
  if (!curves.length || !Number.isFinite(radius) || radius > 4000) throw Error('Invalid bounded footprint.');
  return { local, curves, spans, radius, maximumContourApproximationMm };
}

/** Area moments do not approve a contour for tapering. Anchors and ratios select
 * the actual integration domain; coefficients use that same anchor. */
export function nativeFootprintMoments(kernel: Kernel, base: BaseContour, input: unknown,
  options: { ratio?: number; anchor?: XY; plane?: boolean; tolerance?: number; spiralCenter?: SpiralCenter; charge?: (count: number) => void } = {}) {
  const p = validateParametersV3(input), scope = nativeResources();
  try {
    const prepared = prepareFootprint(kernel, base, scope.own, false), ratio = options.ratio ?? 1;
    if (!Number.isFinite(ratio) || ratio < .1 || ratio > 1) throw Error('Invalid integration-domain ratio.');
    const anchor = options.anchor ?? base.centroid;
    if (anchor.length !== 2 || anchor.some(v => !Number.isFinite(v) || Math.abs(v) > 4000)) throw Error('Invalid moment anchor.');
    const spans = prepared.spans.map(s => ({ ...s, points: s.points.map((point): XY => [anchor[0] + ratio * (point[0] - anchor[0]), anchor[1] + ratio * (point[1] - anchor[1])]) }));
    const moments = contourSurfaceMoments(p, spans, anchor, options.plane ? Math.min(1e-8, options.tolerance ?? Infinity) : options.tolerance, options.spiralCenter ?? 'linear', options.charge);
    let lengthBound = 0;
    for (const span of prepared.spans) {
      const n = span.points.length - 1, maxW = Math.max(...span.weights), w = span.weights.map(v => v / maxW), minW = Math.min(...w);
      const x = span.points.map((v, i) => (v[0] - span.points[0]![0]) * w[i]!), y = span.points.map((v, i) => (v[1] - span.points[0]![1]) * w[i]!);
      const magnitude = (values: readonly number[]) => Math.max(...values.map(Math.abs));
      const derivative = (values: readonly number[]) => magnitude(values.slice(1).map((v, i) => n * (v - values[i]!)));
      const dw = derivative(w), dx = (derivative(x) + magnitude(x) * dw) / minW ** 2, dy = (derivative(y) + magnitude(y) * dw) / minW ** 2;
      lengthBound += Math.hypot(dx, dy);
    }
    const e = prepared.maximumContourApproximationMm, areaError = ratio ** 2 * (2 * lengthBound * e + prepared.spans.length * Math.PI * e * e);
    const error = moments.error + 4 * areaError / (moments.area - areaError);
    if (!Number.isFinite(error) || areaError >= moments.area || error > Math.min(.001, .00025 / Math.max(p.depth, 1))) throw Error('Native contour approximation exhausts the moment error allocation.');
    if (Math.abs(moments.area - base.area * ratio ** 2) > areaError + moments.area * moments.error + 1e-6) throw Error('Integrated contour area disagrees with its native source.');
    const fitted = options.plane ? fitContourPlane({ ...moments, error }, spans, anchor) : undefined;
    if (fitted && fitted.error * p.depth > .0002) throw Error(`Native plane uncertainty exceeds its height error allocation: ${fitted.error * p.depth} mm; moment ${error}; objective gap ${fitted.objectiveGap}.`);
    return Object.freeze({ ...moments, error, fitted, anchor: [...anchor] as XY, maximumContourApproximationMm: e });
  } finally { scope.dispose(); }
}
