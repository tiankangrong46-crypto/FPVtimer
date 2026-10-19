import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { idealHoverPower,STANDARD_AIR_DENSITY,STANDARD_SOUND_SPEED,LOW_MACH_LIMIT } from '../src/domain/ideal-hover';
import { blankInput,type RawInput } from '../src/domain/types';
import { validate } from '../src/domain/validation';
import { analyze } from '../src/domain/analysis';
import { applyStructureTime, selectStructure, structureValue } from '../src/domain/structure';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-12,`${a} != ${b}`);
function raw(o:Partial<RawInput>={}):RawInput{return {...blankInput(),roughStructurePercent:'未知',estimateMode:'rough',style:'hover',configurationGroup:'open',weight:'650.5',wheelbase:'225',stator:'2306',kv:'1850',diameter:'5.1',pitch:'3.5',blades:'3',capacity:'1300',cells:'6',minutes:'4',seconds:'30',startVoltage:'25.2',endVoltage:'22.2',...o};}
function result(o:Partial<RawInput>={}){const v=validate(raw(o));assert.ok(v.input,JSON.stringify(v.errors));return analyze(v.input);}
const matched:Partial<RawInput>={stator:'0702',kv:'23000',weight:'40',wheelbase:'65',diameter:'1.2',pitch:'1.9',blades:'3',capacity:'300',cells:'1',startVoltage:'4.2',endVoltage:'3.7'};

