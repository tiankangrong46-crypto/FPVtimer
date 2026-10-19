import { valueOf, type ValidInput } from './types';

// Published examples only, never a universal wheelbase-to-propeller conversion.
// Primary sources and limited scope: docs/FRAME-SIZES-0.7.0.md.
export const frameSizeExamples = [
  { wheelbaseMm:144, propellerIn:3 },
  { wheelbaseMm:160, propellerIn:3.5 },
  { wheelbaseMm:225, propellerIn:5.1 },
] as const;
export function frameFit(input: ValidInput): { allowed:boolean; note:string } {
  const limitReading=input.readings.frameMaxProp;
  if(limitReading.kind==='invalid')return {allowed:false,note:'机架允许最大桨径无效，无法核对尺寸；请修正或明确填未知。'};
  const diameter=valueOf(input,'diameter'),limit=valueOf(input,'frameMaxProp');
  if(limit===null)return {allowed:true,note:'机架允许最大桨径未知，未核实安装适配；轴距不能唯一确定可装桨径。'};
  if(diameter===null)return {allowed:false,note:'已填写机架最大桨径，但实际桨径未知；不能从桨型号猜测安装适配。'};
  return diameter>limit
    ? {allowed:false,note:`桨径${diameter}英寸超过机架允许最大桨径${limit}英寸，停止该配置理论估算。`}
    : {allowed:true,note:`桨径${diameter}英寸不超过用户填报机架上限${limit}英寸；只核对直径上限，不证明所有安装间隙足够。`};
}
