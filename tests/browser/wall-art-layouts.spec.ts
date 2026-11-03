/** Real generator-2 worker/editor integration and explicit version transitions. */
import { test,expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { serializeVersionedDesign,serializeDesign } from '../../src/tools/wall-art/model/design-file.ts';
import { DEFAULT_PARAMETERS_V2 } from '../../src/tools/wall-art/model/parameters-v2.ts';
import { DEFAULT_PARAMETERS } from '../../src/tools/wall-art/model/parameters.ts';
import { unzipSync,strFromU8 } from 'fflate';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

test('import during CAD download does not inherit the cancelled startup signal',async({page})=>{
  let release!:()=>void;
  const downloadGate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/*.wasm',async route=>{await downloadGate;await route.continue();});
  try {
    await page.goto('/');await page.locator('.settings-drawer > summary').click();
    const bytes=serializeVersionedDesign({modelSchemaVersion:2,generatorVersion:2,parameters:{...DEFAULT_PARAMETERS_V2,width:100,height:100,topRatio:1}});
    await page.getByLabel('Load design JSON').setInputFiles({name:'startup.json',mimeType:'application/json',buffer:Buffer.from(bytes)});
    release();
    await expect(page.getByLabel('Panel width (mm)')).toHaveValue('100',{timeout:30000});
    await expect(page.getByRole('button',{name:'Export STL',exact:true})).toBeEnabled();
  }finally{release();}
});

for(const colorScheme of ['light','dark'] as const)test(`narrow ${colorScheme} layout recovery, whole-cell warning and plan lookup`,async({page})=>{
  test.setTimeout(90000);await page.setViewportSize({width:320,height:740});await page.emulateMedia({colorScheme});
  await page.goto('/');await page.locator('.settings-drawer > summary').click();
  const bytes=serializeVersionedDesign({modelSchemaVersion:2,generatorVersion:2,parameters:{...DEFAULT_PARAMETERS_V2,width:100,height:100,topRatio:1,layout:'irregular'}});
  await page.getByLabel('Load design JSON').setInputFiles({name:'narrow.json',mimeType:'application/json',buffer:Buffer.from(bytes)});
  await expect(page.getByLabel('Panel width (mm)')).toHaveValue('100',{timeout:30000});
  await page.locator('.layout-advanced > summary').press('Enter');
  const gap=page.getByLabel('Gap (mm)',{exact:true});await gap.fill('99');await gap.press('Enter');
  await expect(page.locator('#wall-art-error')).toBeVisible();
  await page.locator('.layout-advanced > summary').click();await page.locator('.settings-drawer > summary').click();
  await page.getByRole('button',{name:'Review model settings'}).press('Enter');
  await expect(gap).toBeFocused();await expect(gap).toHaveValue('99');
  // Close and recover before the browser can deliver the delayed native toggle.
  await page.evaluate(()=>{
    document.querySelector<HTMLDetailsElement>('.layout-advanced')!.open=false;
    document.querySelector<HTMLElement>('.settings-drawer > summary')!.click();
    [...document.querySelectorAll('button')].find(button=>button.textContent==='Review model settings')!.click();
  });
  await expect(gap).toBeFocused();await expect(gap).toHaveValue('99');
  await page.getByRole('button',{name:'Revert to accepted design'}).click();
  await page.getByLabel('Cell layout').selectOption('triangular');await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
  await page.getByLabel('Straight boundary',{exact:true}).uncheck();
  await expect(page.getByText(/Whole-cell edge exceeds nominal size/)).toBeVisible();
  await page.locator('.settings-drawer > summary').click();
  await page.getByRole('button',{name:'Numbered plan',exact:true}).click();
  const number=page.getByLabel('Part number',{exact:true});await number.fill('2');
  await expect(page.getByRole('img',{name:'Part 2 enlarged front-view contour. Assembly +Y points up.'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('cancelled generation and denied export quota retain the accepted design',async({page})=>{
  test.setTimeout(90000);await page.goto('/');await page.locator('.settings-drawer > summary').click();
  const definition={modelSchemaVersion:2 as const,generatorVersion:2 as const,parameters:{...DEFAULT_PARAMETERS_V2,width:100,height:100,topRatio:1}};
  await page.getByLabel('Load design JSON').setInputFiles({name:'retained.json',mimeType:'application/json',buffer:Buffer.from(serializeVersionedDesign(definition))});
  await expect(page.getByLabel('Panel width (mm)')).toHaveValue('100',{timeout:30000});
  await page.getByLabel('Load design JSON').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.from(serializeVersionedDesign({...definition,parameters:{...definition.parameters,width:2000,height:2000,layout:'triangular'}}))});
  await page.getByRole('button',{name:'Cancel generation',exact:true}).click();
  await expect(page.getByLabel('Panel width (mm)')).toHaveValue('100');
  await expect(page.getByRole('button',{name:'Export STL',exact:true})).toBeEnabled();
  await page.evaluate(()=>{navigator.storage.estimate=async()=>({quota:0,usage:0});});
  await page.getByRole('button',{name:'Export STL',exact:true}).click();
  await expect(page.locator('#wall-art-error')).toContainText('quota');
  await expect(page.getByLabel('Panel width (mm)')).toHaveValue('100');
  await page.getByRole('button',{name:'Revert to accepted design'}).click();
  await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
});

test('every outline and layout, numbered lookup, exclusions and disk-backed export',async({page})=>{
  test.setTimeout(120000);
  await page.goto('/');await expect(page.getByText('Model ready.',{exact:true})).toBeVisible({timeout:30000});
  await page.locator('.settings-drawer > summary').click();
  const bytes=serializeVersionedDesign({modelSchemaVersion:2,generatorVersion:2,parameters:{...DEFAULT_PARAMETERS_V2,width:100,height:100,topRatio:1}});
  await page.getByLabel('Load design JSON').setInputFiles({name:'layouts.json',mimeType:'application/json',buffer:Buffer.from(bytes)});
  await expect(page.getByLabel('Panel width (mm)')).toHaveValue('100');
  for(const outline of ['ellipse','hexagon','arch','rectangle']){
    await page.getByLabel('Outline',{exact:true}).selectOption(outline);
    await expect(page.getByText('Model ready.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
  }
  for(const layout of ['hexagonal','triangular','radial','square','irregular']){
    await page.getByLabel('Cell layout').selectOption(layout);
    await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled({timeout:30000});
  }
  await expect(page.getByText(/small fragments excluded/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Export 3MF',exact:true})).toBeDisabled();
  await page.locator('.settings-drawer > summary').click();
  await page.getByRole('button',{name:'Numbered plan',exact:true}).press('Enter');
  await expect(page.getByRole('img',{name:/Assembly front view/})).toBeVisible();
  await page.getByLabel('Part number',{exact:true}).fill('2');
  await expect(page.getByText(/Part 2 of /)).toBeVisible();
  await page.getByRole('button',{name:'Acknowledge excluded fragments'}).click();
  await page.locator('.settings-drawer > summary').click();
   for(const format of ['STEP','STL','3MF']){
     const downloading=page.waitForEvent('download');
     await page.getByRole('button',{name:`Export ${format}`,exact:true}).click();
     const download=await downloading;expect(await download.failure()).toBeNull();
     const path=await download.path();expect(path).toBeTruthy();const bytes=await readFile(path!);
     if(format==='STEP'){
       const text=bytes.toString('utf8');expect(text).toContain('ISO-10303-21;');expect(text).toContain('END-ISO-10303-21;');
       expect(text.match(/MANIFOLD_SOLID_BREP\s*\(/g)).toHaveLength(9);
       expect(text).toContain('wa-g2-v:');
     }else if(format==='STL'){
       const geometry=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
       try {geometry.computeBoundingBox();expect(geometry.attributes.position.count/3).toBe(bytes.readUInt32LE(80));
         expect(geometry.boundingBox!.max.z).toBeCloseTo(30,4);expect(geometry.boundingBox!.min.z).toBeCloseTo(0,4);
       }finally{geometry.dispose();}
     }else{
       const model=strFromU8(unzipSync(bytes)['3D/3dmodel.model']);
       expect(model.match(/<object /g)).toHaveLength(9);expect(model).toContain('unit="millimeter"');expect(model).toContain('partnumber="wa-g2-v:');
     }
     await expect(page.getByRole('button',{name:'Release downloaded file'})).toBeVisible();
     await page.getByRole('button',{name:'Release downloaded file'}).click();
     await expect(page.getByRole('button',{name:'Export 3MF',exact:true})).toBeEnabled();
   }
});

test('v1 bytes survive cancelled upgrades and invalid v2 imports; confirmation is explicit',async({page})=>{
  test.setTimeout(90000);
  await page.goto('/');await expect(page.getByText('Model ready.',{exact:true})).toBeVisible({timeout:30000});
  await page.locator('.settings-drawer > summary').click();
  const original=Buffer.from('\n '+new TextDecoder().decode(serializeDesign({...DEFAULT_PARAMETERS,width:100,height:100,topRatio:1}))+'\n');
  await page.getByLabel('Load design JSON').setInputFiles({name:'original.json',mimeType:'application/json',buffer:original});
  await expect(page.getByRole('button',{name:'Preview upgrade to generator 2'})).toBeEnabled();
  await page.getByRole('button',{name:'Preview upgrade to generator 2'}).click();
  await expect(page.getByRole('button',{name:'Confirm upgrade'})).toBeVisible({timeout:30000});
  await page.getByRole('button',{name:'Cancel upgrade',exact:true}).click();
  const saving=page.waitForEvent('download');await page.getByRole('button',{name:'Save design JSON',exact:true}).click();
  expect(await readFile((await (await saving).path())!)).toEqual(original);
  await page.getByLabel('Load design JSON').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"printametric-wall-art","formatVersion":1,"modelSchemaVersion":2,"generatorVersion":1,"seed":1,"parameters":{}}')});
  await expect(page.locator('#wall-art-error')).toBeVisible();await expect(page.getByLabel('Panel width (mm)')).toHaveValue('100');
  await page.getByRole('button',{name:'Revert to accepted design'}).click();
  await expect(page.getByRole('button',{name:'Preview upgrade to generator 2'})).toBeEnabled();
  await page.getByRole('button',{name:'Preview upgrade to generator 2'}).click();
  await page.getByRole('button',{name:'Confirm upgrade'}).click();
  await expect(page.getByLabel('Outline',{exact:true})).toHaveValue('rectangle');
  await page.locator('.layout-advanced > summary').click();
  await expect(page.getByLabel('Engraving depth (mm)')).toHaveValue('0');
  await expect(page.getByLabel('Underside orientation mark')).not.toBeChecked();
});
