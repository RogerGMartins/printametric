/** Checkpoint-only Green boundary integrals for Ridges on native rational curves.
 * The triangular wave has a C1 primitive with bounded weak second derivatives.
 * Composite midpoint error therefore remains bounded when a curve crosses a
 * crease. No smoothing, crease sampling heuristic or polygon replacement is used.
 * Caller validates parameters/contours and supplies certified geometric moments. */
import { DesignError } from '../model/budget.ts';
import { surfaceRandomWords } from '../model/surface-random.ts';
import type { ParametersV3 } from '../model/parameters-v3.ts';
import type { ContourMoments, ContourSpan } from './surface-contour-moments.ts';

import { contourPointAt as at, splitContour as split, contourDerivativeBounds as derivatives, type ContourPoint as Point } from './surface-contour-derivatives.ts';
function periodicPrimitive(s: number): readonly [number, number] {
  const t = s - Math.floor(s);
  const g = t <= .5 ? t * t : 2 * t - t * t - .5;
  const h = t <= .5 ? 2 * t ** 3 / 3 : t * t - 2 * t ** 3 / 3 - 1 / 12;
  return [g - t / 2, h - t * g + t * t / 4];
}

export function ridgeContourMoments(p: ParametersV3, spans: readonly ContourSpan[], anchor: readonly [number, number],
  geometry: ContourMoments, orientation: number, target: number, availableCharts: number): ContourMoments {
  const length = Math.min(p.width, p.height), angle = p.rotation % 360 * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle), d = p.density, frequency = 2 * Math.PI * d;
  const a0 = (c * anchor[0] + s * anchor[1]) / length, b0 = (-s * anchor[0] + c * anchor[1]) / length;
  // Subtract one fixed integer, not a position-dependent modulo that would make
  // the boundary primitive discontinuous. Local A/B keep cancellation bounded.
  const phase = (d * a0 + p.phase % 1) - Math.floor(d * a0 + p.phase % 1);
  const q = surfaceRandomWords('ridges', p.surfaceSeed)[0]! / 2 ** 32;
  const factor = length / geometry.scale, area = geometry.area / length ** 2;
  let charts = spans.map(span => {
    const maximum = Math.max(...span.weights);
    const points = span.points.map((point, i): Point => {
      const x = (point[0] - anchor[0]) / length, y = (point[1] - anchor[1]) / length, w = span.weights[i]! / maximum;
      return [(c * x + s * y) * w, (-s * x + c * y) * w, w];
    });
    return { points, direction: span.direction };
  });
  // Three fixed subdivisions tighten rational derivative bounds. Chart/work caps
  // apply to the whole geometric-plus-field job, including discarded parents.
  let created = charts.length;
  for (let depth = 0; depth < 3; depth++) {
    if (created + 2 * charts.length > availableCharts) break;
    created += 2 * charts.length;
    charts = charts.flatMap(chart => split(chart.points).map(points => ({ points, direction: chart.direction })));
  }
  if (created > availableCharts) throw new DesignError('SURFACE_BUDGET', 'Ridge contour chart work exhausted.');
  const bounded = charts.map(chart => {
    const a = derivatives(chart.points, 0), b = derivatives(chart.points, 1);
    const delta1 = .2 * frequency * b[1]!, delta2 = .2 * (frequency ** 2 * b[1]! ** 2 + frequency * b[2]!);
    const z1 = d * a[1]! + delta1, z2 = d * a[2]! + delta2;
    // Remove B-only gauge terms from the primitives: their closed integral is
    // zero, including after multiplication by B for first moments. The residual
    // periodic G/R obey |G|,|R|<=1/16, |G'|<=1/2, |G''|<=2 and R'=-G.
    const g = 1 / 16, h0 = a[0]! / 2 + g / d;
    const h01 = a[1]! / 2 + z1 / (2 * d), h02 = a[2]! / 2 + (2 * z1 ** 2 + z2 / 2) / d;
    const h1 = a[0]! ** 2 / 4 + a[0]! * g / d + g / d ** 2;
    const h11 = a[0]! * a[1]! / 2 + (a[1]! * g + a[0]! * z1 / 2) / d + g * z1 / d ** 2;
    const h12 = (a[1]! ** 2 + a[0]! * a[2]!) / 2 +
      (a[2]! * g + a[1]! * z1 + a[0]! * (2 * z1 ** 2 + z2 / 2)) / d + (z1 ** 2 / 2 + g * z2) / d ** 2;
    const bound = (alpha: number, beta: number, constant: number) => {
      const w = Math.abs(beta) * b[0]! + constant, w1 = Math.abs(beta) * b[1]!, w2 = Math.abs(beta) * b[2]!;
      const value = Math.abs(alpha) * h1 + w * h0;
      const first = Math.abs(alpha) * h11 + w1 * h0 + w * h01;
      const second = Math.abs(alpha) * h12 + w2 * h0 + 2 * w1 * h01 + w * h02;
      return { second: second * b[1]! + 2 * first * b[2]! + value * b[3]!, absolute: value * b[1]! };
    };
    const bounds = [bound(0, 0, 1), bound(factor * c, -factor * s, 0), bound(factor * s, factor * c, 0)];
    const rounding = 262144 * Number.EPSILON * (1 + Math.abs(d * a0) + Math.abs(frequency * b0)) /
      Math.min(...chart.points.map(point => point[2])) ** 3;
    return { ...chart, second: Math.max(...bounds.map(x => x.second)) * (1 + rounding),
      arithmetic: rounding * Math.max(...bounds.map(x => x.absolute)) };
  });
  const arithmetic = bounded.reduce((sum, chart) => sum + chart.arithmetic, 0) / area;
  const allocation = target * .75 - arithmetic - 2 * geometry.error;
  if (!(allocation > 0)) throw new DesignError('SURFACE_DOMAIN_ERROR', 'Ridge contour arithmetic exhausts its error allocation.');
  const rootSum = bounded.reduce((sum, chart) => sum + Math.cbrt(chart.second), 0);
  const multiplier = Math.sqrt(rootSum / (24 * area * allocation));
  const counts = bounded.map(chart => Math.max(1, Math.ceil(Math.cbrt(chart.second) * multiplier)));
  const evaluations = geometry.evaluations + counts.reduce((sum, n) => sum + n, 0);
  if (!Number.isFinite(evaluations) || evaluations > 65536) throw new DesignError('SURFACE_BUDGET', `Ridge contour integration requires ${evaluations} evaluations; the limit is 65,536.`);
  const totals = [0, 0, 0]; let error = arithmetic;
  bounded.forEach((chart, index) => {
    const count = counts[index]!, n = chart.points.length - 1;
    const derivative = chart.points.slice(1).map((point, i) => point.map((v, j) => n * (v - chart.points[i]![j]!)) as unknown as Point);
    error += chart.second / (24 * count ** 2 * area);
    for (let i = 0; i < count; i++) {
      const t = (i + .5) / count, point = at(chart.points, t), tangent = at(derivative, t);
      const a = point[0] / point[2], b = point[1] / point[2];
      const db = (tangent[1] * point[2] - point[1] * tangent[2]) / point[2] ** 2;
      const delta = phase + .2 * Math.sin(2 * Math.PI * (d * (b0 + b) + q));
      const [g, r] = periodicPrimitive(d * a + delta), h0 = a / 2 + g / d, h1 = a * a / 4 + a * g / d + r / d ** 2;
      const measure = chart.direction * orientation * db / (count * area);
      const values = [h0, factor * (c * h1 - s * b * h0), factor * (s * h1 + c * b * h0)];
      values.forEach((v, j) => { totals[j] = totals[j]! + measure * v; });
    }
  });
  error = (error + geometry.error * Math.max(1, ...totals.map(Math.abs))) / (1 - geometry.error);
  if (!Number.isFinite(error) || error > target || !totals.every(Number.isFinite) || totals[0]! < -error || totals[0]! > 1 + error) {
    throw new DesignError('SURFACE_DOMAIN_ERROR', 'Ridge contour moment error exceeds its height allocation.');
  }
  return Object.freeze({ ...geometry, mean: totals[0]!, uMean: totals[1]!, vMean: totals[2]!, error, evaluations });
}
