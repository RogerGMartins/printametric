// Explicit maintenance command, never part of app startup or the offline build.
// Copies exact installed license texts and pinned upstream kernel notices.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const directory = new URL('../public/licenses/', import.meta.url);
await mkdir(directory, { recursive: true });
const local = {
  react: 'react/LICENSE', 'react-dom': 'react-dom/LICENSE', scheduler: 'scheduler/LICENSE',
  three: 'three/LICENSE',
  replicad: 'replicad/LICENSE', 'replicad-opencascadejs': 'replicad-opencascadejs/LICENSE',
  fflate: 'fflate/LICENSE', zustand: 'zustand/LICENSE', 'react-use-measure': 'react-use-measure/LICENSE',
  'suspend-react': 'suspend-react/LICENSE', 'its-fine': 'its-fine/LICENSE',
  'react-reconciler': 'react/LICENSE', 'use-sync-external-store': 'use-sync-external-store/LICENSE',
  'babel-runtime': '@babel/runtime/LICENSE', buffer: 'buffer/LICENSE', 'base64-js': 'base64-js/LICENSE',
  ieee754: 'ieee754/LICENSE', flatbush: 'flatbush/LICENSE', flatqueue: 'flatqueue/LICENSE', 'opentype-js': 'opentype.js/LICENSE',
};
for (const [name, path] of Object.entries(local)) {
  await writeFile(new URL(`${name}.txt`, directory), await readFile(new URL(`../node_modules/${path}`, import.meta.url)));
}
const occt = 'https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/b8f597c677811d1f9f4d8a97f5ae2825c0353a42/';
const ocjs = 'https://raw.githubusercontent.com/taucad/opencascade.js/ebd263f1/';
const upstream = {
  'react-three-fiber': 'https://raw.githubusercontent.com/pmndrs/react-three-fiber/d74622ea8ed717f7212d7e19d65ff3e325508389/LICENSE',
  'occt-lgpl-2.1': occt + 'LICENSE_LGPL_21.txt', 'occt-exception': occt + 'OCCT_LGPL_EXCEPTION.txt',
  'opencascade-js': ocjs + 'LICENSE', 'opencascade-js-exception': ocjs + 'LICENSE.OCCT-Exception',
  rapidjson: 'https://raw.githubusercontent.com/Tencent/rapidjson/24b5e7a8b27f42fa16b96fc70aade9106cf7102f/license.txt',
  freetype: 'https://raw.githubusercontent.com/freetype/freetype/de8b92dd7ec634e9e2b25ef534c54a3537555c11/docs/FTL.TXT',
  emscripten: 'https://raw.githubusercontent.com/emscripten-core/emscripten/5.0.1/LICENSE',
};
for (const [name, url] of Object.entries(upstream)) {
  const response = await fetch(url); if (!response.ok) throw new Error(`${response.status}: ${url}`);
  await writeFile(new URL(`${name}.txt`, directory), await response.text());
}
await writeFile(new URL('THIRD_PARTY_NOTICES.md', directory), await readFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url)));
console.log(`Copied ${Object.keys(local).length + Object.keys(upstream).length} license texts and the notice index.`);
