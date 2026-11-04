import assert from 'node:assert/strict';
import test from 'node:test';
import { contourSurfaceMoments } from '../src/tools/wall-art/geometry/surface-contour-moments.ts';
import { rectangleSurfaceMoments } from '../src/tools/wall-art/geometry/surface-moments.ts';
import { createSurfaceField } from '../src/tools/wall-art/geometry/surface-fields.ts';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { fitContourPlane } from '../src/tools/wall-art/geometry/surface-contour-plane.ts';
import { surfaceRandomWords } from '../src/tools/wall-art/model/surface-random.ts';

const polygon = points => points.map((p, i) => ({ points: [p, points[(i + 1) % points.length]], weights: [1, 1], direction: 1 }));
const near = (actual, expected, error) => assert.ok(Math.abs(actual - expected) <= error, `${actual} differs from ${expected} by more than ${error}`);
const ridgePhase = seed => surfaceRandomWords('ridges', seed)[0] / 2 ** 32;
function circle(cx, cy, radius) {
  return [[[1, 0], [1, 1], [0, 1]], [[0, 1], [-1, 1], [-1, 0]], [[-1, 0], [-1, -1], [0, -1]], [[0, -1], [1, -1], [1, 0]]]
    .map(points => ({ points: points.map(([x, y]) => [cx + radius * x, cy + radius * y]), weights: [1, Math.SQRT1_2, 1], direction: 1 }));
}

test('signed native-contour moments reproduce closed rectangle integrals and orientation', () => {
  const points = [[91, -53], [139, -53], [139, -7], [91, -7]], anchor = [115, -30], spans = polygon(points);
  for (const family of ['wave', 'dunes', 'random', 'ring', 'ridges', 'dome']) for (const rotation of [0, 37, 360]) {
    const p = { ...DEFAULT_PARAMETERS_V3, family, rotation, phase: .29, surfaceSeed: 5000 };
    const result = contourSurfaceMoments(p, spans, anchor), reference = rectangleSurfaceMoments(p, { minX: 91, maxX: 139, minY: -53, maxY: -7 });
    assert.ok(result.error <= .00025 / p.depth); assert.ok(result.evaluations <= 65536);
    near(result.area, 48 * 46, 1e-8); near(result.mean, reference.mean, result.error + reference.error);
    near(result.uMean, reference.uMean, result.error + reference.error);
    near(result.vMean, reference.vMean * 23 / 24, result.error + reference.error);
    near(result.uu, 1 / 3, result.error); near(result.vv, (23 / 24) ** 2 / 3, result.error);
    const reversed = contourSurfaceMoments(p, spans.map(s => ({ ...s, direction: -1 })), anchor);
    near(reversed.mean, result.mean, 1e-14); near(reversed.area, result.area, 1e-8);
  }
});

test('rational circular boundaries retain exact area and agree with an independent polar integral', () => {
  const radius = 25, anchor = [115, -30], spans = circle(...anchor, radius);
  for (const family of ['wave', 'dunes', 'random', 'ring']) {
    const p = { ...DEFAULT_PARAMETERS_V3, family, rotation: 37, phase: .29, surfaceSeed: 5000 };
    const result = contourSurfaceMoments(p, spans, anchor), field = createSurfaceField(p);
    // Independent composite midpoint in disk area r² and periodic angle. Two
    // resolutions plus its O(N^-2) observed scale are supplementary oracle checks;
    // implementation acceptance uses its analytic whole-chart bound instead.
    const integrate = count => {
      let sum = 0;
      for (let i = 0; i < count; i++) { const r = radius * Math.sqrt((i + .5) / count);
        for (let j = 0; j < 256; j++) { const angle = 2 * Math.PI * (j + .5) / 256; sum += field.evaluate(anchor[0] + r * Math.cos(angle), anchor[1] + r * Math.sin(angle)); }
      }
      return sum / (256 * count);
    };
    const a = integrate(256), b = integrate(512), extrapolated = (4 * b - a) / 3;
    near(result.area, Math.PI * radius ** 2, 1e-7); near(result.u, 0, result.error); near(result.v, 0, result.error);
    near(result.uu, .25, result.error); near(result.vv, .25, result.error); near(result.uv, 0, result.error);
    near(result.mean, extrapolated, result.error + 1e-9);
  }
});

