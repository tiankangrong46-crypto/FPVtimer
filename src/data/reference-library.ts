// One product data source: the supplied snapshot. No fetch, download, storage or provenance lookup.
import manifest from '../../reference-library/v0.1.0/manifest.json';
import motors from '../../reference-library/v0.1.0/motor-catalog.json';
import propellers from '../../reference-library/v0.1.0/propeller-catalog.json';
import curves from '../../reference-library/v0.1.0/bench-curves.json';
import segments from '../../reference-library/v0.1.0/constant-voltage-segments.json';
import coverage from '../../reference-library/v0.1.0/coverage.json';
import flights from '../../reference-library/v0.1.0/flight-references.json';
import calibrations from '../../reference-library/v0.1.0/style-calibrations.json';
import { parseStator } from '../domain/stator';

export interface Geometry { readonly diameterIn: number; readonly pitchIn: number; readonly blades: number }
export interface MotorCategory { readonly stator: string; readonly kv: number; readonly anonymousVariants: number; readonly benchPoints: number }
export interface PropellerCategory extends Geometry { readonly anonymousVariants: number }
export interface UnknownConditions {
  readonly escInclusion: 'unknown'; readonly assembly: 'unknown'; readonly temperatureC: null; readonly flightValidation: 'none';
}
export interface CurvePoint {
  readonly voltageV: number; readonly currentA: number; readonly thrustGf: number; readonly electricalPowerW: number;
  readonly rpm: number | null; readonly throttlePercent: number | null;
}
export interface AnonymousCurve extends UnknownConditions {
  readonly id: string; readonly stator: string; readonly kv: number; readonly cells: number;
  readonly propeller: Geometry | null; readonly eligibility: 'anonymous-category-candidate';
  readonly powerDefinition: 'reported-voltage-times-current'; readonly points: readonly CurvePoint[];
}
export interface VoltageSegment extends UnknownConditions {
  readonly id: string; readonly curveId: string; readonly stator: string; readonly kv: number; readonly cells: number;
  readonly propeller: Geometry; readonly voltageV: number; readonly eligibility: 'numeric-interpolation-only';
  readonly points: readonly { readonly thrustGf: number; readonly electricalPowerW: number }[];
}
export interface Coverage {
  readonly stator: string; readonly kv: number; readonly benchPoints: number; readonly anonymousCurves: number;
  readonly knownGeometryCurves: number; readonly constantVoltageSegments: number;
}
export type LibraryState = { readonly available: false; readonly message: string } | {
  readonly available: true; readonly version: '0.1.0'; readonly motors: readonly MotorCategory[];
  readonly propellers: readonly PropellerCategory[]; readonly curves: readonly AnonymousCurve[];
  readonly segments: readonly VoltageSegment[]; readonly coverage: readonly Coverage[];
  readonly flightReferences: readonly never[]; readonly styleCalibrations: readonly never[];
};
export const libraryFiles = { 'motor-catalog.json': motors, 'propeller-catalog.json': propellers,
  'bench-curves.json': curves, 'constant-voltage-segments.json': segments, 'coverage.json': coverage,
  'flight-references.json': flights, 'style-calibrations.json': calibrations };

function requireThat(ok: unknown): asserts ok { if (!ok) throw new Error('invalid library'); }
function object(value: unknown): Record<string, unknown> {
  requireThat(value && typeof value === 'object' && !Array.isArray(value)); return value as Record<string, unknown>;
}
function fields(value: unknown, allowed: string[]): Record<string, unknown> {
  const row = object(value);
  requireThat(Object.keys(row).length === allowed.length && allowed.every(k => Object.hasOwn(row, k))); return row;
}
function positive(n: unknown): n is number { return typeof n === 'number' && Number.isFinite(n) && n > 0; }
function count(n: unknown): n is number { return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0; }
function identity(row: Record<string, unknown>) {
  requireThat(typeof row.stator === 'string' && positive(row.kv));
  const size = parseStator(row.stator); requireThat(size.kind === 'value' && size.value === row.stator);
  return { stator: row.stator, kv: row.kv };
}
function geometry(raw: unknown): Geometry {
  const r = fields(raw, ['diameterIn', 'pitchIn', 'blades']);
  requireThat(positive(r.diameterIn) && positive(r.pitchIn) && count(r.blades) && r.blades >= 2 && r.blades <= 6);
  return { diameterIn: r.diameterIn, pitchIn: r.pitchIn, blades: r.blades };
}
const conditionFields = ['escInclusion', 'assembly', 'temperatureC', 'flightValidation'];
function unknownConditions(r: Record<string, unknown>): UnknownConditions {
  requireThat(r.escInclusion === 'unknown' && r.assembly === 'unknown' && r.temperatureC === null && r.flightValidation === 'none');
  return { escInclusion: 'unknown', assembly: 'unknown', temperatureC: null, flightValidation: 'none' };
}
function id(value: unknown, prefix: string): string {
  requireThat(typeof value === 'string' && new RegExp(`^${prefix}-[0-9a-f]{20}$`).test(value)); return value;
}
function cells(value: unknown): number { requireThat(count(value) && value >= 1 && value <= 8); return value; }
function array(value: unknown): unknown[] { requireThat(Array.isArray(value)); return value; }
const sameGeometry = (a: Geometry | null, b: Geometry | null) => a === null || b === null ? a === b :
  a.diameterIn === b.diameterIn && a.pitchIn === b.pitchIn && a.blades === b.blades;
