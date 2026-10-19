import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { blankInput,type RawInput,type ValidInput } from '../src/domain/types';
import { validate } from '../src/domain/validation';
import { analyze } from '../src/domain/analysis';
import { median,matchingReferences,independentlyValidatedRange } from '../src/domain/reference';
import { equivalentTimeMinutes } from '../src/domain/endurance';
import { interpolateElectricalPower,parseBenchData,perMotorHoverThrust,thrustToNewton,timeFromEnergy } from '../src/domain/bench';
import type { EnduranceReference,StyleCalibration } from '../src/data/references';

// All complete configurations/curves/calibrations in this file are SYNTHETIC TEST FIXTURES ONLY.
// They test branch logic and arithmetic, never actual aircraft accuracy; none is imported by src/.
const base:RawInput={...blankInput(), estimateMode: 'standard',weight:'1200',wheelbase:'225',kv:'1750',motor:'TEST motor',propModel:'TEST prop',diameter:'5.1',pitch:'3.5',blades:'3',capacity:'1300',cells:'6',minutes:'4',seconds:'30',startVoltage:'25.2',endVoltage:'22.2',landingDelay:'2',startDelay:'1',temperature:'20',wind:'calm',configurationGroup:'open'};
function valid(overrides:Partial<RawInput>={}):ValidInput{const v=validate({...base,...overrides});assert.deepEqual(v.errors,[]);assert.ok(v.input);return v.input;}
const target:Partial<RawInput>={targetStartVoltage:'25.2',targetEndVoltage:'22.2',targetVoltageState:'rest',targetIntervalNote:'TEST: same pack, resting endpoints at known times; independent discharge experiment',targetApplies:'yes'};
const current:Partial<RawInput>={current:'15',currentSource:'calibrated-flight'};
const capacity:Partial<RawInput>={...target,...current,availableCapacity:'1000',capacityBasis:'measured',capacityNote:'TEST independent usable-capacity measurement'};
const bench:Partial<RawInput>={...target,style:'hover',benchData:'200,40\n300,70\n400,110',benchMotor:'TEST motor',benchKv:'1750',benchPropModel:'TEST prop',benchVersion:'TEST-1',benchVoltage:'25.2',benchSource:'TEST fixture, not real data',benchConditions:'TEST static, same voltage on every row',benchGroup:'open',benchMatches:'yes',benchIncludesEsc:'yes',benchAssembly:'isolated',benchThrustUnit:'gf',auxPower:'10',auxBasis:'measured',auxNote:'TEST auxiliary load measurement',availableEnergy:'12',energyBasis:'measured',energyNote:'TEST independent Wh integration between endpoints'};
function flightReference():EnduranceReference{
  const i=valid(); const keys=['aircraft','configurationGroup','weight','motor','kv','propModel','chemistry','capacity','cells','style','startVoltage','endVoltage','startDelay','landingDelay','temperature','wind'];
  const conditions=Object.fromEntries(keys.map(k=>[k,k in i.readings?(i.readings[k as keyof typeof i.readings] as {value:number}).value:i[k as keyof typeof i]])) as EnduranceReference['conditions'];
  return {id:'SYNTHETIC-FLIGHT',url:'https://example.invalid/test-only',version:'TEST-1',origin:'real-measurement',status:'reviewed',evidence:'independent-flight-records',measurementConditions:'TEST only, full matching time and rest voltage conditions',scope:'TEST configuration only',conditions,records:[{id:'train-a',seconds:240},{id:'train-b',seconds:300},{id:'train-c',seconds:260}],validatedRange:{minSeconds:240,maxSeconds:300,status:'independently-validated',source:'TEST independent experiment',method:'TEST protocol, not fitted from current input',validationRecordIds:['holdout-a','holdout-b'],sampleAdequacy:'documented-sufficient',adequacyBasis:'TEST adequacy statement, not a real statistical claim'}};
}
function calibration(multiplier=0.8):StyleCalibration{return {id:'SYNTHETIC-K',version:'TEST-1',source:'TEST independent calibration experiment',status:'independently-validated',origin:'real-measurement',configurationGroup:'open',style:'cruise',definition:'total-electrical-power',measurementConditions:'TEST held-out cruise / hover measurement',multiplier,validation:{source:'TEST independent holdout dataset',method:'TEST no actual accuracy claim',calibrationRecordIds:['calibration-run'],independentRecordIds:['holdout-run']},conditions:{motor:'TEST motor',kv:1750,propModel:'TEST prop',cells:6,weight:1200,benchVoltage:25.2,wind:'calm'}};}