test('signed fans integrate a non-star-shaped domain without certifying its taper', () => {
  const shape = polygon([[0, 0], [40, 0], [40, 10], [10, 10], [10, 40], [0, 40]]), anchor = [30, 30];
  const p = { ...DEFAULT_PARAMETERS_V3, family: 'wave', rotation: 37, phase: .17 };
  const result = contourSurfaceMoments(p, shape, anchor);
  const a = rectangleSurfaceMoments(p, { minX: 0, maxX: 40, minY: 0, maxY: 10 });
  const b = rectangleSurfaceMoments(p, { minX: 0, maxX: 10, minY: 10, maxY: 40 });
  near(result.area, 700, 1e-8); near(result.mean, (400 * a.mean + 300 * b.mean) / 700, result.error + a.error + b.error);
  assert.throws(() => contourSurfaceMoments({ ...p, family: 'spiral' }, shape, anchor), /entire harmonic/);
  assert.throws(() => contourSurfaceMoments(p, [{ ...shape[0], weights: [1, 0] }], anchor), /Invalid rational/);
  assert.throws(() => contourSurfaceMoments(p, shape, [Infinity, 0]), /Invalid bounded/);
  assert.throws(() => contourSurfaceMoments({ ...p, width: 80, height: 80, density: 12 }, circle(0, 0, 2000), [0, 0]), /work exhausted|could not be bounded/);
});

test('native circular plane fits use area covariance and constrain the entire curve', () => {
  for (const radius of [25, 80]) {
    const spans = circle(0, 0, radius), p = { ...DEFAULT_PARAMETERS_V3, family: 'wave' };
    const m = contourSurfaceMoments(p, spans, [0, 0], 1e-8), fitted = fitContourPlane(m, spans, [0, 0]);
    const expectedSlope = Math.min(.5, m.uMean / .25);
    near(fitted.coefficients[0], .5, fitted.error); near(fitted.coefficients[1], expectedSlope, fitted.error);
    near(fitted.coefficients[2], 0, fitted.error);
    for (let i = 0; i < 4096; i++) {
      const angle = 2 * Math.PI * i / 4096, value = fitted.coefficients[0] + fitted.coefficients[1] * Math.cos(angle) + fitted.coefficients[2] * Math.sin(angle);
      assert.ok(value >= 0 && value <= 1);
    }
    assert.ok(fitted.work <= 65536); assert.ok(fitted.error < .001);
    if (radius === 25) assert.equal(fitted.constraints, 0);
    else assert.ok(fitted.constraints > 0);
    assert.throws(() => fitContourPlane({ ...m, uu: 0 }, spans, [0, 0]), /ill-conditioned/);
  }
});

