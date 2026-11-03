// First real 512-part native checkpoint. Keep synthetic timing evidence separate.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { monitorBrowserMemory } from './browser-memory-sampler.mjs';
import { LIMITS_V2 } from '../src/tools/wall-art/model/validation-v2.ts';
import { DEFAULT_PARAMETERS_V2 } from '../src/tools/wall-art/model/parameters-v2.ts';
import { validateParametersV2 } from '../src/tools/wall-art/model/validation-v2.ts';

const out=resolve('artifacts/wall-art-layouts/real-geometry-fixture');
if(process.argv.includes('--build-only')){
  const {build}=await import('vite');
    await build({configFile:false,root:resolve('tests/fixtures/real-layout-profile'),publicDir:false,esbuild:{jsx:'automatic'},worker:{format:'es'},build:{outDir:out,emptyOutDir:true}});
}else{
  const parameters=validateParametersV2({...DEFAULT_PARAMETERS_V2,
    width:Number(process.env.LAYOUT_WIDTH??1600),height:Number(process.env.LAYOUT_HEIGHT??800),
    outline:process.env.LAYOUT_OUTLINE??'rectangle',layout:process.env.LAYOUT_KIND??'square',
    topRatio:Number(process.env.LAYOUT_TOP_RATIO??DEFAULT_PARAMETERS_V2.topRatio),
    reliefHeight:Number(process.env.LAYOUT_RELIEF??DEFAULT_PARAMETERS_V2.reliefHeight)});
  const replacement=process.env.LAYOUT_REPLACEMENT==='1';
  const rendering=process.env.LAYOUT_RENDER==='1';
  const formats=(process.env.LAYOUT_EXPORTS??'').split(',').filter(Boolean);
  if(formats.some(format=>!['step','stl','3mf'].includes(format)))throw Error('LAYOUT_EXPORTS must contain step,stl,3mf');
  const runID=`real-${parameters.outline}-${parameters.layout}-${parameters.width}x${parameters.height}${replacement?'-replacement':''}${rendering?'-render':''}-${new Date().toISOString().replace(/[:.]/g,'-')}`;
  const replacementParameters=replacement?validateParametersV2({...parameters,reliefHeight:parameters.reliefHeight===20?21:20}):null;
  await new Promise((accept,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--build-only'],{stdio:'inherit'});
    child.once('error',reject);child.once('exit',code=>code===0?accept():reject(Error(`Build exited ${code}`)));
  });
  const server=createServer(async(request,response)=>{
    try{
      const name=decodeURIComponent(new URL(request.url,'http://localhost').pathname),path=resolve(out,`.${name==='/'?'/index.html':name}`);
      if(!path.startsWith(out+sep)||!(await stat(path)).isFile()){response.writeHead(404).end();return;}
      response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'})[extname(path)]??'application/octet-stream');
      createReadStream(path).on('error',()=>response.destroy()).pipe(response);
    }catch{response.writeHead(404).end();}
  });
  let browser,memory,result,lastProgress,profile,context;
  const browserErrors=[];
  try{
    await new Promise((accept,reject)=>{server.once('error',reject);server.listen(6773,'127.0.0.1',accept);});
    const launch={channel:'chromium',headless:false,args:['--use-angle=d3d11','--force-low-power-gpu']};
    if(formats.length){
      profile=await mkdtemp(resolve('artifacts/wall-art-layouts/real-export-profile-'));
      context=await chromium.launchPersistentContext(profile,{...launch,acceptDownloads:true});browser=context.browser();
    }else browser=await chromium.launch(launch);
    const page=context?await context.newPage():await browser.newPage();page.setDefaultTimeout(130_000);
    page.on('pageerror',error=>browserErrors.push(String(error)));
    page.on('console',message=>{if(message.type()==='error')browserErrors.push(message.text());});
    await page.exposeFunction('layoutProbeProgress',value=>{lastProgress=value;});
    await page.exposeFunction('exportProbeProgress',value=>{lastProgress={stage:'export',...value};});
    const query=new URLSearchParams();if(rendering)query.set('render','');if(formats.length)query.set('exports','');
    await page.goto(`http://127.0.0.1:6773?${query}`);await page.waitForFunction(()=>typeof window.profileRealLayout==='function');
    memory=monitorBrowserMemory(await browser.newBrowserCDPSession(),LIMITS_V2.workerPeakBytes,()=>browser.close());
    result=await page.evaluate(parameters=>window.profileRealLayout(parameters),parameters);
    if(rendering){
      result.previewDOM=await page.evaluate(()=>({html:document.getElementById('preview').innerHTML.slice(0,3000),canvas:[...document.querySelectorAll('canvas')].map(canvas=>({width:canvas.width,height:canvas.height,rect:canvas.getBoundingClientRect().toJSON(),context:Boolean(canvas.getContext('webgl2'))}))}));
      result.screenshot=resolve('artifacts/wall-art-layouts',`${runID}.png`);
      await page.screenshot({path:result.screenshot});
    }
    if(replacement&&!result.failure){
      const initial=result;
      try {
        const changed=await page.evaluate(parameters=>window.profileRealLayout(parameters),replacementParameters);
        result={initial,replacement:changed,failure:changed.failure};
      } catch(error){result={initial,failure:String(error),lastProgress};}
    }
    if(formats.length&&!result.failure){
      result.exports=[];result.persistentProfile=true;
      for(const format of formats){
        try{
          const ready=await page.evaluate(format=>window.exportRealLayout(format),format);
          const name=`${runID}.${format}`,path=resolve('artifacts/wall-art-layouts',name);
          const event=page.waitForEvent('download');
          await page.evaluate(({id,name})=>window.downloadRealExport(id,name),{id:ready.id,name});
          const download=await event;await download.saveAs(path);
          if(await download.failure()||(await stat(path)).size!==ready.bytes)throw Error('Real export download failed');
          const inspection=format==='step'?undefined:await page.evaluate(({id,format})=>window.inspectRealMeshExport(id,format),{id:ready.id,format});
          await page.evaluate(id=>window.releaseRealExport(id),ready.id);
          result.exports.push({format,...ready,path,inspection});
        }catch(error){result.failure=String(error);result.lastProgress=lastProgress;break;}
      }
    }
  }catch(error){result={failure:String(error),lastProgress};}
  finally{
    if(memory){result.memory=await memory.stop();if(result.memory.failure)result.failure=result.memory.failure;}
    await browser?.close();server.closeAllConnections();await new Promise(accept=>server.close(accept));
    if(profile)await rm(profile,{recursive:true,force:true});
    result.parameters=parameters;
    if(browserErrors.length)result.browserErrors=browserErrors;
    if(replacement)result.replacementParameters=replacementParameters;
    const filename=resolve('artifacts/wall-art-layouts',`${runID}.json`);
    await writeFile(filename,JSON.stringify(result,null,2));
    const summary=run=>run?{...run,reports:run.reports?.length}:undefined;
    console.log(JSON.stringify({...summary(result),initial:summary(result.initial),replacement:summary(result.replacement),evidence:filename}));
  }
  if(result.failure)throw Error('Real geometry checkpoint failed; see retained evidence');
}
