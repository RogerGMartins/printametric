/** Standard 3MF Core package; no printer profiles, packing or scene helpers. */
import { zipSync, strToU8 } from 'fflate';
import type { Part } from '../geometry/types.ts';

const escapeXML = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
export function serialize3MF(parts: Part[]): Uint8Array<ArrayBuffer> {
  let triangleCount = 0;
  const objects = parts.map((part, index) => {
    const { positions: p, indices: ix } = part.mesh;
    triangleCount += ix.length / 3;
    if (triangleCount > 500_000) throw new Error('3MF triangle budget exceeded.');
    const vertices: string[] = [], triangles: string[] = [];
    for (let i = 0; i < p.length; i += 3) vertices.push(`<vertex x="${p[i]}" y="${p[i + 1]}" z="${p[i + 2]}"/>`);
    for (let i = 0; i < ix.length; i += 3) triangles.push(`<triangle v1="${ix[i]}" v2="${ix[i + 1]}" v3="${ix[i + 2]}"/>`);
    return `<object id="${index + 1}" type="model" name="${escapeXML(part.id)}" partnumber="${escapeXML(part.id)}"><mesh><vertices>${vertices.join('')}</vertices><triangles>${triangles.join('')}</triangles></mesh></object>`;
  });
  const build = parts.map((p, i) => `<item objectid="${i + 1}" transform="1 0 0 0 1 0 0 0 1 ${p.translation.join(' ')}"/>`).join('');
  return new Uint8Array(zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': strToU8(`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>${objects.join('')}</resources><build>${build}</build></model>`),
  }, { level: 6, mtime: new Date(1980, 0, 1) }));
}
