import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../../../shared/booking-calendar.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { calendarBookings } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('calendar drops terminal bookings while retaining their unmodified table/history records and payment fields', () => {
  const bookings = ['confirmed', 'pending', 'awaiting_payment', 'completed', 'no_show', 'cancelled'].map((status, id) => ({
    id, status, paymentStatus: 'PAID', bookingDepositPaid: 50, remainingServiceBalance: 950,
  }));
  const before = structuredClone(bookings);
  assert.deepEqual(calendarBookings(bookings).map(b => b.status), ['confirmed', 'pending', 'awaiting_payment']);
  assert.deepEqual(bookings, before);
  bookings[0].status = 'completed';
  assert.equal(calendarBookings(bookings).some(b => b.id === 0), false);
  assert.equal(bookings.length, 6);
  assert.equal(bookings[0].bookingDepositPaid, 50);
});

test('archive and normalized terminal statuses do not reappear on the calendar', () => {
  assert.deepEqual(calendarBookings([{ status: ' Completed ' }, { status: 'NO_SHOW' },
    { status: 'Cancelled' }, { status: 'confirmed', archived: true }]), []);
});
