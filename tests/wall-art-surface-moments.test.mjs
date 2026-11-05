import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMETERS_V3 } from '../src/tools/wall-art/model/parameters-v3.ts';
import { createSurfaceField } from '../src/tools/wall-art/geometry/surface-fields.ts';
import { rectangleSurfaceMoments, fitRectanglePlane } from '../src/tools/wall-art/geometry/surface-moments.ts';
import { surfaceRandomWords } from '../src/tools/wall-art/model/surface-random.ts';

// Independent Gauss-Legendre integration of the point evaluator, not the harmonic
// formula used by the implementation. Degree-32 nodes resolve these fixed domains.
function quadrature(n = 32) {
  return Array.from({ length: n }, (_, i) => {
    let x = Math.cos(Math.PI * (i + .75) / (n + .5)), derivative;
    for (let step = 0; step < 20; step++) {
      let p = 1, previous = 0;
      for (let j = 1; j <= n; j++) { const next = ((2 * j - 1) * x * p - (j - 1) * previous) / j; previous = p; p = next; }
      derivative = n * (x * p - previous) / (x * x - 1);
      const correction = p / derivative; x -= correction;
      if (Math.abs(correction) < 1e-15) break;
    }
    return [x, 2 / ((1 - x * x) * derivative * derivative)];
  });
}

test('rectangular area moments agree with independent integration at rotation, phase and seed boundaries', () => {
  const nodes = quadrature(), box = { minX: 17, maxX: 64.5, minY: -83, maxY: -35.5 };
  for (const family of ['wave', 'dunes', 'random', 'dome', 'ring']) for (const rotation of [0, 37, 360]) for (const density of [.2, 12]) {
    const p = { ...DEFAULT_PARAMETERS_V3, family, rotation, density, phase: .31, surfaceSeed: 5000 };
    const field = createSurfaceField(p), actual = rectangleSurfaceMoments(p, box), expected = [0, 0, 0];
    for (const [u, wu] of nodes) for (const [v, wv] of nodes) {
      const f = field.evaluate(40.75 + 23.75 * u, -59.25 + 23.75 * v), weight = wu * wv / 4;
      [1, u, v].forEach((factor, i) => expected[i] += weight * factor * f);
    }
    [actual.mean, actual.uMean, actual.vMean].forEach((value, i) => assert.ok(Math.abs(value - expected[i]) <= actual.error, `${family}/${rotation}/${density}/${i}`));
  }
});

test('Ridge moments cross creases without smoothing and retain rotated first moments', () => {
  for (const rotation of [0, 37]) for (const density of [2, 12]) {
    const p = { ...DEFAULT_PARAMETERS_V3, family: 'ridges', rotation, density, phase: .31, surfaceSeed: 5000 };
    const box = { minX: -23.75, maxX: 23.75, minY: -23.75, maxY: 23.75 }, actual = rectangleSurfaceMoments(p, box);
    const field = createSurfaceField(p), angle = rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const q = surfaceRandomWords('ridges', p.surfaceSeed)[0] / 2 ** 32, expected = [0, 0, 0];
    // Independent integration in physical XY. At these angles the crease phase
    // increases strictly along X. Locate crossings, then integrate each smooth
    // interval using the point evaluator, rather than the primitive under test.
    for (const [v, wv] of quadrature(512)) {
      const y = 23.75 * v;
      const phaseAt = x => density * (c * x + s * y) / 500 +
        .2 * Math.sin(2 * Math.PI * (density * (-s * x + c * y) / 500 + q)) + p.phase;
      const cuts = [-23.75, 23.75];
      for (let level = Math.floor(2 * phaseAt(-23.75)) + 1; level < 2 * phaseAt(23.75); level++) {
        let lo = -23.75, hi = 23.75;
        for (let step = 0; step < 48; step++) { const mid = (lo + hi) / 2; if (phaseAt(mid) < level / 2) lo = mid; else hi = mid; }
        cuts.push((lo + hi) / 2);
      }
      cuts.sort((a, b) => a - b);
      for (let i = 1; i < cuts.length; i++) for (const [u, wu] of quadrature(8)) {
        const half = (cuts[i] - cuts[i - 1]) / 2, x = cuts[i - 1] + half * (u + 1);
        const weight = wu * wv * half * 23.75 / 47.5 ** 2 * field.evaluate(x, y);
        [1, x / 23.75, v].forEach((factor, j) => expected[j] += factor * weight);
      }
    }
    [actual.mean, actual.uMean, actual.vMean].forEach((x, i) => assert.ok(Math.abs(x - expected[i]) < actual.error, `${rotation}/${density}/${i}: ${x - expected[i]} vs ${actual.error}`));
  }
  const p = { ...DEFAULT_PARAMETERS_V3, family: 'ridges', density: 2, phase: .37 };
  for (const rotation of [0, 90, 180, 270, 360]) {
    const m = rectangleSurfaceMoments({ ...p, rotation }, { minX: -125, maxX: 125, minY: -125, maxY: 125 });
    assert.ok(Math.abs(m.mean - .5) < m.error);
  }
  assert.throws(() => rectangleSurfaceMoments({ ...p, width: 80, height: 80, density: 12, rotation: 37 },
    { minX: -4000, maxX: 4000, minY: -.001, maxY: .001 }), /65,536/);
});

