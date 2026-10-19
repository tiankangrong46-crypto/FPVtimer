import type { EnduranceReference } from '../data/references';
import { knownText, valueOf, type ValidInput, type Rating } from './types';
export function median(values: readonly number[]): number | null {
  if (!values.length || values.some(v=>!Number.isFinite(v)||v<=0)) return null;
  const sorted=[...values].sort((a,b)=>a-b), i=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[i] : (sorted[i-1]+sorted[i])/2;
}
export function classifyDuration(seconds: number, range: readonly [number,number]): Rating {
  if (![seconds,...range].every(v=>Number.isFinite(v)&&v>0)||range[0]>range[1]) return '参考不足';
  return seconds<range[0]?'偏短':seconds>range[1]?'较长':'正常';
}
const forbiddenReferenceInputs=new Set(['minutes','seconds','durationSeconds','current','consumed','availableCapacity','availableEnergy','benchData']);
export function conditionsMatch(input:ValidInput, conditions:EnduranceReference['conditions']):boolean {
  return Object.keys(conditions).length>0 && Object.entries(conditions).every(([key,expected])=>{
    if(forbiddenReferenceInputs.has(key))return false;
    const actual = key in input.readings ? valueOf(input,key as keyof ValidInput['readings']) : input[key as keyof ValidInput];
    if(actual===null||actual===undefined||(typeof actual==='string'&&!knownText(actual)))return false;
    if(typeof expected==='object')return typeof actual==='number' && Number.isFinite(expected.min)&&Number.isFinite(expected.max)&&expected.min<=expected.max&&actual>=expected.min&&actual<=expected.max;
    return (typeof expected!=='string'||knownText(expected))&&actual===expected;
  });
}
const requiredConditions=['aircraft','configurationGroup','weight','motor','kv','propModel','chemistry','capacity','cells','style','startVoltage','endVoltage','startDelay','landingDelay','temperature','wind'];
export function matchingReferences(input:ValidInput, refs:readonly EnduranceReference[]):EnduranceReference[] {
  return refs.filter(ref=>ref.evidence==='independent-flight-records'&&ref.origin==='real-measurement'&&ref.status==='reviewed'&&
    [ref.id,ref.url,ref.version,ref.measurementConditions,ref.scope].every(knownText)&&
    requiredConditions.every(key=>key in ref.conditions)&&conditionsMatch(input,ref.conditions)&&
    median(ref.records.map(r=>r.seconds))!==null&&ref.records.every(r=>knownText(r.id))&&new Set(ref.records.map(r=>r.id)).size===ref.records.length);
}
export function independentlyValidatedRange(ref:EnduranceReference):[number,number]|null {
  const r=ref.validatedRange;
  if(!r||r.status!=='independently-validated'||r.sampleAdequacy!=='documented-sufficient'||![r.source,r.method,r.adequacyBasis].every(knownText))return null;
  if(!r.validationRecordIds.length||new Set(r.validationRecordIds).size!==r.validationRecordIds.length||r.validationRecordIds.some(id=>!knownText(id)||ref.records.some(record=>record.id===id)))return null;
  return classifyDuration(1,[r.minSeconds,r.maxSeconds])==='参考不足'?null:[r.minSeconds,r.maxSeconds];
}
