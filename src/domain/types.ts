import type { StatorReading } from './stator';
import type { CategoryBenchResult } from './category-bench';
import type { RoughEstimate } from './rough-estimate';
import type { TimeComparison } from './flight-scenario';
import { selectStructure } from './structure';
export const styles = ['hover', 'cruise', 'freestyle', 'race'] as const;
export type FlightStyle = typeof styles[number];
export const sourceValues = ['unknown', 'calibrated-flight', 'uncalibrated-flight', 'charger', 'other'] as const;
export type Reading = { kind: 'value'; value: number } | { kind: 'missing' | 'unknown' | 'invalid' };
export const numberFields = ['weight', 'wheelbase', 'kv', 'diameter', 'pitch', 'blades', 'capacity', 'cells', 'minutes', 'seconds', 'startVoltage', 'endVoltage', 'landingDelay', 'resistance', 'current', 'consumed', 'loadedVoltage', 'beforeStop', 'afterStop', 'temperature', 'availableCapacity', 'availableEnergy', 'targetStartVoltage', 'targetEndVoltage', 'auxPower', 'benchVoltage', 'startDelay', 'benchKv', 'roughCapacityPercent', 'roughAuxPower', 'roughStructurePercent', 'frameMaxProp'] as const;
export type NumberField = typeof numberFields[number];
export type RawInput = Record<NumberField, string> & {
  aircraft: string; style: string; chemistry: string; motor: string; propModel: string;
  stator: string; libraryGeometry: string;
  estimateMode: string; roughNominalVoltage: string;
  resistanceMethod: string; resistanceDevice: string;
  currentSource: string; consumedSource: string; sourceDetail: string;
  paired: string; wind: string;
  configurationGroup: string; capacityBasis: string; capacityNote: string; energyBasis: string; energyNote: string;
  targetVoltageState: string; targetIntervalNote: string; targetApplies: string;
  auxBasis: string; auxNote: string; benchData: string; benchSource: string; benchConditions: string;
  benchGroup: string; benchMatches: string; benchIncludesEsc: string; benchAssembly: string; benchThrustUnit: string;
  recoveryConditions: string; comparisonConditions: string;
  benchMotor:string; benchPropModel:string; benchVersion:string;
};
export type ValidInput = Omit<RawInput, NumberField> & {
  readings: Record<NumberField, Reading>; durationSeconds: number; benchPoints: BenchPoint[] | null; statorReading: StatorReading;
};
export interface Issue { field: keyof RawInput; message: string }
export interface Validation { input: ValidInput | null; errors: Issue[]; optionalIssues: Issue[]; warnings: string[] }
export type Rating = '偏短' | '正常' | '较长' | '参考不足';
export interface BenchPoint { thrust: number; electricalPowerW: number }
export type ResultKind = '实测参考' | '模型粗估' | '等效续航' | '参考不足' | '粗估' | '标称能量等效' | '理想模型粗估';
export interface Detail { label: string; value: string; basis: string }
export interface Analysis {
  rating: Rating; referenceSeconds: [number, number] | null; reason: string;
  sag: Detail | null; rebound: Detail | null; details: Detail[];
  notices: string[]; usedInputs: string[]; unusedInputs: string[];
  kind: ResultKind; timeMinutes: number | null; timeLabel: string; observedRangeSeconds: [number, number] | null;
  categoryBench: CategoryBenchResult;
  timeRangeMinutes: [number, number] | null; roughEstimate: RoughEstimate | null;
  comparison: TimeComparison | null;
}
export function blankInput(): RawInput {
  return {
    ...Object.fromEntries(numberFields.map(k => [k, ''])),
    ...selectStructure('quad'), style: 'cruise', chemistry: 'LiPo', motor: '', propModel: '', stator: '', libraryGeometry: '',
    estimateMode: 'rough', roughNominalVoltage: 'unknown',
    resistanceMethod: 'unknown', resistanceDevice: '', currentSource: 'unknown', consumedSource: 'unknown',
    sourceDetail: '', paired: 'unknown', wind: 'unknown', landingDelay: '未知',
    beforeStop: '未知', afterStop: '未知', temperature: '未知',
    capacityBasis: 'unknown', capacityNote: '', energyBasis: 'unknown', energyNote: '',
    targetVoltageState: 'unknown', targetIntervalNote: '', targetApplies: 'unknown',
    auxBasis: 'unknown', auxNote: '', benchData: '', benchSource: '', benchConditions: '',
    benchGroup: 'unknown', benchMatches: 'unknown', benchIncludesEsc: 'unknown', benchAssembly: 'unknown', benchThrustUnit: 'unknown',
    recoveryConditions: 'unknown', comparisonConditions: 'unknown', startDelay: '未知',
    benchMotor:'',benchPropModel:'',benchVersion:'',
  } as RawInput;
}
export function knownText(text: string): boolean {
  return !!text.trim() && !['未知', '不清楚', 'unknown'].includes(text.trim().toLowerCase());
}
export function valueOf(input: ValidInput, field: NumberField): number | null {
  const r = input.readings[field];
  return r.kind === 'value' ? r.value : null;
}
