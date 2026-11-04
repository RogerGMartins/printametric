/** Dome Green integrals on native rational contours, including disk-edge crossings.
 * In unit-radius coordinates q=x²+y², radial fluxes K0 and K1 satisfy
 * div((x,y)K0)=F and div(x(x,y)K1)=xF. Both are C1 across q=1, with
 * globally bounded weak second derivatives; no contour clipping is approximated.
 * Caller supplies validated parameters/curves and certified geometric moments. */
import { DesignError } from '../model/budget.ts';
import type { ParametersV3 } from '../model/parameters-v3.ts';
import type { ContourMoments, ContourSpan } from './surface-contour-moments.ts';
import { contourPointAt as at, splitContour as split, contourDerivativeBounds as derivatives, type ContourPoint as Point } from './surface-contour-derivatives.ts';

export function domeContourMoments(p: ParametersV3, spans: readonly ContourSpan[], anchor: readonly [number, number],
  geometry: ContourMoments, orientation: number, target: number, availableCharts: number): ContourMoments {
  const radius = Math.min(p.width, p.height) / 2, area = geometry.area / radius ** 2, factor = radius / geometry.scale;
  const ax = anchor[0] / geometry.scale, ay = anchor[1] / geometry.scale;
  let charts = spans.map(span => {
    const maximum = Math.max(...span.weights);
    return { points: span.points.map((point, i): Point => { const w = span.weights[i]! / maximum; return [point[0] / radius * w, point[1] / radius * w, w]; }), direction: span.direction };
  });
  let created = charts.length;
  for (let depth = 0; depth < 3; depth++) {
    if (created + 2 * charts.length > availableCharts) break;
    created += 2 * charts.length;
    charts = charts.flatMap(chart => split(chart.points).map(points => ({ points, direction: chart.direction })));
  }
  if (created > availableCharts) throw new DesignError('SURFACE_BUDGET', 'Dome contour chart work exhausted.');
  const bounded = charts.map(chart => {
    const x = derivatives(chart.points, 0), y = derivatives(chart.points, 1);
    const q1 = 2 * (x[0]! * x[1]! + y[0]! * y[1]!);
    const q2 = 2 * (x[1]! ** 2 + x[0]! * x[2]! + y[1]! ** 2 + y[0]! * y[2]!);
    let j = x[0]! * y[1]! + y[0]! * x[1]!;
    const j1 = x[0]! * y[2]! + y[0]! * x[2]!;
    const j2 = x[1]! * y[2]! + x[0]! * y[3]! + y[1]! * x[2]! + y[0]! * x[3]!;
    if (chart.points.length === 2 && chart.points[0]![2] === chart.points[1]![2]) {
      // A line's radial flux determinant is constant. Keeping its exact signed
      // cancellation avoids charging a distant short edge for the full box area.
      const [a, b] = chart.points as [Point, Point], positive = a[0] * b[1], negative = a[1] * b[0];
      j = (Math.abs(positive - negative) + 8192 * Number.EPSILON * (Math.abs(positive) + Math.abs(negative))) / a[2] ** 2;
    }
    // Positive rational weights enclose the whole curve in its control hull.
    // Fully interior charts have polynomial fluxes with zero second q-derivative;
    // crossing charts retain the global weak derivative bound of 1/2.
    const minAbs = (axis: 0 | 1) => { const values = chart.points.map(point => point[axis] / point[2]); return Math.max(0, Math.min(...values), -Math.max(...values)); };
    const qLower = minAbs(0) ** 2 + minAbs(1) ** 2, qUpper = x[0]! ** 2 + y[0]! ** 2;
    const inside = qUpper < 1 - 1e-12, outside = qLower > 1 + 1e-12;
    const lower = outside ? qLower * (1 - 1e-12) : 1;
    const k0 = outside ? 1 / (4 * lower) : .5, k1 = outside ? 2 / (15 * lower ** 1.5) : 1 / 3;
    const d0 = outside ? 1 / (4 * lower ** 2) : .25, d1 = outside ? 1 / (5 * lower ** 2.5) : .2;
    const dd0 = inside ? 0 : .5 / lower ** 3, dd1 = inside ? 0 : .5 / lower ** 3.5;
    const k01 = d0 * q1, k02 = dd0 * q1 ** 2 + d0 * q2;
    const k11 = d1 * q1, k12 = dd1 * q1 ** 2 + d1 * q2;
    const firstMoment = (coordinate: number[], offset: number) => {
      const h = factor * coordinate[0]! * k1 + Math.abs(offset) * k0;
      const h1 = factor * (coordinate[1]! * k1 + coordinate[0]! * k11) + Math.abs(offset) * k01;
      const h2 = factor * (coordinate[2]! * k1 + 2 * coordinate[1]! * k11 + coordinate[0]! * k12) + Math.abs(offset) * k02;
      return { second: h2 * j + 2 * h1 * j1 + h * j2, absolute: h * j };
    };
    const bounds = [{ second: k02 * j + 2 * k01 * j1 + k0 * j2, absolute: k0 * j }, firstMoment(x, ax), firstMoment(y, ay)];
    const rounding = 262144 * Number.EPSILON * (1 + x[0]! + y[0]! + Math.abs(ax) + Math.abs(ay)) / Math.min(...chart.points.map(point => point[2])) ** 3;
    return { ...chart, second: Math.max(...bounds.map(b => b.second)) * (1 + rounding), arithmetic: rounding * Math.max(...bounds.map(b => b.absolute)) };
  });
  const arithmetic = bounded.reduce((sum, chart) => sum + chart.arithmetic, 0) / area;
  const allocation = target * .75 - arithmetic - 2 * geometry.error;
  if (!(allocation > 0)) throw new DesignError('SURFACE_DOMAIN_ERROR', 'Dome contour arithmetic exhausts its error allocation.');
  const rootSum = bounded.reduce((sum, chart) => sum + Math.cbrt(chart.second), 0);
  const multiplier = Math.sqrt(rootSum / (24 * area * allocation));
  const counts = bounded.map(chart => Math.max(1, Math.ceil(Math.cbrt(chart.second) * multiplier)));
  const evaluations = geometry.evaluations + counts.reduce((sum, count) => sum + count, 0);
  if (!Number.isFinite(evaluations) || evaluations > 65536) throw new DesignError('SURFACE_BUDGET', `Dome contour integration requires ${evaluations} evaluations; the limit is 65,536.`);
  const totals = [0, 0, 0]; let error = arithmetic;
  bounded.forEach((chart, index) => {
    const count = counts[index]!, n = chart.points.length - 1;
    const derivative = chart.points.slice(1).map((point, i) => point.map((v, j) => n * (v - chart.points[i]![j]!)) as unknown as Point);
    error += chart.second / (24 * count ** 2 * area);
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count, point = at(chart.points, t), tangent = at(derivative, t);
      const x = point[0] / point[2], y = point[1] / point[2], q = x * x + y * y;
      const k0 = q <= 1 ? .5 - q / 4 : 1 / (4 * q), k1 = q <= 1 ? 1 / 3 - q / 5 : 2 / (15 * q ** 1.5);
      const cross = (point[0] * tangent[1] - point[1] * tangent[0]) / point[2] ** 2;
      const measure = chart.direction * orientation * cross / (count * area);
      const values = [k0, factor * x * k1 - ax * k0, factor * y * k1 - ay * k0];
      values.forEach((value, j) => { totals[j] = totals[j]! + measure * value; });
    }
  });
  error = (error + geometry.error * Math.max(1, ...totals.map(Math.abs))) / (1 - geometry.error);
  if (!Number.isFinite(error) || error > target || !totals.every(Number.isFinite) || totals[0]! < -error || totals[0]! > 1 + error) throw new DesignError('SURFACE_DOMAIN_ERROR', 'Dome contour moment error exceeds its height allocation.');
  return Object.freeze({ ...geometry, mean: totals[0]!, uMean: totals[1]!, vMean: totals[2]!, error, evaluations });
}