test('Ridges curved-contour moments cross creases and agree with independent disk slices', () => {
  const anchor = [115, -30], radius = 25, spans = circle(...anchor, radius);
  // Independent real-area oracle: split each horizontal field-coordinate slice
  // at triangular-wave creases, integrate its linear segments exactly, then use
  // midpoint angular integration. This does not reuse the boundary primitives.
  function disk(p, count) {
    const length = Math.min(p.width, p.height), angle = p.rotation % 360 * Math.PI / 180;
    const c = Math.cos(angle), s = Math.sin(angle), r = radius / length;
    const a0 = (c * anchor[0] + s * anchor[1]) / length, b0 = (-s * anchor[0] + c * anchor[1]) / length;
    const field = createSurfaceField(p), totals = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const theta = -Math.PI / 2 + Math.PI * (i + .5) / count, b = b0 + r * Math.sin(theta), half = r * Math.cos(theta);
      const lo = a0 - half, hi = a0 + half;
      // Locate creases through the documented field phase, independently of the
      // integration implementation. Field values supply segment heights.
      const delta = .2 * Math.sin(2 * Math.PI * (p.density * b + ridgePhase(p.surfaceSeed))) + p.phase % 1;
      const cuts = [lo, hi];
      for (let k = Math.ceil(2 * (p.density * lo + delta)); k < 2 * (p.density * hi + delta); k++) cuts.push((k / 2 - delta) / p.density);
      cuts.sort((a, b) => a - b);
      let mean = 0, first = 0;
      for (let j = 1; j < cuts.length; j++) {
        const x = cuts[j - 1], y = cuts[j], width = y - x;
        const value = a => field.evaluate(length * (c * a - s * b), length * (s * a + c * b));
        const fx = value(x), fy = value(y);
        mean += width * (fx + fy) / 2;
        first += width * ((2 * x + y) * fx + (x + 2 * y) * fy) / 6;
      }
      const db = half * Math.PI / count / (Math.PI * r ** 2);
      totals[0] += mean * db;
      totals[1] += length / radius * (c * (first - a0 * mean) - s * (b - b0) * mean) * db;
      totals[2] += length / radius * (s * (first - a0 * mean) + c * (b - b0) * mean) * db;
    }
    return totals;
  }
  for (const [rotation, phase, surfaceSeed] of [[0, 0, 1], [37, .29, 5000], [90, 1, 9999]]) {
    const p = { ...DEFAULT_PARAMETERS_V3, family: 'ridges', rotation, phase, surfaceSeed };
    const result = contourSurfaceMoments(p, spans, anchor), coarse = disk(p, 8192), fine = disk(p, 16384);
    fine.forEach((value, i) => near(value, coarse[i], 1e-7));
    [result.mean, result.uMean, result.vMean].forEach((value, i) => near(value, fine[i], result.error + 1e-7));
    near(result.area, Math.PI * radius ** 2, 1e-7);
    assert.ok(result.error <= .00025 / p.depth && result.evaluations <= 65536);
  }
});

test('Ridges concave domains keep world moments across anchors and reject excess precision/work', () => {
  const spans = polygon([[0, 0], [40, 0], [40, 10], [10, 10], [10, 40], [0, 40]]);
  const p = { ...DEFAULT_PARAMETERS_V3, family: 'ridges', rotation: 37, phase: .17 };
  const result = contourSurfaceMoments(p, spans, [30, 30]), shifted = contourSurfaceMoments(p, spans, [0, 0]);
  const a = rectangleSurfaceMoments(p, { minX: 0, maxX: 40, minY: 0, maxY: 10 });
  const b = rectangleSurfaceMoments(p, { minX: 0, maxX: 10, minY: 10, maxY: 40 });
  near(result.mean, (400 * a.mean + 300 * b.mean) / 700, result.error + a.error + b.error);
  near(result.mean, shifted.mean, result.error + shifted.error);
  for (const key of ['uMean', 'vMean']) near(30 * result.mean + result.scale * result[key], shifted.scale * shifted[key],
    (30 + result.scale) * result.error + shifted.scale * shifted.error);
  assert.throws(() => contourSurfaceMoments(p, spans, [0, 0], 1e-15), /work exhausted|could not be bounded|error allocation/);
  assert.throws(() => contourSurfaceMoments({ ...p, width: 80, height: 80, density: 12 }, circle(0, 0, 2000), [0, 0], 1e-8), /evaluations|error allocation/);
});

test('Ridges contour bounds cover low/high density, negative phases and reversed rational spans', () => {
  const points = [[-139, 7], [-91, 7], [-91, 53], [-139, 53]], spans = polygon(points), anchor = [-115, 30];
  for (const density of [.2, 12]) for (const phase of [0, 1]) {
    const p = { ...DEFAULT_PARAMETERS_V3, family: 'ridges', density, depth: 200, rotation: 37, phase, surfaceSeed: 9999 };
    const result = contourSurfaceMoments(p, spans, anchor), reference = rectangleSurfaceMoments(p, { minX: -139, maxX: -91, minY: 7, maxY: 53 });
    near(result.mean, reference.mean, result.error + reference.error);
    near(result.uMean, reference.uMean, result.error + reference.error);
    near(result.vMean, reference.vMean * 23 / 24, result.error + reference.error);
    assert.ok(result.error * p.depth <= .00025);
    const reversed = spans.map(span => ({ points: [...span.points].reverse(), weights: span.weights.map(w => w * 1000), direction: -1 }));
    const repeat = contourSurfaceMoments(p, reversed, anchor);
    near(repeat.mean, result.mean, result.error + repeat.error);
    assert.deepEqual(contourSurfaceMoments(p, spans, anchor), result);
  }
});

