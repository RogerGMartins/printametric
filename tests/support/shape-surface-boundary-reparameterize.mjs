/** Compact native boundary candidates parameterized by a monotone rectangle axis.
 * Acceptance compares the ENTIRE original curve to the candidate. Each original
 * Bezier span uses a residual-polynomial coefficient bound; subdivision
 * tightens that bound, never substitutes point samples for it. Monotone axis range
 * proves the correspondence covers both curves. Rational inputs are not changed. */
import { interpolateCandidate } from '../../src/tools/wall-art/geometry/surface-fit.ts';
import { boundCurveResidual } from './shape-surface-curve-residual.mjs';

function split(values, t = .5) {
  let row = [...values]; const left = [row[0]], right = [row.at(-1)];
  while (row.length > 1) { row = row.slice(0, -1).map((value, i) => (1 - t) * value + t * row[i + 1]); left.push(row[0]); right.unshift(row.at(-1)); }
  return [left, right];
}
const evaluate = (values, t) => split(values, t)[0].at(-1);

export function reparameterizeBoundaryCurve(kernel, original, source, restore, tolerance, work) {
  const reject = reason => { work.rejections ??= {}; work.rejections[reason] = (work.rejections[reason] ?? 0) + 1; return null; };
  const first = source.points[0], last = source.points.at(-1);
  const axis = Math.abs(last[0] - first[0]) >= Math.abs(last[1] - first[1]) ? 0 : 1, fixed = 1 - axis;
  const span = last[axis] - first[axis];
  if (Math.abs(span) < 1e-10) return reject('zero-axis-span');
  const normalized = source.points.map(point => (point[axis] - first[axis]) / span);
  if (normalized.some((value, i) => i && value < normalized[i - 1])) return reject('nonmonotone-control-polygon');
  const fixedError = Math.max(...source.points.map(point => Math.abs(point[fixed] - first[fixed])));
  const rounding = 8192 * Number.EPSILON * Math.max(1, ...source.points.flat().map(Math.abs));
  if (fixedError + rounding >= tolerance) return reject('nonplanar-control-polygon');
  const charge = () => { if (++work.comparisons > 65_536) throw Error('Boundary comparison budget exhausted.'); };
  const bezier = restore(source);
  let spans;
  try {
    for (let i = 1; i < source.knots.length - 1; i++) bezier.InsertKnot(source.knots[i], source.degree, 0, false);
    if (bezier.NbPoles() !== (source.knots.length - 1) * source.degree + 1) return null;
    const all = [];
    for (let i = 1; i <= bezier.NbPoles(); i++) { const point = bezier.Pole(i); try { all.push([point.X(), point.Y(), point.Z()]); } finally { point.delete(); } }
    spans = Array.from({ length: source.knots.length - 1 }, (_, i) => all.slice(i * source.degree, i * source.degree + source.degree + 1));
  } finally { bezier.delete(); }
  const samples = new Map([[0, first[2]], [1, last[2]]]);
  function sample(t) {
      if (samples.has(t)) return samples.get(t);
      let lower = original.FirstParameter(), upper = original.LastParameter(), z = NaN;
      for (let i = 0; i < 36; i++) {
        charge(); const middle = (lower + upper) / 2, point = original.Value(middle);
        try { z = point.Z(); const coordinate = axis === 0 ? point.X() : point.Y(); if ((coordinate - first[axis]) / span < t) lower = middle; else upper = middle; }
        finally { point.delete(); }
      }
      samples.set(t, z); return z;
  }
  const degree = 12;
  for (const count of [1, 2, 4, 8]) {
    if (count * degree + 1 >= source.points.length) break;
    const segments = Array.from({ length: count }, (_, i) => {
      const heights = interpolateCandidate(t => sample((i + t) / count), degree);
      return { heights, lower: i / count, upper: (i + 1) / count };
    });
    const crossingRounding = 4e-12 * count * Math.max(...segments.flatMap(segment => segment.heights.slice(1).map((value, i) => degree * Math.abs(value - segment.heights[i]))));
    let bound = 0;
    function compare(points) {
      charge();
      const x = points.map(point => (point[axis] - first[axis]) / span), z = points.map(point => point[2]);
      const crossing = segments.find(segment => segment.upper > x[0] + 1e-12 && segment.upper < x.at(-1) - 1e-12);
      if (crossing) {
        let low = 0, high = 1;
        for (let i = 0; i < 48; i++) { const middle = (low + high) / 2; if (evaluate(x, middle) < crossing.upper) low = middle; else high = middle; }
        const halves = [0, 1, 2].map(axis => split(points.map(point => point[axis]), (low + high) / 2));
        return compare(points.map((_, i) => halves.map(axis => axis[0][i]))) && compare(points.map((_, i) => halves.map(axis => axis[1][i])));
      }
      const index = Math.max(0, Math.min(count - 1, Math.floor(evaluate(x, .5) * count))), segment = segments[index];
      if (rounding + crossingRounding >= tolerance) return false;
      const allowance = Math.sqrt(Math.max(0, (tolerance - rounding - crossingRounding) ** 2 - fixedError ** 2));
      const residualBound = boundCurveResidual(x.map(value => (value - segment.lower) * count), z, segment.heights, allowance, charge);
      if (residualBound === null) return false;
      bound = Math.max(bound, Math.hypot(fixedError, residualBound) + rounding + crossingRounding); return true;
    }
    if (!spans.every(points => compare(points))) continue;
    const points = segments.flatMap((segment, index) => segment.heights.map((height, i) => {
      const p = [first[0], first[1], height]; p[axis] = first[axis] + span * (index + i / degree) / count; return p;
    }).slice(index === 0 ? 0 : 1));
    const knots = Array.from({ length: count + 1 }, (_, i) => i / count), mults = knots.map((_, i) => i === 0 || i === count ? degree + 1 : degree);
    return { curve: restore({ points, knots, mults, degree }), boundMm: bound, originalPoles: source.points.length };
  }
  return reject('residual-bound');
}
