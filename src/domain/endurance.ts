import { enduranceReferences, styleCalibrations, type EnduranceReference, type StyleCalibration } from '../data/references';
import { interpolateElectricalPower, perMotorHoverThrust, timeFromEnergy } from './bench';
import { classifyDuration, conditionsMatch, independentlyValidatedRange, matchingReferences, median } from './reference';
import { knownText, valueOf, type Detail, type Rating, type ResultKind, type ValidInput } from './types';
import type { CategoryBenchResult } from './category-bench';
import { frameFit } from './frame-fit';

export interface EnduranceData { flights:readonly EnduranceReference[]; calibrations:readonly StyleCalibration[] }
export const bundledData:EnduranceData={flights:enduranceReferences,calibrations:styleCalibrations};
export interface EnduranceDecision {
  rating:Rating;kind:ResultKind;timeMinutes:number|null;timeLabel:string;referenceSeconds:[number,number]|null;
  observedRangeSeconds:[number,number]|null;reason:string;details:Detail[];notices:string[];usedInputs:string[];
}
export function targetIntervalKnown(input:ValidInput):boolean {
  const start=valueOf(input,'targetStartVoltage'),end=valueOf(input,'targetEndVoltage');
  return start!==null&&end!==null&&start>end&&['rest','load'].includes(input.targetVoltageState)&&knownText(input.targetIntervalNote)&&input.targetApplies==='yes';
}
export function quantityKnown(input:ValidInput,kind:'capacity'|'energy'):boolean {
  return targetIntervalKnown(input)&&['measured','curve','assumed'].includes(input[kind==='capacity'?'capacityBasis':'energyBasis'])&&
    knownText(input[kind==='capacity'?'capacityNote':'energyNote'])&&
    (valueOf(input,kind==='capacity'?'availableCapacity':'availableEnergy')??0)>0;
}
export function equivalentTimeMinutes(capacityMah:number,currentA:number):number|null {
  return [capacityMah,currentA].every(v=>Number.isFinite(v)&&v>0)?0.06*capacityMah/currentA:null;
}
export function decideEndurance(input:ValidInput,averageCurrent:number|null,data:EnduranceData=bundledData,category?:CategoryBenchResult):EnduranceDecision {
  const d:EnduranceDecision={rating:'参考不足',kind:'参考不足',timeMinutes:null,timeLabel:'参考飞行时间',referenceSeconds:null,observedRangeSeconds:null,
    reason:'缺少匹配实飞参考、适用台架模型或有依据的目标可用量，暂不判断续航长短。',details:[],notices:[],usedInputs:[]};
  if(category) d.notices.push(category.status==='candidates'?`匿名同类候选的电调、装配与温度未知、无实飞验证，不能替代完整型号台架或用于评级；${input.estimateMode==='rough'?'仅新增粗估分支可按明确假设给场景时间。':'标准模式仅展示候选功率。'}`:category.message);
  if(input.aircraft!=='quad'){d.reason='本版仅适用于普通四轴穿越机，当前配置超出适用范围。';return d;}
  const refs=matchingReferences(input,data.flights);
  if(refs.length===1){
    const r=refs[0], times=r.records.map(record=>record.seconds),range=independentlyValidatedRange(r);
    d.kind='实测参考'; d.timeMinutes=median(times)!/60;d.timeLabel='参考时间（记录中位数）';d.referenceSeconds=range;
    d.observedRangeSeconds=[Math.min(...times),Math.max(...times)];
    if(range){d.rating=classifyDuration(input.durationSeconds,range);d.reason='按条件匹配、经独立数据验证的区间比较本次飞行；不代表电池健康。';}
    else d.reason=`匹配 ${times.length} 条独立记录；仅显示中位数与已有记录范围，尚不能作为正常评级阈值。`;
    d.details.push({label:'独立实飞参考',value:`${r.id} · ${r.version} · ${times.length} 条记录`,basis:`${r.url}；${r.measurementConditions}；适用范围：${r.scope}。参考中位数不使用本次飞行时间。${range?`独立验证：${r.validatedRange!.source}；${r.validatedRange!.method}；样本充分性依据：${r.validatedRange!.adequacyBasis}`:'正常评级区间未通过独立验证。'}`});
    d.usedInputs=Object.keys(r.conditions);return d;
  }
  d.notices.push(refs.length>1?'多组实飞参考同时匹配，未定义可信合并规则，跳过实测参考评级。':'没有配置、飞行方式、起降区间及时点均匹配的独立实飞记录。');

  // Model is independent of the current flight duration / q / I. It never issues a formal rating.
  if(input.benchPoints){
    const model=modelEstimate(input,data.calibrations);
    d.notices.push(...model.notices);d.details.push(...model.details);
    if(model.minutes!==null){d.kind='模型粗估';d.timeMinutes=model.minutes;d.timeLabel='估计时间（模型粗估）';d.reason='同电机桨叶台架电功率与目标可用能量的静态近似，未经整机独立验证，不用于评级。';d.usedInputs=model.used;return d;}
  }else d.notices.push('没有可用的同电机、桨叶、测试电压台架表，跳过台架模型；不采用未经核实的公开表格。');

  if(averageCurrent!==null){
    if(quantityKnown(input,'capacity')){
      const q=valueOf(input,'availableCapacity')!;
      d.kind='等效续航';d.timeMinutes=equivalentTimeMinutes(q,averageCurrent);d.timeLabel='等效续航（本次耗电强度）';
      d.reason=`保持本次平均耗电强度的等效续航${input.capacityBasis==='assumed'?'，目标容量为明确假设':''}；不是独立参考，不能据此评价本次正常。`;
      d.details.push({label:'目标可用容量与等效时间',value:`${q} mAh / ${averageCurrent.toFixed(2)} A`,basis:`t等效=0.06×Q/I平均；${input.capacityBasis==='assumed'?'假设':input.capacityBasis==='curve'?'适用电池曲线':'独立测量'}：${input.capacityNote}。目标区间${valueOf(input,'targetStartVoltage')}→${valueOf(input,'targetEndVoltage')} V（${input.targetVoltageState==='rest'?'停桨／静置':'负载'}）；${input.targetIntervalNote}。用户确认适用于本电池与目标负载/温度；平均电流保持不变是假设，不模拟电压和电流随放电变化。`});
      d.usedInputs=['availableCapacity','capacityBasis','capacityNote','targetStartVoltage','targetEndVoltage','targetVoltageState','targetIntervalNote','targetApplies','本次平均电流及其时段来源'];return d;
    }
    const percent=valueOf(input,'roughCapacityPercent');
    if(input.estimateMode==='rough'&&percent!==null&&percent>0&&percent<=100){
      const q=valueOf(input,'capacity')!*percent/100;
      d.kind='等效续航';d.timeMinutes=equivalentTimeMinutes(q,averageCurrent);d.timeLabel='等效续航（本次耗电强度）';
      d.reason=`保持本次平均耗电强度，用户假设标称容量${percent}%可用；不是独立理论参考。`;
      d.details.push({label:'本次电流等效（独立于理论参考）',value:`${d.timeMinutes!.toFixed(2)} 分钟`,basis:`用户容量比例假设${percent}%；Q=${q}mAh，I=${averageCurrent}A；t=0.06×Q/I。此信息不用于理论参考或自身评级。`});return d;
    }
    d.reason='已得到本次平均耗电强度，但目标可用容量或放电区间依据不足，不生成等效时间或正常评级。';
    d.notices.push('等效续航缺少有来源／明确假设的目标可用容量、起止电压状态、测量条件或适用性确认；不会使用标称容量的80%。');
  }else d.notices.push('电流／消耗量的校准或同一时段依据不足；填报数据可供查看，但不作为已核实耗电率或等效时间。');
  if(category?.status==='candidates'&&averageCurrent===null) d.reason='找到同类台架候选，但电调、装配等条件未知且缺独立实飞验证，不生成续航时间或确定评级。';
  return d;
}

