import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { referenceLibrary, libraryFiles, loadReferenceLibrary, type LibraryState } from '../src/data/reference-library';
import manifest from '../reference-library/v0.1.0/manifest.json';
import { parseStator } from '../src/domain/stator';
import { blankInput, type RawInput } from '../src/domain/types';
import { validate } from '../src/domain/validation';
import { analyze } from '../src/domain/analysis';
import { categoryBench, geometryKey, type CategoryCandidate } from '../src/domain/category-bench';
import { interpolateElectricalPower, perMotorHoverThrust, thrustToNewton } from '../src/domain/bench';

// Configuration and expected numbers below come from the shipped snapshot, not invented flight records.
function raw(overrides: Partial<RawInput> = {}): RawInput {
  return { ...blankInput(), estimateMode: 'standard', stator: '0702', kv: '23000', weight: '40', wheelbase: '65', diameter: '1.2', pitch: '1.9', blades: '3',
    capacity: '300', cells: '1', minutes: '2', seconds: '0', startVoltage: '4.2', endVoltage: '3.7',
    configurationGroup: 'open', style: 'hover', wind: 'calm', ...overrides };
}
function valid(overrides: Partial<RawInput> = {}) { const v = validate(raw(overrides)); assert.ok(v.input, JSON.stringify(v.errors)); return v.input; }
function library() { assert.equal(referenceLibrary.available, true); if (!referenceLibrary.available) throw Error('library unavailable'); return referenceLibrary; }
const target: Partial<RawInput> = { availableCapacity: '240', capacityBasis: 'assumed', capacityNote: 'TEST explicit capacity assumption',
  availableEnergy: '1', energyBasis: 'assumed', energyNote: 'TEST explicit energy assumption', targetStartVoltage: '4.2', targetEndVoltage: '3.7',
  targetVoltageState: 'rest', targetIntervalNote: 'TEST interval conditions', targetApplies: 'yes', auxPower: '0', auxBasis: 'assumed', auxNote: 'TEST zero auxiliary assumption',
  current: '3', currentSource: 'calibrated-flight' };
function rejected(edit: (files: any) => void) { const copy = structuredClone(libraryFiles); edit(copy); return loadReferenceLibrary(manifest, copy); }

