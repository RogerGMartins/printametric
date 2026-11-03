import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { stream3MF } from './support/stream-three-mf.mjs';

// Closed positive-volume tetrahedron with two separately placed instances.
const mesh = { positions: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0, 0, 0, 10]), indices: new Uint32Array([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]) };
const parts = [{ id: 'first & <part>', translation: [-25, 41, 3], mesh }, { id: 'second', translation: [137, -46, 9], mesh }];
test('streamed 3MF obeys sink backpressure and preserves local meshes and placements', async () => {
  const chunks = []; let writing = false;
  const result = await stream3MF(parts, { async write(bytes) {
    assert.equal(writing, false); writing = true;
    await new Promise(resolve => setImmediate(resolve)); chunks.push(bytes); writing = false;
  } });
  const zip = unzipSync(Buffer.concat(chunks));
  assert.equal(result.parts, 2); assert.equal(result.triangles, 8);
  assert.equal(result.bytes, chunks.reduce((sum, bytes) => sum + bytes.length, 0));
  assert.deepEqual(Object.keys(zip), ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']);
  const xml = strFromU8(zip['3D/3dmodel.model']);
  assert.match(xml, /unit="millimeter"/); assert.match(xml, /first &amp; &lt;part&gt;/);
  assert.match(xml, /name="Part-1" partnumber="first &amp; &lt;part&gt;"/);
  assert.deepEqual([...xml.matchAll(/<object[^>]+ name="([^"]+)"/g)].map(match=>match[1]),['Part-1','Part-2']);
  assert.match(xml, /transform="1 0 0 0 1 0 0 0 1 -25 41 3"/);
  assert.match(xml, /transform="1 0 0 0 1 0 0 0 1 137 -46 9"/);
  assert.equal((xml.match(/<vertex /g) ?? []).length, 8);
});
test('streamed 3MF rejects invalid geometry, output bounds, cancellation and sink failures', async () => {
  const sink = { write() {} };
  await assert.rejects(stream3MF([], sink), /part budget/);
  await assert.rejects(stream3MF([parts[0], parts[0]], sink), /identity/);
  await assert.rejects(stream3MF([{ ...parts[0], translation: [NaN, 0, 0] }], sink), /placement/);
  await assert.rejects(stream3MF(parts, sink, { maxBytes: 1 }), /budget/);
  await assert.rejects(stream3MF(parts, { write() { throw Error('disk full'); } }), /disk full/);
  const controller = new AbortController();
  await assert.rejects(stream3MF(parts, { write() { controller.abort(Error('cancelled')); } }, { signal: controller.signal }), /cancelled/);
});
