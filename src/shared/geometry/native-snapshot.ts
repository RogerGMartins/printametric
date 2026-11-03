/** Private, pinned native CAD archives. These bytes are never a user design format. */
import { gzipSync, gunzipSync } from 'fflate';
import { cast, isShape3D, type Shape3D } from 'replicad';
import { validateSolid, type Kernel } from './kernel.ts';

export const SNAPSHOT_KERNEL = 'replicad-opencascadejs@1.1.0:e4b05f67dc4e2393a876ce8c5064a9c93db05bf1';
const MAX_PART_BYTES = 8 * 1024 * 1024;
export interface NativeSnapshot {
  version: 1; kernel: string; identity: string; rawLength: number; checksum: string; bytes: Uint8Array<ArrayBuffer>;
}
const hash = async (bytes: Uint8Array<ArrayBuffer>) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2, '0')).join('');

export async function archiveNative(kernel: Kernel, shape: Shape3D, identity: string): Promise<NativeSnapshot> {
  const progress = new kernel.Message_ProgressRange();
  try {
    kernel.BRepTools.Clean(shape.wrapped, false);
    if (!kernel.BinTools.Write(shape.wrapped, '/snapshot.brep', progress)) throw Error('Native snapshot write failed');
    const raw = new Uint8Array(kernel.FS.readFile('/snapshot.brep'));
    if (raw.length > MAX_PART_BYTES) throw Error('Native snapshot part exceeds 8 MiB');
    const bytes = new Uint8Array(gzipSync(raw, { mtime: 0 }));
    return { version: 1, kernel: SNAPSHOT_KERNEL, identity, rawLength: raw.length, checksum: await hash(bytes), bytes };
  } finally { progress.delete(); try { kernel.FS.unlink('/snapshot.brep'); } catch { /* Write may fail before file creation. */ } }
}

export async function restoreNative(kernel: Kernel, snapshot: NativeSnapshot, expectedIdentity: string): Promise<Shape3D> {
  if (!snapshot || Object.keys(snapshot).sort().join() !== 'bytes,checksum,identity,kernel,rawLength,version' ||
      snapshot.version !== 1 || snapshot.kernel !== SNAPSHOT_KERNEL || snapshot.identity !== expectedIdentity ||
      !Number.isSafeInteger(snapshot.rawLength) || snapshot.rawLength < 1 || snapshot.rawLength > MAX_PART_BYTES ||
      !(snapshot.bytes instanceof Uint8Array) || snapshot.bytes.length < 18 || snapshot.bytes.length > MAX_PART_BYTES ||
      typeof snapshot.checksum !== 'string' || snapshot.checksum !== await hash(snapshot.bytes)) throw Error('Invalid native snapshot');
  const data = snapshot.bytes;
  const declaredSize = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(data.length - 4, true);
  if (declaredSize !== snapshot.rawLength) throw Error('Native snapshot size mismatch');
  const rawBytes = gunzipSync(data, { out: new Uint8Array(snapshot.rawLength) });
  if (rawBytes.length !== snapshot.rawLength) throw Error('Native snapshot truncated');
  const raw = new kernel.TopoDS_Shape(), progress = new kernel.Message_ProgressRange();
  let result;
  try {
    kernel.FS.writeFile('/snapshot.brep', rawBytes);
    if (!kernel.BinTools.Read(raw, '/snapshot.brep', progress)) throw Error('Native snapshot restore failed');
    result = cast(raw);
    if(!isShape3D(result))throw Error('Native snapshot must contain one solid.');
    validateSolid(kernel, result);
    return result;
  } catch (error) { result?.delete(); throw error; }
  finally { raw.delete(); progress.delete(); try { kernel.FS.unlink('/snapshot.brep'); } catch { /* Read may fail before file creation. */ } }
}
