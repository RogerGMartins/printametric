/** Checkpoint-only bounded domains for all seven surface fields.
 * Polar joins and Ridges half-cycle boundaries are explicit. Each polynomial patch
 * carries a whole-domain height bound including XY approximation transported through
 * a global field Lipschitz bound. Trimming, CAD validity and material remain R2/R3.
 */
import { DesignError } from '../model/budget.ts';
import { validateParametersV3 } from '../model/validation-v3.ts';
import { surfaceRandomWords } from '../model/surface-random.ts';
import { elevateCurve, fitSine, multiplyLinear, multiplySmoothCenter, type BoundedCurve } from './surface-fit.ts';
import { validateSpiralCenter, type SpiralCenter } from './spiral-center.ts';

export interface SurfaceBox { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number }
export interface BoundaryPatch {
  readonly id: string;
  readonly kind: 'polar-inner' | 'polar-outer' | 'ridge-strip' | 'cartesian';
  readonly u: readonly [number, number];
  readonly v: readonly [number, number];
  /** Polar theta = u + angularTwist*v before field rotation; omitted means zero.
   * v is the field's normalized radius (2*physical radius/reference length). */
  readonly angularTwist?: number;
  readonly degreeU: number;
  readonly degreeV: number;
  /** u-major XYZ Bernstein control points, in assembly millimeters. */
  readonly poles: readonly number[];
  readonly positionErrorMm: number;
  readonly heightErrorMm: number;
  readonly physicalHeightErrorMm: number;
}
export const SURFACE_DOMAIN_LIMITS = Object.freeze({ patches: 256, poles: 4096, evaluations: 65_536, refinements: 8, heightErrorMm: .0002 });
const tau = 2 * Math.PI;
const productError = (a: number, b: number) => a * (1 + b) + b;
const linear = (a: number, b: number): BoundedCurve => ({ coefficients: [a, b], error: 0 });

/** Parameter rectangle is an enclosing chart domain, not a clipped part. Work is
 * bounded before pole allocation. This API accepts only continuous top requests. */
