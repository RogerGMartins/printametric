/** Worker messages contain data only. Epochs invalidate every response after a hard stop. */
import type { ExportFormat, ModelResult } from '../../../shared/geometry/types.ts';
import type { Parameters } from '../model/parameters.ts';
export type Request =
  | { type: 'initialize'; epoch: number }
  | { type: 'generate'; epoch: number; revision: number; parameters: Parameters }
  | { type: 'accept' | 'discard'; epoch: number; revision: number }
  | { type: 'export'; epoch: number; revision: number; format: ExportFormat }
  | { type: 'release'; epoch: number };
export type Response =
  | { type: 'ready'; epoch: number }
  | { type: 'generated'; epoch: number; result: ModelResult }
  | { type: 'exported'; epoch: number; revision: number; format: ExportFormat; bytes: Uint8Array<ArrayBuffer> }
  | { type: 'failed'; epoch: number; code: string; message: string; field?: string };
export interface WorkerPort {
  postMessage(request: Request): void;
  onmessage: ((event: MessageEvent<Response>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate(): void;
}
