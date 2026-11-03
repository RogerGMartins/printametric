/** Bounded tensor Gauss integration of Ring over a rectangle. For fixed real y,
 * cos(k*sqrt(x²+y²)) is entire in x, bounded by 1 on the real axis and of
 * exponential type k. Bernstein's inequality gives |d^m/dx^m| <= k^m;
 * the same holds in y. The Gauss remainder bounds the whole integration domain,
 * not agreement between two sampled grids. Floating/libm allowance is explicit. */
import { DesignError } from '../model/budget.ts';
import type { MomentRectangle, RectangleMoments } from './surface-moments.ts';

const POSITIVE_NODES = [.1834346424956498, .525532409916329, .7966664774136267, .9602898564975363];
const WEIGHTS = [.362683783378362, .3137066458778873, .2223810344533745, .1012285362903763];
const NODES = POSITIVE_NODES.flatMap((x, i) => [[-x, WEIGHTS[i]!], [x, WEIGHTS[i]!]] as const);
const REMAINDER = 40320 ** 4 / (17 * 20922789888000 ** 3); // (8!)^4 / (17*(16!)^3)

export function ringRectangleMoments(box: MomentRectangle, length: number, density: number, depth: number): RectangleMoments {
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2;
  const hx = (box.maxX - box.minX) / 2, hy = (box.maxY - box.minY) / 2;
  const k = 4 * Math.PI * density / length, target = Math.min(.001, .00025 / Math.max(depth, 1));
  const floating = 131072 * Number.EPSILON * (1 + k * (Math.abs(cx) + Math.abs(cy) + hx + hy));
  let nx = 1, ny = 1, truncation = Infinity;
  for (;;) {
    const ex = .5 * REMAINDER * (2 * hx / nx) ** 16 * (k ** 16 + 16 / hx * k ** 15);
    const ey = .5 * REMAINDER * (2 * hy / ny) ** 16 * (k ** 16 + 16 / hy * k ** 15);
    // Includes the derivative of the linear u/v moment factor; intentionally
    // overbounds both axes so one allowance covers mean, uMean and vMean.
    truncation = ex + ey;
    if (truncation + floating <= target) break;
    if (nx * ny * 128 > 65536 || floating >= target || !Number.isFinite(truncation)) {
      throw new DesignError('SURFACE_BUDGET', 'Ring integration cannot meet its domain error within 65,536 evaluations.');
    }
    if (ex >= ey) nx *= 2; else ny *= 2;
  }
  let mean = 0, uMean = 0, vMean = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    for (const [u, wu] of NODES) for (const [v, wv] of NODES) {
      const x = box.minX + (i + (u + 1) / 2) * 2 * hx / nx;
      const y = box.minY + (j + (v + 1) / 2) * 2 * hy / ny;
      const weighted = (1 - Math.cos(k * Math.hypot(x, y))) / 2 * wu * wv / (4 * nx * ny);
      mean += weighted; uMean += weighted * (x - cx) / hx; vMean += weighted * (y - cy) / hy;
    }
  }
  const error = truncation + floating;
  if (![mean, uMean, vMean, error].every(Number.isFinite) || mean < -error || mean > 1 + error) {
    throw new DesignError('SURFACE_FIELD', 'Ring integral exceeded its normalized bounds.');
  }
  return Object.freeze({ mean, uMean, vMean, error });
}
