import type { CategoryBenchResult, CategoryCandidate } from './category-bench';
import { modelEstimate, quantityKnown } from './endurance';
import { timeFromEnergy } from './bench';
import { valueOf, type Detail, type ValidInput } from './types';
import { idealHoverPower, LOW_MACH_LIMIT, type IdealHover } from './ideal-hover';
import { applyStructureTime } from './structure';
import { frameFit } from './frame-fit';
import { applyFlightTime, flightScenarios } from './flight-scenario';
import type { FlightStyle } from './types';

export interface RoughScenario extends CategoryCandidate {
  readonly powerW: number; readonly energyWh: number; readonly minutes: number;
}
export interface IdealScenario extends IdealHover {
  readonly structurePercent: number | null; readonly powerW: number;
  readonly energyWh: number; readonly minutes: number;
}
export interface RoughEstimate {
  readonly kind: '粗估' | '等效续航' | '标称能量等效' | '理想模型粗估'; readonly timeLabel: string;
  readonly rangeMinutes: [number, number]; readonly summary: string; readonly assumptions: readonly string[];
  readonly scenarios: readonly RoughScenario[]; readonly details: readonly Detail[]; readonly usedInputs: readonly string[];
  readonly idealScenario: IdealScenario | null;
  readonly baseRangeMinutes: [number, number]; readonly timeFactor: number; readonly styleLabel: string;
  readonly basis: 'ideal' | 'anonymous-bench' | 'exact-bench';
  readonly structureFactor: number | null;
}
export interface RoughDecision { readonly estimate: RoughEstimate | null; readonly notices: readonly string[] }

