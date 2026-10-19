import { enduranceReferences, styleCalibrations, type EnduranceReference, type StyleCalibration } from '../data/references';
import { labels } from './validation';
import { valueOf, type Analysis, type ValidInput } from './types';
import { matchingReferences } from './reference';
import { decideEndurance } from './endurance';
import { categoryBench } from './category-bench';
import { referenceLibrary, type LibraryState } from '../data/reference-library';
import { roughEstimate } from './rough-estimate';
import { compareFlightTime, comparisonIntervalNote } from './flight-scenario';
export { classifyDuration } from './reference';

export function averageCurrentFromCharge(consumedMah: number, durationSeconds: number): number | null {
  if (!Number.isFinite(consumedMah) || !Number.isFinite(durationSeconds) || consumedMah <= 0 || durationSeconds <= 0) return null;
  return consumedMah * 3.6 / durationSeconds;
}

export function matchingReference(input: ValidInput, refs: readonly EnduranceReference[]): EnduranceReference | undefined {
  const matches=matchingReferences(input,refs);
  return matches.length===1?matches[0]:undefined;
}
export function analyze(input: ValidInput, refs:readonly EnduranceReference[] = enduranceReferences, calibrations:readonly StyleCalibration[] = styleCalibrations, library:LibraryState = referenceLibrary): Analysis {
  const v = (k: keyof ValidInput['readings']) => valueOf(input, k);
  const used = new Set<string>(['实际飞行时间', '飞机适用范围']);
  const result: Analysis = {
    rating: '参考不足', referenceSeconds: null,
    reason: input.aircraft === 'quad' ? '没有满足配置、飞行方式和起降测量条件的实测参考，暂不判断续航长短。' : '本版仅适用于普通四轴穿越机，当前配置超出适用范围。',
    sag: null, rebound: null, details: [], notices: [], usedInputs: [], unusedInputs: [],
    kind:'参考不足',timeMinutes:null,timeLabel:'参考飞行时间',observedRangeSeconds:null,
    categoryBench: categoryBench(input, library, input.estimateMode === 'rough' ? 'hover-scenario' : 'current-hover'),
    timeRangeMinutes: null, roughEstimate: null, comparison:null,
  };
  const n = v('cells')!;
  result.details.push({ label: '实际飞行', value: `${input.durationSeconds} 秒（用户实测输入）`, basis: '分钟 × 60 + 秒；不从电压差反推容量。' });
  result.details.push({ label: '起飞 / 落地平均单节电压', value: `${(v('startVoltage')! / n).toFixed(3)} / ${(v('endVoltage')! / n).toFixed(3)} V`, basis: '整包电压 ÷ 节数，仅为算术均值，不代表每一节的电压或电量。' });
  ['cells', 'startVoltage', 'endVoltage'].forEach(k => used.add(labels[k as keyof typeof labels]));
  let average: number | null = null;
  let currentBasis = '';
  // Charger replenishment and uncalibrated/unknown sources are never silently used as discharge current.
  if (v('current') !== null && input.currentSource === 'calibrated-flight' && v('current')! > 0) {
    average = v('current'); currentBasis = '用户提供的已校准飞控/记录仪、同一飞行时段平均电流';
    used.add(labels.current); used.add('平均电流来源');
  }
  if (v('consumed') !== null && input.consumedSource === 'calibrated-flight' && v('consumed')! > 0) {
    const integrated = averageCurrentFromCharge(v('consumed')!, input.durationSeconds)!;
    result.details.push({ label: '电量积分折算平均电流', value: `${integrated.toFixed(2)} A（估计）`, basis: '本次放电 mAh × 3.6 ÷ 飞行秒数；须为同一时段且电流计已校准，不使用充电器回充量。' });
    used.add(labels.consumed); used.add('消耗电量来源');
    if (average === null) { average = integrated; currentBasis = '同一飞行时段、已校准放电积分与时间折算的平均电流'; }
    else result.notices.push('平均电流与消耗电量均已填写：压降采用直接平均电流；折算电流供核对，不将两者平均。');
  }
  if (v('current') === 0 || v('consumed') === 0) result.notices.push('零电流／零消耗保留为零读数，无法支持有动力飞行的负载估计；未视为未知。');
  if (v('resistance') === 0) result.notices.push('内阻为 0 是用户读数，可能低于仪器分辨率；不能据此认定零压降。');
  const device = input.resistanceDevice.trim().toLowerCase();
  const methodOK = (input.resistanceMethod === 'charger' || input.resistanceMethod === 'dc') && !!device && !['未知', '不清楚', 'unknown'].includes(device);
  if (v('resistance') !== null && v('resistance')! > 0 && average !== null && methodOK) {
    const drop = average * n * v('resistance')! / 1000;
    if (drop < v('startVoltage')!) {
      result.sag = { label: '平均负载压降', value: `约 ${drop.toFixed(3)} V / 整包`, basis: `${currentBasis}；ΔV ≈ I平均 × 节数 × 平均单节内阻 ÷ 1000。仅为电阻项粗估，不代表落地瞬时或峰值压降。${input.resistanceMethod === 'charger' ? '充电器算法、脉冲时长、接触电阻、温度与荷电状态会引入不确定性，未给出未经校准的误差百分比。' : '直流测量的电流、脉冲时长、接触与飞行条件差异会引入不确定性。'}` };
      ['resistance', 'cells'].forEach(k => used.add(labels[k as keyof typeof labels]));
      used.add('内阻测量方式／设备');
    } else result.notices.push('电阻模型压降已达到或超过起飞电压，模型或输入不适用，跳过压降数值。');
  }
  if (!result.sag) result.notices.push('压降未分析：需要正内阻、明确的充电器／直流测量设备，以及同一时段已校准的正平均电流或放电积分；交流内阻不能直接当作直流内阻。');
  const before = v('beforeStop'), after = v('afterStop');
  // No invented "close enough" seconds threshold: retain timing and label the observation accurately.
  if (v('loadedVoltage') !== null && before !== null && after !== null && input.paired === 'yes') {
    const delta = v('endVoltage')! - v('loadedVoltage')!;
    const elapsed = before + after;
    result.rebound = {
      label: input.recoveryConditions==='negligible'?'电压回弹（条件已确认）':'停桨前后电压读数差（非回弹结论）',
      value: `${delta > 0 ? '+' : ''}${delta.toFixed(3)} V / 整包`,
      basis: `用户确认同一次停桨、同一测量设备、期间无再次飞行或充电。负载读数在停桨前 ${before} 秒，停桨读数在停桨后 ${after} 秒，间隔 ${elapsed} 秒。差值为停桨后电压 − 负载电压；${delta > 0 ? '读数上升' : delta < 0 ? '未观测到电压回升，请核对条件与读数' : '显示精度下没有变化'}。${input.recoveryConditions==='negligible'?'用户另确认测量时间接近、期间电量变化可忽略，才将读数变化作为回弹观测；该确认并非程序自动验证。':'测量时间接近及期间电量变化可忽略尚未确认，仅展示读数差，跳过回弹解释。'}不据此计算瞬时内阻或电池健康；时间不接近时不解释为瞬时回弹。`,
    };
    ['loadedVoltage', 'endVoltage', 'beforeStop', 'afterStop'].forEach(k => used.add(labels[k as keyof typeof labels])); used.add('同次停桨与同设备确认');
    used.add('回弹测量条件确认');
  } else result.notices.push('回弹未分析：需要同次停桨的负载电压、停桨后电压、两个已知测量时点及同设备确认；起降电压差不能代替回弹。');
  if (v('consumed') !== null && v('consumed')! > v('capacity')!) result.notices.push('消耗电量超过标称容量，请检查电流计校准、积分时段和容量单位；不据此评价电池健康。');
  if (v('consumed') !== null) used.add(labels.capacity);
  if(average!==null)result.details.push({label:'本次平均耗电强度',value:`${average.toFixed(2)} A（${(average*1000/60).toFixed(1)} mAh/分钟）`,basis:`${currentBasis}；本次信息推算只用于耗电说明或等效续航，不能成为本次正常评级的独立证据。`});
  else if(v('current')!==null)result.details.push({label:'用户填报平均电流（未核实）',value:`${v('current')} A`,basis:'测量来源、校准或同一时段信息不足；保留填报值，不作已核实电流或等效时间依据。'});
  else if(v('consumed')!==null)result.details.push({label:'用户填报消耗量（未核实为放电积分）',value:`${v('consumed')} mAh`,basis:'来源未知或为回充量，不能不加说明地当成本次放电mAh，跳过对应平均电流及等效时间。'});
  const decision=decideEndurance(input,average,{flights:refs,calibrations},result.categoryBench);
  Object.assign(result,{rating:decision.rating,kind:decision.kind,timeMinutes:decision.timeMinutes,timeLabel:decision.timeLabel,referenceSeconds:decision.referenceSeconds,observedRangeSeconds:decision.observedRangeSeconds,reason:decision.reason});
  result.details.push(...decision.details);result.notices.push(...decision.notices);
  decision.usedInputs.forEach(k=>used.add(k in labels?labels[k as keyof typeof labels]:k));
  if (input.estimateMode === 'rough') {
    const coarse = roughEstimate(input, null, result.categoryBench);
    result.notices.push(...coarse.notices);
    if (coarse.estimate) {
      const estimate = coarse.estimate;
      result.roughEstimate = estimate; result.comparison = compareFlightTime(input.durationSeconds,estimate.rangeMinutes);
      if (decision.kind !== '实测参考') {
        result.kind = estimate.kind; result.timeRangeMinutes = estimate.rangeMinutes;
        result.timeMinutes = estimate.rangeMinutes[0] === estimate.rangeMinutes[1] ? estimate.rangeMinutes[0] : null;
        result.timeLabel = estimate.timeLabel; result.reason = estimate.summary;
      }
      result.details.push({label:'比较区间和结束条件',value:comparisonIntervalNote(input),basis:'实际时长仅用于最后作差和达成率；不按起降电压差线性换算能量，不凭差值判断异常。'});
      used.add('本次实际时长（仅用于比较）');used.add('comparisonConditions');
      result.details.push(...estimate.details);
      estimate.usedInputs.forEach(k=>used.add(k in labels?labels[k as keyof typeof labels]:k));
      used.add('用户启用粗估模式');
    } else if (coarse.notices.length && decision.kind !== '实测参考') result.reason = coarse.notices[0];
  }
  if(result.categoryBench.status==='candidates') ['电机定子规格','电机 KV','桨叶几何','串联节数','起飞总重量','飞机结构／分组','飞行方式／风况'].forEach(k=>used.add(k));
  result.usedInputs=[...used];
  result.unusedInputs=[result.roughEstimate ? '标称容量／能量仅用于明确标注的粗估假设，未采用默认80%；未知辅助功耗只给未计辅助设备的推进场景。' : '标称容量未替代目标可用容量／能量，未采用默认80%比例。','未仅凭KV推算功率，未按起降电压差线性换算电量。','未按内阻压降再扣减续航百分比；本次飞行时间和消耗量未用于生成独立参考。'];
  return result;
}
