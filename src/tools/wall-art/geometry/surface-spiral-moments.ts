/** Adaptive rectangular Spiral integration with whole-domain remainders.
 * Away from the origin, the angular/radial field has a complex analytic extension.
 * A disk rho < R bounds angular growth by ((R+rho)/(R-rho))^arms and radial
 * growth by exp(k*rho*(R+rho)/(R-rho)). Cauchy's derivative bound plus the
 * 8-point Gauss remainder bounds each chart. At the center use the envelope
 * bound; at the envelope join include both integral and quadrature corrections.
 * Floating/libm allowances remain explicit rather than a platform proof. */
import { DesignError } from '../model/budget.ts';
import { createSurfaceField } from './surface-fields.ts';
import { spiralCenterWeight, type SpiralCenter } from './spiral-center.ts';
import type { ParametersV3 } from '../model/parameters-v3.ts';
import type { MomentRectangle, RectangleMoments } from './surface-moments.ts';

const X = [.1834346424956498, .525532409916329, .7966664774136267, .9602898564975363];
const W = [.362683783378362, .3137066458778873, .2223810344533745, .1012285362903763];
const NODES = X.flatMap((x, i) => [[-x, W[i]!], [x, W[i]!]] as const);
const CAUCHY_GAUSS = 40320 ** 4 / (17 * 20922789888000 ** 2);
interface Cell { box: MomentRectangle; depth: number; values: number[]; error: number }

export function spiralRectangleMoments(p: ParametersV3, box: MomentRectangle, mode: SpiralCenter): RectangleMoments {
  const length = Math.min(p.width, p.height), radius = .01 * length, k = 4 * Math.PI * p.density / length;
  const hx = (box.maxX - box.minX) / 2, hy = (box.maxY - box.minY) / 2;
  const cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2, area = 4 * hx * hy;
  const target = Math.min(.001, .00025 / Math.max(p.depth, 1)), field = createSurfaceField(p, mode);
  const floating = 131072 * Number.EPSILON * (1 + p.spiralArms + k * (Math.abs(cx) + Math.abs(cy) + hx + hy));
  let evaluations = 0, cells = 0;
  function make(b: MomentRectangle, depth: number): Cell {
    if (++cells > 4096) throw new DesignError('SURFACE_BUDGET', 'Spiral integration exceeds 4,096 bounded charts.');
    const nx = b.minX > 0 ? b.minX : b.maxX < 0 ? b.maxX : 0;
    const ny = b.minY > 0 ? b.minY : b.maxY < 0 ? b.maxY : 0;
    const near = Math.hypot(nx, ny), far = Math.hypot(Math.max(Math.abs(b.minX), Math.abs(b.maxX)), Math.max(Math.abs(b.minY), Math.abs(b.maxY)));
    const wx = b.maxX - b.minX, wy = b.maxY - b.minY, fraction = wx * wy / area;
    const mx = (b.minX + b.maxX) / 2, my = (b.minY + b.maxY) / 2;
    const constantError = .5 * spiralCenterWeight(2 * far / length, mode);
    let gaussError = Infinity;
    for (const radiusFraction of [.25, .5, .75]) {
      const rho = Math.min(near * radiusFraction, 1 / k);
      if (!(rho > 0)) continue;
      let envelope = 1;
      if (far < radius) {
        const t = (far + rho) / radius;
        envelope = mode === 'linear' ? t : mode === 'smooth-c1' ? 3 * t * t + 2 * t ** 3 : 10 * t ** 3 + 15 * t ** 4 + 6 * t ** 5;
      }
      const ratio = (near + rho) / (near - rho);
      const magnitude = 1 + envelope * ratio ** p.spiralArms * Math.exp(k * rho * ratio);
      const analytic = CAUCHY_GAUSS * magnitude * ((wx / rho) ** 16 * (1 + rho / hx) + (wy / rho) ** 16 * (1 + rho / hy));
      // At the join integrate the outer analytic field plus the bounded inner
      // correction. Its error appears once in the integral and once in Q8.
      const correction = near < radius && far >= radius ? 1 - spiralCenterWeight(2 * near / length, mode) : 0;
      gaussError = Math.min(gaussError, analytic + correction);
    }
    if (constantError <= gaussError) {
      return { box: b, depth, values: [.5 * fraction, .5 * (mx - cx) / hx * fraction, .5 * (my - cy) / hy * fraction], error: constantError * fraction };
    }
    if (evaluations + 64 > 65536) throw new DesignError('SURFACE_BUDGET', 'Spiral integration exceeds 65,536 field evaluations.');
    evaluations += 64;
    const values = [0, 0, 0];
    for (const [u, wu] of NODES) for (const [v, wv] of NODES) {
      const x = mx + wx / 2 * u, y = my + wy / 2 * v, term = field.evaluate(x, y) * wu * wv / 4 * fraction;
      values[0] = values[0]! + term; values[1] = values[1]! + term * (x - cx) / hx; values[2] = values[2]! + term * (y - cy) / hy;
    }
    return { box: b, depth, values, error: gaussError * fraction };
  }
  // At most 4,096 small diagnostic charts: a direct deterministic largest-error
  // scan is bounded and avoids introducing a general integration framework.
  const active = [make(box, 0)];
  for (;;) {
    const error = active.reduce((sum, cell) => sum + cell.error, floating);
    if (error <= target) {
      const values = [0, 1, 2].map(i => active.reduce((sum, cell) => sum + cell.values[i]!, 0));
      if (![...values, error].every(Number.isFinite)) throw new DesignError('SURFACE_FIELD', 'Spiral moments are nonfinite.');
      return Object.freeze({ mean: values[0]!, uMean: values[1]!, vMean: values[2]!, error });
    }
    let index = -1;
    for (let i = 0; i < active.length; i++) if (active[i]!.depth < 8 && (index < 0 || active[i]!.error > active[index]!.error)) index = i;
    if (index < 0 || floating >= target) throw new DesignError('SURFACE_DOMAIN_ERROR', 'Spiral integration exhausted eight refinement levels before meeting its error allocation.');
    const cell = active.splice(index, 1)[0]!, b = cell.box, mx = (b.minX + b.maxX) / 2, my = (b.minY + b.maxY) / 2;
    for (const [minX, maxX] of [[b.minX, mx], [mx, b.maxX]]) for (const [minY, maxY] of [[b.minY, my], [my, b.maxY]]) {
      active.push(make({ minX: minX!, maxX: maxX!, minY: minY!, maxY: maxY! }, cell.depth + 1));
    }
  }
}
