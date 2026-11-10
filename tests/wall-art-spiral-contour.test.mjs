/** Independent field integrals and native-domain invariants for the Spiral Green route. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { contourSurfaceMoments } from '../src/tools/wall-art/geometry/surface-contour-moments.ts';
import { rectangleSurfaceMoments } from '../src/tools/wall-art/geometry/surface-moments.ts';
import { createSurfaceField } from '../src/tools/wall-art/geometry/surface-fields.ts';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';

const p = { ...DEFAULT_PARAMETERS_V3, family: 'spiral' };
const polygon = points => points.map((point, i) => ({ points: [point, points[(i + 1) % points.length]], weights: [1, 1], direction: 1 }));
const near = (a, b, e) => assert.ok(Math.abs(a - b) <= e, `${a} differs from ${b}, allowance ${e}`);
function circle(cx, cy, radius) {
  return [[[1, 0], [1, 1], [0, 1]], [[0, 1], [-1, 1], [-1, 0]], [[-1, 0], [-1, -1], [0, -1]], [[0, -1], [1, -1], [1, 0]]]
    .map(points => ({ points: points.map(([x, y]) => [cx + radius * x, cy + radius * y]), weights: [1, Math.SQRT1_2, 1], direction: 1 }));
}

test('Spiral native curves reproduce rectangular integrals across phase, rotation and arm counts', () => {
  const box = { minX: 91, maxX: 139, minY: -53, maxY: -7 }, anchor = [115, -30];
  const spans = polygon([[91, -53], [139, -53], [139, -7], [91, -7]]);
  for (const spiralArms of [1, 5, 16]) for (const [density, phase, rotation] of [[.2, 0, 0], [2, .29, 37], [12, 1, 360]]) {
    const input = { ...p, spiralArms, density, phase, rotation };
    const actual = contourSurfaceMoments(input, spans, anchor), reference = rectangleSurfaceMoments(input, box);
    near(actual.mean, reference.mean, actual.error + reference.error);
    near(actual.uMean, reference.uMean, actual.error + reference.error);
    near(actual.vMean, reference.vMean * 23 / 24, actual.error + reference.error);
    assert.ok(actual.evaluations <= 65536 && actual.error * input.depth <= .00025);
    assert.deepEqual(contourSurfaceMoments(input, spans, anchor), actual);
  }
});

test('Spiral circular means and first moments preserve angular symmetry at the center and join', () => {
  for (const mode of ['linear', 'smooth-c1', 'smooth-c2']) for (const radius of [1, 1.5, 25]) for (const spiralArms of [1, 5, 16]) {
    const input = { ...p, width: 150, height: 150, spiralArms, rotation: 37, phase: .29 }, spans = circle(0, 0, radius);
    const actual = contourSurfaceMoments(input, spans, [0, 0], undefined, mode);
    near(actual.mean, .5, actual.error);
    if (spiralArms > 1) { near(actual.uMean, 0, actual.error); near(actual.vMean, 0, actual.error); }
    else {
      // Angular orthogonality leaves just one radial integral for the first mode.
      // Composite midpoint is an independent supplementary oracle, refined twice.
      const field = createSurfaceField({ ...input, rotation: 0, phase: 0 }, mode);
      const integrate = count => {
        let re = 0, im = 0;
        for (let i = 0; i < count; i++) {
          const r = radius * (i + .5) / count;
          re += (field.evaluate(r, 0) - .5) * r * r;
          im += (field.evaluate(0, r) - .5) * r * r;
        }
        return [re / (count * radius ** 2), im / (count * radius ** 2)];
      };
      const a = integrate(8192), b = integrate(16384), angle = 2 * Math.PI * input.phase - input.rotation * Math.PI / 180;
      a.forEach((v, i) => near(v, b[i], 1e-7));
      near(actual.uMean, b[0] * Math.cos(angle) + b[1] * Math.sin(angle), actual.error + 1e-7);
      near(actual.vMean, b[1] * Math.cos(angle) - b[0] * Math.sin(angle), actual.error + 1e-7);
    }
  }
});

test('Spiral concave and origin-touching contours preserve anchor/orientation and reject exhausted precision', () => {
  const spans = polygon([[0, 0], [40, 0], [40, 10], [10, 10], [10, 40], [0, 40]]), anchor = [30, 30];
  const input = { ...p, phase: .17, rotation: 37 };
  const actual = contourSurfaceMoments(input, spans, anchor, undefined, 'smooth-c2');
  const other = contourSurfaceMoments(input, spans, [0, 0], undefined, 'smooth-c2');
  near(actual.mean, other.mean, actual.error + other.error);
  for (const [axis, key] of [[0, 'uMean'], [1, 'vMean']]) near(actual.scale * actual[key] + anchor[axis] * actual.mean,
    other.scale * other[key], (actual.scale + other.scale + 30) * (actual.error + other.error));
  const reversed = spans.map(s => ({ points: [...s.points].reverse(), weights: [...s.weights].reverse().map(w => w * 1000), direction: -1 }));
  const back = contourSurfaceMoments(input, reversed, anchor, undefined, 'smooth-c2');
  near(actual.mean, back.mean, actual.error + back.error);
  assert.throws(() => contourSurfaceMoments(input, spans, anchor, 1e-15, 'smooth-c2'), /work|refinement|bounded/i);
  assert.throws(() => contourSurfaceMoments(input, spans, anchor, undefined, 'invalid'), /Unknown Spiral-center/);
});

test('Spiral asymmetric curved domains cross the center join without changing either field', () => {
  const center = [1.2, .3], radius = 1.2, spans = circle(...center, radius);
  for (const [mode, spiralArms] of [['linear', 1], ['smooth-c1', 5], ['smooth-c2', 16]]) {
    const input = { ...p, width: 150, height: 150, spiralArms, density: 12, phase: .29, rotation: 37 };
    const actual = contourSurfaceMoments(input, spans, center, undefined, mode), field = createSurfaceField(input, mode);
    const integrate = count => {
      const sums = [0, 0, 0];
      for (let i = 0; i < count; i++) {
        const r = Math.sqrt((i + .5) / count);
        for (let j = 0; j < 1024; j++) {
          const angle = 2 * Math.PI * (j + .5) / 1024, u = r * Math.cos(angle), v = r * Math.sin(angle);
          const f = field.evaluate(center[0] + radius * u, center[1] + radius * v);
          sums[0] += f; sums[1] += u * f; sums[2] += v * f;
        }
      }
      return sums.map(x => x / (count * 1024));
    };
    const a = integrate(2048), b = integrate(4096);
    a.forEach((v, i) => near(v, b[i], 1e-6));
    [actual.mean, actual.uMean, actual.vMean].forEach((v, i) => near(v, b[i], actual.error + 1e-6));
  }
  assert.deepEqual(contourSurfaceMoments(p, spans, center), contourSurfaceMoments(p, spans, center, undefined, 'linear'));
  assert.ok(Math.abs(contourSurfaceMoments(p, spans, center).mean - contourSurfaceMoments(p, spans, center, undefined, 'smooth-c2').mean) > 1e-5);
});

test('tight Spiral plane moments agree with an independent off-center disk integral', () => {
  const center = [50, 50], radius = 20, input = { ...p, width: 160, height: 150, rotation: 37, phase: .29 };
  const actual = contourSurfaceMoments(input, circle(...center, radius), center, 1e-8, 'smooth-c2');
  const field = createSurfaceField(input, 'smooth-c2');
  const integrate = count => {
    const sums = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt((i + .5) / count);
      for (let j = 0; j < 512; j++) {
        const angle = 2 * Math.PI * (j + .5) / 512, u = r * Math.cos(angle), v = r * Math.sin(angle);
        const f = field.evaluate(center[0] + radius * u, center[1] + radius * v);
        sums[0] += f; sums[1] += u * f; sums[2] += v * f;
      }
    }
    return sums.map(x => x / (count * 512));
  };
  const a = integrate(256), b = integrate(512), c = integrate(1024);
  const ab = b.map((v, i) => (4 * v - a[i]) / 3), bc = c.map((v, i) => (4 * v - b[i]) / 3);
  ab.forEach((v, i) => near(v, bc[i], 1e-10));
  [actual.mean, actual.uMean, actual.vMean].forEach((v, i) => near(v, bc[i], actual.error + 1e-10));
});
