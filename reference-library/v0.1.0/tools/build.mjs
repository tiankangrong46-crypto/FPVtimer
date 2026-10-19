import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const hash = value => createHash('sha256').update(value).digest('hex');
const id = value => hash(JSON.stringify(value)).slice(0, 20);
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const round = value => Number(value.toFixed(6));

export function parseStator(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{2})(\d{1,2}(?:\.\d+)?)$/);
  if (!match || !positive(Number(match[1])) || !positive(Number(match[2]))) return null;
  const height = Number(match[2]);
  return `${match[1]}${height < 10 ? '0' : ''}${height}`;
}

const shapeKey = shape => [shape.diameterIn, shape.pitchIn, shape.blades].join('|');
const shape = (diameterIn, pitchIn, blades) => {
  diameterIn = Number(diameterIn); pitchIn = Number(pitchIn); blades = Number(blades);
  return positive(diameterIn) && positive(pitchIn) && Number.isInteger(blades) && blades >= 2 && blades <= 6
    ? { diameterIn, pitchIn, blades } : null;
};

// Only geometry survives. An unrecognized name stays unknown; no raw labels are exported.
export function explicitGeometry(label) {
  if (typeof label !== 'string' || /\bmm\b/i.test(label)) return null;
  const explicit = label.match(/(?:^|[^\d.])(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[x×*]\s*([2-6])(?:\D|$)/i);
  if (explicit) return shape(explicit[1], explicit[2], explicit[3]);
  const compact = label.match(/(?:^|[^\d])(\d{4,5})(?:R|S|RS)?\s*[-×*x]\s*([2-6])(?:\D|$)/i);
  if (!compact) return null;
  const code = compact[1];
  return shape(Number(code.slice(0, 2)) / 10, Number(code.slice(2)) / 10 ** (code.length - 3), compact[2]);
}

function aliases(label) {
  if (typeof label !== 'string') return [];
  return [...new Set([
    label.toLowerCase().replace(/[^a-z0-9.]/g, ''),
    ...[...label.matchAll(/(?:^|[^\d])(\d{4,5})([a-z]*)(?!\d)/gi)].map(m => `${m[1]}${m[2]}`.toLowerCase()),
  ])];
}

function makeGeometryLookup(propItems) {
  const lookup = new Map();
  for (const item of propItems) {
    const s = item.specs ?? {};
    const geometry = shape(s.diameter_in, s.pitch_in, s.blades);
    if (!geometry) continue;
    for (const key of aliases(item.model)) {
      if (!lookup.has(key)) lookup.set(key, new Map());
      lookup.get(key).set(shapeKey(geometry), geometry);
    }
  }
  return label => {
    const direct = explicitGeometry(label);
    const found = new Map();
    for (const key of aliases(label)) for (const [k, v] of lookup.get(key) ?? []) found.set(k, v);
    if (direct) {
      // Conflicting catalogue aliases are not silently resolved in favour of a guess.
      return found.size && !found.has(shapeKey(direct)) ? null : direct;
    }
    return found.size === 1 ? [...found.values()][0] : null;
  };
}

export function constantVoltageSegments(curve) {
  const byVoltage = new Map();
  for (const point of curve.points) {
    if (!byVoltage.has(point.voltageV)) byVoltage.set(point.voltageV, []);
    byVoltage.get(point.voltageV).push(point);
  }
  const result = [];
  for (const [voltageV, points] of byVoltage) {
    const unique = [...new Map(points.map(p => [JSON.stringify(p), p])).values()].sort((a, b) => a.thrustGf - b.thrustGf);
    if (unique.length < 2 || !curve.propeller) continue;
    if (unique.some((p, i) => i && (p.thrustGf <= unique[i - 1].thrustGf || p.electricalPowerW < unique[i - 1].electricalPowerW))) continue;
    result.push({
      id: `segment-${id([curve.id, voltageV])}`,
      curveId: curve.id, stator: curve.stator, kv: curve.kv,
      propeller: curve.propeller, voltageV, cells: curve.cells,
      eligibility: 'numeric-interpolation-only', escInclusion: 'unknown', assembly: 'unknown',
      temperatureC: null, flightValidation: 'none',
      points: unique.map(p => ({ thrustGf: p.thrustGf, electricalPowerW: p.electricalPowerW })),
    });
  }
  return result;
}

export function convert(motorItems, propItems) {
  const geometryFor = makeGeometryLookup(propItems);
  const groups = new Map(), catalogue = new Map(), propCatalogue = new Map();
  const counts = { inputMotors: motorItems.length, inputPoints: 0, invalidStatorPoints: 0, invalidNumericPoints: 0, unsupportedCellPoints: 0, duplicatePoints: 0 };
  for (const motor of motorItems) {
    const stator = parseStator(motor.specs?.stator);
    const options = new Set((motor.specs?.kv_options ?? []).filter(positive));
    for (const row of motor.specs?.thrust_table ?? []) if (positive(row.kv)) options.add(row.kv);
    if (stator) for (const kv of options) {
      const key = `${stator}|${kv}`;
      if (!catalogue.has(key)) catalogue.set(key, { stator, kv, anonymousVariants: new Set(), benchPoints: 0 });
      catalogue.get(key).anonymousVariants.add(id(motor.slug));
    }
    for (const row of motor.specs?.thrust_table ?? []) {
      counts.inputPoints++;
      if (!stator) { counts.invalidStatorPoints++; continue; }
      if (![row.kv, row.voltage_v, row.current_a, row.thrust_g].every(positive)) { counts.invalidNumericPoints++; continue; }
      const cellMatch = String(row.cells ?? '').match(/^([1-8])S(?:1P)?$/i);
      if (!cellMatch) { counts.unsupportedCellPoints++; continue; }
      const cells = Number(cellMatch[1]);
      const key = JSON.stringify([motor.slug, row.kv, row.prop, cells]);
      if (!groups.has(key)) groups.set(key, {
        id: `curve-${id(key)}`, stator, kv: row.kv, cells,
        propeller: geometryFor(row.prop),
        eligibility: 'anonymous-category-candidate', powerDefinition: 'reported-voltage-times-current',
        escInclusion: 'unknown', assembly: 'unknown', temperatureC: null, flightValidation: 'none', points: [],
      });
      groups.get(key).points.push({
        voltageV: row.voltage_v, currentA: row.current_a, thrustGf: row.thrust_g,
        electricalPowerW: round(row.voltage_v * row.current_a),
        rpm: positive(row.rpm) ? row.rpm : null,
        throttlePercent: typeof row.throttle === 'number' && Number.isFinite(row.throttle) && row.throttle >= 0 && row.throttle <= 100 ? row.throttle : null,
      });
    }
  }
  const curves = [...groups.values()].sort((a, b) => a.stator.localeCompare(b.stator) || a.kv - b.kv || a.id.localeCompare(b.id));
  for (const curve of curves) {
    const unique = new Map(curve.points.map(p => [JSON.stringify(p), p]));
    counts.duplicatePoints += curve.points.length - unique.size;
    curve.points = [...unique.values()].sort((a, b) => a.thrustGf - b.thrustGf || a.voltageV - b.voltageV);
    catalogue.get(`${curve.stator}|${curve.kv}`).benchPoints += curve.points.length;
  }
  for (const item of propItems) {
    const s = item.specs ?? {}, geometry = shape(s.diameter_in, s.pitch_in, s.blades);
    if (!geometry) continue;
    const key = shapeKey(geometry);
    if (!propCatalogue.has(key)) propCatalogue.set(key, { ...geometry, anonymousVariants: 0 });
    propCatalogue.get(key).anonymousVariants++;
  }
  return {
    counts,
    motors: [...catalogue.values()].map(r => ({ ...r, anonymousVariants: r.anonymousVariants.size })).sort((a, b) => a.stator.localeCompare(b.stator) || a.kv - b.kv),
    propellers: [...propCatalogue.values()].sort((a, b) => a.diameterIn - b.diameterIn || a.pitchIn - b.pitchIn || a.blades - b.blades),
    curves, segments: curves.flatMap(constantVoltageSegments),
  };
}

export async function build(baseUrl) {
  if (!/^https:\/\//.test(baseUrl)) throw new Error('Pass an explicit HTTPS export base URL.');
  const raw = await Promise.all(['motors.json', 'props.json'].map(async name => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${name}`);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const body = await response.text();
    return { name, body, parsed: JSON.parse(body) };
  }));
  const converted = convert(raw[0].parsed.items, raw[1].parsed.items);
  const envelope = items => ({ schemaVersion: '1.0.0', libraryVersion: '0.1.0', items });
  const data = {
    'motor-catalog.json': envelope(converted.motors),
    'propeller-catalog.json': envelope(converted.propellers),
    'bench-curves.json': envelope(converted.curves),
    'constant-voltage-segments.json': envelope(converted.segments),
    'flight-references.json': envelope([]),
    'style-calibrations.json': envelope([]),
  };
  const files = [];
  for (const [name, value] of Object.entries(data)) {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(join(ROOT, name), content, 'utf8');
    files.push({ name, sha256: hash(content), bytes: Buffer.byteLength(content), records: value.items.length });
  }
  const coverageMap = new Map();
  for (const row of converted.motors) coverageMap.set(`${row.stator}|${row.kv}`, {
    stator: row.stator, kv: row.kv, benchPoints: row.benchPoints,
    anonymousCurves: 0, knownGeometryCurves: 0, constantVoltageSegments: 0,
  });
  for (const row of converted.curves) { const c = coverageMap.get(`${row.stator}|${row.kv}`); c.anonymousCurves++; if (row.propeller) c.knownGeometryCurves++; }
  for (const row of converted.segments) coverageMap.get(`${row.stator}|${row.kv}`).constantVoltageSegments++;
  const coverage = `${JSON.stringify(envelope([...coverageMap.values()]), null, 2)}\n`;
  await writeFile(join(ROOT, 'coverage.json'), coverage, 'utf8');
  files.push({ name: 'coverage.json', sha256: hash(coverage), bytes: Buffer.byteLength(coverage), records: coverageMap.size });
  const pointCount = converted.curves.reduce((sum, c) => sum + c.points.length, 0);
  const manifest = {
    schemaVersion: '1.0.0', libraryVersion: '0.1.0', generated: raw[0].parsed.generated,
    purpose: 'offline-anonymous-category-candidates',
    units: { stator: 'mm-size-code', kv: 'rpm-per-volt', diameterIn: 'inch', pitchIn: 'inch', thrustGf: 'gram-force', voltageV: 'V', currentA: 'A', electricalPowerW: 'W' },
    capabilities: { manufacturerFreeRecords: true, provenanceFreeRecords: true, exactProductMatching: false, formalEnduranceRating: false, validatedStyleMultipliers: false, independentAccuracyValidated: false },
    counts: { ...converted.counts, retainedPoints: pointCount, motorCategories: converted.motors.length, propellerGeometries: converted.propellers.length, anonymousCurves: converted.curves.length, knownGeometryCurves: converted.curves.filter(c => c.propeller).length, constantVoltageSegments: converted.segments.length, flightReferences: 0, styleCalibrations: 0 },
    files,
  };
  await writeFile(join(ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const attributionPath = join(ROOT, 'LICENSE-ATTRIBUTION.md');
  const attribution = await readFile(attributionPath, 'utf8');
  const marker = '\n<!-- SNAPSHOT -->';
  const snapshot = raw.map(r => `- ${r.name}: SHA-256 \`${hash(r.body)}\``).join('\n');
  await writeFile(attributionPath, attribution.split(marker)[0] + marker + `\n\nSnapshot base: ${baseUrl}\n\n${snapshot}\n`, 'utf8');
  console.log(JSON.stringify(manifest.counts, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const baseUrl = process.argv[process.argv.indexOf('--base-url') + 1];
  await build(baseUrl);
}