export function modelEstimate(input:ValidInput,calibrations:readonly StyleCalibration[],scope:'strict'|'hover-baseline'='strict'){
  const notices:string[]=[],details:Detail[]=[],used:string[]=[];
  const fail=(why:string)=>({minutes:null as number|null,notices:[...notices,why],details,used});
  const fit=frameFit(input);if(!fit.allowed)return fail(fit.note);
  const group=input.configurationGroup;
  if(!['open','ducted','whoop'].includes(group)||input.benchGroup!==group||input.benchMatches!=='yes')return fail('台架模型缺少已确认的同电机、同桨叶、同测试电压和独立机型分组匹配。');
  if(!knownText(input.motor)||!knownText(input.propModel)||!knownText(input.benchSource)||!knownText(input.benchConditions)||!knownText(input.benchVersion)||!valueOf(input,'benchVoltage'))return fail('台架来源、版本、测量条件、测试电压或完整电机／桨叶型号未知，跳过模型。');
  const identity=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
  if(!knownText(input.benchMotor)||!knownText(input.benchPropModel)||identity(input.motor)!==identity(input.benchMotor)||identity(input.propModel)!==identity(input.benchPropModel)||valueOf(input,'kv')!==valueOf(input,'benchKv'))return fail('台架记录的电机型号、KV或桨叶型号与飞机配置不匹配，不能套用。');
  if(input.benchIncludesEsc!=='yes')return fail('功率须明确为包含电调的电池侧电输入功率；轴功率或未知功率定义不可直接代入。');
  if(!['gf','N'].includes(input.benchThrustUnit))return fail('台架推力单位未知，不能把g推力与N混用。');
  if(group!=='open'&&input.benchAssembly!=='installed')return fail('涵道／Whoop 需要对应装配状态的独立台架组，不能套用裸电机台架。');
  const thrust=perMotorHoverThrust(valueOf(input,'weight')!)!;
  const motorPower=interpolateElectricalPower(input.benchPoints!,thrust,input.benchThrustUnit as 'gf'|'N');
  if(motorPower===null)return fail('目标单电机推力不在台架覆盖范围内，或最高测试推力不足以覆盖目标；不外推、不生成该工况时间，也不据此断言飞机一定不能飞。');
  const aux=valueOf(input,'auxPower');
  if(aux===null||!['measured','assumed'].includes(input.auxBasis)||!knownText(input.auxNote))return fail('辅助设备功耗或其测量／假设依据未知，不能默认为0。');
  const hover=4*motorPower+aux;
  let power=hover;
  if(scope==='hover-baseline'){
    details.push({label:'台架基线适用假设',value:'仅取静态悬停功率基线',basis:'保留完整型号、电输入、装配和覆盖准入；所选工况另乘用户时间系数，不使用独立k，也不声称已匹配实际风况。'});
  }else if(input.style==='hover'){
    if(input.wind!=='calm')return fail('静态悬停模型没有有风／未知风况校准，跳过该工况时间。');
  }else{
    const matching=calibrations.filter(c=>c.status==='independently-validated'&&c.origin==='real-measurement'&&c.configurationGroup===group&&c.style===input.style&&c.definition==='total-electrical-power'&&[c.id,c.version,c.source,c.measurementConditions,c.validation?.source??'',c.validation?.method??''].every(knownText)&&c.validation.calibrationRecordIds.length>0&&c.validation.independentRecordIds.length>0&&[...c.validation.calibrationRecordIds,...c.validation.independentRecordIds].every(knownText)&&c.validation.independentRecordIds.every(id=>!c.validation.calibrationRecordIds.includes(id))&&Number.isFinite(c.multiplier)&&c.multiplier>0&&['motor','kv','propModel','cells','weight','benchVoltage','wind'].every(k=>k in c.conditions)&&conditionsMatch(input,c.conditions));
    if(matching.length!==1)return fail('该配置类别与飞行方式缺少唯一、独立实测校准的 k；不假设巡航一定比悬停耗电。');
    power=hover*matching[0].multiplier;
    details.push({label:'飞行方式独立校准',value:`k=${matching[0].multiplier}`,basis:`${matching[0].id} · ${matching[0].version}；${matching[0].source}；${matching[0].measurementConditions}。k定义为总电功率比，包含辅助设备，不能混用仅电机功率倍率。`});
  }
  details.push({label:'台架悬停功率',value:`单电机 ${thrust.toFixed(3)} N，整机 ${hover.toFixed(1)} W`,basis:`T=(起飞g/1000)×9.80665/4；仅在覆盖区间线性插值电输入功率。P悬停=4×P单电机+P辅助。台架测试 ${valueOf(input,'benchVoltage')} V；来源：${input.benchSource}；条件：${input.benchConditions}；辅助功耗${aux}W（${input.auxBasis}：${input.auxNote}）。不包含未经验证的整机气流干扰修正。`});
  if(!quantityKnown(input,'energy'))return fail('目标可用能量Wh、起止区间或测量／假设依据不足，不能从标称容量或电压差补算。');
  const energy=valueOf(input,'availableEnergy')!;
  const minutes=timeFromEnergy(energy,power)!;
  details.push({label:'台架能量模型',value:`${minutes.toFixed(2)} 分钟（非评级）`,basis:`t=60×${energy}Wh/${power.toFixed(3)}W；${input.energyBasis}：${input.energyNote}。目标${valueOf(input,'targetStartVoltage')}→${valueOf(input,'targetEndVoltage')}V（${input.targetVoltageState}）；${input.targetIntervalNote}。这是恒测试电压、准静态功率的近似，未模拟放电电压变化；不额外按内阻压降扣减续航。`});
  used.push('weight','motor','kv','propModel','configurationGroup','style','wind','benchData','benchVoltage','benchKv','benchMotor','benchPropModel','benchVersion','benchSource','benchConditions','benchGroup','benchMatches','benchIncludesEsc','benchAssembly','auxPower','auxBasis','auxNote','availableEnergy','energyBasis','energyNote','targetStartVoltage','targetEndVoltage','targetVoltageState','targetIntervalNote','targetApplies');
  return {minutes,notices,details,used};
}
