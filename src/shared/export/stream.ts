/** Bounded format writers accept a backpressured sink, independent of storage. */
export interface ByteSink { write(bytes: Uint8Array): void | Promise<void> }
export interface StreamOptions { signal?: AbortSignal; maxBytes?: number }
