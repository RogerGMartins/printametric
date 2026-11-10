import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceContourIdentity, partTopologyKey, upgradePartCorrespondence } from '../src/tools/wall-art/model/part-identity.ts';

test('v3 identity remapping retains immutable native data and uses component keys rather than enumeration', () => {
  const original = [
    { id: 'wa-g2-v:-1,2:c0:i0', cellKey: 'v:-1,2', mapNumber: 1, nativeFace: 'source-1', centroid: [12, 17] },
    { id: 'wa-g2-v:-1,2:c1:i0', cellKey: 'v:-1,2', mapNumber: 2, nativeFace: 'source-2', centroid: [11, 15] },
    { id: 'wa-g2-d:2,3:c0:i2', cellKey: 'd:2,3', mapNumber: 3, nativeFace: 'source-3', centroid: [8, 12] },
  ];
  const saved = structuredClone(original), remapped = original.map(surfaceContourIdentity);
  assert.deepEqual(original, saved);
  remapped.forEach((part, i) => {
    assert.notEqual(part, original[i]); assert.equal(part.nativeFace, original[i].nativeFace);
    assert.equal(part.centroid, original[i].centroid); assert.equal(part.mapNumber, original[i].mapNumber);
    assert.equal(partTopologyKey(part), partTopologyKey(original[i]));
    assert.deepEqual(surfaceContourIdentity(part), part);
  });
  const first = upgradePartCorrespondence(original, remapped);
  assert.deepEqual(upgradePartCorrespondence([...original].reverse(), [remapped[1], remapped[2], remapped[0]]), first);
  assert.equal(new Set(first.map(row => row.targetId)).size, 3);
  const legacy = [{ id: 'wa-g1-r2-c3', mapNumber: 1 }, { id: 'wa-g1-r0-c0', mapNumber: 2 }];
  const target = [{ id: 'wa-g3-s:0,0:c0:i0', cellKey: 's:0,0', mapNumber: 1 }, { id: 'wa-g3-s:2,3:c0:i0', cellKey: 's:2,3', mapNumber: 2 }];
  assert.deepEqual(upgradePartCorrespondence(legacy, target).map(row => [row.sourceId, row.targetId]),
    [['wa-g1-r0-c0', 'wa-g3-s:0,0:c0:i0'], ['wa-g1-r2-c3', 'wa-g3-s:2,3:c0:i0']]);
  assert.throws(() => partTopologyKey({ id: original[0].id, cellKey: 'v:0,2' }), { code: 'IDENTITY' });
  assert.throws(() => partTopologyKey({ id: 'wa-g1-r9007199254740992-c0' }), { code: 'IDENTITY' });
  assert.throws(() => upgradePartCorrespondence(original, [remapped[0], remapped[0], remapped[2]]), { code: 'IDENTITY' });
  assert.throws(() => upgradePartCorrespondence(original, remapped.slice(1)), { code: 'IDENTITY' });
  assert.throws(() => upgradePartCorrespondence(original, remapped.map((p, i) => i ? p : { ...p, id: 'wa-g3-v:-1,2:c2:i0' })), { code: 'IDENTITY' });
});
