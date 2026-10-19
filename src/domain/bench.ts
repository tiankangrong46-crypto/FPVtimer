import type { BenchPoint } from './types';
export const STANDARD_GRAVITY = 9.80665;
export function thrustToNewton(thrust: number, unit: 'gf' | 'N'): number {
  return unit === 'gf' ? thrust * STANDARD_GRAVITY / 1000 : thrust;
}
export function perMotorHoverThrust(weightG: number): number | null {
  return Number.isFinite(weightG) && weightG > 0 ? thrustToNewton(weightG / 4, 'gf') : null;
}
export function parseBenchData(raw: string): BenchPoint[] | null {
  const lines = raw.trim().split(/\r?\n/).filter(s => s.trim());
  if (lines.length < 2 || lines.length > 500) return null;
  const points: BenchPoint[] = [];
  for (const line of lines) {
    const parts = line.trim().split(/[,，\t ]+/);
    // Keep source precision; input is a transcription of an engineering table, not a measured weight field.
    if (parts.length !== 2 || parts.some(s => !/^\d+(\.\d{1,3})?$/.test(s))) return null;
    const [thrust, electricalPowerW] = parts.map(Number);
    if (![thrust, electricalPowerW].every(n => Number.isFinite(n) && n > 0 && n <= 1e7)) return null;
    points.push({ thrust, electricalPowerW });
  }
  points.sort((a,b) => a.thrust - b.thrust);
  if (points.some((p,i) => i > 0 && p.thrust <= points[i-1].thrust)) return null;
  return points;
}
export function interpolateElectricalPower(points: readonly BenchPoint[], targetN: number, unit: 'gf' | 'N'): number | null {
  if (!Number.isFinite(targetN) || targetN <= 0 || points.length < 2) return null;
  const normalized = points.map(p=>({thrust:thrustToNewton(p.thrust,unit),power:p.electricalPowerW})).sort((a,b)=>a.thrust-b.thrust);
  if (normalized.some((p,i)=>!Number.isFinite(p.thrust)||!Number.isFinite(p.power)||p.thrust<=0||p.power<=0||(i>0&&p.thrust<=normalized[i-1].thrust))) return null;
  if (targetN < normalized[0].thrust || targetN > normalized.at(-1)!.thrust) return null;
  for (let i=0;i<normalized.length;i++) {
    if (targetN===normalized[i].thrust) return normalized[i].power;
    if (i && targetN<normalized[i].thrust) {
      const a=normalized[i-1],b=normalized[i];
      return a.power+(b.power-a.power)*(targetN-a.thrust)/(b.thrust-a.thrust);
    }
  }
  return null;
}
export function timeFromEnergy(energyWh: number, averagePowerW: number): number | null {
  if (![energyWh,averagePowerW].every(x=>Number.isFinite(x)&&x>0)) return null;
  return 60*energyWh/averagePowerW;
}