test('means use area rather than vertices and unsupported domains fail explicitly', () => {
  const p = { ...DEFAULT_PARAMETERS_V3, density: 2, phase: .25 };
  const box = { minX: -125, maxX: 125, minY: -10, maxY: 10 };
  assert.ok(Math.abs(rectangleSurfaceMoments(p, box).mean - .5) < 1e-12);
  const field = createSurfaceField(p);
  assert.ok(field.evaluate(-125, -10) < 1e-12 && field.evaluate(125, 10) < 1e-12);
  assert.equal(rectangleSurfaceMoments({ ...p, family: 'dome' }, { minX: 300, maxX: 320, minY: 0, maxY: 10 }).mean, 0);
  assert.throws(() => rectangleSurfaceMoments(p, { ...box, maxX: Infinity }), /rectangle/);
  assert.throws(() => rectangleSurfaceMoments(p, { ...box, minX: 125 }), /rectangle/);
});

test('Spiral area moments retain the chosen center envelope with bounded refinement', () => {
  const nodes = quadrature(512);
  for (const mode of ['linear', 'smooth-c2']) for (const origin of mode === 'linear' ? [250] : [0, 25, 250]) {
    const p = { ...DEFAULT_PARAMETERS_V3, family: 'spiral', phase: .29, rotation: 37 };
    const box = { minX: origin - 23.75, maxX: origin + 23.75, minY: -23.75, maxY: 23.75 };
    const actual = rectangleSurfaceMoments(p, box, mode), field = createSurfaceField(p, mode), expected = [0, 0, 0];
    for (const [u, wu] of nodes) for (const [v, wv] of nodes) {
      const term = field.evaluate(origin + 23.75 * u, 23.75 * v) * wu * wv / 4;
      [1, u, v].forEach((factor, i) => expected[i] += factor * term);
    }
    assert.ok(actual.error <= .00025 / p.depth);
    [actual.mean, actual.uMean, actual.vMean].forEach((x, i) => assert.ok(Math.abs(x - expected[i]) < actual.error,
      `${mode}/${origin}/${i}: ${x - expected[i]} vs ${actual.error}`));
    if (origin === 0) assert.ok(Math.abs(actual.mean - .5) < actual.error); // Odd-arm opposite points sum to 1.
  }
  // The less regular baseline cannot meet this join-crossing allocation within
  // the same work cap. Reject it explicitly rather than substituting C2.
  assert.throws(() => rectangleSurfaceMoments({ ...DEFAULT_PARAMETERS_V3, family: 'spiral' },
    { minX: -23.75, maxX: 23.75, minY: -23.75, maxY: 23.75 }), /65,536/);
  assert.throws(() => rectangleSurfaceMoments({ ...DEFAULT_PARAMETERS_V3, family: 'spiral', width: 80, height: 80, density: 12, spiralArms: 16 },
    { minX: -4000, maxX: 4000, minY: -4000, maxY: 4000 }, 'smooth-c2'), /integration (exceeds|exhausted)/);
});

