import { numberFields, sourceValues, styles, type NumberField, type RawInput, type Reading, type Validation } from './types';
import { parseBenchData } from './bench';
import { knownText } from './types';
import { parseStator } from './stator';
import { selectedGeometry } from './category-bench';

const integers = new Set<NumberField>(['cells', 'blades', 'minutes', 'seconds']);
const voltages = new Set<NumberField>(['startVoltage', 'endVoltage', 'loadedVoltage', 'targetStartVoltage', 'targetEndVoltage', 'benchVoltage']);
const optional = new Set<NumberField>(['resistance', 'current', 'consumed', 'loadedVoltage', 'beforeStop', 'afterStop', 'temperature', 'availableCapacity', 'availableEnergy', 'targetStartVoltage', 'targetEndVoltage', 'auxPower', 'benchVoltage', 'startDelay', 'benchKv', 'roughCapacityPercent', 'roughAuxPower', 'roughStructurePercent', 'frameMaxProp']);
const unknownAllowed = new Set<NumberField>([...optional, 'landingDelay']);
const zeros = new Set<NumberField>(['minutes', 'seconds', 'landingDelay', 'beforeStop', 'afterStop', 'resistance', 'current', 'consumed', 'temperature', 'auxPower', 'startDelay', 'roughAuxPower', 'roughStructurePercent']);
export const labels: Record<NumberField, string> = {
  weight: '起飞总重量', wheelbase: '机架轴距', kv: '电机 KV', diameter: '桨叶直径', pitch: '桨叶螺距', blades: '叶片数',
  capacity: '标称容量', cells: '串联节数', minutes: '飞行分钟', seconds: '飞行秒数', startVoltage: '起飞前整包电压',
  endVoltage: '落地停桨后整包电压', landingDelay: '落地后测量间隔', resistance: '平均单节内阻', current: '平均电流',
  consumed: '本次消耗电量', loadedVoltage: '落地前负载整包电压', beforeStop: '负载读数距停桨', afterStop: '停桨后测量间隔', temperature: '环境温度',
  availableCapacity: '目标区间可用容量', availableEnergy: '目标区间可用能量', targetStartVoltage: '目标起点整包电压', targetEndVoltage: '目标终点整包电压', auxPower: '辅助设备功耗', benchVoltage: '台架测试电压', startDelay: '起飞电压测量距起飞时间',
  benchKv:'台架电机KV',
  roughCapacityPercent: '粗估可用容量比例', roughAuxPower: '粗估辅助功耗', 
  roughStructurePercent: '结构时间保留系数', frameMaxProp:'机架允许最大桨径',
};
export function parseReading(raw: string, decimals = 1, allowNegative = false): Reading {
  const s = raw.trim();
  if (!s) return { kind: 'missing' };
  if (['未知', '不清楚', 'unknown'].includes(s.toLowerCase())) return { kind: 'unknown' };
  const pattern = new RegExp(`^${allowNegative ? '-?' : ''}\\d+${decimals ? `(\\.\\d{1,${decimals}})?` : ''}$`);
  if (!pattern.test(s) || !Number.isFinite(Number(s))) return { kind: 'invalid' };
  return { kind: 'value', value: Number(s) };
}
export function validate(raw: RawInput): Validation {
  const result: Validation = { input: null, errors: [], optionalIssues: [], warnings: [] };
  const readings = {} as Record<NumberField, Reading>;
  const hasModel = knownText(raw.propModel);
  const hasGeometrySelection = knownText(raw.libraryGeometry);
  const geometry = hasGeometrySelection ? selectedGeometry(raw.libraryGeometry) : null;
  if (hasGeometrySelection && !geometry) result.optionalIssues.push({ field: 'libraryGeometry', message: '桨叶几何选择无效或参考库不可用，本次跳过同类候选；基础评估仍可使用。' });
  const statorReading = parseStator(raw.stator);
  if (statorReading.kind === 'invalid') result.optionalIssues.push({ field: 'stator', message: '定子规格须为尺寸字符串，例如0802、2306或2806.5；也可留空／未知。仅跳过同类候选。' });
  for (const field of numberFields) {
    if (hasGeometrySelection && ['diameter', 'pitch', 'blades'].includes(field)) {
      const selected = geometry && ({ diameter: geometry.diameterIn, pitch: geometry.pitchIn, blades: geometry.blades })[field as 'diameter' | 'pitch' | 'blades'];
      readings[field] = typeof selected === 'number' ? { kind: 'value', value: selected } : { kind: 'invalid' };
      continue; // Disabled manual strings are preserved in raw input, never used instead of the explicit selection.
    }
    const precision = integers.has(field) ? 0 : voltages.has(field) ? 3 : 1;
    let r = parseReading(raw[field], precision, field === 'temperature');
    let error = '';
    const notRequired = optional.has(field) || ((hasModel || hasGeometrySelection) && ['diameter', 'pitch', 'blades'].includes(field));
    if (r.kind === 'missing' && !notRequired) error = `请填写${labels[field]}`;
    if (r.kind === 'unknown' && !unknownAllowed.has(field) && !notRequired) error = `${labels[field]}不能为未知`;
    if (r.kind === 'invalid') error = `${labels[field]}须为${precision ? `最多 ${precision} 位小数的数字` : '整数'}${unknownAllowed.has(field) ? '，或填写未知' : ''}`;
    if (r.kind === 'value') {
      if (!zeros.has(field) && r.value <= 0) error = `${labels[field]}必须大于 0`;
      if (field !== 'temperature' && r.value < 0) error = `${labels[field]}不能为负数`;
      if (field === 'cells' && (r.value < 1 || r.value > 8)) error = '串联节数仅支持 1–8S';
      if (field === 'seconds' && r.value > 59) error = '飞行秒数须为 0–59';
      if (field === 'roughCapacityPercent' && r.value > 100) error = '粗估可用容量比例须大于0且不超过100%';
      if (field === 'roughStructurePercent' && r.value > 100) error = '结构时间保留系数须为0至100%，不再按功率侧损耗计算';
      if (Math.abs(r.value) > 1e7) error = `${labels[field]}数值过大，请检查单位`;
    }
    if (error) {
      (optional.has(field) ? result.optionalIssues : result.errors).push({ field, message: error });
      r = { kind: 'invalid' };
    }
    readings[field] = r;
  }
  const enumChecks = [
    ['style', styles], ['chemistry', ['LiPo', 'LiHV']], ['aircraft', ['quad', 'other']],
    ['resistanceMethod', ['unknown', 'charger', 'dc', 'ac', 'other']],
    ['currentSource', sourceValues], ['consumedSource', sourceValues],
    ['paired', ['unknown', 'yes', 'no']], ['wind', ['unknown', 'calm', 'light', 'strong']],
    ['configurationGroup', ['unknown','open','ducted','whoop']],
    ['capacityBasis', ['unknown','measured','curve','assumed','this-flight']], ['energyBasis', ['unknown','measured','curve','assumed','this-flight']],
    ['targetVoltageState', ['unknown','rest','load']], ['targetApplies', ['unknown','yes','no']],
    ['auxBasis', ['unknown','measured','assumed']], ['benchGroup', ['unknown','open','ducted','whoop']],
    ['benchMatches', ['unknown','yes','no']], ['benchIncludesEsc', ['unknown','yes','no']],
    ['benchAssembly', ['unknown','isolated','installed']], ['benchThrustUnit', ['unknown','gf','N']],
    ['recoveryConditions', ['unknown','negligible','not-negligible']],
    ['comparisonConditions', ['unknown','same','different','early']],
    ['estimateMode', ['standard','rough']], ['roughNominalVoltage', ['unknown','3.8','3.85']],
  ] as const;
  for (const [field, allowed] of enumChecks) {
    if (!(allowed as readonly string[]).includes(raw[field])) {
      const issue = { field, message: '请选择有效选项' };
      if (['style', 'chemistry', 'aircraft', 'estimateMode'].includes(field)) result.errors.push(issue);
      else { result.optionalIssues.push(issue); }
    }
  }
  const numeric = (k: NumberField) => readings[k].kind === 'value' ? readings[k].value : null;
  const duration = (numeric('minutes') ?? 0) * 60 + (numeric('seconds') ?? 0);
  if (!result.errors.some(e => ['minutes', 'seconds'].includes(e.field)) && duration <= 0) result.errors.push({ field: 'minutes', message: '实际飞行时间必须大于 0' });
  const cells = numeric('cells');
  if (cells) {
    const full = raw.chemistry === 'LiHV' ? 4.35 : 4.2;
    for (const field of ['startVoltage', 'endVoltage'] as const) {
      const v = numeric(field);
      if (v && v / cells > full) result.warnings.push(`${labels[field]}的平均单节电压超过 ${full.toFixed(2)} V；请核对节数、类型和读数，整包均值不能检查单节失衡。`);
    }
  }
  if ((numeric('endVoltage') ?? 0) > (numeric('startVoltage') ?? Infinity)) result.warnings.push('落地电压高于起飞电压，请核对读数与测量条件；不据此推断耗电量。');
  const benchPoints = knownText(raw.benchData) ? parseBenchData(raw.benchData) : null;
  if (knownText(raw.benchData) && !benchPoints) result.optionalIssues.push({field:'benchData',message:'台架表须有 2–500 行；每行“推力,电输入功率W”，正数最多三位小数，推力不可重复；本次跳过台架模型。'});
  if (!result.errors.length) result.input = { ...raw, readings, durationSeconds: duration, benchPoints, statorReading };
  return result;
}
