import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ROOT, parseStator, explicitGeometry, convert, constantVoltageSegments } from './build.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const key = row => `${row.stator}|${row.kv}`;
function keys(value, allowed) {
  assert.deepEqual(Object.keys(value).sort(), [...allowed].sort());
}
function geometry(value) {
  keys(value, ['diameterIn', 'pitchIn', 'blades']);
  assert(positive(value.diameterIn) && positive(value.pitchIn));
  assert(Number.isInteger(value.blades) && value.blades >= 2 && value.blades <= 6);
}
function anonymous(value) {
  if (Array.isArray(value)) return value.forEach(anonymous);
  if (value && typeof value === 'object') {
    for (const [field, child] of Object.entries(value)) {
      assert(!/^(brand|manufacturer|source|sources|url|slug|model|note|_scraped_at)$/i.test(field), field);
      anonymous(child);
    }
  } else if (typeof value === 'string') {
    assert(!/https?:\/\/|PRIVATE-|SYNTHETIC-ONLY|t-motor|iflight|gemfan|hqprop|betafpv|tmotor/i.test(value));
  }
}

// These in-memory fixtures never enter the distributed data files.
assert.equal(parseStator('2306'), '2306');
assert.equal(parseStator('0802'), '0802');
assert.equal(parseStator('2806.5'), '2806.5');
assert.equal(parseStator('2306.0'), '2306');
assert.equal(parseStator('not a size'), null);
assert.deepEqual(explicitGeometry('5.1x4.3x3'), { diameterIn: 5.1, pitchIn: 4.3, blades: 3 });
assert.deepEqual(explicitGeometry('T5147-3'), { diameterIn: 5.1, pitchIn: 4.7, blades: 3 });
assert.equal(explicitGeometry('51433'), null);
assert.equal(explicitGeometry('40mm'), null);
const testProp = { diameterIn: 5.1, pitchIn: 4.3, blades: 3 };
const testPoints = [
  { voltageV: 22.2, thrustGf: 100, electricalPowerW: 20 },
  { voltageV: 22.2, thrustGf: 200, electricalPowerW: 40 },
  { voltageV: 21, thrustGf: 300, electricalPowerW: 60 },
];
const testCurve = { id: 'fixture', stator: '2306', kv: 1850, cells: 6, propeller: testProp, points: testPoints };
assert.equal(constantVoltageSegments(testCurve).length, 1);
assert.equal(constantVoltageSegments(testCurve)[0].points.length, 2);
assert.equal(constantVoltageSegments({ ...testCurve, propeller: null }).length, 0);
assert.equal(constantVoltageSegments({ ...testCurve, points: [...testPoints, { voltageV: 22.2, thrustGf: 100, electricalPowerW: 21 }] }).length, 0);
const motorFixture = ['PRIVATE-a', 'PRIVATE-b'].map(slug => ({
  slug, brand: slug, model: slug,
  specs: { stator: '2306', kv_options: [1850], thrust_table: [
    { kv: 1850, prop: '5.1x4.3x3', cells: '6S', voltage_v: 22.2, current_a: 1, thrust_g: 100 },
    { kv: 1850, prop: '5.1x4.3x3', cells: '6S', voltage_v: 22.2, current_a: 2, thrust_g: 200 },
  ] },
}));
const converted = convert(motorFixture, []);
assert.equal(converted.curves.length, 2);
assert.notEqual(converted.curves[0].id, converted.curves[1].id);
assert.equal(converted.motors[0].stator, '2306');
assert.equal(converted.motors[0].anonymousVariants, 2);
anonymous(converted);

