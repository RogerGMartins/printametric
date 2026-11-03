/** Dedicated CAD owner. The client schedules one operation and the newest queued edit. */
import wasmURL from 'replicad-opencascadejs/wasm?url';
import { initializeKernel, type Kernel } from '../../../shared/geometry/kernel.ts';
import { generateModel, type CanonicalModel } from './generate.ts';
import { DesignError, LIMITS } from '../model/budget.ts';
import { exactObject, validateParameters } from '../model/validation.ts';
import type { Request, Response } from './protocol.ts';

const host = globalThis as unknown as { onmessage: ((event: MessageEvent<unknown>) => void) | null; postMessage(message: Response, transfer?: Transferable[]): void };
let epoch = 0, kernel: Kernel | null = null, accepted: CanonicalModel | null = null, candidate: CanonicalModel | null = null, busy = false;
const send = (response: Response, transfer: Transferable[] = []) => host.postMessage(response, transfer);
const fields = { initialize: ['type', 'epoch'], generate: ['type', 'epoch', 'revision', 'parameters'], accept: ['type', 'epoch', 'revision'], discard: ['type', 'epoch', 'revision'], export: ['type', 'epoch', 'revision', 'format'], release: ['type', 'epoch'] };
function validateRequest(value: unknown): Request {
  if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string' || !Object.hasOwn(fields, value.type)) throw new DesignError('PROTOCOL', 'Unsupported worker request.');
  const message = exactObject(value, fields[value.type as keyof typeof fields]);
  if (!Number.isSafeInteger(message.epoch) || Number(message.epoch) < 1 || ('revision' in message && (!Number.isSafeInteger(message.revision) || Number(message.revision) < 1))) throw new DesignError('PROTOCOL', 'Invalid worker revision.');
  if (message.type === 'generate') validateParameters(message.parameters);
  if (message.type === 'export' && !['step', 'stl', '3mf'].includes(String(message.format))) throw new DesignError('FORMAT', 'Choose STEP, STL or 3MF.');
  return message as unknown as Request;
}
host.onmessage = async event => {
  try {
    const request = validateRequest(event.data);
    if (request.type === 'initialize') {
      if (epoch || busy) throw new DesignError('PROTOCOL', 'Worker already initialized.');
      epoch = request.epoch; busy = true;
      try { kernel = await initializeKernel({ locateFile: () => wasmURL }); send({ type: 'ready', epoch }); }
      finally { busy = false; }
      return;
    }
    if (request.epoch !== epoch) return;
    if (!kernel || busy) throw new DesignError('PROTOCOL', 'CAD is not ready for this operation.');
    switch (request.type) {
      case 'generate': {
        if (candidate) throw new DesignError('PROTOCOL', 'Resolve the previous candidate first.');
        busy = true;
        try {
          candidate = generateModel(request.parameters, request.revision, kernel);
          // Transfer a copy. The canonical source remains attached for STL and 3MF.
          const result = structuredClone(candidate.result);
          send({ type: 'generated', epoch, result }, result.parts.flatMap(p => [p.mesh.positions.buffer, p.mesh.indices.buffer]));
        } finally { busy = false; }
        break;
      }
      case 'accept':
        if (candidate?.result.revision !== request.revision) throw new DesignError('PROTOCOL', 'Candidate revision is no longer available.');
        accepted?.dispose(); accepted = candidate; candidate = null; break;
      case 'discard':
        if (candidate?.result.revision === request.revision) { candidate.dispose(); candidate = null; } break;
      case 'export': {
        if (accepted?.result.revision !== request.revision) throw new DesignError('REVISION', 'The accepted CAD revision is unavailable. Retry generation.');
        busy = true;
        try {
          const source = accepted;
          const bytes = request.format === 'step'
            ? await (await import('../../../shared/export/step.ts')).serializeSTEP(source.result.parts, source.solids)
            : request.format === 'stl'
              ? (await import('../../../shared/export/stl.ts')).serializeSTL(source.result.parts)
              : (await import('../../../shared/export/three-mf.ts')).serialize3MF(source.result.parts);
          if (kernel.wasmMemory.buffer.byteLength + source.result.budget.meshBytes * 2 + bytes.byteLength * 2 > LIMITS.memoryBytes) throw new DesignError('MEMORY_BUDGET', 'The export exceeds the geometry memory budget. Increase pitch.');
          send({ type: 'exported', epoch, revision: request.revision, format: request.format, bytes }, [bytes.buffer]);
        } finally { busy = false; }
        break;
      }
      case 'release': accepted?.dispose(); candidate?.dispose(); accepted = null; candidate = null; break;
    }
  } catch (error) {
    const known = error instanceof DesignError;
    send({ type: 'failed', epoch, code: known ? error.code : 'CAD_FAILED',
      message: known ? error.message : 'CAD processing failed for generator 1. The previous valid design is retained. Retry or reduce the design.',
      ...(known && error.field ? { field: error.field } : {}) });
  }
};