// Shared dimensional conversion; no observed voltage, current flight duration, or IR correction here.
export function nominalEnergyWh(capacityMah: number, cells: number, nominalCellV: number): number | null {
  return [capacityMah, cells, nominalCellV].every(v => Number.isFinite(v) && v > 0) && Number.isInteger(cells) && cells <= 8
    ? capacityMah / 1000 * cells * nominalCellV : null;
}
export function scenarioTimeRange(energyWh: readonly [number, number], powerW: readonly [number, number]): [number, number] | null {
  if (![...energyWh, ...powerW].every(v => Number.isFinite(v) && v > 0) || energyWh[0] > energyWh[1] || powerW[0] > powerW[1]) return null;
  return [timeFromEnergy(energyWh[0], powerW[1])!, timeFromEnergy(energyWh[1], powerW[0])!];
}
function nominalVoltage(input: ValidInput): number | null {
  // Primary technical verification and type/label limitations are recorded outside business data in the method document.
  if (input.chemistry === 'LiPo') return 3.7;
  return input.chemistry === 'LiHV' && ['3.8', '3.85'].includes(input.roughNominalVoltage) ? Number(input.roughNominalVoltage) : null;
}
function applyStyle(input: ValidInput, base: Omit<RoughEstimate, 'baseRangeMinutes'|'timeFactor'|'styleLabel'|'structureFactor'>): RoughEstimate {
  const style = flightScenarios[input.style as FlightStyle];
  const percent=base.basis==='ideal'?valueOf(input,'roughStructurePercent'):null;
  const scale=(t:number)=>applyFlightTime(percent===null?t:applyStructureTime(t,percent)!,input.style)!;
  const assumption = `${style.label}时间系数${(style.timeFactor*100).toFixed(0)}%（用户指定假设），在基础时间最后乘一次；不是功率倍率，不是独立实测校准`;
  return { ...base, baseRangeMinutes: base.rangeMinutes, timeFactor: style.timeFactor, styleLabel: style.label,
    structureFactor:percent===null?null:percent/100,
    rangeMinutes: base.rangeMinutes.map(scale) as [number,number],
    scenarios: base.scenarios.map(s => ({...s,minutes:applyFlightTime(s.minutes,input.style)!})),
    idealScenario: base.idealScenario ? {...base.idealScenario,minutes:scale(base.idealScenario.minutes)} : null,
    timeLabel: `${style.label}理论参考时间`, summary: `${base.summary} ${style.label}时间×${style.timeFactor}（用户假设）。`,
    assumptions: [...base.assumptions, assumption], usedInputs:[...base.usedInputs,'style'],
    details: [...base.details,{label:'工况时间换算',value:`${style.label} × ${style.timeFactor}`,basis:`${assumption}；基线${base.rangeMinutes.map(t=>t.toFixed(3)).join('–')}分钟。T工况=T基础${percent===null?'（结构系数未知或台架不再折减）':`×结构${percent/100}`}×方式${style.timeFactor}，当前实际时长没有参与理论参考计算。`}] };
}
export function roughEstimate(input: ValidInput, _averageCurrent: number | null, category: CategoryBenchResult): RoughDecision {
  const fail = (message: string): RoughDecision => ({ estimate: null, notices: [message] });
  if (input.estimateMode !== 'rough') return { estimate: null, notices: [] };
  if (input.aircraft !== 'quad') return fail('粗估只适用于普通四轴；当前结构不支持。');
  const fit=frameFit(input);if(!fit.allowed)return fail(fit.note);
  const percent = valueOf(input, 'roughCapacityPercent');
  // A zero / invalid explicit assumption is not "unknown" and cannot silently select the 100% scenario.
  const percentInvalid = input.readings.roughCapacityPercent.kind === 'invalid';
  const assumptions: string[] = [fit.note], usedInputs: string[] = ['frameMaxProp'];
  // The current-flight I/q/t path remains a separate equivalent analysis, never theoretical evidence.
  if (input.benchPoints) {
    const exact = modelEstimate(input, [], 'hover-baseline');
    if (exact.minutes !== null) return { notices: [], estimate: applyStyle(input, {
      kind:'粗估',timeLabel:'台架基础时间',rangeMinutes:[exact.minutes,exact.minutes],summary:'基础来自完整型号台架电输入功率及有依据的目标能量，推进损耗不重复扣减。',
      assumptions:[fit.note,'基础来自台架电输入功率；不再应用结构时间保留系数，避免重复折减。','辅助功耗及目标可用能量的来源／假设见台架依据。'],
      scenarios:[],idealScenario:null,basis:'exact-bench',details:exact.details,usedInputs:['frameMaxProp',...exact.used],
    }) };
  }
  const guarded = ['ducted', 'whoop'].includes(input.configurationGroup);
  if (input.configurationGroup !== 'open' && !guarded) return fail('飞机结构／桨叶装配未知，请选择开放桨、涵道或圈圈机；不自动猜测结构。');
  // Ducted/Whoop use only an explicitly assumed ideal baseline. Open-rotor
  // anonymous curves remain ineligible and do not become assembly evidence.
  const hasCandidates = !guarded && category.status === 'candidates' && category.candidates.length > 0;
  let ideal: IdealHover | null = null;
  if (!hasCandidates) {
    if (!guarded && (category.status === 'out-of-range' || category.status === 'unsupported')) return fail(`当前配置超出匹配台架覆盖或模型适用范围，不绕过限制：${category.message}`);
    const diameter = valueOf(input,'diameter'), weight = valueOf(input,'weight'), wheelbase = valueOf(input,'wheelbase');
    if (diameter === null || weight === null || wheelbase === null) return fail('无匹配功率数据，理想模型仍需有效起飞重量、桨径和机架轴距；不从桨型号猜测。');
    if (diameter * 25.4 >= wheelbase / Math.SQRT2) return fail('在正方形四轴布局假设下桨盘相接／重叠，超出独立桨盘模型范围；不生成理想时间。');
    ideal = idealHoverPower(weight,diameter);
    if (!ideal || ideal.farWakeMach >= LOW_MACH_LIMIT) return fail('理想远尾流超出低马赫数近似范围，或数值无效；不生成后备模型时间。');
    if (input.readings.roughStructurePercent.kind === 'invalid') return fail('结构时间保留系数无效，不当作未知或自动填默认值。');
    if (valueOf(input,'roughStructurePercent')===0) return fail('结构时间保留系数为0%，结果时间为0，不能作为比较分母；请修改系数。');
  }
  let energy: number, kind: RoughEstimate['kind'] = '粗估';
  if (quantityKnown(input, 'energy')) {
    energy = valueOf(input, 'availableEnergy')!;
    assumptions.push(`目标可用能量${energy}Wh（${input.energyBasis==='assumed'?'用户明确假设':input.energyBasis==='curve'?'适用曲线':'独立测量'}：${input.energyNote}）`);
    usedInputs.push('availableEnergy', 'energyBasis', 'energyNote', 'targetStartVoltage', 'targetEndVoltage', 'targetVoltageState', 'targetIntervalNote', 'targetApplies');
  } else {
    if (percentInvalid) return fail('可用容量比例为非法／零读数，本次不改用全部标称能量；请修正或明确选择未知。');
    const voltage = nominalVoltage(input);
    if (voltage === null) return fail('LiHV标称单节电压未知／不受支持：按电池标签选择3.80或3.85V，或提供有依据的目标可用Wh；不从起降电压猜测。');
    const nominal = nominalEnergyWh(valueOf(input, 'capacity')!, valueOf(input, 'cells')!, voltage)!;
    energy = nominal * (percent === null ? 1 : percent / 100);
    if (percent === null) { kind = '标称能量等效'; assumptions.push('假设标称能量全部可用'); }
    else assumptions.push(`用户假设可用容量比例${percent}%，按相同比例折算标称能量（不积分放电曲线）`);
    assumptions.push(`标称能量=${valueOf(input, 'capacity')}mAh÷1000×${valueOf(input, 'cells')}S×${voltage}V/节；不是起降电压平均值`);
    usedInputs.push('capacity', 'cells', 'chemistry', 'roughCapacityPercent'); if (input.chemistry === 'LiHV') usedInputs.push('roughNominalVoltage');
  }
  const auxReading = input.readings.roughAuxPower;
  if (auxReading.kind === 'invalid') return fail('辅助功耗假设非法，跳过理论粗估；不把非法值视为未知。');
  const aux = valueOf(input, 'roughAuxPower');
  if (aux === null) assumptions.push('辅助功耗未知：仅计推进功耗的场景，未计图传等设备');
  else assumptions.push(`辅助功耗${aux}W（用户假设${aux===0?'，明确输入0':''}）`);
  assumptions.push('内部基础来自无风静态悬停功率，所选工况最后另乘用户时间系数；不匹配实际风况');
  let idealScenario: IdealScenario | null = null;
  if (ideal) {
    const structurePercent = valueOf(input,'roughStructurePercent');
    const powerW = ideal.idealPowerW + (aux ?? 0);
    const minutes = timeFromEnergy(energy,powerW)!;
    idealScenario = { ...ideal, structurePercent, powerW, energyWh: energy, minutes };
    assumptions.push(structurePercent === null ? '结构时间保留系数未知：未应用结构折减，不认定实际无损耗' : `结构时间保留系数${structurePercent}%为用户假设，最终时间×${structurePercent/100}，不再做功率侧损耗修正`);
    assumptions.push('空气密度固定为标准海平面假设1.225kg/m³，不代表现场温度／气压；不从温度单独推密度');
    assumptions.push('正方形四轴、等径独立桨盘、均匀承重、自由空气中静态悬停；忽略地面效应及机架干扰');
    if (guarded) assumptions.push(`${input.configurationGroup === 'whoop' ? '圈圈机／Whoop' : '涵道四轴'}：借用未建模涵道的理想桨盘基线及用户结构时间假设；未计算涵道增升、桨尖间隙或气流干扰，不是涵道性能模型，不使用开放桨匿名台架功率`);
    assumptions.push('只核实理论公式／量纲及实现；未验证实机精度、电机最大推力、桨尖转速或能否实际悬停，时间系数不保证接近实飞');
  } else {
    assumptions.push('各表列测试电压分别计算，尚未匹配本次飞行负载电压');
    assumptions.push('同类配置不等于相同产品；电调计入、装配、温度仍未知，无实飞验证');
    if (valueOf(input,'roughStructurePercent') !== null) assumptions.push('已有台架电功率：结构时间系数不再叠加，避免重复折减');
  }
  const scenarios: RoughScenario[] = (hasCandidates ? category.candidates : []).map(c => {
    const powerW = 4 * c.motorPowerW + (aux ?? 0);
    return { ...c, powerW, energyWh: energy, minutes: timeFromEnergy(energy, powerW)! };
  });
  const powers = idealScenario ? [idealScenario.powerW] : scenarios.map(s => s.powerW), rangeMinutes = scenarioTimeRange([energy, energy], [Math.min(...powers), Math.max(...powers)]);
  if (!rangeMinutes) return fail('假设形成的能量或功率无效，未生成时间。');
  const energySummary = kind === '标称能量等效' ? '假设标称能量全部可用' : quantityKnown(input,'energy') ? `目标可用能量${energy}Wh` : `假设可用容量${percent}%`;
  const summary = `基础来自匿名台架：${energySummary}；${aux === null ? '仅计推进功耗' : `辅助${aux}W`}，按各测试电压分场景。`;
  const idealSummary = idealScenario ? `基础来自理想模型：${energySummary}；${idealScenario.structurePercent === null ? '结构时间系数未知，未折减' : `结构时间×${idealScenario.structurePercent/100}（假设）`}；${aux===null?'仅推进':`辅助${aux}W`}。` : '';
  return { notices: [], estimate: applyStyle(input, { kind: idealScenario ? '理想模型粗估' : kind, timeLabel:'基础时间', rangeMinutes, summary:idealSummary || summary, assumptions, scenarios, idealScenario,basis:idealScenario?'ideal':'anonymous-bench',
    usedInputs: [...usedInputs, 'roughAuxPower', 'weight', 'diameter', 'libraryGeometry', 'configurationGroup', ...(idealScenario ? ['wheelbase','roughStructurePercent'] : ['stator','kv','pitch','blades','cells'])],
    details: [{ label: '粗估假设与缺失项', value: idealScenario ? '理想物理模型与用户假设，非实机验证' : '场景范围，非统计误差／置信区间', basis: `${assumptions.join('；')}。${idealScenario?'A总=4π(D/2)²；T=mg；P理想=T√(T/(2ρA总))。定子／KV／螺距／叶片数不决定理想功率，未验证真实动力能力。':'P≈4×P单电机+P辅助；只在每段推力覆盖内插值，不拼组、不跨电压、不外推。'}T基础=60×可用Wh/P，最终另乘工况时间系数。不是实际可飞时间、保证时间或安全上限。` }] }) };
}
