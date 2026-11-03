/** One active operation and latest-only pending generation; independent export snapshots. */
import type { ExportFormat, ModelResult } from '../../../shared/geometry/types.ts';
import { DEFAULT_PARAMETERS, parameterDigest, type Parameters } from '../model/parameters.ts';
import { validateParameters } from '../model/validation.ts';
import { LIMITS } from '../model/budget.ts';
import type { Response, WorkerPort } from '../geometry/protocol.ts';

export interface AcceptedDesign { parameters: Parameters; result: ModelResult; originalBytes: Uint8Array | null }
export interface EditorSnapshot {
  accepted: AcceptedDesign | null;
  status: 'starting' | 'generating' | 'ready' | 'recovering' | 'failed';
  error: { code: string; message: string; field?: string } | null;
  exporting: ExportFormat | null;
}
interface Candidate { revision: number; parameters: Parameters; originalBytes: Uint8Array | null; restoring: boolean }
type Active = { type: 'initialize' } | { type: 'generate'; candidate: Candidate } | { type: 'export'; revision: number; format: ExportFormat };

export class WallArtClient {
  snapshot: EditorSnapshot = { accepted: null, status: 'starting', error: null, exporting: null };
  private port: WorkerPort | null = null;
  private epoch = 0;
  private revision = 0;
  private active: Active | null = null;
  private queued: Candidate | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private readonly createPort: () => WorkerPort;
  private readonly changed: (state: EditorSnapshot) => void;
  private readonly downloaded: (bytes: Uint8Array<ArrayBuffer>, format: ExportFormat, revision: number) => void;
  private readonly timeoutMs: number;
  constructor(createPort: () => WorkerPort, changed: (state: EditorSnapshot) => void,
    downloaded: (bytes: Uint8Array<ArrayBuffer>, format: ExportFormat, revision: number) => void, timeoutMs = LIMITS.timeoutMs) {
    this.createPort = createPort; this.changed = changed; this.downloaded = downloaded; this.timeoutMs = timeoutMs;
  }
  private publish(patch: Partial<EditorSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; if (!this.disposed) this.changed(this.snapshot); }
  private watch(active: Active) {
    clearTimeout(this.timer); this.active = active;
    this.timer = setTimeout(() => this.failHard('TIMEOUT', 'CAD exceeded the 30 s time limit. Retry or reduce the design.'), this.timeoutMs);
  }
  start() {
    if (this.disposed || this.port) return;
    this.epoch++;
    try {
      this.port = this.createPort(); const epoch = this.epoch;
      this.port.onmessage = event => { if (!this.disposed && epoch === this.epoch) this.receive(event.data); };
      this.port.onerror = () => { if (!this.disposed && epoch === this.epoch) this.failHard('WORKER', 'The CAD worker stopped. Retry to restore the previous valid design.'); };
      this.watch({ type: 'initialize' }); this.port.postMessage({ type: 'initialize', epoch });
      const accepted = this.snapshot.accepted;
      this.queued = { revision: ++this.revision, parameters: accepted?.parameters ?? { ...DEFAULT_PARAMETERS }, originalBytes: accepted?.originalBytes ?? null, restoring: Boolean(accepted) };
      this.publish({ status: accepted ? 'recovering' : 'starting', exporting: null });
    } catch { this.failHard('WORKER', 'The CAD worker could not start. Retry generation.'); }
  }
  submit(value: unknown, originalBytes: Uint8Array | null = null) {
    const parameters = validateParameters(value);
    if (this.snapshot.status === 'failed') throw new Error('Retry CAD before submitting a design.');
    const pending = this.queued ?? (this.active?.type === 'generate' ? this.active.candidate : null);
    // Enter followed by blur is one edit, including while CAD is still running.
    if (pending && parameterDigest(pending.parameters) === parameterDigest(parameters) && pending.originalBytes === originalBytes) return;
    this.queued = { revision: ++this.revision, parameters, originalBytes, restoring: false };
    this.publish({ status: 'generating', error: null }); this.pump();
  }
  private pump() {
    if (this.active || !this.queued || !this.port) return;
    const candidate = this.queued; this.queued = null;
    this.watch({ type: 'generate', candidate });
    this.port.postMessage({ type: 'generate', epoch: this.epoch, revision: candidate.revision, parameters: candidate.parameters });
  }
  private retireSTEPWorker() {
    // OCCT's STEP transfer graph retains native allocations after wrapper disposal.
    // Retire that WASM heap after each STEP operation, retaining the validated UI
    // mesh. Restore CAD before another export; a queued edit takes precedence.
    const queued = this.queued;
    this.stop(); this.start();
    if (queued) { this.queued = queued; this.publish({ status: 'generating' }); }
  }
  private receive(message: Response) {
    if (!message || message.epoch !== this.epoch || !this.active) return;
    const active = this.active;
    if (message.type === 'ready' && active.type === 'initialize') {
      clearTimeout(this.timer); this.active = null; this.pump(); return;
    }
    if (message.type === 'generated' && active.type === 'generate' && message.result?.revision === active.candidate.revision) {
      const candidate = active.candidate;
      clearTimeout(this.timer); this.active = null;
      if (this.queued) this.port?.postMessage({ type: 'discard', epoch: this.epoch, revision: candidate.revision });
      else {
        if (message.result.digest !== parameterDigest(candidate.parameters) || message.result.units !== 'mm' || !Array.isArray(message.result.parts) || !message.result.parts.length) {
          this.failHard('PROTOCOL', 'CAD returned an invalid result. Retry generation.'); return;
        }
        this.port?.postMessage({ type: 'accept', epoch: this.epoch, revision: candidate.revision });
        this.publish({ accepted: { parameters: candidate.parameters, result: message.result, originalBytes: candidate.originalBytes }, status: 'ready', error: null });
      }
      this.pump(); return;
    }
    if (message.type === 'exported' && active.type === 'export' && message.revision === active.revision && message.format === active.format && message.bytes instanceof Uint8Array) {
      clearTimeout(this.timer); this.active = null;
      try { this.downloaded(message.bytes, active.format, active.revision); this.publish({ exporting: null }); }
      catch { this.publish({ exporting: null, error: { code: 'DOWNLOAD', message: 'Download failed. Retry export.' } }); }
      if (active.format === 'step') { this.retireSTEPWorker(); return; }
      this.pump(); return;
    }
    if (message.type === 'failed') {
      clearTimeout(this.timer); this.active = null;
      if (active.type === 'initialize' || (active.type === 'generate' && active.candidate.restoring)) { this.failHard(message.code, message.message); return; }
      if (active.type === 'export' && active.format === 'step') { this.failHard(message.code, message.message); return; }
      if (active.type === 'generate' && this.queued) { this.pump(); return; }
      this.publish({ status: this.snapshot.accepted ? 'ready' : 'failed', exporting: null,
        error: { code: message.code, message: message.message, ...(message.field ? { field: message.field } : {}) } });
      this.pump();
    }
  }
  export(format: ExportFormat) {
    const accepted = this.snapshot.accepted;
    if (!accepted || this.active || this.queued || this.snapshot.error || this.snapshot.status !== 'ready' || !['stl', 'step', '3mf'].includes(format)) return;
    this.publish({ exporting: format }); this.watch({ type: 'export', revision: accepted.result.revision, format });
    this.port?.postMessage({ type: 'export', epoch: this.epoch, revision: accepted.result.revision, format });
  }
  cancelGeneration() {
    this.queued = null;
    if (this.active?.type === 'export') { this.publish({ status: 'ready', error: null }); return; }
    this.stop();
    if (!this.snapshot.accepted) { this.publish({ status: 'failed', error: { code: 'CANCELLED', message: 'Generation cancelled. Retry when ready.' } }); return; }
    this.publish({ status: 'recovering', error: null }); this.start();
  }
  cancelExport() { if (this.active?.type === 'export') { this.queued = null; this.stop(); this.publish({ status: 'recovering', exporting: null, error: null }); this.start(); } }
  retry() { this.queued = null; this.stop(); this.publish({ error: null }); this.start(); }
  clearError() { this.publish({ error: null }); }
  private stop() { clearTimeout(this.timer); this.port?.terminate(); this.port = null; this.active = null; this.epoch++; }
  private failHard(code: string, message: string) { this.queued = null; this.stop(); this.publish({ status: 'failed', exporting: null, error: { code, message } }); }
  dispose() { this.disposed = true; this.queued = null; this.stop(); }
}
