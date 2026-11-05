/** Independent small-polynomial oracles and strict collapsed-edge normalization. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { boundCurveResidual } from './support/shape-surface-curve-residual.mjs';
import { removeCollapsedTriangles } from './support/shape-surface-boundary-mesh.mjs';
import { validateMesh } from '../src/shared/geometry/validate-mesh.ts';

test('whole-interval residual catches interior errors even when endpoints agree', () => {
  const fixtures = [
    { g: [0, .5, 1], z: [0, 0, 1] },
    { g: [.2, .5, .8], z: [.04, .16, .64] },
    // The elevated quadratic g=t² composed with h=g² equals z=t⁴.
    { g: [0, 0, 1 / 6, .5, 1], z: [0, 0, 0, 0, 1] },
  ];
  for (const { g, z } of fixtures) {
    const bound = boundCurveResidual(g, z, [0, 0, 1], 1e-8);
    assert.ok(bound !== null && bound <= 1e-8);
    const wrong = [...z]; wrong[1] += .1;
    assert.equal(boundCurveResidual(g, wrong, [0, 0, 1], 1e-8), null);
  }
  assert.throws(() => boundCurveResidual([0, NaN], [0, 1], [0, 1], .001), /Invalid/);
});

test('collapsed-edge normalization removes only repeated exact positions, not small faces or holes', () => {
  const vertices = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  const closed = [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3];
  const normalized = removeCollapsedTriangles({ vertices, triangles: [...closed, 1, 0, 4] });
  assert.equal(normalized.collapsedTriangles, 1);
  assert.equal(normalized.mesh.indices.length, closed.length);
  assert.ok(Math.abs(validateMesh(normalized.mesh).volume - 1 / 6) < 1e-15);
  const near = [...vertices]; near[14] = 1e-12;
  const retained = removeCollapsedTriangles({ vertices: near, triangles: [...closed, 1, 0, 4] });
  assert.equal(retained.collapsedTriangles, 0);
  assert.throws(() => validateMesh(retained.mesh), /Degenerate/);
  assert.throws(() => validateMesh(removeCollapsedTriangles({ vertices, triangles: closed.slice(3) }).mesh), /open/);
});
