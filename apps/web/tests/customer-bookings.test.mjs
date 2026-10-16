import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/customer-bookings.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { customerBookingSections } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const statuses = ['pending', 'awaiting_payment', 'confirmed', 'ongoing', 'completed', 'cancelled', 'no_show', 'cancellation_pending'];
const bookings = ['grooming', 'vaccination'].flatMap((serviceCategory, category) => statuses.map((status, i) => ({
  id: category * 10 + i, serviceCategory, status, date: `202${6 + i % 2}-10-${20 + i}`, time: '13:00', paymentStatus: 'PAID', price: 1000,
})));

test('each service filter applies to upcoming/history and counters across every booking status without mutating records', () => {
  const original = structuredClone(bookings);
  for (const category of ['all', 'grooming', 'vaccination']) {
    const { upcoming, past } = customerBookingSections(bookings, category);
    assert.equal(upcoming.length, category === 'all' ? 10 : 5);
    assert.equal(past.length, category === 'all' ? 6 : 3);
    assert.ok(past.every(booking => ['completed', 'cancelled', 'no_show'].includes(booking.status)));
    assert.ok([...upcoming, ...past].every(booking => category === 'all' || booking.serviceCategory === category));
  }
  assert.deepEqual(bookings, original);
});
test('upcoming sorts earliest first, history newest first, with time and ID tie-breakers', () => {
  const base = { serviceCategory: 'grooming', status: 'confirmed', date: '2027-01-01', time: '09:00' };
  const rows = [{ ...base, id: 3, time: '10:00' }, { ...base, id: 2 }, { ...base, id: 1 }, { ...base, id: 4, date: '2026-12-31' }];
  assert.deepEqual(customerBookingSections(rows, 'all').upcoming.map(b => b.id), [4, 1, 2, 3]);
  assert.deepEqual(customerBookingSections(rows.map(b => ({ ...b, status: 'completed' })), 'all').past.map(b => b.id), [3, 2, 1, 4]);
});
test('no matching service returns empty sections without removing bookings', () => {
  assert.deepEqual(customerBookingSections(bookings.filter(b => b.serviceCategory === 'grooming'), 'vaccination'), { upcoming: [], past: [] });
  assert.deepEqual(customerBookingSections([], 'all'), { upcoming: [], past: [] });
});