export function createBoundaryPatches(input: unknown, box: SurfaceBox, spiralCenter: SpiralCenter = 'linear', compactSpiral = false, charge?: (count: number) => void): readonly BoundaryPatch[] {
  validateSpiralCenter(spiralCenter);
  if (typeof compactSpiral !== 'boolean') throw new DesignError('SURFACE_DOMAIN', 'Invalid Spiral chart strategy.');
  const p = validateParametersV3(input);
  if (p.stepBlend !== 0 || p.planarTops) throw new DesignError('SURFACE_DOMAIN', 'Patch construction requires a continuous top request.');
  if (![box.minX, box.maxX, box.minY, box.maxY].every(Number.isFinite) || box.minX >= box.maxX || box.minY >= box.maxY || Math.max(...Object.values(box).map(Math.abs)) > 4000) throw new DesignError('SURFACE_DOMAIN', 'Invalid bounded surface rectangle.');
  const length = Math.min(p.width, p.height), rotation = ['dome', 'ring'].includes(p.family) ? 0 : p.rotation % 360 * Math.PI / 180;
  const c = Math.cos(rotation), s = Math.sin(rotation), baseline = (p.plinthEnabled ? p.baseThickness : 0) + p.minimumRelief;
  const corners = [[box.minX, box.minY], [box.minX, box.maxY], [box.maxX, box.minY], [box.maxX, box.maxY]].map(([x, y]) => [(c * x! + s * y!) / length, (-s * x! + c * y!) / length] as const);
  const phase = p.phase % 1, patches: BoundaryPatch[] = [];
  let poles = 0, evaluations = 0;
  const sine = (start: number, end: number, frequency: number, offset: number, degree: number) => {
    evaluations += degree + 1;
    if (evaluations > SURFACE_DOMAIN_LIMITS.evaluations) throw new DesignError('SURFACE_BUDGET', 'Boundary-domain evaluation budget exhausted.');
    charge?.(degree + 1);
    return fitSine(start, end, frequency, offset, degree);
  };
  function append(kind: BoundaryPatch['kind'], u: readonly [number, number], v: readonly [number, number], degreeU: number, degreeV: number,
    point: (i: number, j: number) => readonly [number, number, number], positionErrorMm: number, heightErrorMm: number, lipschitz: number, angularTwist = 0) {
    const count = (degreeU + 1) * (degreeV + 1);
    if (patches.length >= SURFACE_DOMAIN_LIMITS.patches || poles + count > SURFACE_DOMAIN_LIMITS.poles) throw new DesignError('SURFACE_BUDGET', 'Boundary-domain patch/control-point budget exhausted.');
    const coordinates: number[] = [];
    for (let i = 0; i <= degreeU; i++) for (let j = 0; j <= degreeV; j++) coordinates.push(...point(i, j));
    if (!coordinates.every(Number.isFinite)) throw new DesignError('SURFACE_DOMAIN', 'Nonfinite patch control point.');
    // Final tensor products/sums and rotation reserve double rounding separately.
    const rounding = 1024 * Number.EPSILON * Math.max(1, ...coordinates.map(Math.abs));
    positionErrorMm += Math.SQRT2 * rounding; heightErrorMm += rounding;
    const physicalHeightErrorMm = heightErrorMm + p.depth * lipschitz * positionErrorMm;
    if (!Number.isFinite(physicalHeightErrorMm) || physicalHeightErrorMm > SURFACE_DOMAIN_LIMITS.heightErrorMm) throw new DesignError('SURFACE_DOMAIN_ERROR', 'Whole-domain surface error exceeds its investigation allocation.');
    poles += count;
    patches.push({ id: `r1-${p.family}-${patches.length}`, kind, u, v, degreeU, degreeV, poles: coordinates, positionErrorMm, heightErrorMm, physicalHeightErrorMm, ...(angularTwist ? { angularTwist } : {}) });
  }
  if (['wave', 'dunes', 'random'].includes(p.family)) {
    const terms: { x: number; y: number; phase: number; amplitude: number }[] = [];
    const add = (a: number, b: number, offset: number, amplitude: number) => terms.push({
      x: tau * (a * c - b * s) / length, y: tau * (a * s + b * c) / length, phase: tau * offset, amplitude,
    });
    if (p.family === 'wave') add(p.density, 0, phase, .5);
    else if (p.family === 'dunes') {
      const q = surfaceRandomWords('dunes', p.surfaceSeed).map(x => x / 2 ** 32);
      add(p.density, 0, phase + q[0]!, 1 / 3.5);
      add(0, .7 * p.density, -phase + q[1]!, .5 / 3.5);
      add(.6 * p.density, .6 * p.density, q[2]!, .25 / 3.5);
    } else {
      const q = surfaceRandomWords('random', p.surfaceSeed).map(x => x / 2 ** 32);
      const sum = Array.from({ length: 6 }, (_, i) => 1 / (i + 1)).reduce((a, b) => a + b, 0);
      for (let k = 1; k <= 6; k++) {
        const angle = tau * q[2 * (k - 1)]!, frequency = p.density * (.5 + k / 6);
        add(frequency * Math.cos(angle), frequency * Math.sin(angle), phase + q[2 * k - 1]!, 1 / (2 * k * sum));
      }
    }
    const nx = Math.max(1, Math.ceil((box.maxX - box.minX) * Math.max(...terms.map(t => Math.abs(t.x))) / 4));
    const ny = Math.max(1, Math.ceil((box.maxY - box.minY) * Math.max(...terms.map(t => Math.abs(t.y))) / 4));
    if (nx * ny * 169 > SURFACE_DOMAIN_LIMITS.poles) throw new DesignError('SURFACE_BUDGET', 'Harmonic chart budget exhausted.');
    const lipschitz = terms.reduce((sum, t) => sum + Math.abs(t.amplitude) * Math.hypot(t.x, t.y), 0);
    for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) {
      const u = [box.minX + (box.maxX - box.minX) * ix / nx, box.minX + (box.maxX - box.minX) * (ix + 1) / nx] as const;
      const v = [box.minY + (box.maxY - box.minY) * iy / ny, box.minY + (box.maxY - box.minY) * (iy + 1) / ny] as const;
      const fits = terms.map(t => ({ ...t, sx: sine(...u, t.x, t.phase, 12), cx: sine(...u, t.x, t.phase + Math.PI / 2, 12),
        sy: sine(...v, t.y, 0, 12), cy: sine(...v, t.y, Math.PI / 2, 12) }));
      const error = p.depth * fits.reduce((sum, t) => sum + Math.abs(t.amplitude) *
        (productError(t.sx.error, t.cy.error) + productError(t.cx.error, t.sy.error)), 0);
      append('cartesian', u, v, 12, 12, (i, j) => [u[0] + (u[1] - u[0]) * i / 12, v[0] + (v[1] - v[0]) * j / 12,
        baseline + p.depth * (.5 + fits.reduce((sum, t) => sum + t.amplitude *
          (t.sx.coefficients[i]! * t.cy.coefficients[j]! + t.cx.coefficients[i]! * t.sy.coefficients[j]!), 0))], 0, error, lipschitz);
    }
  } else if (p.family === 'ridges') {
    const aMin = Math.min(...corners.map(v => v[0])), aMax = Math.max(...corners.map(v => v[0]));
    const bMin = Math.min(...corners.map(v => v[1])), bMax = Math.max(...corners.map(v => v[1]));
    // A conservative envelope covers the bent strips, including entire crest and
    // trough curves. R2 trims these domains against the actual native footprint.
    const low = p.density * aMin - .2 + phase, high = p.density * aMax + .2 + phase;
    const first = Math.floor(2 * low), last = Math.ceil(2 * high);
    const segments = Math.max(1, Math.ceil(tau * p.density * (bMax - bMin) / 4));
    if ((last - first) * segments > SURFACE_DOMAIN_LIMITS.patches) throw new DesignError('SURFACE_BUDGET', 'Too many ridge domains.');
    const q = surfaceRandomWords('ridges', p.surfaceSeed)[0]! / 2 ** 32;
    for (let k = first; k < last; k++) for (let segment = 0; segment < segments; segment++) {
      const u = [Math.max(low, k / 2), Math.min(high, (k + 1) / 2)] as const;
      const v = [bMin + (bMax - bMin) * segment / segments, bMin + (bMax - bMin) * (segment + 1) / segments] as const;
      const bend = sine(v[0], v[1], tau * p.density, tau * q, 10), b = elevateCurve(linear(...v), 10);
      const heights = u.map(value => k % 2 === 0 ? 2 * value - k : k + 1 - 2 * value);
      append('ridge-strip', u, v, 1, 10, (i, j) => {
        const a = (u[i]! - phase - .2 * bend.coefficients[j]!) / p.density, bb = b.coefficients[j]!;
        return [length * (c * a - s * bb), length * (s * a + c * bb), baseline + p.depth * heights[i]!];
      }, length * .2 / p.density * bend.error + length * b.error, 0, 2 * p.density / length * Math.hypot(1, .4 * Math.PI * p.density));
    }
  } else {
    const nearX = Math.max(box.minX, Math.min(0, box.maxX)), nearY = Math.max(box.minY, Math.min(0, box.maxY));
    const minRadius = 2 * Math.hypot(nearX, nearY) / length, maxRadius = 2 * Math.max(...corners.map(v => Math.hypot(...v)));
    const center = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
    const centerAngle = Math.atan2(-s * center[0]! + c * center[1]!, c * center[0]! + s * center[1]!);
    const angles = corners.map(v => { let angle = Math.atan2(v[1], v[0]); while (angle - centerAngle > Math.PI) angle -= tau; while (angle - centerAngle < -Math.PI) angle += tau; return angle; });
    const angleMin = minRadius === 0 ? -Math.PI : Math.min(...angles), angleMax = minRadius === 0 ? Math.PI : Math.max(...angles);
    const join = p.family === 'spiral' ? .02 : p.family === 'dome' ? 1 : 0, radii = [minRadius, ...(minRadius < join && join < maxRadius ? [join] : []), maxRadius];
    const centeredCompact = p.family === 'spiral' && spiralCenter === 'smooth-c2' && compactSpiral && minRadius === 0;
    // C2 uses narrower angular charts with lower degree. This preserves the field
    // and its interval certificate while reducing polar mesher refinement. Keep
    // the original linear/C1 construction reproducible for comparison.
    const compactAngular = p.family === 'spiral' && spiralCenter === 'smooth-c2';
    const sectors = Math.max(1, Math.ceil((angleMax - angleMin) * (p.family === 'spiral' ? p.spiralArms : 1) / (compactAngular ? 4 : 6)));
    const degreeU = compactAngular ? 10 : 12;
    // Quintic derivative <= 1.875 and W(0)=0 also bound W(t)/t by 1.875.
    const centerSlope = (spiralCenter === 'linear' ? 1 : spiralCenter === 'smooth-c1' ? 1.5 : 1.875) / .02;
    const lipschitz = p.family === 'dome' ? 4 / length : p.family === 'ring' ? tau * p.density / length : Math.hypot(centerSlope + tau * p.density, centerSlope * p.spiralArms) / length;
    for (let band = 0; band < radii.length - 1; band++) {
      const start = radii[band]!, end = radii[band + 1]!, inner = end <= join;
      // The clipped-footprint investigation uses fewer radial joins with a higher
      // degree. Every patch still passes the same whole-domain error certificate.
      // Keep the rectangular comparison's original tessellation reproducible.
      const radialDegree = p.family === 'spiral' && compactSpiral && !inner ? 12 : 6;
      const radialSpan = radialDegree === 12 ? 8 : 1.2;
      const segments = p.family !== 'dome' ? Math.max(1, Math.ceil(tau * p.density * (end - start) / radialSpan)) : 1;
      if (segments * sectors + patches.length > SURFACE_DOMAIN_LIMITS.patches) throw new DesignError('SURFACE_BUDGET', 'Too many polar domains.');
      for (let radial = 0; radial < segments; radial++) for (let sector = 0; sector < sectors; sector++) {
        const u = [angleMin + (angleMax - angleMin) * sector / sectors, angleMin + (angleMax - angleMin) * (sector + 1) / sectors] as const;
        const v = [start + (end - start) * radial / segments, start + (end - start) * (radial + 1) / segments] as const;
        if (centeredCompact) {
          // Follow constant Spiral phase: theta=eta+tau*d*r/arms. Height then
          // varies only with eta outside the center envelope. This changes chart
          // coordinates, not the field, and avoids diagonal UV refinement.
          const twist = tau * p.density / p.spiralArms, degree = 9;
          const ca = sine(...u, 1, rotation + Math.PI / 2, degreeU), sa = sine(...u, 1, rotation, degreeU);
          const cr = multiplyLinear(sine(...v, twist, Math.PI / 2, degree - 1), ...v);
          const sr = multiplyLinear(sine(...v, twist, 0, degree - 1), ...v);
          const h = sine(...u, p.spiralArms, tau * phase + Math.PI / 2, degreeU);
          const envelope = elevateCurve(inner ? multiplySmoothCenter({ coefficients: [1], error: 0 }, v[0] / join, v[1] / join, 2) : { coefficients: [1], error: 0 }, degree);
          const coordinateError = (angular: BoundedCurve, radial: BoundedCurve) => angular.error * (v[1] + radial.error) + radial.error;
          const xyError = length / 2 * Math.hypot(coordinateError(ca, cr) + coordinateError(sa, sr), coordinateError(sa, cr) + coordinateError(ca, sr));
          append(inner ? 'polar-inner' : 'polar-outer', u, v, degreeU, degree, (i, j) => [
            length / 2 * (ca.coefficients[i]! * cr.coefficients[j]! - sa.coefficients[i]! * sr.coefficients[j]!),
            length / 2 * (sa.coefficients[i]! * cr.coefficients[j]! + ca.coefficients[i]! * sr.coefficients[j]!),
            baseline + p.depth / 2 * (1 + h.coefficients[i]! * envelope.coefficients[j]!),
          ], xyError, p.depth / 2 * productError(h.error, envelope.error), lipschitz, twist);
          continue;
        }
        const degreeV = p.family === 'dome' ? 2 : radialDegree + (inner ? (spiralCenter === 'linear' ? 1 : spiralCenter === 'smooth-c1' ? 3 : 5) : 0);
        const x = sine(u[0], u[1], 1, rotation + Math.PI / 2, degreeU), y = sine(u[0], u[1], 1, rotation, degreeU);
        const radius = elevateCurve(linear(...v), degreeV);
        let heightError = 0, heights: (i: number, j: number) => number;
        if (p.family === 'dome') {
          const squared = [v[0] ** 2, v[0] * v[1], v[1] ** 2];
          heights = (_, j) => baseline + (inner ? p.depth * (1 - squared[j]!) : 0);
        } else if (p.family === 'ring') {
          const cr = sine(v[0], v[1], tau * p.density, Math.PI / 2, degreeV);
          heightError = .5 * p.depth * cr.error;
          heights = (_, j) => baseline + .5 * p.depth * (1 - cr.coefficients[j]!);
        } else {
          const ca = sine(u[0], u[1], p.spiralArms, tau * phase + Math.PI / 2, degreeU), sa = sine(u[0], u[1], p.spiralArms, tau * phase, degreeU);
          let cr = sine(v[0], v[1], tau * p.density, Math.PI / 2, radialDegree), sr = sine(v[0], v[1], tau * p.density, 0, radialDegree);
          if (inner) {
            const envelope = spiralCenter === 'linear' ? multiplyLinear : (curve: BoundedCurve, start: number, end: number) => multiplySmoothCenter(curve, start, end, spiralCenter === 'smooth-c1' ? 1 : 2);
            cr = envelope(cr, v[0] / join, v[1] / join); sr = envelope(sr, v[0] / join, v[1] / join);
          }
          heightError = .5 * p.depth * (productError(ca.error, cr.error) + productError(sa.error, sr.error));
          heights = (i, j) => baseline + .5 * p.depth * (1 + ca.coefficients[i]! * cr.coefficients[j]! + sa.coefficients[i]! * sr.coefficients[j]!);
        }
        const positionError = length / 2 * (v[1] * Math.hypot(x.error, y.error) + Math.SQRT2 * radius.error);
        append(inner ? 'polar-inner' : 'polar-outer', u, v, degreeU, degreeV,
          (i, j) => [length / 2 * radius.coefficients[j]! * x.coefficients[i]!, length / 2 * radius.coefficients[j]! * y.coefficients[i]!, heights(i, j)], positionError, heightError, lipschitz);
      }
    }
  }
  return patches;
}

/** Diagnostic evaluation of the exact polynomial represented by the control net. */
export function evaluateBoundaryPatch(patch: BoundaryPatch, u: number, v: number): readonly [number, number, number] {
  if (![u, v].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new DesignError('SURFACE_DOMAIN', 'Patch coordinates must be in [0,1].');
  const evaluate = (values: number[], t: number) => { while (values.length > 1) values = values.slice(0, -1).map((a, i) => (1 - t) * a + t * values[i + 1]!); return values[0]!; };
  return [0, 1, 2].map(axis => evaluate(Array.from({ length: patch.degreeU + 1 }, (_, i) => evaluate(Array.from({ length: patch.degreeV + 1 }, (_, j) => patch.poles[3 * (i * (patch.degreeV + 1) + j) + axis]!), v)), u)) as unknown as readonly [number, number, number];
}
