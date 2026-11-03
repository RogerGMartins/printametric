/** Version dispatch and atomic accepted designs. Generator 1 keeps its original
 * worker path; generator 2 retains immutable archives outside disposable heaps. */
import type { ExportFormat,ModelResult } from '../../../shared/geometry/types.ts';
import { DesignError, LIMITS } from '../model/budget.ts';
import { definitionDigest,validateDesignDefinition,type DesignDefinition } from '../model/definition.ts';
import { DEFAULT_PARAMETERS_V2 } from '../model/parameters-v2.ts';
import { generateLayout,type LayoutHost,type LayoutProgress } from '../geometry/layout-coordinator.ts';
import type { LayoutSnapshot } from '../geometry/batch-protocol.ts';
import type { WorkerPort } from '../geometry/protocol.ts';
import { WallArtClient } from './worker-client.ts';
import type { exportLayout } from './layout-export.ts';

export interface AcceptedDefinition {
  definition:DesignDefinition;result:ModelResult;originalBytes:Uint8Array|null;layout:LayoutSnapshot|null;
}
export interface DesignSnapshot {
  accepted:AcceptedDefinition|null;status:'starting'|'generating'|'ready'|'recovering'|'failed';
  error:{code:string;message:string;field?:string}|null;exporting:ExportFormat|null;
  progress:LayoutProgress|null;upgrade:LayoutSnapshot|null;acknowledgedKey:string;
}
export type LayoutDownload=Awaited<ReturnType<typeof exportLayout>>;
export interface DesignClientHost extends LayoutHost {
  createLegacy:()=>WorkerPort;
  exportLayout:typeof exportLayout;
  download:(data:Uint8Array<ArrayBuffer>|LayoutDownload,format:ExportFormat,revision:number)=>void;
}
type Candidate={definition:DesignDefinition;originalBytes:Uint8Array|null;upgrade:boolean};
export class DesignClient {
  snapshot:DesignSnapshot={accepted:null,status:'starting',error:null,exporting:null,progress:null,upgrade:null,acknowledgedKey:''};
  private generation:AbortController|null=null;
  private exporting:AbortController|null=null;
  private legacy:WallArtClient|null=null;
  private legacyListening=false;
  private sequence=0;
  private revision=0;
  private disposed=false;
  private queued:Candidate|null=null;
  private pending:Candidate|null=null;
  private readonly host:DesignClientHost;
  private readonly changed:(snapshot:DesignSnapshot)=>void;
  constructor(host:DesignClientHost,changed:(snapshot:DesignSnapshot)=>void){this.host=host;this.changed=changed;}
  private publish(patch:Partial<DesignSnapshot>){if(this.disposed)return;this.snapshot={...this.snapshot,...patch};this.changed(this.snapshot);}
  start(){this.submit({modelSchemaVersion:2,generatorVersion:2,parameters:{...DEFAULT_PARAMETERS_V2}});}
  submit(value:unknown,originalBytes:Uint8Array|null=null,upgrade=false){
    const definition=validateDesignDefinition(value),candidate={definition,originalBytes,upgrade};
    if(this.disposed)return;
    if(this.pending&&definitionDigest(this.pending.definition)===definitionDigest(definition)&&this.pending.originalBytes===originalBytes&&this.pending.upgrade===upgrade)return;
    if(this.exporting||this.snapshot.exporting){this.queued=candidate;return;}
    this.run(candidate);
  }
  private accept(candidate:Candidate,result:ModelResult,layout:LayoutSnapshot|null){
    const ack=layout?.exclusionKey===this.snapshot.accepted?.layout?.exclusionKey?this.snapshot.acknowledgedKey:'';
    this.pending=null;
    if(layout){this.legacyListening=false;this.legacy?.dispose();this.legacy=null;}
    this.publish({accepted:{definition:candidate.definition,result,originalBytes:candidate.originalBytes,layout},status:'ready',error:null,progress:null,upgrade:null,acknowledgedKey:ack});
  }
  private run(candidate:Candidate){
    const sequence=++this.sequence;this.generation?.abort();this.generation=null;
    this.pending=candidate;this.legacyListening=false;
    this.publish({status:'generating',error:null,progress:null,upgrade:null});
    if(candidate.definition.generatorVersion===1){
      // Retain an existing v1 worker only when it owns the accepted v1 design.
      if(!this.legacy){
        const client=new WallArtClient(this.host.createLegacy,state=>{
          if(this.disposed||!this.legacyListening)return;
          if(state.accepted&&state.status==='ready'&&!state.error&&this.pending?.definition.generatorVersion===1&&
            state.accepted.result.digest===definitionDigest(this.pending.definition)&&state.accepted.originalBytes===this.pending.originalBytes)
            this.accept(this.pending,state.accepted.result,null);
          else if(state.error){this.pending=null;this.publish({status:this.snapshot.accepted?'ready':'failed',error:state.error,exporting:null});}
          else {
            if(state.accepted&&state.status==='ready'&&!this.pending&&this.snapshot.accepted?.definition.generatorVersion===1)
              this.publish({accepted:{...this.snapshot.accepted,result:state.accepted.result}});
            this.publish({status:state.status,exporting:state.exporting});
          }
          if(!state.exporting&&this.queued)this.pump();
        },(bytes,format,revision)=>this.host.download(bytes,format,revision));
        this.legacy=client;client.start();
      }
      this.legacyListening=true;
      try {this.legacy.submit(candidate.definition.parameters,candidate.originalBytes);}
      catch(error){this.fail(error);}
      return;
    }
    const controller=new AbortController();this.generation=controller;
    const old=this.snapshot.accepted;
    const reservedBytes=old&&!old.layout?LIMITS.memoryBytes+old.result.budget.wasmBytes+old.result.budget.meshBytes*4:0;
    const host={...this.host,reservedBytes,progress:(progress:LayoutProgress)=>{if(sequence===this.sequence&&!controller.signal.aborted)this.publish({progress});}};
    void generateLayout(candidate.definition.parameters,++this.revision,this.snapshot.accepted?.layout??null,host,controller.signal).then(layout=>{
      if(this.disposed||sequence!==this.sequence)return;
      this.generation=null;this.pending=null;
      if(candidate.upgrade)this.publish({upgrade:layout,status:'ready',progress:null});
      else this.accept(candidate,layout.result,layout);
    }).catch(error=>{if(!this.disposed&&sequence===this.sequence){this.generation=null;this.fail(error);}});
  }
  private fail(error:unknown){this.pending=null;this.publish({status:this.snapshot.accepted?'ready':'failed',progress:null,
    error:{code:error instanceof DesignError?error.code:'CAD',message:error instanceof Error?error.message:'CAD failed.',...(error instanceof DesignError&&error.field?{field:error.field}:{})}});}
  confirmUpgrade(){
    const layout=this.snapshot.upgrade;
    if(!layout||this.snapshot.accepted?.definition.generatorVersion!==1)return;
    this.accept({definition:{modelSchemaVersion:2,generatorVersion:2,parameters:layout.parameters},originalBytes:null,upgrade:false},layout.result,layout);
  }
  cancelGeneration(){
    ++this.sequence;this.queued=null;this.pending=null;this.generation?.abort();this.generation=null;
    if(this.legacyListening&&this.legacy&&this.snapshot.accepted?.definition.generatorVersion===1){
      this.publish({upgrade:null,progress:null,error:null,status:'recovering'});this.legacy.cancelGeneration();return;
    }
    if(this.legacyListening&&this.legacy){this.legacyListening=false;this.legacy.dispose();this.legacy=null;}
    this.publish({status:this.snapshot.accepted?'ready':'failed',upgrade:null,progress:null,error:this.snapshot.accepted?null:{code:'CANCELLED',message:'Generation cancelled. Retry when ready.'}});
  }
  acknowledge(){const layout=this.snapshot.accepted?.layout;if(layout)this.publish({acknowledgedKey:layout.exclusionKey});}
  clearError(){this.publish({error:null});}
  retry(){const definition=this.snapshot.accepted?.definition??{modelSchemaVersion:2 as const,generatorVersion:2 as const,parameters:{...DEFAULT_PARAMETERS_V2}};
    if(definition.generatorVersion===1){this.legacy?.dispose();this.legacy=null;}
    this.submit(definition,this.snapshot.accepted?.originalBytes??null);}
  export(format:ExportFormat){
    const accepted=this.snapshot.accepted;
    if(!accepted||this.pending||this.snapshot.upgrade||this.snapshot.error||this.snapshot.status!=='ready'||this.snapshot.exporting)return;
    if(!accepted.layout){this.legacyListening=true;this.legacy?.export(format);return;}
    const controller=new AbortController();this.exporting=controller;
    this.publish({exporting:format});
    void this.host.exportLayout(accepted.layout,format,this.snapshot.acknowledgedKey,this.host,controller.signal).then(download=>{
      if(this.disposed||controller.signal.aborted){void download.release();return;}
      try {this.host.download(download,format,accepted.result.revision);}
      catch(error){void download.release();throw error;}
    }).catch(error=>{if(!this.disposed&&!controller.signal.aborted)this.fail(error);}).finally(()=>{
      if(this.exporting===controller){this.exporting=null;this.publish({exporting:null});this.pump();}
    });
  }
  private pump(){const candidate=this.queued;this.queued=null;if(candidate&&!this.disposed)this.run(candidate);}
  cancelExport(){this.queued=null;this.exporting?.abort();if(this.legacyListening)this.legacy?.cancelExport();}
  dispose(){this.disposed=true;++this.sequence;this.generation?.abort();this.exporting?.abort();this.legacy?.dispose();this.queued=null;}
}
