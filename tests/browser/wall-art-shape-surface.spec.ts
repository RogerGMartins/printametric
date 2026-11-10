/** Integrated generator-3 controls, real workers, files and final-solid downloads. */
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { serializeVersionedDesign, parseVersionedDesign } from '../../src/tools/wall-art/model/design-file.ts';
import { DEFAULT_PARAMETERS_V3 } from '../../src/tools/wall-art/model/parameters-v3.ts';
import { DEFAULT_PARAMETERS_V2 } from '../../src/tools/wall-art/model/parameters-v2.ts';
import { DEFAULT_PARAMETERS } from '../../src/tools/wall-art/model/parameters.ts';
import type { DesignDefinition } from '../../src/tools/wall-art/model/definition.ts';

const small:Extract<DesignDefinition,{generatorVersion:3}>={modelSchemaVersion:3,generatorVersion:3,parameters:{...DEFAULT_PARAMETERS_V3,width:100,height:100,topRatio:.8}};
async function load(page:Page,definition:DesignDefinition){
  await page.getByLabel('Load design JSON').setInputFiles({name:'design.json',mimeType:'application/json',buffer:Buffer.from(serializeVersionedDesign(definition))});
  await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled({timeout:120000});
}
async function save(page:Page){
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Save design JSON',exact:true}).click();
  return await readFile((await (await promise).path())!);
}

test('fresh generator 3 uses the approved starter and saves actual accepted parameters',async({page})=>{
  test.setTimeout(120000);await page.goto('/');await page.locator('.settings-drawer > summary').click();
  await expect(page.getByLabel('Top size (%)',{exact:true})).toHaveValue('12');
  await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled({timeout:120000});
  expect(parseVersionedDesign(await save(page))).toEqual({modelSchemaVersion:3,generatorVersion:3,parameters:DEFAULT_PARAMETERS_V3});
  await expect(page.getByLabel('Model status')).toContainText('Accepted generator 3 · wave · 100 parts');
  await expect(page.locator('.model-canvas canvas')).toBeVisible();
});

test('every family and arm count stays keyboard-editable while surface amplitude is inactive',async({page})=>{
  test.setTimeout(120000);await page.goto('/');await page.locator('.settings-drawer > summary').click();
  await load(page,{...small,parameters:{...small.parameters,depth:0,concavity:1}});
  const family=page.getByLabel('Surface family');
  for(const value of ['wave','dunes','ring','dome','spiral','ridges','random']){
    await family.selectOption(value);await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
    await expect(page.getByText('Surface settings are retained; they do not change height while amplitude is 0.',{exact:true})).toBeVisible();
  }
  await page.getByText('Advanced surface',{exact:true}).press('Enter');
  const arms=page.getByLabel('Spiral arms',{exact:true});await arms.fill('1');await arms.press('Enter');
  for(let value=2;value<=16;value++){await arms.press('ArrowUp');await arms.press('Enter');await expect(arms).toHaveValue(String(value));}
  await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled({timeout:30000});
  const saved=parseVersionedDesign(await save(page));if(saved.generatorVersion!==3)throw Error('Expected generator 3');
  expect(saved.parameters.spiralArms).toBe(16);expect(saved.parameters.family).toBe('random');expect(saved.parameters.depth).toBe(0);
});

