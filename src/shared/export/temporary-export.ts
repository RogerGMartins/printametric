// Explicit-export storage. A cross-tab lock owns each random job
// directory until the caller releases its download. No timer guesses download end.
const DIRECTORY = 'printametric-exports-v1';
const PREFIX = 'printametric-export:';
const DISK_LIMIT = 2 * 1024 ** 3;
const validID = (id: string) => /^[0-9a-f-]{36}$/.test(id);

export async function exportRoot() {
  if (!globalThis.isSecureContext || !navigator.storage?.getDirectory || !navigator.locks) throw Error('Temporary export storage unavailable');
  return (await navigator.storage.getDirectory()).getDirectoryHandle(DIRECTORY, { create: true });
}

// Called only as part of an explicit export. Active tabs hold their lock, so this
// cannot remove another tab's live output. Crashed tabs release locks automatically.
export async function cleanAbandonedExports() {
  const root = await exportRoot();
  await navigator.locks.request(PREFIX + 'allocation', async () => {
    for await (const [id, handle] of root.entries()) {
      if (handle.kind !== 'directory' || !validID(id)) continue;
      await navigator.locks.request(PREFIX + id, { ifAvailable: true }, async lock => {
        if (lock) try { await root.removeEntry(id, { recursive: true }); }
        catch (error) { if (!(error instanceof DOMException) || error.name !== 'NotFoundError') throw error; }
      });
    }
  });
}

export async function reserveTemporaryExport(maxBytes = 2 * 1024 ** 3) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 2 * 1024 ** 3) throw Error('Invalid export storage bound');
  const root = await exportRoot();
  await cleanAbandonedExports();
  const estimate = await navigator.storage.estimate();
  if (typeof estimate.quota!=='number' || typeof estimate.usage!=='number' || !Number.isFinite(estimate.quota) || !Number.isFinite(estimate.usage) || estimate.quota - estimate.usage < maxBytes) throw Error('Insufficient temporary export quota');
  const id = crypto.randomUUID();
  let unlock!: ()=>void, entered!: ()=>void;
  const acquired = new Promise<void>(resolve => { entered = resolve; });
  const held = navigator.locks.request(PREFIX + id, async () => {
    await new Promise<void>(resolve => { unlock = resolve; entered(); });
  });
  // Propagate lock errors rather than hanging while waiting for its callback.
  await Promise.race([acquired, held.then(() => { throw Error('Export lock ended before acquisition'); })]);
  let released = false;
  try {
    await navigator.locks.request(PREFIX + 'allocation', async () => {
      let reserved = 0;
      for await (const [key, handle] of root.entries()) {
        if (!validID(key) || handle.kind !== 'directory') continue;
        const metadata = await handle.getFileHandle('reservation.json');
        const file = await metadata.getFile();
        if (file.size > 128) throw Error('Invalid temporary export reservation');
        const value = JSON.parse(await file.text());
        if (!Number.isSafeInteger(value.maxBytes) || value.maxBytes < 1 || value.maxBytes > DISK_LIMIT) throw Error('Invalid temporary export reservation');
        reserved += value.maxBytes;
      }
      if (reserved + maxBytes > DISK_LIMIT) throw Error('Temporary export storage is reserved by another export');
      const directory = await root.getDirectoryHandle(id, { create: true });
      const metadata = await directory.getFileHandle('reservation.json', { create: true });
      const writer = await metadata.createWritable();
      try { await writer.write(JSON.stringify({ maxBytes })); await writer.close(); }
      catch (error) { await writer.abort().catch(() => {}); throw error; }
    });
  } catch (error) {
    try { await root.removeEntry(id, { recursive: true }); } catch (cleanup) { if (!(cleanup instanceof DOMException) || cleanup.name !== 'NotFoundError') throw cleanup; }
    finally { unlock(); await held; }
    throw error;
  }
  return {
    id, maxBytes,
    async release() {
      if (released) return;
      // Preserve the lease if removal fails, so another tab cannot claim cleanup
      // while this caller still needs to retry a failed release.
      // Hard worker termination releases OPFS locks asynchronously in Chromium.
      // Retry only that transient error, with a bounded wait and a visible failure.
      for (let attempt = 0; ; attempt++) {
        try { await navigator.locks.request(PREFIX + 'allocation', () => root.removeEntry(id, { recursive: true })); break; }
        catch (error) {
          if (!(error instanceof DOMException) || error.name !== 'NoModificationAllowedError' || attempt === 20) throw error;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      released = true; unlock(); await held;
    },
  };
}

// Dedicated-worker-only sink. Close the access handle before returning a File;
// structured cloning that File to the page preserves the disk-backed source.
export async function openTemporarySink(id: string, maxBytes: number) {
  if (!validID(id) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 2 * 1024 ** 3) throw Error('Invalid temporary export request');
  const root = await exportRoot(), directory = await root.getDirectoryHandle(id);
  const file = await directory.getFileHandle('output', { create: true });
  // This dedicated-worker API is implemented by supported browsers but is not
  // declared by the installed DOM lib. Keep its narrow contract at this boundary.
  const syncFile=file as FileSystemFileHandle & { createSyncAccessHandle?: ()=>Promise<{
    truncate(size:number):void;write(data:Uint8Array<ArrayBuffer>,options:{at:number}):number;flush():void;close():void;
  }> };
  if(!syncFile.createSyncAccessHandle)throw Error('Disk-backed export requires synchronous worker file access.');
  const access = await syncFile.createSyncAccessHandle();
  let bytes = 0, closed = false;
  try { access.truncate(0); } catch (error) { access.close(); throw error; }
  return {
    write(chunk: Uint8Array<ArrayBuffer>) {
      if (closed || !(chunk instanceof Uint8Array) || bytes + chunk.length > maxBytes) throw Error('Temporary export byte limit exceeded');
      let written = 0;
      while (written < chunk.length) {
        const length = access.write(chunk.subarray(written), { at: bytes + written });
        if (length <= 0) throw Error('Temporary export write made no progress');
        written += length;
      }
      bytes += written;
    },
    async finish() {
      if (closed) throw Error('Temporary export is closed');
      access.flush(); access.close(); closed = true;
      const result = await file.getFile();
      if (result.size !== bytes) throw Error('Temporary export length mismatch');
      return result;
    },
    close() { if (!closed) { access.close(); closed = true; } },
  };
}
