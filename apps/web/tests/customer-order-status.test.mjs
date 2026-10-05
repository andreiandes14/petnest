import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/lib/customer-order-status.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { customerOrderStatus } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('pending provider acceptance stays Pending without payment action', () => {
  assert.deepEqual(customerOrderStatus({ status: 'PENDING', paymentStatus: 'UNPAID' }),
    { status: 'PENDING', tone: 'pending', canPay: false });
});
test('accepted unpaid, legacy and failed orders await payment with the existing retry action', () => {
  for (const paymentStatus of ['UNPAID', undefined, 'FAILED']) {
    const order = { status: 'CONFIRMED', paymentStatus };
    const snapshot = { ...order };
    assert.deepEqual(customerOrderStatus(order), { status: 'AWAITING_PAYMENT', tone: 'pending', canPay: true });
    assert.deepEqual(order, snapshot);
  }
});
test('persisted pending payment and transient verification wait show processing without another action', () => {
  assert.deepEqual(customerOrderStatus({ status: 'CONFIRMED', paymentStatus: 'PENDING' }),
    { status: 'PAYMENT_PROCESSING', tone: 'processing', canPay: false });
  assert.deepEqual(customerOrderStatus({ status: 'CONFIRMED', paymentStatus: 'UNPAID' }, true),
    { status: 'PAYMENT_PROCESSING', tone: 'processing', canPay: false });
});
test('only backend Paid produces Confirmed after provider acceptance, regardless of return context', () => {
  for (const waiting of [false, true]) {
    assert.deepEqual(customerOrderStatus({ status: 'CONFIRMED', paymentStatus: 'PAID' }, waiting),
      { status: 'CONFIRMED', tone: 'confirmed', canPay: false });
  }
  assert.notEqual(customerOrderStatus({ status: 'CONFIRMED', paymentStatus: 'UNPAID' }, true).status, 'CONFIRMED');
});
test('cancellation and other existing fulfillment statuses take precedence', () => {
  for (const paymentStatus of ['UNPAID', 'PENDING', 'PAID']) {
    assert.deepEqual(customerOrderStatus({ status: 'CANCELLED', paymentStatus }, true),
      { status: 'CANCELLED', tone: 'cancelled', canPay: false });
  }
  assert.deepEqual(customerOrderStatus({ status: 'COMPLETED', paymentStatus: 'PAID' }),
    { status: 'COMPLETED', tone: 'completed', canPay: false });
});
