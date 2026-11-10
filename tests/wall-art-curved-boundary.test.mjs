/** Native curve oracles for compact curved-footprint flank boundaries. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKernel } from './support/wall-art-kernel.mjs';
import { reduceBoundaryCurve } from './support/shape-surface-boundary-curve.mjs';

test('curved boundary reduction certifies transverse coordinates and preserves its source', async () => {
  const kernel = await loadKernel(), degree = 8;
  const points = new kernel.NCollection_Array1_gp_Pnt(1, degree + 1);
  const knots = new kernel.NCollection_Array1_double(1, 2), mults = new kernel.NCollection_Array1_int(1, 2);
  let original, reduced;
  try {
    // Exact elevated curve: (20t, 7t², 30+4t³). Both dependent coordinates vary.
    for (let i = 0; i <= degree; i++) {
      const p = new kernel.gp_Pnt(20 * i / degree, 7 * i * (i - 1) / (degree * (degree - 1)),
        30 + 4 * i * (i - 1) * (i - 2) / (degree * (degree - 1) * (degree - 2)));
      try { points.SetValue(i + 1, p); } finally { p.delete(); }
    }
    knots.SetValue(1, 0); knots.SetValue(2, 1); mults.SetValue(1, degree + 1); mults.SetValue(2, degree + 1);
    original = new kernel.Geom_BSplineCurve(points, knots, mults, degree, false);
    for (const knot of [.2, .4, .6, .8]) original.InsertKnot(knot, degree, 0, false);
    const count = original.NbPoles(), work = { comparisons: 0 };
    reduced = reduceBoundaryCurve(kernel, original, 1e-6, work, true);
    assert.ok(reduced.curve && reduced.curve.NbPoles() < count);
    assert.ok(reduced.boundMm <= 1e-6 && work.comparisons <= 65_536);
    assert.equal(original.NbPoles(), count);
    for (let i = 0; i <= 1024; i++) {
      const t = i / 1024, p = reduced.curve.Value(t), source = original.Value(t);
      try {
        assert.ok(Math.hypot(p.X() - 20 * t, p.Y() - 7 * t * t, p.Z() - 30 - 4 * t ** 3) <= reduced.boundMm);
        assert.ok(Math.hypot(source.X() - 20 * t, source.Y() - 7 * t * t, source.Z() - 30 - 4 * t ** 3) < 1e-10);
      } finally { p.delete(); source.delete(); }
    }
    assert.throws(() => reduceBoundaryCurve(kernel, original, 1e-6, { comparisons: 65_536 }, true), /comparison budget/);
    const uncertain = reduceBoundaryCurve(kernel, original, 1e-15, { comparisons: 0 }, true);
    try { assert.equal(uncertain.curve, null); } finally { uncertain.curve?.delete(); }
  } finally { reduced?.curve?.delete(); original?.delete(); points.delete(); knots.delete(); mults.delete(); }
});
