/** Version-tagged text drafts preserve invalid entries without changing accepted CAD. */
import { PARAMETER_NAMES } from '../model/parameters.ts';
import { NUMERIC_NAMES_V2,PARAMETER_NAMES_V2 } from '../model/parameters-v2.ts';
import { validateDesignDefinition,type DesignDefinition } from '../model/definition.ts';
import { DesignError } from '../model/budget.ts';
export type DefinitionDrafts=Record<string,string>;
export function definitionDrafts(definition:DesignDefinition):DefinitionDrafts {
  return Object.fromEntries(Object.entries(definition.parameters).map(([key,value])=>[key,String(value)]));
}
export function parseDefinitionDrafts(drafts:DefinitionDrafts,version:1|2):DesignDefinition {
  const parameters:Record<string,unknown>={};
  for(const name of version===1?PARAMETER_NAMES:PARAMETER_NAMES_V2){
    const text=drafts[name]??'';
    if((NUMERIC_NAMES_V2 as readonly string[]).includes(name)){
      if(!text.trim())throw new DesignError('REQUIRED','Enter a number.',name);
      parameters[name]=Number(text);
    }else if(name==='orientationMark'||name==='straightBoundary'){
      if(text!=='true'&&text!=='false')throw new DesignError('PARAMETER','Choose true or false.',name);
      parameters[name]=text==='true';
    }else parameters[name]=text;
  }
  return validateDesignDefinition({modelSchemaVersion:version,generatorVersion:version,parameters});
}