const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
assert.equal(manifest.capabilities.formalEnduranceRating, false);
assert.equal(manifest.capabilities.exactProductMatching, false);
assert.equal(manifest.capabilities.independentAccuracyValidated, false);
assert.equal(manifest.files.length, 7);
const files = new Map();
for (const entry of manifest.files) {
  assert(/^[a-z-]+\.json$/.test(entry.name));
  assert(!files.has(entry.name));
  const bytes = await readFile(join(ROOT, entry.name));
  assert.equal(hash(bytes), entry.sha256, `${entry.name} checksum`);
  assert.equal(bytes.length, entry.bytes, `${entry.name} bytes`);
  const data = JSON.parse(bytes.toString('utf8'));
  keys(data, ['schemaVersion', 'libraryVersion', 'items']);
  assert.equal(data.schemaVersion, manifest.schemaVersion);
  assert.equal(data.libraryVersion, manifest.libraryVersion);
  assert.equal(data.items.length, entry.records);
  anonymous(data);
  files.set(entry.name, data.items);
}
const motors = files.get('motor-catalog.json');
const props = files.get('propeller-catalog.json');
const curves = files.get('bench-curves.json');
const segments = files.get('constant-voltage-segments.json');
const coverage = files.get('coverage.json');
assert.equal(files.get('flight-references.json').length, 0);
assert.equal(files.get('style-calibrations.json').length, 0);
const motorKeys = new Set();
for (const motor of motors) {
  keys(motor, ['stator', 'kv', 'anonymousVariants', 'benchPoints']);
  assert.equal(parseStator(motor.stator), motor.stator);
  assert(positive(motor.kv) && Number.isInteger(motor.anonymousVariants) && motor.anonymousVariants > 0);
  assert(Number.isInteger(motor.benchPoints) && motor.benchPoints >= 0);
  assert(!motorKeys.has(key(motor)));
  motorKeys.add(key(motor));
}
for (const prop of props) {
  keys(prop, ['diameterIn', 'pitchIn', 'blades', 'anonymousVariants']);
  geometry({ diameterIn: prop.diameterIn, pitchIn: prop.pitchIn, blades: prop.blades });
  assert(Number.isInteger(prop.anonymousVariants) && prop.anonymousVariants > 0);
}
const curveMap = new Map();
let points = 0;
for (const curve of curves) {
  keys(curve, ['id', 'stator', 'kv', 'cells', 'propeller', 'eligibility', 'powerDefinition', 'escInclusion', 'assembly', 'temperatureC', 'flightValidation', 'points']);
  assert(/^curve-[0-9a-f]{20}$/.test(curve.id) && !curveMap.has(curve.id));
  assert(motorKeys.has(key(curve)));
  assert(Number.isInteger(curve.cells) && curve.cells >= 1 && curve.cells <= 8);
  assert.equal(curve.eligibility, 'anonymous-category-candidate');
  assert.equal(curve.powerDefinition, 'reported-voltage-times-current');
  assert.equal(curve.escInclusion, 'unknown'); assert.equal(curve.assembly, 'unknown');
  assert.equal(curve.temperatureC, null); assert.equal(curve.flightValidation, 'none');
  if (curve.propeller !== null) geometry(curve.propeller);
  assert(curve.points.length > 0);
  for (const p of curve.points) {
    keys(p, ['voltageV', 'currentA', 'thrustGf', 'electricalPowerW', 'rpm', 'throttlePercent']);
    assert([p.voltageV, p.currentA, p.thrustGf, p.electricalPowerW].every(positive));
    // Six-decimal export rounding only; this is not an engineering error bound.
    assert(Math.abs(p.electricalPowerW - p.voltageV * p.currentA) <= 0.000000501);
    assert(p.rpm === null || positive(p.rpm));
    assert(p.throttlePercent === null || (Number.isFinite(p.throttlePercent) && p.throttlePercent >= 0 && p.throttlePercent <= 100));
  }
  points += curve.points.length;
  curveMap.set(curve.id, curve);
}
const expectedSegments = curves.flatMap(constantVoltageSegments);
assert.deepEqual(segments, expectedSegments);
const segmentIds = new Set();
for (const segment of segments) {
  assert(!segmentIds.has(segment.id)); segmentIds.add(segment.id);
  const parent = curveMap.get(segment.curveId);
  assert(parent);
  assert.equal(key(segment), key(parent));
  assert.equal(segment.cells, parent.cells);
  assert.deepEqual(segment.propeller, parent.propeller);
  assert(positive(segment.voltageV));
  assert(segment.points.length >= 2);
  for (let i = 0; i < segment.points.length; i++) {
    const p = segment.points[i];
    assert([p.thrustGf, p.electricalPowerW].every(positive));
    assert(parent.points.some(q => q.voltageV === segment.voltageV && q.thrustGf === p.thrustGf && q.electricalPowerW === p.electricalPowerW));
    if (i) assert(p.thrustGf > segment.points[i - 1].thrustGf && p.electricalPowerW >= segment.points[i - 1].electricalPowerW);
  }
}
assert.equal(coverage.length, motors.length);
for (const row of coverage) {
  keys(row, ['stator', 'kv', 'benchPoints', 'anonymousCurves', 'knownGeometryCurves', 'constantVoltageSegments']);
  const selected = curves.filter(c => key(c) === key(row));
  assert.equal(row.benchPoints, selected.reduce((n, c) => n + c.points.length, 0));
  assert.equal(row.benchPoints, motors.find(m => key(m) === key(row))?.benchPoints);
  assert.equal(row.anonymousCurves, selected.length);
  assert.equal(row.knownGeometryCurves, selected.filter(c => c.propeller !== null).length);
  assert.equal(row.constantVoltageSegments, segments.filter(s => key(s) === key(row)).length);
}
const c = manifest.counts;
assert.equal(points, c.retainedPoints);
assert.equal(c.inputPoints, c.retainedPoints + c.invalidStatorPoints + c.invalidNumericPoints + c.unsupportedCellPoints + c.duplicatePoints);
assert.equal(motors.length, c.motorCategories);
assert.equal(props.length, c.propellerGeometries);
assert.equal(curves.length, c.anonymousCurves);
assert.equal(curves.filter(row => row.propeller !== null).length, c.knownGeometryCurves);
assert.equal(segments.length, c.constantVoltageSegments);
console.log(JSON.stringify({ passed: true, files: files.size, curves: curves.length, points, constantVoltageSegments: segments.length, scope: 'structure, units, isolation, checksums; not flight accuracy' }, null, 2));
