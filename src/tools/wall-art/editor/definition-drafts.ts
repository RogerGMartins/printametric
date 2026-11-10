/** Version-tagged text drafts preserve invalid entries without changing accepted CAD. */
import { PARAMETER_NAMES } from '../model/parameters.ts';
import { NUMERIC_NAMES_V2,PARAMETER_NAMES_V2 } from '../model/parameters-v2.ts';
import { NUMERIC_NAMES_V3,PARAMETER_NAMES_V3,BOOLEAN_NAMES_V3 } from '../model/parameters-v3.ts';
import { validateDesignDefinition,type DesignDefinition } from '../model/definition.ts';
import { DesignError } from '../model/budget.ts';
export type DefinitionDrafts=Record<string,string>;
/** Decimal shifting avoids a multiply/divide rounding change when an untouched
 * imported ratio is displayed as a percentage and submitted again. */
function shiftDecimal(text:string,places:number):string {
  const match=/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(text.trim());
  if(!match||!(match[2]||match[3])||!Number.isFinite(Number(text)))return text;
  const digits=(match[2]??'')+(match[3]??''),point=(match[2]?.length??0)+Number(match[4]??0)+places;
  if(Math.abs(point)>400)return String(Number(text)*10**places);
  return (match[1]+(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point))).replace(/^([+-]?)0+(?=\d)/,'$1');
}
export function definitionDrafts(definition:DesignDefinition):DefinitionDrafts {
  return Object.fromEntries(Object.entries(definition.parameters).map(([key,value])=>[key,
    definition.generatorVersion===3&&['topRatio','stepBlend'].includes(key)?shiftDecimal(String(value),2):String(value)]));
}
export function parseDefinitionDrafts(drafts:DefinitionDrafts,version:1|2|3):DesignDefinition {
  const parameters:Record<string,unknown>={};
  for(const name of version===1?PARAMETER_NAMES:version===2?PARAMETER_NAMES_V2:PARAMETER_NAMES_V3){
    const text=drafts[name]??'';
    if(((version===3?NUMERIC_NAMES_V3:NUMERIC_NAMES_V2) as readonly string[]).includes(name)){
      if(!text.trim())throw new DesignError('REQUIRED','Enter a number.',name);
      const percentage=version===3&&['topRatio','stepBlend'].includes(name);
      if(percentage&&(!Number.isFinite(Number(text))||Number(text)<(name==='topRatio'?10:0)||Number(text)>100))
        throw new DesignError('PARAMETER',`${name==='topRatio'?'Top size':'Top blend'} must be ${name==='topRatio'?'10':'0'}–100%.`,name);
      parameters[name]=Number(percentage?shiftDecimal(text,-2):text);
    }else if((BOOLEAN_NAMES_V3 as readonly string[]).includes(name)){
      if(text!=='true'&&text!=='false')throw new DesignError('PARAMETER','Choose true or false.',name);
      parameters[name]=text==='true';
    }else parameters[name]=text;
  }
  return validateDesignDefinition({modelSchemaVersion:version,generatorVersion:version,parameters});
}
