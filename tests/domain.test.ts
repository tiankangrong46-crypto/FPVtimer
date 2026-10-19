import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, classifyDuration, matchingReference } from '../src/domain/analysis';
import { parseReading, validate } from '../src/domain/validation';
import { blankInput, type RawInput, type ValidInput } from '../src/domain/types';
import { enduranceReferences, reviewedSources, type EnduranceReference } from '../src/data/references';

// SYNTHETIC TEST FIXTURE. Not real flight data; never imported into the application.
export const sample = (overrides: Partial<RawInput> = {}): RawInput => ({
  ...blankInput(), estimateMode: 'standard', weight: '650.5', wheelbase: '225', kv: '1750', diameter: '5.1', pitch: '3.5', blades: '3',
  capacity: '1300', cells: '6', minutes: '4', seconds: '30', startVoltage: '25.200', endVoltage: '22.200', ...overrides,
});
function input(overrides: Partial<RawInput> = {}): ValidInput {
  const checked = validate(sample(overrides)); assert.deepEqual(checked.errors, []); assert.ok(checked.input); return checked.input;
}
const optionalOK: Partial<RawInput> = { resistance: '3.5', resistanceMethod: 'charger', resistanceDevice: '人工测试设备', current: '15', currentSource: 'calibrated-flight' };

