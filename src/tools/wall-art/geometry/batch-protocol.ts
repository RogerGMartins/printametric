/** Bounded, private native jobs. The controller retains accepted archives; workers
 * own fresh heaps and transfer only newly created outputs. Units are millimeters. */
import type { Bounds, ModelResult, Part } from '../../../shared/geometry/types.ts';
import type { NativeSnapshot } from '../../../shared/geometry/native-snapshot.ts';
import type { ParametersV2 } from '../model/parameters-v2.ts';
import type { BaseContour, ExcludedContour } from './layout-metadata.ts';
import type { Cell, XY } from './layouts/cells.ts';
import type { Identification } from './engraving.ts';

export interface ArchivedPart {
  part: Part; snapshot: NativeSnapshot; identification: Identification;
  assemblyBounds: Bounds; clearanceHull: XY[] | null;
}
export type BatchRequest = { parameters: ParametersV2; module: WebAssembly.Module; reservation: number } & (
  { stage: 'partition'; items: Cell[] } | { stage: 'parts'; items: BaseContour[] } |
  { stage: 'clearance'; items: [ArchivedPart, ArchivedPart][] } | { stage: 'step'; items: ArchivedPart[] });
export interface BatchResult {
  bases: BaseContour[]; excluded: ExcludedContour[]; parts: ArchivedPart[];
  operations: number; triangles: number; retainedBytes: number; wasmBytes: number;
  step?: Uint8Array<ArrayBuffer>;
}
export interface LayoutSnapshot {
  parameters: ParametersV2; result: ModelResult; parts: ArchivedPart[];
  bases: BaseContour[]; excluded: ExcludedContour[]; exclusionKey: string;
  partitionBytes: number; retainedBytes: number;
}
export interface BatchPort {
  onmessage: ((event: MessageEvent<{ result?: BatchResult; error?: { code: string; message: string; field?: string } }>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(request: BatchRequest): void;
  terminate(): void;
}