describe('独立桨盘理想模型公式核实（非实机预测验证）',()=>{
  it('解析算例：总推力8N、总面积1m²、密度1，速度2m/s、功率16W',()=>{
    const m=1000*8/9.80665,d=1/Math.sqrt(Math.PI)/0.0254;
    const h=idealHoverPower(m,d,1)!;near(h.totalThrustN,8);near(h.totalAreaM2,1);near(h.inducedVelocityMs,2);near(h.idealPowerW,16);
    // Four independent discs each carry 2N over 0.25m²: 4 × 2N × 2m/s = 16W.
  });
  it('m四倍功率八倍、桨径两倍功率减半、密度四倍功率减半',()=>{
    const p=idealHoverPower(650,5)!.idealPowerW;
    near(idealHoverPower(2600,5)!.idealPowerW,p*8);near(idealHoverPower(650,10)!.idealPowerW,p/2);
    near(idealHoverPower(650,5,STANDARD_AIR_DENSITY*4)!.idealPowerW,p/2);
  });
  it('g、英寸、四个桨盘单位正确；无效数值不产生结果',()=>{
    near(idealHoverPower(1000,10)!.totalAreaM2,4*Math.PI*0.127**2);near(idealHoverPower(1000,10)!.totalThrustN,9.80665);
    for(const x of [0,-1,NaN,Infinity]){assert.equal(idealHoverPower(x,5),null);assert.equal(idealHoverPower(650,x),null);assert.equal(idealHoverPower(650,5,x),null);}
  });
  it('结构系数直接乘时间，不是减损或功率除法',()=>{
    near(applyStructureTime(90,25)!,22.5);near(applyStructureTime(90,18)!,16.2);near(applyStructureTime(90,0)!,0);near(applyStructureTime(90,100)!,90);
    for(const p of [-1,100.1,NaN,Infinity])assert.equal(applyStructureTime(90,p),null);
  });
});
describe('后备选择、假设与适用范围',()=>{
  it('2306/1850无匹配改走理想模型，保留未验证和未评级状态',()=>{
    const r=result();assert.equal(r.categoryBench.status,'no-match');assert.equal(r.kind,'理想模型粗估');assert.equal(r.rating,'参考不足');
    assert.ok(r.roughEstimate!.idealScenario);assert.equal(r.roughEstimate!.scenarios.length,0);assert.match(r.timeLabel,/悬停理论参考/);
    assert.match(r.reason,/结构时间系数未知/);assert.ok(r.roughEstimate!.assumptions.some(s=>s.includes('1.225kg/m³')));
  });
  it('未知与100%不折减但状态不同，0%不产生可比较时间',()=>{
    const unknown=result().roughEstimate!.idealScenario!,full=result({roughStructurePercent:'100'}).roughEstimate!.idealScenario!;
    near(unknown.minutes,full.minutes);assert.equal(unknown.structurePercent,null);assert.equal(full.structurePercent,100);
    const zero=result({roughStructurePercent:'0'});assert.equal(zero.roughEstimate,null);assert.equal(zero.comparison,null);assert.match(zero.reason,/为0%/);
  });
  it('默认25%时间系数，与基础功率无关，不重复在功率侧扣损耗',()=>{
    assert.equal(blankInput().roughStructurePercent,'25');const r=result({roughStructurePercent:'25'}),s=r.roughEstimate!.idealScenario!;
    near(s.powerW,s.idealPowerW);near(s.minutes,result({roughStructurePercent:'100'}).timeMinutes!*0.25);assert.equal(s.structurePercent,25);
    assert.match(r.reason,/结构时间×0.25（假设）/);assert.equal(r.rating,'参考不足');
  });
  it('结构最终时间修正包含辅助功耗基础，不重复扣能量',()=>{
    const s=result({roughStructurePercent:'25',roughAuxPower:'5',roughCapacityPercent:'80'}).roughEstimate!.idealScenario!;
    near(s.powerW,s.idealPowerW+5);near(s.energyWh,1.3*6*3.7*0.8);near(s.minutes,60*s.energyWh/s.powerW*0.25);
  });
  it('匹配台架优先，既有电功率不叠加理想损耗；非法损耗不阻断台架',()=>{
    for(const roughStructurePercent of ['','10','100']){const r=result({...matched,roughStructurePercent});assert.equal(r.kind,'标称能量等效');assert.equal(r.roughEstimate!.idealScenario,null);}
    assert.deepEqual(result(matched).timeRangeMinutes,result({...matched,roughStructurePercent:'10'}).timeRangeMinutes);
  });
  it('非法损耗只跳过理想后备，不当未知；0与99.9合法',()=>{
    for(const roughStructurePercent of ['-1','101','10.55','oops']){const v=validate(raw({roughStructurePercent}));assert.ok(v.input);assert.ok(v.optionalIssues.length);assert.equal(analyze(v.input).roughEstimate,null);}
    assert.ok(result({roughStructurePercent:'99.9'}).roughEstimate!.idealScenario);
  });
  it('正方形布局的相接／重叠不算；阈值两侧按实际一位小数校验',()=>{
    assert.equal(result({diameter:'5',wheelbase:'179.6'}).roughEstimate,null);assert.match(result({diameter:'5',wheelbase:'179.6'}).reason,/重叠/);
    assert.ok(result({diameter:'5',wheelbase:'179.7'}).roughEstimate!.idealScenario);
  });
  it('远尾流马赫数边界阻止不可压近似之外的结果',()=>{
    const area=4*Math.PI*(5*0.0254/2)**2,vi=LOW_MACH_LIMIT*STANDARD_SOUND_SPEED/2;
    const criticalG=2*STANDARD_AIR_DENSITY*area*vi**2/9.80665*1000;
    assert.ok(result({diameter:'5',weight:String(Math.floor(criticalG*10)/10)}).roughEstimate!.idealScenario);
    const above=result({diameter:'5',weight:String(Math.ceil(criticalG*10)/10)});assert.equal(above.roughEstimate,null);assert.match(above.reason,/低马赫数/);
  });
  it('未知分组及非四轴不能靠损耗值绕过范围',()=>{
    assert.equal(result({configurationGroup:'unknown',roughStructurePercent:'45'}).roughEstimate,null);
    assert.equal(result({aircraft:'other'}).roughEstimate,null);
  });
  it('结构选择统一分组与用户默认，45%为总损耗不叠加旧参数',()=>{
    assert.equal(blankInput().configurationGroup,'open');assert.equal(structureValue(blankInput()),'quad');
    for(const structure of ['whoop']){
      const selected=selectStructure(structure);assert.equal(selected.roughStructurePercent,'18');assert.equal(selected.aircraft,'quad');assert.equal(structureValue(selected),structure);
      const r=result(selected),s=r.roughEstimate!.idealScenario!;near(s.powerW,s.idealPowerW);near(s.minutes,result({roughStructurePercent:'100'}).timeMinutes!*0.18);
      assert.equal(r.rating,'参考不足');assert.match(r.reason,/结构时间×0.18（假设）/);assert.ok(r.roughEstimate!.assumptions.some(s=>s.includes('不是涵道性能模型')));
    }
    assert.equal(selectStructure('quad').roughStructurePercent,'25');assert.throws(()=>selectStructure('bad'));
  });
  it('涵道／Whoop不借用开放桨匿名候选，即使找到相同定子桨叶',()=>{
    for(const structure of ['whoop']){
      const r=result({...matched,...selectStructure(structure)});assert.equal(r.categoryBench.status,'unsupported');
      assert.equal(r.roughEstimate!.scenarios.length,0);assert.ok(r.roughEstimate!.idealScenario);assert.equal(r.kind,'理想模型粗估');
      const out=result({...matched,...selectStructure(structure),weight:'300'});assert.ok(out.roughEstimate!.idealScenario);
    }
  });
  it('涵道假设仍支持未知／0和手改损耗，并保留几何和数值边界',()=>{
    for(const structure of ['whoop']){
      const base=selectStructure(structure);
      assert.equal(result({...base,roughStructurePercent:'未知'}).roughEstimate!.idealScenario!.structurePercent,null);
      assert.equal(result({...base,roughStructurePercent:'0'}).roughEstimate,null);
      assert.equal(result({...base,roughStructurePercent:'15.5'}).roughEstimate!.idealScenario!.structurePercent,15.5);
      assert.equal(result({...base,roughStructurePercent:'101'}).roughEstimate,null);
      assert.equal(result({...base,wheelbase:'100'}).roughEstimate,null);
      assert.equal(result({...base,estimateMode:'standard'}).roughEstimate,null);
    }
  });
  it('已有台架推力区间外不能借理想模型绕过，不推断一定飞不起来',()=>{
    const r=result({...matched,weight:'100000'});assert.equal(r.categoryBench.status,'out-of-range');assert.equal(r.roughEstimate,null);assert.match(r.reason,/不绕过/);
  });
  it('理想功率不由KV／定子／螺距／叶片数或本次耗电决定',()=>{
    const expected=result().roughEstimate!.idealScenario!;
    const r=result({stator:'9909',kv:'1900',pitch:'4.5',blades:'2',minutes:'20',current:'99',currentSource:'unknown'}).roughEstimate!.idealScenario!;
    near(r.idealPowerW,expected.idealPowerW);near(r.minutes,expected.minutes);
    assert.ok(result({stator:''}).roughEstimate!.idealScenario);
  });
  it('缺桨径不从型号猜，标准模式也不自动启用后备',()=>{
    assert.equal(result({diameter:'',pitch:'',blades:'',propModel:'unknown geometry'}).roughEstimate,null);
    assert.equal(result({estimateMode:'standard'}).roughEstimate,null);
  });
  it('已核实电流等效仍优先，不受后备损耗／布局非法影响',()=>{
    const r=result({current:'15',currentSource:'calibrated-flight',roughCapacityPercent:'80',roughStructurePercent:'100',wheelbase:'1'});
    assert.equal(r.kind,'等效续航');assert.equal(r.roughEstimate,null);near(r.timeMinutes!,0.06*1300*0.8/15);
  });
});
