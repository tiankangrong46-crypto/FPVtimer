import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { blankInput,type RawInput } from '../src/domain/types';
import { validate } from '../src/domain/validation';
import { analyze } from '../src/domain/analysis';
import { applyFlightTime,compareFlightTime,comparisonSummary,comparisonIntervalNote } from '../src/domain/flight-scenario';
import { selectStructure,structureOptions } from '../src/domain/structure';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function input(o:Partial<RawInput>={}) {const v=validate({...blankInput(),estimateMode:'rough',style:'hover',weight:'650.5',wheelbase:'225',kv:'1850',stator:'2306',diameter:'5.1',pitch:'3.5',blades:'3',capacity:'1300',cells:'6',minutes:'4',seconds:'30',startVoltage:'25.2',endVoltage:'22.2',...o});assert.ok(v.input,JSON.stringify(v.errors));return v.input;}
const a=(o:Partial<RawInput>={})=>analyze(input(o));
// Synthetic exact-motor test fixture; never production reference data.
const bench:Partial<RawInput>={motor:'TEST motor',propModel:'TEST prop',benchMotor:'TEST motor',benchPropModel:'TEST prop',benchKv:'1850',benchData:'100,20\n200,60',benchVoltage:'25.2',benchVersion:'TEST',benchSource:'SYNTHETIC ONLY',benchConditions:'TEST same voltage',benchGroup:'open',benchMatches:'yes',benchIncludesEsc:'yes',benchThrustUnit:'gf',benchAssembly:'isolated',auxPower:'5',auxBasis:'assumed',auxNote:'TEST explicit',availableEnergy:'12',energyBasis:'measured',energyNote:'TEST independent target Wh',targetStartVoltage:'25.2',targetEndVoltage:'22.2',targetVoltageState:'rest',targetIntervalNote:'TEST rest timing/cutoff',targetApplies:'yes'};
describe('所选工况理论参考与实际对比（仅程序正确性）',()=>{
  it('两种结构映射35%／45%，默认与回切一致，无旧8%／13%',()=>{
    assert.deepEqual(structureOptions.map(s=>s.label),['裸桨','圈圈']);assert.equal(blankInput().roughStructurePercent,'25');
    for(const [s,l] of [['quad',25],['whoop',18]] as const){const r=a(selectStructure(s)),p=r.roughEstimate!.idealScenario!;assert.equal(p.structurePercent,l);near(p.powerW,p.idealPowerW);near(p.minutes,60*p.energyWh/p.powerW*l/100);}
    assert.equal(selectStructure('quad').roughStructurePercent,'25');assert.equal(selectStructure('whoop').roughStructurePercent,'18');
  });
  it('理想分支四种方式时间只乘一次，基础功率和能量不受方式影响',()=>{
    const hover=a(),base=hover.roughEstimate!.idealScenario!;
    for(const [style,f] of [['hover',1],['cruise',0.8],['freestyle',0.58],['race',0.33]] as const){
      const r=a({style}),s=r.roughEstimate!.idealScenario!;near(s.minutes,base.minutes*f);near(s.powerW,base.powerW);near(s.energyWh,base.energyWh);
      assert.equal(r.roughEstimate!.timeFactor,f);assert.match(r.timeLabel,/理论参考时间/);assert.equal(r.rating,'参考不足');
      if(style==='freestyle')assert.ok(r.roughEstimate!.assumptions.some(a=>a.includes('花飞时间系数58%（用户指定假设）')));
    }
  });
  it('顺序为损耗→加辅助→能量除功率→乘时间系数，圈圈花飞亦正确',()=>{
    const s=a({...selectStructure('whoop'),style:'freestyle',roughAuxPower:'7.5',roughCapacityPercent:'80'}).roughEstimate!.idealScenario!;
    near(s.powerW,s.idealPowerW+7.5);near(s.minutes,60*(1.3*6*3.7*0.8)/(s.idealPowerW+7.5)*0.58*0.18);
  });
  it('改变本次时长／已校准电量电流不改变理论参考，只改变比较',()=>{
    const first=a({style:'race'}),other=a({style:'race',minutes:'50',seconds:'0',current:'2',currentSource:'calibrated-flight',consumed:'900',consumedSource:'calibrated-flight',roughCapacityPercent:''});
    assert.deepEqual(first.roughEstimate!.rangeMinutes,other.roughEstimate!.rangeMinutes);assert.notDeepEqual(first.comparison,other.comparison);assert.ok(other.comparison!.achievementRange[0]>100);
  });
  it('匿名台架四种方式只乘时间，不叠加35%／45%也不取邻组',()=>{
    const c:Partial<RawInput>={stator:'0702',kv:'23000',weight:'40',wheelbase:'65',diameter:'1.2',pitch:'1.9',capacity:'300',cells:'1',startVoltage:'4.2',endVoltage:'3.7'};
    const base=a(c).roughEstimate!;assert.equal(base.basis,'anonymous-bench');
    for(const [style,f] of [['hover',1],['cruise',0.8],['freestyle',0.58],['race',0.33]] as const){const r=a({...c,style,roughStructurePercent:'45'}).roughEstimate!;r.scenarios.forEach((s,i)=>{near(s.minutes,base.scenarios[i].minutes*f);near(s.powerW,base.scenarios[i].powerW);assert.equal(s.segmentId,base.scenarios[i].segmentId);});}
  });
  it('完整型号台架使用悬停基线而非旧k，最终乘工况系数且损耗不重复',()=>{
    const base=a(bench).roughEstimate!;assert.equal(base.basis,'exact-bench');
    const motor=20+(60-20)*(650.5/4-100)/(200-100);near(base.rangeMinutes[0],60*12/(4*motor+5));
    for(const [style,f] of [['hover',1],['cruise',0.8],['freestyle',0.58],['race',0.33]] as const){const r=a({...bench,style,roughStructurePercent:'99'}).roughEstimate!;assert.equal(r.basis,'exact-bench');near(r.rangeMinutes[0],base.rangeMinutes[0]*f);}
  });
  it('时间差正负、范围反向、超过100%不截断，零分母／非有限值拒绝',()=>{
    const below=compareFlightTime(120,[4,4])!,above=compareFlightTime(360,[4,4])!;
    assert.deepEqual(below.differenceRange,[-2,-2]);assert.deepEqual(above.achievementRange,[150,150]);assert.match(comparisonSummary(below),/短2.00.*−2.00/);assert.match(comparisonSummary(above),/长2.00.*\+2.00.*150.0%/);
    assert.deepEqual(compareFlightTime(300,[4,6])!.differenceRange,[-1,1]);near(compareFlightTime(300,[4,6])!.achievementRange[0],500/6);near(compareFlightTime(300,[4,6])!.achievementRange[1],125);
    for(const range of [[0,1],[-1,2],[2,1],[NaN,2],[1,Infinity]] as [number,number][])assert.equal(compareFlightTime(120,range),null);
    assert.equal(compareFlightTime(-1,[1,1]),null);assert.equal(compareFlightTime(Infinity,[1,1]),null);assert.equal(applyFlightTime(0,'hover'),null);assert.equal(applyFlightTime(3,'invalid'),null);near(applyFlightTime(10,'cruise')!,8);
  });
  it('一致需完整目标依据及对应电压状态，提前落地或不一致仍显示数字并提示',()=>{
    assert.match(comparisonIntervalNote(input({...bench,comparisonConditions:'same'})),/用户确认.*一致/);
    for(const o of [{comparisonConditions:'early'},{comparisonConditions:'different'},{comparisonConditions:'same'},{...bench,comparisonConditions:'same',endVoltage:'23'}]){const r=a(o);assert.ok(r.comparison);assert.match(comparisonIntervalNote(input(o)),/使用区间可能不同/);}
    assert.deepEqual(a({comparisonConditions:'early'}).roughEstimate!.rangeMinutes,a().roughEstimate!.rangeMinutes);
  });
});
