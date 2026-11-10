/** Matched native-mesh views and independent browser 3MF checks for a fixed matrix. */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const directory = resolve(process.argv[2] ?? '');
if (![3, 6].includes(process.argv.length)) throw Error('Supply one review directory and optionally the three generated starter directories.');
const report = JSON.parse(await readFile(`${directory}/report.json`, 'utf8'));
if (process.argv.length === 6) {
  report.starters = [];
  for (const source of process.argv.slice(3)) {
    const starter = JSON.parse(await readFile(`${source}/report.json`, 'utf8')), profile = starter.parameters.concavity;
    if (!starter.complete || starter.parts.length !== 100 || ![1, 2.2, 4].includes(profile) || report.starters.some(row => row.profile === profile)) throw Error('Expected three distinct complete 100-piece starters.');
    const id = `starter-${profile}`; await mkdir(`${directory}/${id}`, { recursive: true });
    for (const extension of ['step', 'stl', '3mf']) await copyFile(`${source}/starter.${extension}`, `${directory}/${id}/assembly.${extension}`);
    await copyFile(`${source}/preview.json`, `${directory}/${id}/preview.json`);
    report.starters.push({ id, profile, source, count: 100, triangles: starter.parts.reduce((sum, part) => sum + part.triangles, 0) });
  }
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
}
await new Promise((accept, reject) => { const child = spawn(process.execPath, ['scripts/profile-shape-surface-browser.mjs', '--build-only'], { stdio: 'inherit' }); child.once('error', reject); child.once('exit', code => code ? reject(Error(`Build exited ${code}.`)) : accept()); });
const out = resolve('artifacts/wall-art-shape-surface/browser-fixture');
const server = createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname), models = name.startsWith('/models/'), base = models ? directory : out;
    const file = resolve(base, models ? name.slice(8) : `.${name === '/' ? '/index.html' : name}`);
    if (!file.startsWith(base + sep) || !(await stat(file)).isFile()) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' })[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch { response.writeHead(404).end(); }
});
let browser; const evidence = [], sections = [];
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
try {
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(6873, '127.0.0.1', accept); });
  browser = await chromium.launch({ channel: 'chromium', headless: false }); const page = await browser.newPage(); page.setDefaultTimeout(120000);
  await page.goto('http://127.0.0.1:6873'); await page.waitForFunction(() => typeof window.renderSurfaceViews === 'function');
  for (const fixture of [...report.results, ...(report.starters ?? [])]) {
    if (!fixture.count) { sections.push(`<section><h2>${escape(fixture.id)}</h2><p>Expected rejection: ${escape(fixture.expectedRejection ?? fixture.failure)}</p></section>`); continue; }
    const result = await page.evaluate(id => window.renderSurfaceViews(id), fixture.id);
    for (const [name, image] of Object.entries(result.images)) await writeFile(`${directory}/${fixture.id}/${name}.png`, Buffer.from(image.split(',')[1], 'base64'));
    const { images, ...check } = result; evidence.push({ id: fixture.id, ...check });
    sections.push(`<section><h2>${escape(fixture.id)}</h2><p>${fixture.count} parts · ${fixture.triangles.toLocaleString()} triangles · mm</p><div>${Object.keys(images).map(name => `<figure><img loading="lazy" src="${escape(fixture.id)}/${name}.png" alt="${escape(fixture.id)} ${name} view"><figcaption>${name}</figcaption></figure>`).join('')}</div><p>${['step', 'stl', '3mf'].map(ext => `<a href="${escape(fixture.id)}/assembly.${ext}">${ext.toUpperCase()}</a>`).join(' · ')} · <a href="${escape(fixture.id)}/preview.json">Exact parameters and bounds</a></p></section>`);
    console.log(JSON.stringify(evidence.at(-1)));
  }
  await writeFile(`${directory}/browser-readers.json`, JSON.stringify(evidence, null, 2));
  await writeFile(`${directory}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Native surface P2 review</title><style>body{max-width:1500px;margin:auto;padding:24px;font:16px system-ui;background:#edf1f5;color:#172331}section{padding:20px 0;border-top:1px solid #aab7c4}section>div{display:grid;grid-template-columns:repeat(3,1fr)}figure{margin:0}img{width:100%}a{color:#124b85}figcaption{text-align:center}@media(max-width:700px){section>div{grid-template-columns:1fr}}</style><h1>Native surface P2 review</h1><p>Actual canonical meshes shared by preview and export. Front, side and isometric views use fixed camera directions. This is an isolated review artifact; production integration requires approval.</p>${sections.join('')}</html>`);
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(accept => server.close(accept)); }
