/** React owns drafts and download controls; DesignClient owns accepted revisions. */
import { useEffect,useRef,useState } from 'react';
import { downloadBytes } from '../../../shared/export/download.ts';
import { DEFAULT_PARAMETERS_V2 } from '../model/parameters-v2.ts';
import { definitionDigest,type DesignDefinition } from '../model/definition.ts';
import { parseVersionedDesign,serializeVersionedDesign } from '../model/design-file.ts';
import { proposeUpgrade } from '../model/migrate-v1.ts';
import { DesignError,LIMITS } from '../model/budget.ts';
import { DesignClient,type DesignSnapshot,type LayoutDownload } from './design-client.ts';
import { createLayoutHost } from './layout-host.ts';
import { exportLayout } from './layout-export.ts';
import { definitionDrafts,parseDefinitionDrafts } from './definition-drafts.ts';

const initial:DesignDefinition={modelSchemaVersion:2,generatorVersion:2,parameters:{...DEFAULT_PARAMETERS_V2}};
export function useWallArt(){
  const [snapshot,setSnapshot]=useState<DesignSnapshot>({accepted:null,status:'starting',error:null,exporting:null,progress:null,upgrade:null,acknowledgedKey:''});
  const [drafts,setDrafts]=useState(()=>definitionDrafts(initial)),[version,setVersion]=useState<1|2>(2);
  const [inputError,setInputError]=useState<{message:string;field?:string}|null>(null),[loadingFile,setLoadingFile]=useState(false);
  const [downloadHeld,setDownloadHeld]=useState(false);
  const downloadRef=useRef<{download:LayoutDownload;url:string}|null>(null);
  const client=useRef<DesignClient|null>(null),pendingImport=useRef<Uint8Array|null>(null),loadSequence=useRef(0);
  const draftRef=useRef(drafts);draftRef.current=drafts;
  const versionRef=useRef(version);versionRef.current=version;
  function apply(definition:DesignDefinition){const next=definitionDrafts(definition);draftRef.current=next;versionRef.current=definition.generatorVersion;setDrafts(next);setVersion(definition.generatorVersion);setInputError(null);}
  function report(error:unknown){setInputError({message:error instanceof Error?error.message:'The design could not be loaded.',...(error instanceof DesignError&&error.field?{field:error.field}:{})});}
  useEffect(()=>{
    const controller=new DesignClient({...createLayoutHost(),createLegacy:()=>new Worker(new URL('../geometry/worker.ts',import.meta.url),{type:'module'}),exportLayout,
      download(data,format,revision){
        const name=`wall-art-r${revision}-mm.${format==='3mf'?'model.3mf':format}`;
        if(data instanceof Uint8Array){downloadBytes(data,name,format==='3mf'?'model/3mf':'application/octet-stream');return;}
        const url=URL.createObjectURL(data.file),anchor=document.createElement('a');anchor.href=url;anchor.download=name;
        document.body.append(anchor);anchor.click();anchor.remove();downloadRef.current={download:data,url};setDownloadHeld(true);
      }},state=>{
        setSnapshot(state);
        if(pendingImport.current&&state.accepted?.originalBytes===pendingImport.current){apply(state.accepted.definition);pendingImport.current=null;}
        else if(state.error)pendingImport.current=null;
      });
    client.current=controller;controller.start();
    return()=>{loadSequence.current++;controller.dispose();if(client.current===controller)client.current=null;
      const held=downloadRef.current;downloadRef.current=null;if(held){URL.revokeObjectURL(held.url);void held.download.release().catch(()=>{});}};
  },[]);
  function change(name:string,value:string){loadSequence.current++;setLoadingFile(false);pendingImport.current=null;const next={...draftRef.current,[name]:value};draftRef.current=next;setDrafts(next);}
  function commit(){try{
    const definition=parseDefinitionDrafts(draftRef.current,versionRef.current);setInputError(null);
    if(definitionDigest(definition)===snapshot.accepted?.result.digest&&snapshot.status==='ready'){client.current?.clearError();return;}
    client.current?.submit(definition);
  }catch(error){report(error);}}
  async function load(file:File|undefined){if(!file)return;const sequence=++loadSequence.current;setLoadingFile(true);
    try{if(file.size>LIMITS.fileBytes)throw new DesignError('FILE_SIZE','Design files must be at most 1 MiB.');
      const bytes=new Uint8Array(await file.arrayBuffer());if(sequence!==loadSequence.current)return;
      const definition=parseVersionedDesign(bytes);pendingImport.current=bytes;client.current?.submit(definition,bytes);setInputError(null);
    }catch(error){if(sequence===loadSequence.current){pendingImport.current=null;report(error);}}
    finally{if(sequence===loadSequence.current)setLoadingFile(false);}}
  function revert(){loadSequence.current++;setLoadingFile(false);pendingImport.current=null;client.current?.cancelGeneration();apply(snapshot.accepted?.definition??initial);}
  let validDraft:DesignDefinition|null=null;try{validDraft=parseDefinitionDrafts(drafts,version);}catch{/* Keep invalid text editable. */}
  const dirty=!validDraft||definitionDigest(validDraft)!==snapshot.accepted?.result.digest;
  const ready=Boolean(snapshot.accepted&&snapshot.status==='ready'&&!snapshot.exporting&&!snapshot.error&&!inputError&&!dirty&&!loadingFile&&!snapshot.upgrade);
  const exportReady=ready&&!downloadHeld&&(!snapshot.accepted?.layout?.exclusionKey||snapshot.acknowledgedKey===snapshot.accepted.layout.exclusionKey);
  function save(ungenerated=false){try{
    const definition=ungenerated?parseDefinitionDrafts(draftRef.current,versionRef.current):snapshot.accepted?.definition;
    if(!definition||(!ungenerated&&!ready))return;
    const bytes=!ungenerated&&snapshot.accepted?.originalBytes?snapshot.accepted.originalBytes:serializeVersionedDesign(definition);
    downloadBytes(new Uint8Array(bytes),`wall-art${ungenerated?'-ungenerated':''}.json`,'application/json');
  }catch(error){report(error);}}
  async function releaseDownload(){const held=downloadRef.current;if(!held)return;
    try{await held.download.release();URL.revokeObjectURL(held.url);downloadRef.current=null;setDownloadHeld(false);}
    catch(error){report(error);}}
  function upgrade(){const accepted=snapshot.accepted;if(accepted?.definition.generatorVersion===1)client.current?.submit(proposeUpgrade(accepted.definition.parameters),null,true);}
  function confirmUpgrade(){const candidate=snapshot.upgrade;if(!candidate)return;client.current?.confirmUpgrade();apply({modelSchemaVersion:2,generatorVersion:2,parameters:candidate.parameters});}
  return {snapshot,drafts,version,inputError,loadingFile,dirty,ready,exportReady,validDraft,downloadHeld,change,commit,load,revert,save,releaseDownload,upgrade,confirmUpgrade,
    shortcut:(width:number,height:number)=>{change('width',String(width));change('height',String(height));commit();},
    acknowledge:()=>client.current?.acknowledge(),exportModel:(format:'step'|'stl'|'3mf')=>{if(exportReady)client.current?.export(format);},
    retry:()=>client.current?.retry(),cancelExport:()=>client.current?.cancelExport()};
}
export type WallArtEditor=ReturnType<typeof useWallArt>;
