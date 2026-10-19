import { referenceLibrary, type Coverage, type Geometry, type LibraryState } from '../data/reference-library';
import { interpolateElectricalPower, perMotorHoverThrust } from './bench';
import { valueOf, type ValidInput } from './types';

export const geometryKey = (g: Geometry) => `${g.diameterIn}|${g.pitchIn}|${g.blades}`;
export function geometryChoices(library: LibraryState = referenceLibrary): readonly Geometry[] {
  if (!library.available) return [];
  const geometries = [...library.propellers, ...library.segments.map(s => s.propeller)];
  return [...new Map(geometries.map(g => [geometryKey(g), g])).values()];
}
export function selectedGeometry(key: string, library: LibraryState = referenceLibrary): Geometry | null {
  return geometryChoices(library).find(g => geometryKey(g) === key) ?? null;
}
export function motorCoverage(stator: string, kv: number | null, library: LibraryState = referenceLibrary): Coverage | null {
  return library.available ? library.coverage.find(c => c.stator === stator && c.kv === kv) ?? null : null;
}
export interface CategoryCandidate {
  readonly segmentId: string; readonly curveId: string; readonly voltageV: number; readonly motorPowerW: number;
  readonly thrustRangeGf: readonly [number, number];
  readonly escInclusion: 'unknown'; readonly assembly: 'unknown'; readonly temperatureC: null; readonly flightValidation: 'none';
}
export interface CategoryBenchResult {
  readonly status: 'unavailable' | 'missing' | 'no-match' | 'unsupported' | 'out-of-range' | 'candidates';
  readonly version: string | null; readonly message: string; readonly coverage: Coverage | null;
  readonly candidates: readonly CategoryCandidate[]; readonly matchedSegments: number;
  readonly geometry: Geometry | null; readonly targetThrustGf: number | null;
}
// Candidates never supply facts for the exact-motor model or a formal rating.
// Explicit rough mode may compose them into separate, unvalidated hover scenarios.
export function categoryBench(input: ValidInput, library: LibraryState = referenceLibrary, scope: 'current-hover' | 'hover-scenario' = 'current-hover'): CategoryBenchResult {
  const base = { version: library.available ? library.version : null, coverage: null, candidates: [], matchedSegments: 0, geometry: null, targetThrustGf: null };
  if (!library.available) return { ...base, status: 'unavailable', message: library.message };
  const stator = input.statorReading.kind === 'value' ? input.statorReading.value : null;
  const kv = valueOf(input, 'kv'), cells = valueOf(input, 'cells');
  if (!stator || kv === null || cells === null) return { ...base, status: 'missing', message: '定子规格、KV或节数未知／无效，跳过同类候选；不推测邻近配置。' };
  const coverage = motorCoverage(stator, kv, library);
  if (!coverage) return { ...base, status: 'no-match', message: `${stator} / ${kv} KV 暂无匹配候选，不借用邻近KV。` };
  const chosen = input.libraryGeometry ? selectedGeometry(input.libraryGeometry, library) : null;
  const d = valueOf(input, 'diameter'), p = valueOf(input, 'pitch'), b = valueOf(input, 'blades');
  const geometry = input.libraryGeometry ? chosen : d !== null && p !== null && b !== null ? { diameterIn: d, pitchIn: p, blades: b } : null;
  const withCoverage = { ...base, coverage, geometry };
  if (!geometry) return { ...withCoverage, status: 'missing', message: '桨叶几何未知或选择无效：需明确桨径、螺距、叶片数；不从型号猜测。' };
  const matches = library.segments.filter(s => s.stator === stator && s.kv === kv && s.cells === cells && geometryKey(s.propeller) === geometryKey(geometry));
  const matched = { ...withCoverage, matchedSegments: matches.length };
  if (!matches.length) return { ...matched, status: 'no-match', message: '当前定子＋KV＋桨叶几何＋节数暂无匹配同电压段，不缩放或跨组拼接。' };
  if (input.aircraft !== 'quad' || input.configurationGroup !== 'open' || (scope === 'current-hover' && (input.style !== 'hover' || input.wind !== 'calm'))) {
    return { ...matched, status: 'unsupported', message: `找到 ${matches.length} 段；仅对普通开放桨四轴、无明显风静态悬停展示候选功率，当前工况或类别依据不足。` };
  }
  const weight = valueOf(input, 'weight'), targetN = weight === null ? null : perMotorHoverThrust(weight);
  if (targetN === null) return { ...matched, status: 'missing', message: '有效起飞重量缺失，无法计算单电机目标推力。' };
  const candidates: CategoryCandidate[] = [];
  for (const segment of matches) {
    // Explicit adapter: library gf is NOT the domain BenchPoint thrust field or N.
    const points = segment.points.map(p => ({ thrust: p.thrustGf, electricalPowerW: p.electricalPowerW }));
    const motorPowerW = interpolateElectricalPower(points, targetN, 'gf');
    if (motorPowerW !== null) candidates.push({ segmentId: segment.id, curveId: segment.curveId, voltageV: segment.voltageV, motorPowerW,
      thrustRangeGf: [segment.points[0].thrustGf, segment.points.at(-1)!.thrustGf], escInclusion: segment.escInclusion,
      assembly: segment.assembly, temperatureC: segment.temperatureC, flightValidation: segment.flightValidation });
  }
  return { ...matched, targetThrustGf: weight! / 4, candidates, status: candidates.length ? 'candidates' : 'out-of-range',
    message: candidates.length ? `有 ${candidates.length} 段覆盖目标推力，${scope === 'hover-scenario' ? '可用于另行标注假设的无风悬停等效场景，不用于评级' : '仅展示各测试电压下的单电机同类候选功率，不生成续航或评级'}。` : '目标推力不在任何匹配段覆盖范围内，跳过候选功率；不外推，不断言飞机不能飞。' };
}
