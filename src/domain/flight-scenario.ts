import { valueOf, type FlightStyle, type ValidInput } from './types';
import { quantityKnown } from './endurance';

// Explicit user assumptions, never independent flight calibration data.
export const flightScenarios: Record<FlightStyle, { label: string; timeFactor: number }> = {
  hover: { label: '悬停', timeFactor: 1 },
  cruise: { label: '巡航', timeFactor: 0.8 },
  freestyle: { label: '花飞', timeFactor: 0.58 },
  race: { label: '竞速', timeFactor: 0.33 },
};
export function applyFlightTime(baseMinutes: number, style: string): number | null {
  const scenario = flightScenarios[style as FlightStyle];
  if (!scenario || !Number.isFinite(baseMinutes) || baseMinutes <= 0) return null;
  return baseMinutes * scenario.timeFactor;
}
export interface TimeComparison {
  actualMinutes: number; referenceRange: [number, number];
  differenceRange: [number, number]; achievementRange: [number, number];
}
export function compareFlightTime(actualSeconds: number, referenceRange: readonly [number, number]): TimeComparison | null {
  if (!Number.isFinite(actualSeconds) || actualSeconds < 0 || !referenceRange.every(t => Number.isFinite(t) && t > 0) || referenceRange[0] > referenceRange[1]) return null;
  const actualMinutes = actualSeconds / 60;
  return { actualMinutes, referenceRange: [...referenceRange],
    differenceRange: [actualMinutes-referenceRange[1], actualMinutes-referenceRange[0]],
    achievementRange: [actualMinutes/referenceRange[1]*100, actualMinutes/referenceRange[0]*100] };
}
export function comparisonSummary(comparison: TimeComparison): string {
  const [low,high] = comparison.differenceRange, [a,b] = comparison.achievementRange;
  const signed = (n:number) => `${n>0?'+':n<0?'−':''}${Math.abs(n).toFixed(2)}`;
  const delta = low === high ? signed(low) : `${signed(low)}～${signed(high)}`;
  const direction = low === high ? low < 0 ? `比参考短${Math.abs(low).toFixed(2)}分钟` : low > 0 ? `比参考长${low.toFixed(2)}分钟` : '与参考时间相同' : '与参考场景范围比较';
  return `${direction}（实际－参考：${delta}分钟），达到参考的${a===b?a.toFixed(1):`${a.toFixed(1)}～${b.toFixed(1)}`}%。`;
}
export function comparisonIntervalNote(input: ValidInput): string {
  if (input.comparisonConditions === 'same' && quantityKnown(input,'energy') && input.targetVoltageState === 'rest' &&
      valueOf(input,'targetStartVoltage') === valueOf(input,'startVoltage') && valueOf(input,'targetEndVoltage') === valueOf(input,'endVoltage')) {
    return '用户确认电量区间、测量状态及时机和结束条件一致，尚未独立核验；比较不代表正式评级或电池健康。';
  }
  const why = input.comparisonConditions === 'early' ? '本次提前落地或未用完目标能量。' : input.comparisonConditions === 'different' ? '用户确认电量区间或结束条件不同。' : '电量区间与结束条件尚未核实一致。';
  return `${why}使用区间可能不同，不能据此判断性能异常。`;
}
