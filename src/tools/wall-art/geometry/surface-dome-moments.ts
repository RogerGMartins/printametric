/** Closed-form rectangular integrals of max(0,1-(x²+y²)/R²), including
 * circle crossings. Integrate in unit-radius coordinates to limit cancellation.
 * Floating allowances include libm evaluation; they are not a platform proof. */
import { DesignError } from '../model/budget.ts';
import type { MomentRectangle, RectangleMoments } from './surface-moments.ts';

export function domeRectangleMoments(box: MomentRectangle, radius: number): RectangleMoments {
  const ax = box.minX / radius, bx = box.maxX / radius;
  const ay = box.minY / radius, by = box.maxY / radius;
  const area = (bx - ax) * (by - ay), cx = (ax + bx) / 2, cy = (ay + by) / 2;
  // Oriented primitive from (0,0). Outside the disk the integrand is zero.
  function primitive(x: number, y: number): readonly [number, number, number] {
    const sx = Math.sign(x), sy = Math.sign(y);
    x = Math.min(1, Math.abs(x)); y = Math.min(1, Math.abs(y));
    const cut = Math.min(x, Math.sqrt(Math.max(0, 1 - y * y)));
    let m = y * cut - y * cut ** 3 / 3 - y ** 3 * cut / 3;
    let mx = y * cut * cut / 2 - y * cut ** 4 / 4 - y ** 3 * cut * cut / 6;
    let my = (y * y / 2 - y ** 4 / 4) * cut - y * y * cut ** 3 / 6;
    if (x > cut) {
      const i3 = (v: number) => (v * Math.sqrt(Math.max(0, 1 - v * v)) * (5 - 2 * v * v) + 3 * Math.asin(v)) / 8;
      const iy = (v: number) => v / 4 - v ** 3 / 6 + v ** 5 / 20;
      m += 2 / 3 * (i3(x) - i3(cut));
      mx += 2 / 15 * ((1 - cut * cut) ** 2.5 - (1 - x * x) ** 2.5);
      my += iy(x) - iy(cut);
    }
    return [sx * sy * m, sy * mx, sx * my];
  }
  const pp = primitive(bx, by), mp = primitive(ax, by), pm = primitive(bx, ay), mm = primitive(ax, ay);
  const totals = pp.map((v, i) => v - mp[i]! - pm[i]! + mm[i]!);
  const mean = totals[0]! / area;
  const uMean = (totals[1]! / area - cx * mean) * 2 / (bx - ax);
  const vMean = (totals[2]! / area - cy * mean) * 2 / (by - ay);
  const error = 32768 * Number.EPSILON / area * Math.max(1, 2 * (1 + Math.abs(cx)) / (bx - ax), 2 * (1 + Math.abs(cy)) / (by - ay));
  if (![mean, uMean, vMean, error].every(Number.isFinite) || mean < -error || mean > 1 + error || error > .001) {
    throw new DesignError('SURFACE_DOMAIN_ERROR', 'Dome integral cancellation exceeds the bounded numerical allowance.');
  }
  return Object.freeze({ mean, uMean, vMean, error });
}
