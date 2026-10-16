import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../../../shared/booking-attendance.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { canMarkNoShow, noShowExplanation } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const booking = { status: 'confirmed', paymentStatus: 'PAID', depositRequired: true, date: '2026-10-16', time: '09:00' };
test('paid appointments become eligible at Philippine start time regardless of device timezone', () => {
  assert.equal(canMarkNoShow(booking, Date.parse('2026-10-16T00:59:59Z')), false);
  assert.equal(canMarkNoShow(booking, Date.parse('2026-10-16T01:00:00Z')), true);
  assert.equal(canMarkNoShow(booking, Date.parse('2026-10-17T01:00:00Z')), true);
});
test('terminal, duplicate, unpaid deposits, prior notice and malformed appointments cannot be submitted', () => {
  const now = Date.parse('2026-10-16T02:00:00Z');
  for (const status of ['pending', 'awaiting_payment', 'no_show', 'completed', 'cancelled', 'rejected']) {
    assert.equal(canMarkNoShow({ ...booking, status }, now), false);
  }
  assert.equal(canMarkNoShow({ ...booking, paymentStatus: 'UNPAID' }, now), false);
  assert.equal(canMarkNoShow({ ...booking, cancellationReason: 'Prior notice' }, now), false);
  assert.equal(canMarkNoShow({ ...booking, time: '25:00' }, now), false);
  assert.equal(canMarkNoShow(undefined, now), false);
});

test('future appointments explain the actual Philippine schedule and become confirmable at start', () => {
 const before = Date.parse('2026-10-16T00:59:59Z');
 assert.match(noShowExplanation(booking, before), /October 16, 2026/);
 assert.match(noShowExplanation(booking, before), /9:00 AM/);
 assert.match(noShowExplanation(booking, before), /Philippine time/);
 assert.equal(noShowExplanation(booking, before + 1000), undefined);
});

test('attendance balances distinguish service credit from no-show fees without repeated deductions', async () => {
 const source=readFileSync(new URL('../../../shared/booking-deposit.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
 const {remainingBookingBalance,DEPOSIT_NOTICE}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
 for(const status of ['confirmed','completed'])assert.equal(remainingBookingBalance({price:1000,depositRequired:true,paymentStatus:'PAID',status}),950);
 for(const paymentStatus of ['PAID','UNPAID'])assert.equal(remainingBookingBalance({price:1000,depositRequired:true,paymentStatus,status:'no_show'}),0);
 assert.equal(remainingBookingBalance({price:1000,depositRequired:true,paymentStatus:'UNPAID',status:'awaiting_payment'}),1000);
 assert.match(DEPOSIT_NOTICE,/deducted from your total service fee/);assert.match(DEPOSIT_NOTICE,/non-refundable no-show fee/);
});
