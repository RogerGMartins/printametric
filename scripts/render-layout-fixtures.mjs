// Deterministic visual review sheet from the real contours and original glyph
// polygons. This is a drawing, not an image-generation service or a UI study.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { loadKernel } from '../tests/support/wall-art-kernel.mjs';
import { DEFAULT_PARAMETERS_V2, OUTLINES, LAYOUTS } from '../src/tools/wall-art/model/parameters-v2.ts';
import { partitionLayout } from '../src/tools/wall-art/geometry/layouts/partition.ts';
import { digitPolygons } from '../src/tools/wall-art/geometry/glyphs.ts';
import { identificationPolygons } from '../src/tools/wall-art/geometry/engraving.ts';
const kernel=await loadKernel(),directory=resolve('artifacts/wall-art-layouts');
await mkdir(directory,{recursive:true});
const polygon=points=>`<polygon points="${points.map(point=>point.join(',')).join(' ')}"/>`;
const panels=[];
for(const outline of OUTLINES)for(const layout of LAYOUTS){
  const result=partitionLayout(kernel,{...DEFAULT_PARAMETERS_V2,width:100,height:100,outline,layout});
  const paths=result.bases.map(base=>`<g fill="#ddd" stroke="#222" stroke-width=".35">${base.paths.flat().map(path=>`<path d="${path}"/>`).join('')}</g>`).join('');
  panels.push(`<figure><figcaption>${outline} / ${layout}<small>${result.bases.length} parts; ${result.excluded.length} excluded</small></figcaption><svg viewBox="-55 -55 110 110">${paths}</svg></figure>`);
}
const digits=Array.from({length:10},(_,digit)=>`<figure class="digit"><figcaption>${digit}</figcaption><svg viewBox="-1 -1 8 12">${digitPolygons(digit).map(points=>polygon(points.map(([x,y])=>[x,10-y]))).join('')}</svg></figure>`).join('');
const combinations=[1,6,9,10,99,100,999,1000,4000].map(number=>{
  const points=identificationPolygons(number,5,true).flat(),width=Math.max(9,(String(number).length*7-1)*.5+2);
  return `<figure class="number"><figcaption>${number}</figcaption><svg viewBox="${-width/2} -6.5 ${width} 13">${points.map(polygon).join('')}</svg></figure>`;
}).join('');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Wall-art layout and identification fixtures</title><style>
body{font:16px Arial,sans-serif;color:#222;background:white;margin:32px;max-width:1200px}h1{font-size:26px}h2{margin-top:30px;font-size:21px}p{line-height:1.5}figure{margin:0}figcaption{font-weight:bold;margin-bottom:8px}small{display:block;font-weight:normal;margin-top:4px}.layouts{display:grid;grid-template-columns:repeat(5,1fr);gap:20px}.layouts svg{width:200px;height:200px}.digits,.numbers{display:flex;justify-content:space-between;gap:14px}.digit svg{width:55px;height:82px}.number svg{width:105px;height:110px}svg{display:block;fill:#222}
</style><h1>Wall art 02 — contour and identification review</h1><p>Native post-gap contours at 100 × 100 mm, pitch 50 mm, gap 2.5 mm, seed 1. All boundaries clipped. These are review fixtures, not a capacity claim.</p><div class="layouts">${panels.join('')}</div><h2>Original digits — readable underside</h2><p>Seven-segment outlines; fixed geometry, independent of installed fonts. At the minimum 5 mm numeral height, bars are 0.8 mm wide.</p><div class="digits">${digits}</div><h2>Minimum-size numbers with orientation marks</h2><p>Back view after turning a part over about its local X axis. The arrow points toward assembly +Y; that direction appears downward in this back view. Arrow: 4 × 5 mm; shaft: 0.8 mm; number-to-arrow gap: 0.8 mm. Engraving depth is 1 mm by default.</p><div class="numbers">${combinations}</div><p>Physical print readability remains unverified. Numbers that cannot fit with 1.2 mm edge clearance remain map-only; the part is retained.</p></html>`;
await writeFile(resolve(directory,'fixture-review.html'),html);
const browser=await chromium.launch();
try{
  const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
  await page.setContent(html);await page.screenshot({path:resolve(directory,'fixture-review.png'),fullPage:true});
}finally{await browser.close();}
console.log(resolve(directory,'fixture-review.png'));