describe('输入与单位', () => {
  it('区分空、未知、零、非法', () => {
    assert.equal(parseReading('').kind, 'missing'); assert.equal(parseReading('未知').kind, 'unknown');
    assert.deepEqual(parseReading('0'), {kind:'value', value:0}); assert.equal(parseReading('NaN').kind, 'invalid');
  });
  it('基础输入正确，选填空或未知不阻止评估', () => { assert.ok(validate(sample()).input); assert.equal(analyze(input()).rating, '参考不足'); });
  it('重量和容量接受一位小数', () => { assert.ok(validate(sample({weight:'650.1', capacity:'850.5'})).input); });
  it('电压支持三位小数，不自动四舍五入', () => {
    assert.ok(validate(sample({startVoltage:'25.123'})).input); assert.equal(validate(sample({startVoltage:'25.1234'})).input, null);
  });
  for (const key of ['weight', 'capacity', 'kv'] as const) it(`${key}拒绝多余小数和零`, () => {
    assert.equal(validate(sample({[key]:'1.23'})).input, null); assert.equal(validate(sample({[key]:'0'})).input, null);
  });
  for (const cells of ['1','8']) it(`支持${cells}S边界`, () => assert.ok(validate(sample({cells})).input));
  for (const cells of ['0','9','6.5','未知','']) it(`拒绝无效节数 ${cells}`, () => assert.equal(validate(sample({cells})).input, null));
  it('叶片数是正整数', () => { assert.equal(validate(sample({blades:'2.5'})).input,null); assert.equal(validate(sample({blades:'0'})).input,null); });
  it('可使用具体桨叶型号代替三项规格', () => { assert.ok(validate(sample({diameter:'',pitch:'',blades:'',propModel:'已知型号'})).input); });
  it('没有型号则三项规格必须齐全', () => assert.equal(validate(sample({pitch:''})).input,null));
  it('分钟秒转换、0分、59秒', () => { assert.equal(input({minutes:'0',seconds:'59'}).durationSeconds,59); assert.equal(input().durationSeconds,270); });
  it('拒绝零时长、60秒、小数时间', () => {
    for (const o of [{minutes:'0',seconds:'0'},{seconds:'60'},{minutes:'1.5'}]) assert.equal(validate(sample(o)).input,null);
  });
  it('负温度合法；可选非法只提示、不阻止基础评估', () => {
    const v=validate(sample({temperature:'-5.5',resistance:'3.55'})); assert.ok(v.input); assert.equal(v.optionalIssues.length,1); assert.equal(analyze(v.input).sag,null);
  });
  it('空的落地测量时间要补填，未知合法', () => { assert.equal(validate(sample({landingDelay:''})).input,null); assert.ok(validate(sample({landingDelay:'不清楚'})).input); });
  it('非法枚举阻止基本输入', () => { assert.equal(validate(sample({style:'made-up'})).input,null); });
  it('不静默截断/解析指数、Infinity、逗号或单位', () => { for (const x of ['1e2','Infinity','3,5','3.5mΩ','-1']) assert.equal(parseReading(x).kind,'invalid'); });
});
describe('续航参考与评级边界', () => {
  it('真实产品来源仅审查，不能从最大值和单个标称值建立评级', () => {
    assert.equal(reviewedSources.length,3); assert.equal(enduranceReferences.length,0);
    const air65 = input({weight:'23.8',wheelbase:'65',kv:'27000',diameter:'1.2',pitch:'1.9',capacity:'260',cells:'1',chemistry:'LiHV',minutes:'4',seconds:'0',startVoltage:'4.35',endVoltage:'3.3'});
    assert.equal(analyze(air65).referenceSeconds,null); assert.equal(analyze(air65).rating,'参考不足');
  });
  it('无参考不能生成正常或精确时间', () => { const a=analyze(input()); assert.equal(a.rating,'参考不足'); assert.equal(a.referenceSeconds,null); });
  it('不适用机型明确提示', () => assert.match(analyze(input({aircraft:'other'})).reason,/超出适用范围/));
  it('比较范围仅使用来源上下界，包含边界', () => {
    const range=[240,300] as const; assert.equal(classifyDuration(239,range),'偏短');
    assert.equal(classifyDuration(240,range),'正常'); assert.equal(classifyDuration(300,range),'正常'); assert.equal(classifyDuration(301,range),'较长');
    assert.equal(classifyDuration(250,[300,240]),'参考不足'); assert.equal(classifyDuration(NaN,range),'参考不足');
  });
  it('不完整匹配不允许引用；测试参考不得混入正式库', () => {
    const ref:EnduranceReference={id:'SYNTHETIC-ONLY',url:'https://example.invalid/fixture',version:'test',evidence:'independent-flight-records',origin:'real-measurement',status:'reviewed',measurementConditions:'synthetic test only',scope:'synthetic test only',conditions:{},records:[{id:'fixture-a',seconds:240},{id:'fixture-b',seconds:300}]};
    assert.equal(matchingReference(input(),[ref]),undefined);
    const i=input({motor:'test',propModel:'test',landingDelay:'0',temperature:'20',wind:'calm',configurationGroup:'open',startDelay:'0'});
    const keys=['aircraft','weight','wheelbase','kv','motor','propModel','diameter','pitch','blades','chemistry','capacity','cells','style','startVoltage','endVoltage','landingDelay','temperature','wind','configurationGroup','startDelay'];
    for (const k of keys) { const r=i.readings[k as keyof typeof i.readings]; ref.conditions[k]=r?.kind==='value'?r.value:i[k as keyof typeof i] as string; }
    assert.equal(analyze(i,[ref]).kind,'实测参考'); assert.equal(analyze(i,[ref]).rating,'参考不足');
    ref.validatedRange={minSeconds:240,maxSeconds:300,status:'independently-validated',validationRecordIds:['independent-test-1'],source:'test-only source',method:'test-only validation',sampleAdequacy:'documented-sufficient',adequacyBasis:'test-only adequacy'};
    assert.equal(analyze(i,[ref]).rating,'正常'); ref.conditions.kv=1800; assert.equal(analyze(i,[ref]).rating,'参考不足');
  });
});
describe('压降与电量积分', () => {
  it('3.5mΩ × 6S × 15A = 0.315V，含充电器不确定性', () => { const a=analyze(input(optionalOK)); assert.match(a.sag!.value,/0.315/); assert.match(a.sag!.basis,/充电器/); assert.match(a.sag!.basis,/不确定性/); });
  it('只有内阻不能计算压降', () => assert.equal(analyze(input({resistance:'3.5'})).sag,null));
  it('平均电流未知来源或未校准时跳过', () => {
    for (const source of ['unknown','uncalibrated-flight','charger','other']) assert.equal(analyze(input({...optionalOK,currentSource:source})).sag,null);
  });
  it('810mAh / 270s = 10.8A；折算压降0.2268V', () => {
    const a=analyze(input({...optionalOK,current:'',consumed:'810',consumedSource:'calibrated-flight'})); assert.match(a.sag!.value,/0.227/); assert.match(a.details[2].value,/10.80/);
  });
  it('充电器回充mAh不冒充放电积分', () => assert.equal(analyze(input({...optionalOK,current:'',consumed:'810',consumedSource:'charger'})).sag,null));
  it('直流设备可用，交流或未知设备不可用', () => {
    assert.ok(analyze(input({...optionalOK,resistanceMethod:'dc'})).sag);
    for (const method of ['ac','unknown','other']) assert.equal(analyze(input({...optionalOK,resistanceMethod:method})).sag,null);
    assert.equal(analyze(input({...optionalOK,resistanceDevice:''})).sag,null);
    assert.equal(analyze(input({...optionalOK,resistanceDevice:'未知'})).sag,null);
  });
  it('零内阻/电流不会冒充理想电池', () => { assert.equal(analyze(input({...optionalOK,resistance:'0'})).sag,null); assert.equal(analyze(input({...optionalOK,current:'0'})).sag,null); });
  it('压降超过起飞电压时拒绝模型', () => assert.equal(analyze(input({...optionalOK,resistance:'1000'})).sag,null));
  it('两种电流输入不平均，直接电流优先', () => assert.match(analyze(input({...optionalOK,consumed:'810',consumedSource:'calibrated-flight'})).sag!.value,/0.315/));
});
describe('回弹的时序与未知', () => {
  const pair: Partial<RawInput>={loadedVoltage:'21.000',beforeStop:'0.5',afterStop:'2',paired:'yes'};
  it('同次停桨读数差和时间间隔', () => { const r=analyze(input(pair)).rebound!; assert.match(r.value,/\+1.200/); assert.match(r.basis,/2.5 秒/); });
  it('未知、空白或不同次停桨跳过对应分析', () => {
    for (const o of [{beforeStop:'未知'},{afterStop:''},{paired:'no'},{paired:'unknown'}]) assert.equal(analyze(input({...pair,...o})).rebound,null);
  });
  it('不使用起飞与降落电压差替代回弹', () => assert.equal(analyze(input()).rebound,null));
  it('负差值不转正，也不宣称虚压', () => { const r=analyze(input({...pair,loadedVoltage:'23'})).rebound!; assert.match(r.value,/-0.800/); assert.match(r.basis,/未观测到电压回升/); });
  it('长间隔明确非瞬时，无臆造秒数阈值', () => assert.match(analyze(input({...pair,afterStop:'120'})).rebound!.basis,/不解释为瞬时回弹/));
  it('0秒已知，与未知不同', () => assert.ok(analyze(input({...pair,beforeStop:'0',afterStop:'0'})).rebound));
});