const key = (r: { stator: string; kv: number }) => `${r.stator}|${r.kv}`;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value;
}

// Validate unknown input at one boundary. A bad optional snapshot must not break basic assessment.
// SHA-256 and file bytes are checked in offline build/tests, without runtime crypto dependencies.
export function loadReferenceLibrary(rawManifest: unknown, rawFiles: unknown): LibraryState {
  try {
    const m = object(rawManifest), files = object(rawFiles), caps = object(m.capabilities), counts = object(m.counts);
    requireThat(m.schemaVersion === '1.0.0' && m.libraryVersion === '0.1.0' && m.purpose === 'offline-anonymous-category-candidates');
    requireThat(caps.manufacturerFreeRecords === true && caps.provenanceFreeRecords === true &&
      ['exactProductMatching', 'formalEnduranceRating', 'validatedStyleMultipliers', 'independentAccuracyValidated'].every(k => caps[k] === false));
    const entries = array(m.files), seenFiles = new Set<string>();
    requireThat(entries.length === 7);
    const rows = new Map<string, unknown[]>();
    for (const raw of entries) {
      const entry = fields(raw, ['name', 'sha256', 'bytes', 'records']);
      requireThat(typeof entry.name === 'string' && Object.hasOwn(libraryFiles, entry.name) && !seenFiles.has(entry.name));
      requireThat(typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256) && count(entry.bytes) && count(entry.records));
      seenFiles.add(entry.name);
      const file = fields(files[entry.name], ['schemaVersion', 'libraryVersion', 'items']);
      requireThat(file.schemaVersion === m.schemaVersion && file.libraryVersion === m.libraryVersion);
      const items = array(file.items); requireThat(items.length === entry.records); rows.set(entry.name, items);
    }
    const motorRows: MotorCategory[] = rows.get('motor-catalog.json')!.map(raw => {
      const r = fields(raw, ['stator', 'kv', 'anonymousVariants', 'benchPoints']);
      requireThat(count(r.anonymousVariants) && r.anonymousVariants > 0 && count(r.benchPoints));
      return { ...identity(r), anonymousVariants: r.anonymousVariants, benchPoints: r.benchPoints };
    });
    const motorKeys = new Set(motorRows.map(key)); requireThat(motorKeys.size === motorRows.length);
    const propRows: PropellerCategory[] = rows.get('propeller-catalog.json')!.map(raw => {
      const r = fields(raw, ['diameterIn', 'pitchIn', 'blades', 'anonymousVariants']);
      requireThat(count(r.anonymousVariants) && r.anonymousVariants > 0);
      return { ...geometry({ diameterIn: r.diameterIn, pitchIn: r.pitchIn, blades: r.blades }), anonymousVariants: r.anonymousVariants };
    });
    const curveRows: AnonymousCurve[] = rows.get('bench-curves.json')!.map(raw => {
      const r = fields(raw, ['id', 'stator', 'kv', 'cells', 'propeller', 'eligibility', 'powerDefinition', ...conditionFields, 'points']);
      requireThat(r.eligibility === 'anonymous-category-candidate' && r.powerDefinition === 'reported-voltage-times-current' && motorKeys.has(key(identity(r))));
      const points = array(r.points).map(rawPoint => {
        const p = fields(rawPoint, ['voltageV', 'currentA', 'thrustGf', 'electricalPowerW', 'rpm', 'throttlePercent']);
        requireThat(positive(p.voltageV) && positive(p.currentA) && positive(p.thrustGf) && positive(p.electricalPowerW));
        // Export rounding check, not an experimental accuracy tolerance.
        requireThat(Math.abs(p.electricalPowerW - p.voltageV * p.currentA) <= 0.000000501);
        requireThat(p.rpm === null || positive(p.rpm));
        requireThat(p.throttlePercent === null || (typeof p.throttlePercent === 'number' && Number.isFinite(p.throttlePercent) && p.throttlePercent >= 0 && p.throttlePercent <= 100));
        return { voltageV: p.voltageV, currentA: p.currentA, thrustGf: p.thrustGf, electricalPowerW: p.electricalPowerW, rpm: p.rpm, throttlePercent: p.throttlePercent };
      });
      requireThat(points.length > 0);
      return { ...identity(r), ...unknownConditions(r), id: id(r.id, 'curve'), cells: cells(r.cells), propeller: r.propeller === null ? null : geometry(r.propeller),
        eligibility: 'anonymous-category-candidate', powerDefinition: 'reported-voltage-times-current', points };
    });
    const curveMap = new Map(curveRows.map(r => [r.id, r])); requireThat(curveMap.size === curveRows.length);
    const segmentRows: VoltageSegment[] = rows.get('constant-voltage-segments.json')!.map(raw => {
      const r = fields(raw, ['id', 'curveId', 'stator', 'kv', 'cells', 'propeller', 'voltageV', 'eligibility', ...conditionFields, 'points']);
      const parentId = id(r.curveId, 'curve'), parent = curveMap.get(parentId), prop = geometry(r.propeller);
      requireThat(parent && key(identity(r)) === key(parent) && cells(r.cells) === parent.cells && sameGeometry(prop, parent.propeller));
      requireThat(r.eligibility === 'numeric-interpolation-only' && positive(r.voltageV));
      const voltage = r.voltageV;
      const points = array(r.points).map(rawPoint => {
        const p = fields(rawPoint, ['thrustGf', 'electricalPowerW']); requireThat(positive(p.thrustGf) && positive(p.electricalPowerW));
        requireThat(parent.points.some(q => q.voltageV === voltage && q.thrustGf === p.thrustGf && q.electricalPowerW === p.electricalPowerW));
        return { thrustGf: p.thrustGf, electricalPowerW: p.electricalPowerW };
      });
      requireThat(points.length >= 2 && points.every((p, i) => i === 0 || (p.thrustGf > points[i - 1].thrustGf && p.electricalPowerW >= points[i - 1].electricalPowerW)));
      return { ...identity(r), ...unknownConditions(r), id: id(r.id, 'segment'), curveId: parentId, cells: parent.cells,
        propeller: prop, voltageV: voltage, eligibility: 'numeric-interpolation-only', points };
    });
    requireThat(new Set(segmentRows.map(s => s.id)).size === segmentRows.length);
    const coverageRows: Coverage[] = rows.get('coverage.json')!.map(raw => {
      const r = fields(raw, ['stator', 'kv', 'benchPoints', 'anonymousCurves', 'knownGeometryCurves', 'constantVoltageSegments']);
      requireThat(count(r.benchPoints) && count(r.anonymousCurves) && count(r.knownGeometryCurves) && count(r.constantVoltageSegments));
      const ident = identity(r), cs = curveRows.filter(c => key(c) === key(ident)), motor = motorRows.find(x => key(x) === key(ident));
      requireThat(motor && motor.benchPoints === r.benchPoints && cs.reduce((sum, c) => sum + c.points.length, 0) === r.benchPoints && cs.length === r.anonymousCurves &&
        cs.filter(c => c.propeller !== null).length === r.knownGeometryCurves && segmentRows.filter(s => key(s) === key(ident)).length === r.constantVoltageSegments);
      return { ...ident, benchPoints: r.benchPoints, anonymousCurves: r.anonymousCurves, knownGeometryCurves: r.knownGeometryCurves, constantVoltageSegments: r.constantVoltageSegments };
    });
    requireThat(coverageRows.length === motorRows.length && new Set(coverageRows.map(key)).size === motorRows.length);
    requireThat(rows.get('flight-references.json')!.length === 0 && rows.get('style-calibrations.json')!.length === 0);
    requireThat(counts.motorCategories === motorRows.length && counts.propellerGeometries === propRows.length && counts.anonymousCurves === curveRows.length &&
      counts.retainedPoints === curveRows.reduce((sum, c) => sum + c.points.length, 0) && counts.knownGeometryCurves === curveRows.filter(c => c.propeller !== null).length &&
      counts.constantVoltageSegments === segmentRows.length && counts.flightReferences === 0 && counts.styleCalibrations === 0);
    return freeze({ available: true, version: '0.1.0', motors: motorRows, propellers: propRows, curves: curveRows,
      segments: segmentRows, coverage: coverageRows, flightReferences: [], styleCalibrations: [] });
  } catch {
    return Object.freeze({ available: false, message: '参考库不可用：版本、字段或数据一致性校验失败；基础评估和其他有效分析仍可使用。' });
  }
}
export const referenceLibrary = loadReferenceLibrary(manifest, libraryFiles);