test('Ring integration rejects excessive work and retains center symmetry at maximum density', () => {
  const p = { ...DEFAULT_PARAMETERS_V3, family: 'ring', width: 80, height: 80, density: 12, depth: 200 };
  const m = rectangleSurfaceMoments(p, { minX: -23.75, maxX: 23.75, minY: -23.75, maxY: 23.75 });
  assert.ok(m.error <= .00025 / 200);
  assert.ok(Math.abs(m.uMean) < m.error && Math.abs(m.vMean) < m.error);
  assert.throws(() => rectangleSurfaceMoments(p, { minX: -4000, maxX: 4000, minY: -4000, maxY: 4000 }), /65,536 evaluations/);
});

test('Dome rectangle moments integrate circular crossings and signed quadrants', () => {
  const p = { ...DEFAULT_PARAMETERS_V3, family: 'dome' }, radius = 250;
  const full = rectangleSurfaceMoments(p, { minX: -radius, maxX: radius, minY: -radius, maxY: radius });
  assert.ok(Math.abs(full.mean - Math.PI / 8) < full.error);
  assert.ok(Math.abs(full.uMean) < full.error && Math.abs(full.vMean) < full.error);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const m = rectangleSurfaceMoments(p, { minX: sx < 0 ? -radius : 0, maxX: sx < 0 ? 0 : radius,
      minY: sy < 0 ? -radius : 0, maxY: sy < 0 ? 0 : radius });
    assert.ok(Math.abs(m.mean - Math.PI / 8) < m.error);
    assert.ok(Math.abs(m.uMean - sx * (4 / 15 - Math.PI / 8)) < m.error);
    assert.ok(Math.abs(m.vMean - sy * (4 / 15 - Math.PI / 8)) < m.error);
  }
  const box = { minX: 225, maxX: 275, minY: -25, maxY: 25 }, actual = rectangleSurfaceMoments(p, box);
  // Independent nested Gauss rule with the physical circle as the X endpoint.
  const nodes = quadrature(), expected = [0, 0, 0], field = createSurfaceField(p);
  for (const [v, wv] of nodes) {
    const y = 25 * v, right = Math.sqrt(radius * radius - y * y), half = (right - 225) / 2;
    for (const [u, wu] of nodes) {
      const x = 225 + half * (u + 1), weight = wu * wv * half * 25 / 2500 * field.evaluate(x, y);
      [1, (x - 250) / 25, v].forEach((factor, i) => expected[i] += factor * weight);
    }
  }
  [actual.mean, actual.uMean, actual.vMean].forEach((x, i) => assert.ok(Math.abs(x - expected[i]) < actual.error));
});

test('constrained rectangle planes retain slope and satisfy the whole-domain bounds', () => {
  assert.deepEqual(fitRectanglePlane({ mean: .5, uMean: .04, vMean: .06, error: 0 }), [.5, .12, .18]);
  const limited = fitRectanglePlane({ mean: .5, uMean: 1 / Math.PI, vMean: 0, error: 0 });
  assert.ok(Math.abs(limited[0] - .5) < 1e-12 && Math.abs(limited[1] - .5) < 1e-12 && limited[2] === 0);
  const both = fitRectanglePlane({ mean: .5, uMean: .2, vMean: .2, error: 0 });
  assert.ok(Math.abs(both[1] - .25) < 1e-12 && Math.abs(both[2] - .25) < 1e-12);
  const p = { ...DEFAULT_PARAMETERS_V3, rotation: 37, phase: .1 };
  const plane = fitRectanglePlane(rectangleSurfaceMoments(p, { minX: -100, maxX: 100, minY: -50, maxY: 50 }));
  assert.ok(Math.abs(plane[1]) > .1 && Math.abs(plane[2]) > .01);
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
    const height = plane[0] + plane[1] * (i / 20 - 1) + plane[2] * (j / 20 - 1);
    assert.ok(height >= -1e-13 && height <= 1 + 1e-13);
  }
  assert.throws(() => fitRectanglePlane({ mean: NaN, uMean: 0, vMean: 0, error: 0 }), /Invalid/);
});