test('Dome contour moments retain exact centered disk integrals and cross the disk edge', () => {
  const p = { ...DEFAULT_PARAMETERS_V3, family: 'dome', width: 150, height: 150 }, domeRadius = 75;
  for (const radius of [25, 75, 100]) {
    const result = contourSurfaceMoments(p, circle(0, 0, radius), [0, 0]);
    const mean = radius <= domeRadius ? 1 - radius ** 2 / (2 * domeRadius ** 2) : domeRadius ** 2 / (2 * radius ** 2);
    near(result.mean, mean, result.error); near(result.uMean, 0, result.error); near(result.vMean, 0, result.error);
  }
  const radius = 25, anchor = [70, 5], spans = circle(...anchor, radius);
  // Independent area slices clip to the disk and integrate the quadratic exactly
  // in x. Angular midpoint convergence is supplementary to the production bound.
  function sliced(count) {
    const totals = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const theta = -Math.PI / 2 + Math.PI * (i + .5) / count, y = anchor[1] + radius * Math.sin(theta);
      const half = radius * Math.cos(theta), edge = Math.sqrt(Math.max(0, domeRadius ** 2 - y * y));
      const lo = Math.max(anchor[0] - half, -edge), hi = Math.min(anchor[0] + half, edge);
      if (hi <= lo) continue;
      const mean = (1 - y * y / domeRadius ** 2) * (hi - lo) - (hi ** 3 - lo ** 3) / (3 * domeRadius ** 2);
      const first = (1 - y * y / domeRadius ** 2) * (hi * hi - lo * lo) / 2 - (hi ** 4 - lo ** 4) / (4 * domeRadius ** 2);
      const measure = half / (count * radius ** 2);
      totals[0] += mean * measure; totals[1] += (first - anchor[0] * mean) / radius * measure;
      totals[2] += (y - anchor[1]) / radius * mean * measure;
    }
    return totals;
  }
  const result = contourSurfaceMoments(p, spans, anchor), coarse = sliced(8192), fine = sliced(16384);
  fine.forEach((value, i) => near(value, coarse[i], 1e-7));
  [result.mean, result.uMean, result.vMean].forEach((value, i) => near(value, fine[i], result.error + 1e-7));
  const outside = contourSurfaceMoments(p, circle(125, 0, radius), [125, 0]);
  near(outside.mean, 0, outside.error); near(outside.uMean, 0, outside.error); near(outside.vMean, 0, outside.error);
  assert.ok(result.evaluations <= 65536 && result.error * p.depth <= .00025);
  assert.deepEqual(contourSurfaceMoments(p, spans, anchor), result);
});

test('Dome concave domains and reversed curves preserve world moments with bounded rejection', () => {
  const spans = polygon([[0, 0], [90, 0], [90, 30], [30, 30], [30, 90], [0, 90]]);
  const p = { ...DEFAULT_PARAMETERS_V3, family: 'dome', width: 150, height: 150, depth: 200 };
  const result = contourSurfaceMoments(p, spans, [33, 33]), shifted = contourSurfaceMoments(p, spans, [0, 0]);
  const a = rectangleSurfaceMoments(p, { minX: 0, maxX: 90, minY: 0, maxY: 30 });
  const b = rectangleSurfaceMoments(p, { minX: 0, maxX: 30, minY: 30, maxY: 90 });
  near(result.mean, (2700 * a.mean + 1800 * b.mean) / 4500, result.error + a.error + b.error);
  near(result.mean, shifted.mean, result.error + shifted.error);
  for (const key of ['uMean', 'vMean']) near(33 * result.mean + result.scale * result[key], shifted.scale * shifted[key],
    (33 + result.scale) * result.error + shifted.scale * shifted.error);
  const reversed = spans.map(s => ({ points: [...s.points].reverse(), weights: s.weights.map(w => w * 1000), direction: -1 }));
  near(contourSurfaceMoments(p, reversed, [33, 33]).mean, result.mean, result.error);
  assert.ok(result.error * p.depth <= .00025);
  assert.throws(() => contourSurfaceMoments(p, spans, [0, 0], 1e-15), /work exhausted|could not be bounded|error allocation/);
});