describe('独立实飞参考',()=>{
  it('中位数正确，不把上下界中点当成中位数',()=>{assert.equal(median([300,240,260]),260);assert.equal(median([4,2]),3);assert.equal(median([]),null);});
  it('理论比较与正式实飞评级独立，用户时间系数不改正式评级区间',()=>{const ref=flightReference();ref.conditions.style='hover';const a=analyze(valid({...bench,estimateMode:'rough'}),[ref]);assert.equal(a.kind,'实测参考');assert.equal(a.rating,'正常');assert.deepEqual(a.referenceSeconds,[240,300]);assert.ok(a.comparison);assert.equal(a.roughEstimate!.basis,'exact-bench');assert.equal(a.timeMinutes,260/60);});
  it('独立验证区间才评级；参考中位数不依赖本次时长',()=>{const ref=flightReference();const a=analyze(valid(),[ref]);assert.equal(a.kind,'实测参考');assert.equal(a.timeMinutes,260/60);assert.equal(a.rating,'正常');assert.equal(analyze(valid({minutes:'6'}),[ref]).rating,'较长');assert.equal(analyze(valid({minutes:'1'}),[ref]).timeMinutes,260/60);});
  it('少量/未经验证的记录仅显示已有范围',()=>{const r=flightReference();delete r.validatedRange;r.records=r.records.slice(0,1);const a=analyze(valid(),[r]);assert.equal(a.rating,'参考不足');assert.equal(a.kind,'实测参考');assert.deepEqual(a.observedRangeSeconds,[240,240]);assert.equal(a.referenceSeconds,null);});
  it('样本充分性未知、验证ID泄漏或未验证区间均不正式评级',()=>{for(const mutate of [(r:EnduranceReference)=>{r.validatedRange!.sampleAdequacy='unknown';},(r:EnduranceReference)=>{r.validatedRange!.validationRecordIds=['train-a'];},(r:EnduranceReference)=>{r.validatedRange!.status='unvalidated';}]){const r=flightReference();mutate(r);assert.equal(independentlyValidatedRange(r),null);assert.equal(analyze(valid(),[r]).rating,'参考不足');}});
  it('电压不匹配：非满电起飞或提前落地不能评级',()=>{const r=flightReference();for(const changes of [{startVoltage:'24'},{endVoltage:'23'},{landingDelay:'未知'},{startDelay:'未知'}])assert.equal(analyze(valid(changes),[r]).kind,'参考不足');});
  it('额外约束不能被忽略，不允许拿本次耗电或时长匹配参考',()=>{for(const conditions of [{unsupportedSpeed:8},{minutes:4},{consumed:810}]){const r=flightReference();Object.assign(r.conditions,conditions);assert.equal(matchingReferences(valid(),[r]).length,0);}});
  it('来源未知、合成数据、待核实数据不进入正式参考',()=>{for(const o of [{url:'未知'},{origin:'synthetic' as const},{status:'pending' as const}]){const r={...flightReference(),...o};assert.equal(matchingReferences(valid(),[r]).length,0);}});
  it('明确来自来源的条件区间可匹配，无自创容差',()=>{const r=flightReference();r.conditions.weight={min:1100,max:1300};assert.equal(matchingReferences(valid(),[r]).length,1);assert.equal(matchingReferences(valid({weight:'1300.1'}),[r]).length,0);});
});
describe('单位与台架模型',()=>{
  it('kg/gf/N、四轴推力和Wh/W分钟转换',()=>{assert.equal(thrustToNewton(1000,'gf'),9.80665);assert.equal(thrustToNewton(2,'N'),2);assert.equal(perMotorHoverThrust(4000),9.80665);assert.equal(timeFromEnergy(12,240),3);assert.equal(timeFromEnergy(0,240),null);});
  it('线性插值覆盖内正确，禁止外推、重复推力或非法表格',()=>{const points=parseBenchData('200,40\n400,110')!;assert.equal(interpolateElectricalPower(points,thrustToNewton(300,'gf'),'gf'),75);assert.equal(interpolateElectricalPower(points,thrustToNewton(100,'gf'),'gf'),null);assert.equal(parseBenchData('200,40\n200,50'),null);assert.equal(parseBenchData('200,-1\n300,50'),null);});
  it('四电机70W加辅助10W，共290W，12Wh得720/290分钟',()=>{const a=analyze(valid(bench));assert.equal(a.kind,'模型粗估');assert.equal(a.rating,'参考不足');assert.ok(Math.abs(a.timeMinutes!-720/290)<1e-12);});
  it('模型时间完全不使用本次飞行时间或消耗量',()=>{const a=analyze(valid(bench)),b=analyze(valid({...bench,minutes:'15',consumed:'100',consumedSource:'calibrated-flight'}));assert.equal(a.timeMinutes,b.timeMinutes);assert.equal(b.rating,'参考不足');});
  it('推力覆盖不足或过低不生成该模型工况时间',()=>{for(const weight of ['1700','600']){const a=analyze(valid({...bench,weight}));assert.equal(a.timeMinutes,null);assert.match(a.notices.join(''),/推力/);}});
  it('电机/KV/桨/机型与台架记录不匹配时拒绝',()=>{for(const changes of [{kv:'1800'},{motor:'different'},{propModel:'different'},{benchGroup:'whoop'}])assert.notEqual(analyze(valid({...bench,...changes})).kind,'模型粗估');});
  it('不能用未知或轴功率代替电输入功率',()=>{for(const benchIncludesEsc of ['unknown','no'])assert.equal(analyze(valid({...bench,benchIncludesEsc})).timeMinutes,null);});
  it('没有辅助功耗/能量/电压条件，不补0或80%',()=>{for(const changes of [{auxPower:''},{auxNote:'未知'},{availableEnergy:''},{energyBasis:'unknown'},{energyBasis:'this-flight'},{targetVoltageState:'unknown'},{targetIntervalNote:'未知'}])assert.equal(analyze(valid({...bench,...changes})).timeMinutes,null);});
  it('明确假设可产生带标签粗估；0辅助功耗与未知分开',()=>{const a=analyze(valid({...bench,auxPower:'0',auxBasis:'assumed',auxNote:'TEST explicit zero auxiliary assumption',energyBasis:'assumed'}));assert.equal(a.kind,'模型粗估');assert.ok(Math.abs(a.timeMinutes!-720/280)<1e-12);});
  it('悬停模型对有风/未知风况拒绝',()=>{for(const wind of ['unknown','strong'])assert.equal(analyze(valid({...bench,wind})).timeMinutes,null);});
  it('巡航、花飞、竞速没有k就降级，不能沿用悬停时间',()=>{for(const style of ['cruise','freestyle','race'])assert.equal(analyze(valid({...bench,style})).timeMinutes,null);});
  it('独立校准k允许小于1，巡航功耗不强制大于悬停',()=>{const h=analyze(valid(bench)),c=analyze(valid({...bench,style:'cruise'}),[],[calibration()]);assert.equal(c.kind,'模型粗估');assert.ok(Math.abs(c.timeMinutes!-h.timeMinutes!/0.8)<1e-12);});
  it('k机型/电压/来源/工况匹配不完整则不用',()=>{const k=calibration();k.conditions.benchVoltage=24;assert.equal(analyze(valid({...bench,style:'cruise'}),[],[k]).timeMinutes,null);assert.equal(analyze(valid({...bench,style:'freestyle'}),[],[calibration()]).timeMinutes,null);});
  it('涵道/Whoop不能用裸电机或其他分组校准',()=>{assert.equal(analyze(valid({...bench,configurationGroup:'whoop',benchGroup:'whoop'})).timeMinutes,null);const a=analyze(valid({...bench,configurationGroup:'whoop',benchGroup:'whoop',benchAssembly:'installed'}));assert.equal(a.kind,'模型粗估');assert.equal(analyze(valid({...bench,configurationGroup:'whoop',benchGroup:'whoop',benchAssembly:'installed',style:'cruise'}),[],[calibration()]).timeMinutes,null);});
  it('正式实飞参考优先于粗估或本次等效',()=>{const a=analyze(valid({...bench,...capacity,style:'cruise'}),[flightReference()]);assert.equal(a.kind,'实测参考');});
});
describe('本次等效与缺失降级',()=>{
  it('Q=1000mAh,I=15A等效4分钟，不评价本次正常',()=>{assert.equal(equivalentTimeMinutes(1000,15),4);const a=analyze(valid(capacity));assert.equal(a.kind,'等效续航');assert.equal(a.timeMinutes,4);assert.equal(a.rating,'参考不足');assert.match(a.reason,/不能据此评价本次正常/);});
  it('q=810mAh,t=4.5分钟→10.8A，等效1000mAh得50/9分钟',()=>{const a=analyze(valid({...capacity,current:'',consumed:'810',consumedSource:'calibrated-flight'}));assert.equal(a.kind,'等效续航');assert.ok(Math.abs(a.timeMinutes!-50/9)<1e-12);});
  it('仅有标称容量不能代替可用Q，但仍显示平均耗电率',()=>{const a=analyze(valid(current));assert.equal(a.timeMinutes,null);assert.ok(a.details.some(d=>d.label==='本次平均耗电强度'));});
  it('Q来源、测量时点、适用性未知则不生成等效时间',()=>{for(const changes of [{capacityBasis:'unknown'},{capacityBasis:'this-flight'},{capacityNote:'未知'},{targetApplies:'unknown'},{targetEndVoltage:'未知'}])assert.equal(analyze(valid({...capacity,...changes})).timeMinutes,null);});
  it('未知电流来源或充电器回充不能不加说明当作放电量',()=>{assert.equal(analyze(valid({...capacity,currentSource:'unknown'})).timeMinutes,null);assert.equal(analyze(valid({...capacity,current:'',consumed:'810',consumedSource:'charger'})).timeMinutes,null);});
  it('模型缺k时可降级为独立标识的本次等效',()=>{assert.equal(analyze(valid({...bench,...capacity,style:'race'})).kind,'等效续航');});
  it('缺全部可选数据仍能给出参考不足与实际时间',()=>{const a=analyze(valid());assert.equal(a.kind,'参考不足');assert.ok(a.details.some(d=>d.value.includes('270 秒')));});
  it('回弹必须另确认接近时点和电量变化可忽略；否则仅读数差',()=>{const p={loadedVoltage:'21',beforeStop:'0.5',afterStop:'2',paired:'yes'};const unknown=analyze(valid(p));assert.match(unknown.rebound!.label,/非回弹结论/);const yes=analyze(valid({...p,recoveryConditions:'negligible'}));assert.match(yes.rebound!.label,/条件已确认/);});
  it('optional台架表非法不阻止基础流程',()=>{const v=validate({...base,benchData:'not a curve'});assert.ok(v.input);assert.ok(v.optionalIssues.some(i=>i.field==='benchData'));assert.equal(analyze(v.input).kind,'参考不足');});
});
