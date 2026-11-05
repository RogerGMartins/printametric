/** Bounded reduction of native Boolean intersection curves. Candidate knot removal
 * is independently checked in the original non-rational B-spline basis: the
 * largest control-point displacement bounds the entire parametric curve. Rational
 * curves remain exact. This is not a sampled-distance test. Caller owns result. */
import { reparameterizeBoundaryCurve } from './shape-surface-boundary-reparameterize.mjs';

export function reduceBoundaryCurve(kernel, original, tolerance = 1e-7, work = { comparisons: 0 }, curved = false) {
  function snapshot(curve) {
    const points = [];
    for (let i = 1; i <= curve.NbPoles(); i++) { const point = curve.Pole(i); try { points.push([point.X(), point.Y(), point.Z()]); } finally { point.delete(); } }
    return { points, knots: Array.from({ length: curve.NbKnots() }, (_, i) => curve.Knot(i + 1)),
      mults: Array.from({ length: curve.NbKnots() }, (_, i) => curve.Multiplicity(i + 1)), degree: curve.Degree() };
  }
  function restore(data) {
    const points = new kernel.NCollection_Array1_gp_Pnt(1, data.points.length), knots = new kernel.NCollection_Array1_double(1, data.knots.length), mults = new kernel.NCollection_Array1_int(1, data.knots.length);
    try {
      data.points.forEach((xyz, i) => { const point = new kernel.gp_Pnt(...xyz); try { points.SetValue(i + 1, point); } finally { point.delete(); } });
      data.knots.forEach((value, i) => { knots.SetValue(i + 1, value); mults.SetValue(i + 1, data.mults[i]); });
      return new kernel.Geom_BSplineCurve(points, knots, mults, data.degree, false);
    } finally { points.delete(); knots.delete(); mults.delete(); }
  }
  if (original.IsRational()) return { curve: null, boundMm: 0, originalPoles: original.NbPoles() };
  const source = snapshot(original);
  if (source.points.length > 4096 || source.knots.length > 4096) throw Error('Native boundary curve exceeds its bounded reduction input.');
  const reparameterized = reparameterizeBoundaryCurve(kernel, original, source, restore, tolerance, work, curved);
  if (reparameterized) return reparameterized;
  let best = null, boundMm = 0;
  try {
    for (const removalTolerance of [tolerance, tolerance / 10, tolerance / 100]) {
      let candidate = restore(source), refined;
      try {
        for (let i = candidate.NbKnots() - 1; i >= 2; i--) {
          for (let multiplicity = candidate.Multiplicity(i) - 1; multiplicity >= 0; multiplicity--) {
            if (!candidate.RemoveKnot(i, multiplicity, removalTolerance)) break;
          }
        }
        if (candidate.NbPoles() >= (best?.NbPoles() ?? source.points.length)) continue;
        refined = restore(snapshot(candidate));
        for (let i = 1; i < source.knots.length - 1; i++) refined.InsertKnot(source.knots[i], source.mults[i], 0, false);
        if (refined.NbPoles() !== source.points.length || refined.NbKnots() !== source.knots.length) continue;
        if (source.knots.some((value, i) => refined.Knot(i + 1) !== value || refined.Multiplicity(i + 1) !== source.mults[i])) continue;
        let bound = 0;
        for (let i = 1; i <= refined.NbPoles(); i++) {
          const point = refined.Pole(i), expected = source.points[i - 1];
          try { bound = Math.max(bound, Math.hypot(point.X() - expected[0], point.Y() - expected[1], point.Z() - expected[2])); }
          finally { point.delete(); }
        }
        // Knot insertion is exact in real arithmetic; reserve double roundoff
        // separately from the measured control-net displacement.
        bound += 4096 * Number.EPSILON * Math.max(1, ...source.points.flat().map(Math.abs));
        if (bound > tolerance) continue;
        best?.delete(); best = candidate; candidate = null; boundMm = bound;
      } finally { refined?.delete(); candidate?.delete(); }
    }
    return { curve: best, boundMm, originalPoles: source.points.length };
  } catch (error) { best?.delete(); throw error; }
}
