// Bounded 3MF writer. The sink supplies backpressure; ZIP output
// from one small input chunk is drained before another input chunk is produced.
import { Zip, ZipDeflate } from 'fflate';
import { validateMesh } from '../geometry/validate-mesh.ts';
import type { Part } from '../geometry/types.ts';
import type { ByteSink, StreamOptions } from './stream.ts';

const encode = new TextEncoder();
const escape = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const types = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
const relationships = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';

function* modelXML(parts: readonly Part[]) {
  yield '<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>';
  for (const [index, part] of parts.entries()) {
    // Slicers can use object names directly as filenames. Keep the full stable
    // identity in partnumber, and use a portable numbered display/file name.
    yield `<object id="${index + 1}" type="model" name="Part-${index + 1}" partnumber="${escape(part.id)}"><mesh><vertices>`;
    const { positions: p, indices: ix } = part.mesh;
    for (let i = 0; i < p.length; i += 3) yield `<vertex x="${p[i]}" y="${p[i + 1]}" z="${p[i + 2]}"/>`;
    yield '</vertices><triangles>';
    for (let i = 0; i < ix.length; i += 3) yield `<triangle v1="${ix[i]}" v2="${ix[i + 1]}" v3="${ix[i + 2]}"/>`;
    yield '</triangles></mesh></object>';
  }
  yield '</resources><build>';
  for (const [index, part] of parts.entries()) yield `<item objectid="${index + 1}" transform="1 0 0 0 1 0 0 0 1 ${part.translation.join(' ')}"/>`;
  yield '</build></model>';
}

export async function stream3MF(parts: readonly Part[], sink: ByteSink, { signal, maxBytes = 2 * 1024 ** 3 }: StreamOptions = {}) {
  if (!Array.isArray(parts) || !parts.length || parts.length > 4000) throw Error('3MF part budget exceeded');
  let triangles = 0;
  const ids = new Set();
  for (const part of parts) {
    signal?.throwIfAborted();
    if (typeof part.id !== 'string' || !part.id.length || part.id.length > 128 || /[\u0000-\u001f]/.test(part.id) || ids.has(part.id)) throw Error('Invalid 3MF part identity');
    ids.add(part.id);
    if (!Array.isArray(part.translation) || part.translation.length !== 3 || part.translation.some((n: unknown) => !Number.isFinite(n))) throw Error('Invalid 3MF placement');
    validateMesh(part.mesh);
    triangles += part.mesh.indices.length / 3;
    if (triangles > 2_000_000) throw Error('3MF triangle budget exceeded');
  }
  let bytes = 0, ended = false, failure: Error | undefined;
  const pending: Uint8Array[] = [];
  const zip = new Zip((error, chunk, final) => { if (error) failure = error; else { pending.push(chunk); ended = final; } });
  const drain = async () => {
    if (failure) throw failure;
    for (const chunk of pending.splice(0)) {
      signal?.throwIfAborted();
      if (bytes + chunk.length > maxBytes) throw Error('Temporary 3MF file budget exceeded');
      await sink.write(chunk); bytes += chunk.length;
    }
  };
  try {
    for (const [name, records] of [['[Content_Types].xml', [types]], ['_rels/.rels', [relationships]], ['3D/3dmodel.model', modelXML(parts)]] as const) {
      const entry = new ZipDeflate(name, { level: 6 }); entry.mtime = new Date(1980, 0, 1); zip.add(entry);
      let text = '';
      for (const record of records) {
        text += record;
        if (text.length >= 16 * 1024) { entry.push(encode.encode(text), false); text = ''; await drain(); }
      }
      entry.push(encode.encode(text), true); await drain();
    }
    zip.end(); await drain();
    if (!ended) throw Error('Truncated 3MF ZIP output');
    return { bytes, parts: parts.length, triangles };
  } finally { zip.terminate(); }
}
