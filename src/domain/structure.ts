import type { RawInput } from './types';

// User-specified scenario defaults, not measured aerodynamic efficiencies.
export const structureOptions = [
  { value: 'quad', group: 'open', label: '裸桨', factorPercent: '25' },
  { value: 'whoop', group: 'whoop', label: '圈圈', factorPercent: '18' },
] as const;

export function structureValue(input: Pick<RawInput, 'aircraft' | 'configurationGroup'>): string {
  return input.configurationGroup === 'open' ? 'quad' : ['ducted','whoop'].includes(input.configurationGroup) ? 'whoop' : '';
}
export function selectStructure(value: string): Pick<RawInput, 'aircraft' | 'configurationGroup' | 'roughStructurePercent'> {
  const option = structureOptions.find(s => s.value === value);
  if (!option) throw new Error('Unsupported aircraft structure');
  return { aircraft: 'quad', configurationGroup: option.group, roughStructurePercent: option.factorPercent };
}
// A time retained fraction, not a power loss or a "subtract this percent" rule.
export function applyStructureTime(minutes: number, percent: number): number | null {
  if (!Number.isFinite(minutes)||minutes<=0||!Number.isFinite(percent)||percent<0||percent>100) return null;
  return minutes*percent/100;
}
