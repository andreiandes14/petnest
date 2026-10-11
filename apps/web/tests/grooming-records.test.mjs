import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(new URL('../src/lib/grooming-records.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { latestGroomingRecords, groomingTime, repeatGroomingService, availableGroomingTime } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const record = (id, title, date, time, status = 'completed') => ({ id, title, date, time, status });

test('latest completed session per service, ordered by session date and actual time; history untouched', () => {
  const records = [record(1, 'Bath', '2026-09-19', '10:00 AM'), record(2, 'Purga', '2026-10-04', '11:00 AM'),
    record(3, 'Bath', '2026-10-13', '2:00 PM'), record(4, 'Purga', '2026-09-14', '1:00 PM'),
    record(5, 'Bath', '2026-10-14', '9:00 AM', 'pending')];
  const snapshot = structuredClone(records);
  assert.deepEqual(latestGroomingRecords(records).map(item => item.id), [3, 2]);
  assert.deepEqual(records, snapshot);
});
test('time ordering handles AM/PM and 24-hour times, with stable unique ID ties', () => {
  const records = [record(1, 'Bath', '2026-10-04', '11:00 AM'), record(2, ' bath ', '2026-10-04', '2:00 PM'),
    record(3, 'Bath', '2026-10-04', '14:00'), record(4, 'Purga', '2026-10-04', null)];
  assert.deepEqual(latestGroomingRecords(records).map(item => item.id), [3, 4]);
  assert.deepEqual(latestGroomingRecords(records.reverse()).map(item => item.id), [3, 4]);
});
test('missing times are never invented; saved times display in 12-hour format', () => {
  assert.equal(groomingTime(null), 'Time unavailable');
  assert.equal(groomingTime(''), 'Time unavailable');
  assert.equal(groomingTime('14:00'), '2:00 PM');
  assert.equal(groomingTime('10:30 AM'), '10:30 AM');
  assert.equal(groomingTime('00:00'), '12:00 AM');
});

test('repeat selects only the matching available grooming service at the current provider', () => {
  const bath = { id: 2, name: 'Bath', category: 'grooming', available: true };
  const services = [{ id: 1, name: 'Bath', category: 'vaccination', available: true }, bath,
    { id: 3, name: 'Purga', category: 'grooming', available: false }];
  assert.equal(repeatGroomingService(services, ' bath '), bath);
  assert.equal(repeatGroomingService(services, 'Purga'), undefined);
  assert.equal(repeatGroomingService(services, 'Missing service'), undefined);
});

test('suggested time is kept only when available; another available time can replace it', () => {
  const slots = [{ time: '10:30 AM', status: 'unavailable' }, { time: '2:00 PM', status: 'available' }];
  assert.equal(availableGroomingTime('10:30 AM', slots), '');
  assert.equal(availableGroomingTime('14:00', slots), '2:00 PM');
  assert.equal(availableGroomingTime('', slots), '');
  assert.equal(availableGroomingTime('10:30 AM', [{ time: '10:30 AM', status: 'available' }]), '10:30 AM');
});
