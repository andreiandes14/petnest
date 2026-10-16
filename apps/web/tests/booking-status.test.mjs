import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/booking-status.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { bookingStatusDisplay, vaccinationCourseLabel } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('cancelled appointments retain Cancelled without changing their stored status', () => {
  const booking = { status: 'cancelled', paymentStatus: 'PAID', cancellationReason: 'Customer request' };
  const before = structuredClone(booking);
  assert.deepEqual(bookingStatusDisplay(booking.status), { label: 'Cancelled', description: 'Cancelled' });
  assert.deepEqual(booking, before);
  assert.equal(bookingStatusDisplay(' CANCELLED ').label, 'Cancelled');
});
test('Not Continued belongs only to vaccination course progress, never appointment status', () => {
  assert.equal(vaccinationCourseLabel('cancelled'), 'Not Continued');
  assert.equal(vaccinationCourseLabel('ongoing'), 'Ongoing');
  assert.equal(vaccinationCourseLabel('completed'), 'Completed');
  assert.equal(vaccinationCourseLabel(null), 'Ongoing');
  for (const service of ['grooming', 'vaccination', 'other']) {
    const booking = { serviceCategory: service, status: 'cancelled' };
    assert.equal(bookingStatusDisplay(booking.status).label, 'Cancelled');
  }
});
test('Completed service is exclusive to completed bookings', () => {
  assert.deepEqual(bookingStatusDisplay('completed'), { label: 'Completed', description: 'Completed service' });
  for (const status of ['pending', 'awaiting_payment', 'confirmed', 'ongoing', 'no_show', 'cancellation_pending', 'cancelled']) {
    assert.notEqual(bookingStatusDisplay(status).description, 'Completed service');
  }
});