for(const colorScheme of ['light','dark'] as const)test(`320px ${colorScheme} surface drafts, inactive controls, range keyboard and recovery`,async({page})=>{
  test.setTimeout(120000);await page.setViewportSize({width:320,height:800});await page.emulateMedia({colorScheme});
  await page.goto('/');await page.locator('.settings-drawer > summary').click();await load(page,small);
  const top=page.getByLabel('Top size (%)',{exact:true});await top.fill('37.12345');await top.press('Enter');
  await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
  await expect(top).toHaveValue('37.12345');expect(parseVersionedDesign(await save(page)).parameters.topRatio).toBe(.3712345);
  await page.getByLabel('Top size range',{exact:true}).press('End');
  await expect(top).toHaveValue('100');await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
  await page.getByText('Advanced shape',{exact:true}).press('Enter');
  await page.getByLabel('Planar tops',{exact:true}).press('Space');
  await expect(page.getByText('No effect: stepped tops are already horizontal. Your choice is retained.',{exact:true})).toBeVisible();
  const blend=page.getByLabel('Top blend (%)',{exact:true});await blend.fill('50');await blend.press('Enter');
  await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
  await expect(page.getByText('One flat face per top; it may slope.',{exact:true})).toBeVisible();
  await page.getByLabel('Top blend range',{exact:true}).press('Home');await expect(blend).toHaveValue('0');
  await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
  await page.getByLabel('Top blend range',{exact:true}).press('End');await expect(blend).toHaveValue('100');
  await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
  await page.getByLabel('Surface family').selectOption('dome');
  await expect(page.getByLabel('Pattern density',{exact:true})).toBeEnabled();
  await page.getByText('Advanced surface',{exact:true}).press('Enter');
  const seed=page.getByLabel('Surface seed',{exact:true});await expect(seed).toBeEnabled();
  await seed.fill('0');await seed.press('Enter');await expect(page.locator('#wall-art-error')).toBeVisible();
  await page.getByText('Advanced surface',{exact:true}).click();await page.locator('.settings-drawer > summary').click();
  await page.getByRole('button',{name:'Review model settings'}).press('Enter');await expect(seed).toBeFocused();await expect(seed).toHaveValue('0');
  await seed.fill('5000');await seed.press('Enter');await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
  await page.getByText('Advanced layout and identification',{exact:true}).press('Enter');
  const layoutSeed=page.getByLabel('Layout seed',{exact:true});await layoutSeed.fill('9999');await layoutSeed.press('Enter');
  await expect(page.getByRole('button',{name:'Save design JSON',exact:true})).toBeEnabled();
  const bytes=await save(page),definition=parseVersionedDesign(bytes);expect(definition.generatorVersion).toBe(3);
  if(definition.generatorVersion!==3)throw Error('Expected generator 3');expect(definition.parameters.surfaceSeed).toBe(5000);expect(definition.parameters.seed).toBe(9999);
  await load(page,definition);expect(await save(page)).toEqual(bytes);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('invalid bare material retains the source; floor-only failure remains a map-only part',async({page})=>{
  test.setTimeout(120000);await page.goto('/');await page.locator('.settings-drawer > summary').click();await load(page,small);
  const original=await save(page);
  const bad={...small,parameters:{...small.parameters,plinthEnabled:false,minimumRelief:.5,depth:.1}};
  await page.getByLabel('Load design JSON').setInputFiles({name:'thin.json',mimeType:'application/json',buffer:Buffer.from(serializeVersionedDesign(bad))});
  await expect(page.locator('#wall-art-error')).toContainText('Part',{timeout:30000});await expect(page.getByLabel('Model status')).toContainText('Previous valid design');
  await page.getByRole('button',{name:'Revert to accepted design'}).click();expect(await save(page)).toEqual(original);
  await load(page,{...bad,parameters:{...bad.parameters,minimumRelief:1.3}});
  await expect(page.getByRole('button',{name:'Export STL',exact:true})).toBeEnabled();
  await page.locator('.settings-drawer > summary').click();await page.getByRole('button',{name:'Review map-only parts'}).click();
  await expect(page.getByText('This valid part is too thin for the requested underside cuts. Number and arrow were omitted.',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Part number',{exact:true})).toHaveValue('1');
  await expect(page.getByLabel('Part number',{exact:true})).toBeFocused();
});

for(const sourceVersion of [1,2] as const)for(const colorScheme of ['light','dark'] as const)test(`320px ${colorScheme} generator ${sourceVersion} upgrades directly with keyboard confirmation and saved replay`,async({page})=>{
  test.setTimeout(120000);await page.setViewportSize({width:320,height:800});await page.emulateMedia({colorScheme});await page.goto('/');await page.locator('.settings-drawer > summary').press('Enter');
  const old:DesignDefinition=sourceVersion===1
    ?{modelSchemaVersion:1,generatorVersion:1,parameters:{...DEFAULT_PARAMETERS,width:100,height:100,seed:5000,topRatio:.37}}
    :{modelSchemaVersion:2,generatorVersion:2,parameters:{...DEFAULT_PARAMETERS_V2,width:100,height:100,seed:5000,topRatio:.37}};
  await load(page,old);const original=await save(page);
  await page.getByRole('button',{name:'Preview upgrade to generator 3'}).press('Enter');await expect(page.getByRole('button',{name:'Confirm upgrade'})).toBeVisible({timeout:30000});
  await expect(page.getByLabel('Model status')).toContainText('4 part identities matched');await expect(page.getByRole('button',{name:'Export STEP',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Cancel upgrade',exact:true}).press('Enter');expect(await save(page)).toEqual(original);
  await page.getByRole('button',{name:'Preview upgrade to generator 3'}).press('Enter');await page.getByRole('button',{name:'Confirm upgrade'}).press('Enter');
  await expect(page.getByLabel('Top size (%)',{exact:true})).toHaveValue('37');await expect(page.getByLabel('Surface amplitude (mm)',{exact:true})).toHaveValue('0');
  await expect(page.getByLabel('Side curvature',{exact:true})).toHaveValue('1');const upgraded=parseVersionedDesign(await save(page));expect(upgraded.generatorVersion).toBe(3);
  await load(page,upgraded);expect(parseVersionedDesign(await save(page))).toEqual(upgraded);
  await load(page,old);expect(await save(page)).toEqual(original);
});

test('curved generator 3 downloads STEP, STL and 3MF only on explicit actions',async({page})=>{
  test.setTimeout(120000);let downloads=0;page.on('download',()=>downloads++);
  await page.goto('/');await page.locator('.settings-drawer > summary').click();await load(page,{...small,parameters:{...small.parameters,stepBlend:0}});
  expect(downloads).toBe(0);
  for(const format of ['STEP','STL','3MF']){
    const promise=page.waitForEvent('download');await page.getByRole('button',{name:`Export ${format}`,exact:true}).click();
    const download=await promise;expect(await download.failure()).toBeNull();const bytes=await readFile((await download.path())!);
    if(format==='STEP'){expect(bytes.toString()).toContain('wa-g3-s:');expect(bytes.toString().match(/MANIFOLD_SOLID_BREP\s*\(/g)).toHaveLength(4);}
    else if(format==='STL'){
      const mesh=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
      try{mesh.computeBoundingBox();expect(mesh.boundingBox!.max.z).toBeGreaterThan(30);expect(mesh.boundingBox!.min.z).toBeCloseTo(0,4);}finally{mesh.dispose();}
    }else{const xml=strFromU8(unzipSync(bytes)['3D/3dmodel.model']);expect(xml.match(/<object /g)).toHaveLength(4);expect(xml).toContain('partnumber="wa-g3-s:');expect(xml).toContain('unit="millimeter"');}
    await page.getByRole('button',{name:'Release downloaded file'}).click();await expect(page.getByRole('button',{name:'Export STL',exact:true})).toBeEnabled();
  }
  expect(downloads).toBe(3);
});
