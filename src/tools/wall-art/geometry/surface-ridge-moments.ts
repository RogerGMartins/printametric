/** Ridges: exact integration across each band, bounded midpoint integration along
 * it. Rotate the rectangle into field coordinates; each horizontal slice has
 * linear endpoints between vertex levels. The triangular-wave primitive is C1
 * even at creases, with bounded weak second derivatives. Thus the midpoint
 * remainder applies across crease crossings without smoothing the field. */
import { DesignError } from '../model/budget.ts';
import { surfaceRandomWords } from '../model/surface-random.ts';
import type { ParametersV3 } from '../model/parameters-v3.ts';
import type { MomentRectangle, RectangleMoments } from './surface-moments.ts';

function primitive(s: number): readonly [number, number] {
  const n = Math.floor(s), t = s - n;
  const g = t <= .5 ? t * t : 2 * t - t * t - .5;
  const h = t <= .5 ? 2 * t ** 3 / 3 : t * t - 2 * t ** 3 / 3 - 1 / 12;
  return [.5 * n + g, n * n / 4 + n * g + h];
}

export function ridgeRectangleMoments(p: ParametersV3, box: MomentRectangle): RectangleMoments {
  const length = Math.min(p.width, p.height), angle = p.rotation % 360 * Math.PI / 180;
  const axisAligned = p.rotation % 90 === 0;
  const c = axisAligned ? Math.round(Math.cos(angle)) : Math.cos(angle);
  const s = axisAligned ? Math.round(Math.sin(angle)) : Math.sin(angle), d = p.density, tau = 2 * Math.PI;
  const width = box.maxX - box.minX, height = box.maxY - box.minY, area = width * height / length ** 2;
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const vertices = [[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]]
    .map(([x, y]) => [(c * x! + s * y!) / length, (-s * x! + c * y!) / length] as const);
  const levels = [...new Set(vertices.map(v => v[1]))].sort((a, b) => a - b);
  const q = surfaceRandomWords('ridges', p.surfaceSeed)[0]! / 2 ** 32;
  const weights = [[0, 0, 1], [2 * length * c / width, -2 * length * s / width, -2 * cx / width],
    [2 * length * s / height, 2 * length * c / height, -2 * cy / height]];
  const target = Math.min(.001, .00025 / Math.max(p.depth, 1));
  const first = .2 * tau * d, second = .2 * (tau * d) ** 2;
  const totals = [0, 0, 0]; let evaluations = 0, error = 0;
  for (let k = 1; k < levels.length; k++) {
    const lo = levels[k - 1]!, hi = levels[k]!, mid = (lo + hi) / 2, span = hi - lo;
    if (span === 0) continue;
    const edges: { slope: number; intercept: number; middle: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const a = vertices[i]!, b = vertices[(i + 1) % 4]!;
      if (!(mid > Math.min(a[1], b[1]) && mid < Math.max(a[1], b[1]))) continue;
      const slope = (b[0] - a[0]) / (b[1] - a[1]), intercept = a[0] - slope * a[1];
      edges.push({ slope, intercept, middle: slope * mid + intercept });
    }
    if (edges.length !== 2) throw new DesignError('SURFACE_DOMAIN_ERROR', 'Rotated ridge slice is numerically unresolved.');
    edges.sort((a, b) => a.middle - b.middle);
    const [left, right] = edges as [typeof edges[number], typeof edges[number]];
    const sliceWidth = Math.max((right.slope - left.slope) * lo + right.intercept - left.intercept,
      (right.slope - left.slope) * hi + right.intercept - left.intercept);
    const tl = Math.abs(left.slope) + first / d, tr = Math.abs(right.slope) + first / d;
    const secondBounds = weights.map(([a, b]) => Math.abs(a!) * second / d * sliceWidth +
      (Math.abs(b!) + Math.abs(a!) * first / d) * (tl + tr) +
      Math.abs(a! * left.slope + b!) * tl + Math.abs(a! * right.slope + b!) * tr +
      2 * d * (tl * tl + tr * tr) + 2 * second / d);
    const bound = Math.max(...secondBounds), allocation = target / (2 * (levels.length - 1));
    const count = Math.max(1, Math.ceil(Math.sqrt(bound * span ** 3 / (24 * area * allocation))));
    if (!Number.isFinite(count) || evaluations + count > 65536) {
      throw new DesignError('SURFACE_BUDGET', 'Ridge integration exceeds 65,536 bounded slice evaluations.');
    }
    evaluations += count; error += bound * span ** 3 / (24 * area * count * count);
    let arithmetic = 0;
    for (let i = 0; i < count; i++) {
      const b = lo + (i + .5) * span / count;
      const al = left.slope * b + left.intercept, ar = right.slope * b + right.intercept;
      const delta = .2 * Math.sin(tau * (d * b + q)) + p.phase % 1;
      const pl = primitive(d * al + delta), pr = primitive(d * ar + delta);
      const m = (pr[0] - pl[0]) / d;
      const am = (pr[1] - pl[1] - delta * (pr[0] - pl[0])) / (d * d);
      weights.forEach(([a, bb, cc], j) => { totals[j] = totals[j]! + (a! * am + (bb! * b + cc!) * m) * span / count / area; });
      // Absolute primitive/weight magnitudes cover subtraction cancellation.
      const magnitude = Math.max(1, ...pl.map(Math.abs), ...pr.map(Math.abs));
      arithmetic = Math.max(arithmetic, 131072 * Number.EPSILON * magnitude *
        Math.max(...weights.map(([a, bb, cc]) => 1 + Math.abs(a!) / (d * d) * (1 + Math.abs(delta)) + Math.abs(bb! * b + cc!) / d)));
    }
    error += arithmetic * span / area;
  }
  if (error > target || ![...totals, error].every(Number.isFinite) || totals[0]! < -error || totals[0]! > 1 + error) {
    throw new DesignError('SURFACE_DOMAIN_ERROR', 'Ridge moment error exceeds its height allocation.');
  }
  return Object.freeze({ mean: totals[0]!, uMean: totals[1]!, vMean: totals[2]!, error });
}
