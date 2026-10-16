import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/booking-course-status.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { withVaccinationCourseStatus } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const booking = (id, changes = {}) => ({ id, ownerId: 'owner', petId: 11, providerId: 10, serviceCategory: 'vaccination', recordId: null, status: 'completed', paymentStatus: 'PAID', bookingDepositPaid: 50, remainingServiceBalance: 950, ...changes });
const record = (id, bookingId, progress, changes = {}) => ({ id, bookingId, ownerId: 'owner', petId: 11, providerId: 10, type: 'vaccination', vaccinationProgress: progress, ...changes });

test('existing persisted records map by IDs; unrelated completed vaccination and grooming retain status and payments', () => {
  const bookings = [booking(41), booking(45), booking(46), booking(47, { serviceCategory: 'grooming' })];
  const records = [record(22, 41, 'completed'), record(25, 45, 'cancelled'), record(26, 46, 'cancelled')];
  const before = structuredClone({ bookings, records });
  const result = withVaccinationCourseStatus(bookings, records, 'owner');
  assert.deepEqual(result.map(b => b.vaccinationCourseStatus), ['completed', 'cancelled', 'cancelled', undefined]);
  assert.ok(result.every(b => b.status === 'completed' && b.paymentStatus === 'PAID' && b.bookingDepositPaid === 50 && b.remainingServiceBalance === 950));
  assert.deepEqual({ bookings, records }, before);
});
test('explicit linked course chain shares progress without matching names, crossing owners, pets or providers', () => {
  const bookings = [booking(1), booking(2, { recordId: 101 }), booking(3, { recordId: 102 })];
  const records = [record(101, 1, 'ongoing'), record(102, 2, 'ongoing'), record(103, 3, 'cancelled')];
  assert.ok(withVaccinationCourseStatus(bookings, records, 'owner').every(b => b.vaccinationCourseStatus === 'cancelled'));
  for (const changes of [{ ownerId: 'other' }, { petId: 12 }, { providerId: 20 }, { type: 'grooming' }]) {
    assert.equal(withVaccinationCourseStatus([booking(45)], [record(25, 45, 'cancelled', changes)], 'owner')[0].vaccinationCourseStatus, undefined);
  }
  assert.equal(withVaccinationCourseStatus([booking(45)], [record(25, 46, 'cancelled')], 'owner')[0].vaccinationCourseStatus, undefined);
});
