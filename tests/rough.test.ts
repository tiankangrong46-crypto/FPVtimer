import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blankInput, type RawInput } from '../src/domain/types';
import { validate } from '../src/domain/validation';
import { analyze } from '../src/domain/analysis';
import { nominalEnergyWh, scenarioTimeRange } from '../src/domain/rough-estimate';
import { referenceLibrary, type LibraryState } from '../src/data/reference-library';
import { geometryKey } from '../src/domain/category-bench';
import { interpolateElectricalPower, perMotorHoverThrust } from '../src/domain/bench';

function raw(o: Partial<RawInput> = {}): RawInput {
  return { ...blankInput(), estimateMode: 'rough', stator: '0702', kv: '23000', weight: '40', wheelbase: '65', diameter: '1.2', pitch: '1.9', blades: '3',
    capacity: '300', cells: '1', minutes: '2', seconds: '0', startVoltage: '4.2', endVoltage: '3.7', configurationGroup: 'open', style: 'hover', wind: 'calm', ...o };
}
function input(o: Partial<RawInput> = {}) { const v=validate(raw(o)); assert.ok(v.input,JSON.stringify(v.errors)); return v.input; }
const a = (o: Partial<RawInput> = {}) => analyze(input(o));
const interval: Partial<RawInput> = { targetStartVoltage: '4.2', targetEndVoltage: '3.7', targetVoltageState: 'rest', targetApplies: 'yes', targetIntervalNote: 'TEST defined interval, timing, conditions' };
const energy: Partial<RawInput> = { ...interval, availableEnergy: '1', energyBasis: 'assumed', energyNote: 'TEST explicit energy assumption' };
const charge: Partial<RawInput> = { ...interval, availableCapacity: '240', capacityBasis: 'assumed', capacityNote: 'TEST explicit Q assumption', current: '3', currentSource: 'calibrated-flight' };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);