describe('离线匿名库准入与损坏降级', () => {
  it('真实快照数量和7份SHA256／字节数正确，无合格实飞或k', () => {
    const lib = library(); assert.equal(lib.motors.length, 289); assert.equal(lib.propellers.length, 149); assert.equal(lib.curves.length, 1054);
    assert.equal(lib.segments.length, 519); assert.equal(lib.flightReferences.length, 0); assert.equal(lib.styleCalibrations.length, 0);
    for (const f of manifest.files) { const bytes = readFileSync(new URL(`../reference-library/v0.1.0/${f.name}`, import.meta.url));
      assert.equal(bytes.length, f.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), f.sha256); }
    assert.ok(readFileSync(new URL('../reference-library/v0.1.0/LICENSE-ATTRIBUTION.md', import.meta.url), 'utf8').includes('CC BY 4.0'));
  });
  it('全部输出只读，匿名字段不混入计算数据', () => {
    const lib = library(); assert.ok(Object.isFrozen(lib) && Object.isFrozen(lib.segments[0].points));
    assert.doesNotMatch(JSON.stringify(lib), /"(?:brand|manufacturer|source|url|model)"|https?:\/\//i);
  });
  it('缺文件、错版本、非对象均返回明确不可用状态', () => {
    assert.equal(rejected(f => delete f['coverage.json']).available, false);
    assert.equal(loadReferenceLibrary({ ...manifest, libraryVersion: 'next' }, libraryFiles).available, false);
    assert.equal(loadReferenceLibrary(null, null).available, false);
  });
  it('不接受匿名记录中的品牌、未知字段或虚构已知测试条件', () => {
    for (const edit of [(f: any) => f['motor-catalog.json'].items[0].brand = 'TEST',
      (f: any) => f['constant-voltage-segments.json'].items[0].escInclusion = 'yes',
      (f: any) => f['bench-curves.json'].items[0].assembly = 'installed']) assert.equal(rejected(edit).available, false);
  });
  it('段改电压、父组、数值或覆盖统计将校验失败', () => {
    for (const edit of [(f: any) => f['constant-voltage-segments.json'].items[0].voltageV = 4.2,
      (f: any) => f['constant-voltage-segments.json'].items[0].curveId = f['constant-voltage-segments.json'].items[1].curveId,
      (f: any) => f['bench-curves.json'].items[0].points[0].electricalPowerW = -1,
      (f: any) => f['coverage.json'].items[0].benchPoints++]) assert.equal(rejected(edit).available, false);
  });
  it('库不可用时原有等效与压降继续工作', () => {
    const broken: LibraryState = { available: false, message: '参考库不可用：TEST' };
    const a = analyze(valid({ ...target, resistance: '3.5', resistanceMethod: 'dc', resistanceDevice: 'TEST device' }), [], [], broken);
    assert.equal(a.categoryBench.status, 'unavailable'); assert.equal(a.kind, '等效续航'); assert.equal(a.timeMinutes, 4.8); assert.ok(a.sag);
  });
});
describe('规格、几何和精确匹配', () => {
  it('定子保留前导零与小数高度，不限定必须在库内', () => {
    assert.deepEqual(parseStator('0802'), { kind: 'value', value: '0802' }); assert.deepEqual(parseStator('2806.5'), { kind: 'value', value: '2806.5' });
    assert.deepEqual(parseStator('2306.0'), { kind: 'value', value: '2306' }); assert.ok(validate(raw({ stator: '9909', motor: '' })).input);
  });
  it('空、未知和非法规格不混同，不阻断基础评估；零KV仍非法', () => {
    for (const [stator, kind] of [['', 'missing'], ['未知', 'unknown'], ['0', 'invalid'], ['2806.55', 'invalid'], ['TEST brand', 'invalid']]) {
      const v = validate(raw({ stator })); assert.ok(v.input); assert.equal(v.input.statorReading.kind, kind); assert.equal(categoryBench(v.input).candidates.length, 0);
    }
    assert.equal(validate(raw({ kv: '0' })).input, null);
  });
  it('2306/1850确实无匹配，不借邻近KV', () => {
    const r = categoryBench(valid({ stator: '2306', kv: '1850' })); assert.equal(r.status, 'no-match'); assert.match(r.message, /暂无匹配候选/);
  });
  it('桨叶未知时仅保留覆盖信息，不从型号猜几何', () => {
    const r = categoryBench(valid({ diameter: '', pitch: '', blades: '', propModel: 'unknown geometry only' }));
    assert.equal(r.status, 'missing'); assert.ok(r.coverage); assert.equal(r.candidates.length, 0);
  });
  it('1.22英寸库内几何选择精确保留，不四舍五入；替代失效手填值', () => {
    const g = library().propellers.find(g => g.diameterIn === 1.22); assert.ok(g);
    const i = valid({ libraryGeometry: geometryKey(g), diameter: 'bad', pitch: '', blades: '' });
    assert.equal(i.readings.diameter.kind, 'value'); if (i.readings.diameter.kind === 'value') assert.equal(i.readings.diameter.value, 1.22);
    assert.equal(categoryBench(i).geometry!.diameterIn, 1.22);
  });
  it('非法几何选择只跳过候选，不能退回旧手填值或伪造匹配', () => {
    const v = validate(raw({ libraryGeometry: 'missing-geometry' })); assert.ok(v.input); assert.ok(v.optionalIssues.length);
    assert.equal(categoryBench(v.input).status, 'missing');
  });
  it('KV／节数／桨叶几何均逐项匹配，没有容差或比例缩放', () => {
    for (const override of [{ kv: '23000.1' }, { cells: '2' }, { diameter: '1.3' }, { pitch: '2.0' }, { blades: '2' }])
      assert.equal(categoryBench(valid(override)).candidates.length, 0);
  });
});
describe('真实同电压候选数值与隔离', () => {
  it('真实段在10gf逐段插值：第一段由8.46/5.52和12.07/7.08算出', () => {
    const r = categoryBench(valid()); assert.equal(r.status, 'candidates');
    const c = r.candidates.find(c => c.segmentId === 'segment-f8ffeb9d6a64597e72c8'); assert.ok(c);
    const expected = 5.52 + (7.08 - 5.52) * (10 - 8.46) / (12.07 - 8.46);
    assert.ok(Math.abs(c.motorPowerW - expected) < 1e-12); assert.equal(c.voltageV, 4); assert.equal(c.escInclusion, 'unknown'); assert.equal(c.assembly, 'unknown');
  });
  it('gf/N转换相同、两端可用、区间外不外推', () => {
    const s = library().segments[0], points = s.points.map(p => ({ thrust: p.thrustGf, electricalPowerW: p.electricalPowerW }));
    const nPoints = points.map(p => ({ ...p, thrust: thrustToNewton(p.thrust, 'gf') }));
    assert.ok(Math.abs(interpolateElectricalPower(points, perMotorHoverThrust(40)!, 'gf')! - interpolateElectricalPower(nPoints, perMotorHoverThrust(40)!, 'N')!) < 1e-12);
    for (const p of [s.points[0], s.points.at(-1)!]) assert.equal(interpolateElectricalPower(points, perMotorHoverThrust(p.thrustGf * 4)!, 'gf'), p.electricalPowerW);
    assert.equal(interpolateElectricalPower(points, thrustToNewton(s.points.at(-1)!.thrustGf + 0.01, 'gf'), 'gf'), null);
    assert.equal(categoryBench(valid({ weight: '100000' })).status, 'out-of-range');
  });
  it('不同匿名组逐条结果，不平均原始点', () => {
    const r = categoryBench(valid()); assert.ok(r.candidates.length >= 2); assert.equal(new Set(r.candidates.map(c => c.segmentId)).size, r.candidates.length);
    for (const c of r.candidates) { const s = library().segments.find(s => s.id === c.segmentId)!;
      assert.equal(s.curveId, c.curveId); assert.equal(s.voltageV, c.voltageV);
      assert.equal(c.motorPowerW, interpolateElectricalPower(s.points.map(p => ({ thrust: p.thrustGf, electricalPowerW: p.electricalPowerW })), perMotorHoverThrust(40)!, 'gf'));
    }
  });
  it('静置起飞电压不能筛选／改变测试电压候选，更不补负载依据', () => {
    const a = categoryBench(valid()), b = categoryBench(valid({ startVoltage: '4.35' })); assert.deepEqual(a.candidates, b.candidates);
    assert.ok(a.candidates.every(c => c.voltageV === 4));
  });
  it('同父组不同电压的推力区间不相交，不能跨电压补出候选', () => {
    const lib = library();
    const s = lib.segments.find(a => lib.segments.some(b => a.curveId === b.curveId && a.voltageV !== b.voltageV)); assert.ok(s);
    const shape = s.propeller;
    const group = lib.segments.filter(a => a.curveId === s.curveId);
    assert.equal(s.curveId, 'curve-d300fa381d6f869c185e');
    for (const segment of group) {
      const targetGf = (segment.points[0].thrustGf + segment.points.at(-1)!.thrustGf) / 2;
      const i = valid({ stator: s.stator, kv: String(s.kv), cells: String(s.cells), weight: String(Math.ceil(targetGf * 40) / 10), libraryGeometry: geometryKey(shape) });
      const candidates: readonly CategoryCandidate[] = categoryBench(i).candidates.filter(c => c.curveId === s.curveId);
      assert.equal(candidates.length, 1); assert.equal(candidates[0].segmentId, segment.id); assert.equal(candidates[0].voltageV, segment.voltageV);
    }
    const gap = valid({ stator: s.stator, kv: String(s.kv), cells: String(s.cells), weight: '20', libraryGeometry: geometryKey(shape) });
    assert.equal(categoryBench(gap).candidates.filter(c => c.curveId === s.curveId).length, 0);
  });
  it('巡航／花飞／竞速、风未知、Whoop／涵道不套普通静态悬停', () => {
    for (const override of [{ style: 'cruise' }, { style: 'freestyle' }, { style: 'race' }, { wind: 'unknown' }, { configurationGroup: 'unknown' }, { configurationGroup: 'whoop' }, { configurationGroup: 'ducted' }, { aircraft: 'other' }])
      assert.equal(categoryBench(valid(override)).status, 'unsupported');
  });
  it('有候选及用户Wh／辅助功耗／自报确认仍不启用匿名续航或评级', () => {
    const a = analyze(valid({ ...target, current: '', benchMatches: 'yes', benchIncludesEsc: 'yes' }));
    assert.equal(a.categoryBench.status, 'candidates'); assert.equal(a.timeMinutes, null); assert.equal(a.rating, '参考不足'); assert.equal(a.kind, '参考不足');
    assert.match(a.reason, /条件未知/);
  });
  it('候选缺失、损坏或不适用均不影响等效；无Q／能量不填默认值', () => {
    const a = analyze(valid(target)); assert.equal(a.categoryBench.status, 'candidates'); assert.equal(a.kind, '等效续航'); assert.equal(a.rating, '参考不足');
    for (const override of [{ stator: '2306', kv: '1850' }, { style: 'race' }, { weight: '100000' }]) assert.equal(analyze(valid({ ...target, ...override })).kind, '等效续航');
    const b = analyze(valid({ current: '3', currentSource: 'calibrated-flight' })); assert.equal(b.timeMinutes, null); assert.equal(b.rating, '参考不足');
  });
});
