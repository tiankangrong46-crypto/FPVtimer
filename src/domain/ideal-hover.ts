import { STANDARD_GRAVITY } from './bench';

// 1976 standard sea-level atmosphere; this is a scenario assumption, not local weather inferred from temperature.
export const STANDARD_AIR_DENSITY = 1.225;
export const STANDARD_SOUND_SPEED = 340.3;
export const LOW_MACH_LIMIT = 0.3;
export interface IdealHover {
  readonly totalAreaM2: number; readonly totalThrustN: number; readonly inducedVelocityMs: number;
  readonly inducedMach: number; readonly idealPowerW: number; readonly densityKgM3: number;
  readonly farWakeMach: number;
}
export function idealHoverPower(weightG: number, diameterIn: number, densityKgM3 = STANDARD_AIR_DENSITY): IdealHover | null {
  if (![weightG, diameterIn, densityKgM3].every(n=>Number.isFinite(n)&&n>0)) return null;
  const radiusM = diameterIn * 0.0254 / 2;
  const totalAreaM2 = 4 * Math.PI * radiusM ** 2;
  const totalThrustN = weightG / 1000 * STANDARD_GRAVITY;
  const inducedVelocityMs = Math.sqrt(totalThrustN / (2 * densityKgM3 * totalAreaM2));
  const idealPowerW = totalThrustN * inducedVelocityMs;
  if (![totalAreaM2,totalThrustN,inducedVelocityMs,idealPowerW].every(n=>Number.isFinite(n)&&n>0)) return null;
  return { totalAreaM2,totalThrustN,inducedVelocityMs,idealPowerW,densityKgM3,inducedMach:inducedVelocityMs/STANDARD_SOUND_SPEED,farWakeMach:2*inducedVelocityMs/STANDARD_SOUND_SPEED };
}