describe('粗估公式、范围和准入隔离',()=>{
  it('mAh转Wh与能量／功率反向范围正确',()=>{
    near(nominalEnergyWh(1000,6,3.7)!,22.2); assert.deepEqual(scenarioTimeRange([10,20],[100,200]),[3,12]);
    assert.deepEqual(scenarioTimeRange([10,10],[100,100]),[6,6]);
    for(const range of [[20,10],[0,10],[NaN,10]] as [number,number][]) assert.equal(scenarioTimeRange(range,[100,200]),null);
    for(const range of [[200,100],[0,100],[100,Infinity]] as [number,number][]) assert.equal(scenarioTimeRange([10,20],range),null);
    assert.equal(nominalEnergyWh(1000,0,3.7),null);assert.equal(nominalEnergyWh(1000,1.5,3.7),null);
  });
  it('标准模式不启用匿名时间，原严格台架门槛不变',()=>{
    const r=a({estimateMode:'standard',...energy,auxPower:'0',auxBasis:'assumed',auxNote:'TEST zero auxiliary',benchMatches:'yes',benchIncludesEsc:'yes'});
    assert.equal(r.timeMinutes,null);assert.equal(r.timeRangeMinutes,null);assert.equal(r.roughEstimate,null);assert.equal(r.rating,'参考不足');
  });
  it('未知比例／辅助给显式标称全能量和仅推进基础场景',()=>{
    const r=a(),e=r.roughEstimate!;assert.ok(e);assert.equal(r.kind,'标称能量等效');assert.equal(r.rating,'参考不足');
    assert.match(r.reason,/假设标称能量全部可用/);assert.match(r.reason,/仅计推进功耗/);assert.match(r.timeLabel,/悬停理论参考/);
    assert.ok(e.scenarios.length>=2); for(const s of e.scenarios){near(s.energyWh,1.11);near(s.powerW,4*s.motorPowerW);near(s.minutes,60*1.11/(4*s.motorPowerW));}
    const powers=e.scenarios.map(s=>s.powerW);near(r.timeRangeMinutes![0],60*1.11/Math.max(...powers));near(r.timeRangeMinutes![1],60*1.11/Math.min(...powers));
    assert.ok(e.assumptions.some(s=>s.includes('电调计入、装配、温度仍未知')));
  });
  it('真实候选在10gf以覆盖点计算，假设80%与5W逐段生效',()=>{
    const r=a({roughCapacityPercent:'80',roughAuxPower:'5'}),s=r.roughEstimate!.scenarios.find(s=>s.segmentId==='segment-f8ffeb9d6a64597e72c8')!;
    const motor=5.52+(7.08-5.52)*(10-8.46)/(12.07-8.46);near(s.powerW,(4*motor+5));near(s.energyWh,1.11*0.8);near(s.minutes,60*1.11*0.8/(4*motor+5));
    assert.equal(r.kind,'粗估');assert.match(r.reason,/80%/);assert.match(r.reason,/辅助5W/);assert.match(r.reason,/时间×1（用户假设）/);
  });
  it('明确0W与未知场景功率相同但依据不同，不宣称未知设备零功耗',()=>{
    assert.deepEqual(a().timeRangeMinutes,a({roughAuxPower:'0'}).timeRangeMinutes);
    assert.match(a().reason,/仅计推进/);assert.match(a({roughAuxPower:'0'}).reason,/辅助0W/);
    assert.ok(a({roughAuxPower:'0'}).roughEstimate!.assumptions.some(s=>s.includes('明确输入0')));
  });
  it('零／非法比例不可退回100%，空和未知才允许标称场景',()=>{
    for(const roughCapacityPercent of ['0','101','80.55','oops']){const v=validate(raw({roughCapacityPercent}));assert.ok(v.input);assert.ok(v.optionalIssues.length);assert.equal(analyze(v.input).roughEstimate,null);}
    for(const roughCapacityPercent of ['','未知','不清楚'])assert.equal(a({roughCapacityPercent}).kind,'标称能量等效');
  });
  it('非法辅助不变未知，竞速最终乘0.33',()=>{
    for(const o of [{roughAuxPower:'-1'},{roughAuxPower:'3.55'}])assert.equal(a(o).roughEstimate,null);
    const e=a({style:'race'}).roughEstimate!;near(e.scenarios[0].minutes,60*1.11/e.scenarios[0].powerW*0.33);
    assert.equal(e.timeFactor,0.33);
  });
  it('有依据Wh优先于容量比例，不重复扣减；严格人工来源仍独立',()=>{
    const r=a({...energy,roughCapacityPercent:'50'});assert.equal(r.kind,'粗估');near(r.roughEstimate!.scenarios[0].energyWh,1);
    assert.equal(r.categoryBench.candidates[0].escInclusion,'unknown');assert.equal(input({...energy}).benchIncludesEsc,'unknown');
  });
  it('无匹配可后备理想模型，区间外或缺桨径仍不凑时间',()=>{
    assert.equal(a({stator:'2306',kv:'1850'}).kind,'理想模型粗估');
    for(const o of [{weight:'100000'},{diameter:'',pitch:'',blades:'',propModel:'unknown geometry'}]){const r=a(o);assert.equal(r.roughEstimate,null);assert.equal(r.timeMinutes,null);}
    const broken:LibraryState={available:false,message:'参考库不可用：TEST'};
    assert.equal(analyze(input(),[],[],broken).kind,'理想模型粗估');
  });
  it('不按起降静置电压平均或本次时间／未核实耗电改变匿名结果',()=>{
    const first=a().roughEstimate!.scenarios;
    assert.deepEqual(first,a({startVoltage:'4',endVoltage:'3.2',minutes:'10',seconds:'30',consumed:'800',consumedSource:'unknown'}).roughEstimate!.scenarios);
    assert.equal(a().rating,'参考不足');assert.equal(a({minutes:'10'}).rating,'参考不足');
  });
});
describe('等效优先、化学标称与其他分支降级',()=>{
  it('本次电流等效不能覆盖独立理论参考',()=>{
    const r=a({...charge,...energy});assert.equal(r.kind,'粗估');assert.deepEqual(r.timeRangeMinutes,a(energy).timeRangeMinutes);assert.equal(r.rating,'参考不足');assert.ok(r.comparison);
  });
  it('无有效理论能量时保留本次电流等效且不作理论比较',()=>{
    const r=a({current:'3',currentSource:'calibrated-flight',roughCapacityPercent:'80',stator:'9909',chemistry:'LiHV'});
    assert.equal(r.kind,'等效续航');near(r.timeMinutes!,4.8);assert.equal(r.roughEstimate,null);assert.equal(r.comparison,null);assert.match(r.reason,/LiHV/);
  });
  it('回充／未知电流不当依据；无Q可用独立理想模型而非补容量等效',()=>{
    for(const currentSource of ['unknown','charger','uncalibrated-flight'])assert.equal(a({current:'3',currentSource,roughCapacityPercent:'80'}).kind,'粗估');
    const r=a({current:'3',currentSource:'calibrated-flight',stator:'9909'});assert.equal(r.kind,'理想模型粗估');assert.ok(r.roughEstimate!.idealScenario);
  });
  it('粗估无效不影响原有等效、压降与回弹',()=>{
    const broken:LibraryState={available:false,message:'参考库不可用：TEST'};
    const r=analyze(input({...charge,roughAuxPower:'oops',resistance:'3.5',resistanceMethod:'dc',resistanceDevice:'TEST device',loadedVoltage:'3.5',beforeStop:'0',afterStop:'1',paired:'yes'}),[],[],broken);
    assert.equal(r.kind,'等效续航');assert.ok(r.sag);assert.ok(r.rebound);
  });
  it('LiHV标称值未知不能默认3.8；按标签选3.8／3.85，或用独立Wh',()=>{
    assert.equal(a({chemistry:'LiHV'}).roughEstimate,null);assert.match(a({chemistry:'LiHV'}).reason,/LiHV标称单节电压未知/);
    near(a({chemistry:'LiHV',roughNominalVoltage:'3.8'}).roughEstimate!.scenarios[0].energyWh,1.14);
    near(a({chemistry:'LiHV',roughNominalVoltage:'3.85'}).roughEstimate!.scenarios[0].energyWh,1.155);
    assert.equal(a({chemistry:'LiHV',roughNominalVoltage:'4.35'}).roughEstimate,null);
    near(a({...energy,chemistry:'LiHV'}).roughEstimate!.scenarios[0].energyWh,1);
  });
});
describe('工况、匿名组与电压的场景隔离',()=>{
  it('巡航花飞竞速按最终时间系数换算，风况仍未核实',()=>{
    const base=a().timeRangeMinutes;
    for(const [style,factor] of [['cruise',0.8],['freestyle',0.58],['race',0.33]] as const){const r=a({style,wind:'unknown'});r.timeRangeMinutes!.forEach((t,i)=>near(t,base![i]*factor));assert.ok(r.roughEstimate!.assumptions.some(s=>s.includes('不匹配实际风况')));}
    assert.deepEqual(a({wind:'strong'}).timeRangeMinutes,base);
  });
  it('涵道／Whoop只用理想假设场景，未知分组或其他结构仍拒绝',()=>{
    for(const configurationGroup of ['ducted','whoop']) {const r=a({configurationGroup,roughStructurePercent:'13'});assert.ok(r.roughEstimate!.idealScenario);assert.equal(r.roughEstimate!.scenarios.length,0);}
    assert.equal(a({configurationGroup:'unknown'}).roughEstimate,null);
    assert.equal(a({aircraft:'other'}).roughEstimate,null);
  });
  it('每个真实匿名段分别插值和计时，不拼点、不跨电压补区间',()=>{
    assert.ok(referenceLibrary.available);const lib=referenceLibrary;
    const segment=lib.segments.find(s=>s.id==='segment-7b2008ad4621c5d82656')!;
    const config={stator:segment.stator,kv:String(segment.kv),cells:String(segment.cells),libraryGeometry:geometryKey(segment.propeller)};
    const r=a({...config,weight:'9.2'}),scenarios=r.roughEstimate!.scenarios;
    assert.equal(scenarios.filter(s=>s.curveId===segment.curveId).length,1);assert.equal(scenarios.find(s=>s.curveId===segment.curveId)!.voltageV,3.93);
    assert.equal(a({...config,weight:'20'}).roughEstimate,null); // This true inter-voltage gap has no covering candidate.
    for(const s of scenarios){const original=lib.segments.find(p=>p.id===s.segmentId)!;
      const power=interpolateElectricalPower(original.points.map(p=>({thrust:p.thrustGf,electricalPowerW:p.electricalPowerW})),perMotorHoverThrust(9.2)!,'gf');
      assert.equal(s.motorPowerW,power);assert.equal(s.voltageV,original.voltageV);assert.equal(s.curveId,original.curveId);assert.equal(s.escInclusion,'unknown');
    }
  });
});
