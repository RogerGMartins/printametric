// Deterministic scheduler tests exercise races without relying on CAD timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WallArtClient } from '../src/tools/wall-art/editor/worker-client.ts';
import { DEFAULT_PARAMETERS as defaults, parameterDigest } from '../src/tools/wall-art/model/parameters.ts';
import { parseDrafts, toDrafts } from '../src/tools/wall-art/editor/state.ts';

function harness() {
  const ports = [], downloads = [], states = [];
  const client = new WallArtClient(() => {
    const port = { messages: [], onmessage: null, onerror: null, terminated: false,
      postMessage(message) { this.messages.push(message); }, terminate() { this.terminated = true; },
      reply(message) { this.onmessage?.({ data: { epoch: this.messages[0].epoch, ...message } }); } };
    ports.push(port); return port;
  }, state => states.push(state), (...args) => downloads.push(args));
  client.start();
  const ready = port => port.reply({ type: 'ready' });
  const generated = (port, message = port.messages.findLast(m => m.type === 'generate')) => port.reply({ type: 'generated', result: {
    revision: message.revision, digest: parameterDigest(message.parameters), units: 'mm', parts: [{ id: 'fixture' }],
  } });
  ready(ports[0]); generated(ports[0]);
  return { client, ports, downloads, states, ready, generated };
}
test('worker latest-only queue rejects stale results and preserves failed accepted snapshots', () => {
  const h = harness(), { client, ports: [port] } = h;
  try {
    const accepted = client.snapshot.accepted;
    assert.throws(() => client.submit({ ...defaults, width: NaN }));
    client.submit({ ...defaults, width: 300 });
    const stale = port.messages.at(-1);
    client.submit({ ...defaults, width: 300 });
    assert.equal(port.messages.at(-1), stale); // Enter then blur does not queue a duplicate.
    client.submit({ ...defaults, width: 400 }); client.submit({ ...defaults, width: 450 });
    assert.equal(port.messages.filter(m => m.type === 'generate').length, 2);
    h.generated(port, stale);
    assert.equal(client.snapshot.accepted, accepted);
    assert.equal(port.messages.at(-1).parameters.width, 450);
    assert.equal(port.messages.at(-2).type, 'discard');
    const originalBytes = new Uint8Array([1, 2, 3]);
    h.generated(port); client.submit({ ...defaults, width: 250 }, originalBytes);
    const previous = client.snapshot.accepted;
    port.reply({ type: 'failed', code: 'CAD_FAILED', message: 'Fixture CAD failure' });
    assert.equal(client.snapshot.accepted, previous); assert.equal(client.snapshot.error.code, 'CAD_FAILED');
    client.submit({ ...defaults, width: 250 }, originalBytes); h.generated(port);
    assert.equal(client.snapshot.accepted.originalBytes, originalBytes);
    assert.equal(h.downloads.length, 0);
  } finally { client.dispose(); }
});
test('export pins one revision while edits queue; generation cancel does not cancel export', () => {
  const h = harness(), { client, ports: [port] } = h;
  try {
    const revision = client.snapshot.accepted.result.revision;
    client.export('stl'); client.export('step');
    assert.equal(port.messages.filter(m => m.type === 'export').length, 1);
    client.submit({ ...defaults, width: 200 }); client.cancelGeneration();
    assert.equal(port.terminated, false); assert.equal(client.snapshot.exporting, 'stl');
    port.reply({ type: 'exported', revision, format: 'stl', bytes: new Uint8Array([12]) });
    assert.equal(h.downloads.length, 1); assert.equal(h.downloads[0][2], revision);
    client.export('3mf'); client.submit({ ...defaults, width: 300 });
    port.reply({ type: 'exported', revision, format: '3mf', bytes: new Uint8Array([34]) });
    assert.equal(port.messages.at(-1).type, 'generate'); h.generated(port);
    assert.equal(client.snapshot.accepted.parameters.width, 300);
  } finally { client.dispose(); }
});
test('hard cancellation, crash and watchdog invalidate handles and require restoration', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness(), { client, ports } = h;
  try {
    const accepted = client.snapshot.accepted;
    client.submit({ ...defaults, width: 200 }); const obsolete = ports[0].messages.at(-1);
    client.cancelGeneration(); assert.equal(ports[0].terminated, true);
    assert.equal(client.snapshot.status, 'recovering'); assert.equal(client.snapshot.accepted, accepted);
    h.generated(ports[0], obsolete); assert.equal(client.snapshot.accepted, accepted);
    client.export('step'); assert.equal(ports[1].messages.some(m => m.type === 'export'), false);
    h.ready(ports[1]); assert.deepEqual(ports[1].messages.at(-1).parameters, accepted.parameters);
    h.generated(ports[1]); assert.equal(client.snapshot.status, 'ready');
    client.export('step'); client.cancelExport(); assert.equal(ports[1].terminated, true);
    h.ready(ports[2]); h.generated(ports[2]); ports[2].onerror({});
    assert.equal(client.snapshot.status, 'failed'); assert.equal(client.snapshot.error.code, 'WORKER');
    client.retry(); t.mock.timers.tick(30_000);
    assert.equal(client.snapshot.error.code, 'TIMEOUT'); assert.equal(ports[3].terminated, true);
    assert.deepEqual(client.snapshot.accepted.parameters, accepted.parameters);
  } finally { client.dispose(); }
});
test('draft text preserves invalid values; empty is not zero and steps do not quantize', () => {
  const drafts = toDrafts({ ...defaults }); drafts.width = '';
  assert.throws(() => parseDrafts(drafts), error => error.field === 'width'); assert.equal(drafts.width, '');
  drafts.width = '499.123'; assert.equal(parseDrafts(drafts).width, 499.123);
  drafts.seed = '1.5'; assert.throws(() => parseDrafts(drafts));
});
test('STEP completion retires native heap and preserves the latest queued design', () => {
  const h = harness(), { client, ports } = h;
  try {
    const accepted = client.snapshot.accepted;
    client.export('step'); client.submit({ ...defaults, width: 300 });
    ports[0].reply({ type: 'exported', revision: accepted.result.revision, format: 'step', bytes: new Uint8Array([1]) });
    assert.equal(ports[0].terminated, true); assert.equal(h.downloads.length, 1);
    assert.equal(client.snapshot.accepted, accepted);
    h.ready(ports[1]); assert.equal(ports[1].messages.at(-1).parameters.width, 300);
    h.generated(ports[1]); client.export('step');
    ports[1].reply({ type: 'exported', revision: client.snapshot.accepted.result.revision, format: 'step', bytes: new Uint8Array([2]) });
    assert.equal(client.snapshot.status, 'recovering');
    client.export('stl'); assert.equal(ports[2].messages.some(m => m.type === 'export'), false);
    h.ready(ports[2]); h.generated(ports[2]);
    assert.equal(client.snapshot.status, 'ready'); assert.equal(client.snapshot.accepted.parameters.width, 300);
  } finally { client.dispose(); }
});
