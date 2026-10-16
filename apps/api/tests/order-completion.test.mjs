import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const source = readFileSync(new URL('../src/routes/petnest.ts', import.meta.url), 'utf8');
const display = compile(readFileSync(new URL('../../web/src/lib/customer-order-status.ts', import.meta.url), 'utf8'));
const { customerOrderStatus } = await import(`data:text/javascript;base64,${Buffer.from(display).toString('base64')}`);
function fixture(changes = {}) {
  const row = { id: 40, providerId: 10, ownerId: 'customer', customerId: 'customer', status: 'CONFIRMED', paymentStatus: 'PAID', paymongoPaymentReference: 'pay_fixture', paidAt: '2026-10-16T00:00:00Z', total: 200, items: [{ productId: 1, productName: 'Food', price: 100, quantity: 2 }], fulfillmentMethod: 'PICKUP', ...changes };
  const handlers = new Map(); let providerId = 10, authenticated = true, writes = 0;
  const matches = filter => Object.entries(filter).every(([key, value]) => value && typeof value === 'object' && '$ne' in value ? row[key] !== value.$ne : row[key] === value);
  const deps = { router: { patch(path, fn) { handlers.set(path, fn); } },
    requireProvider: async (req, res) => { if (!authenticated) { res.status(401).json({ error: 'Sign in required' }); return null; } return { providerId }; },
    orderCollection: { async findOne(filter) { return matches(filter) ? { ...row } : null; }, async findOneAndUpdate(filter, update) { if (!matches(filter)) return null; Object.assign(row, update.$set); writes++; return { ...row }; } },
    CreateOrderResponse: { parse: value => value },
  };
  const start = source.indexOf('router.patch("/provider/orders/:orderId/complete"');
  const archive = source.indexOf('router.patch("/provider/orders/:orderId/archive"', start);
  const next = source.indexOf('\nrouter.', archive + 1);
  new Function(...Object.keys(deps), compile(source.slice(start, next < 0 ? undefined : next)))(...Object.values(deps));
  return { row, get writes() { return writes; }, setProvider(id) { providerId = id; }, signOut() { authenticated = false; }, async call(action = 'complete', body = { received: true }, id = '40') {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handlers.get(`/provider/orders/:orderId/${action}`)({ params: { orderId: id }, body }, res); return res;
  } };
}
for (const fulfillmentMethod of ['PICKUP', 'DELIVERY']) test(`${fulfillmentMethod}: receipt confirmation completes once, retains payment/order data, and supports manual archive/restore`, async () => {
  const f = fixture({ fulfillmentMethod, deliveryAddress: fulfillmentMethod === 'DELIVERY' ? { cityMunicipality: 'City' } : undefined });
  const original = structuredClone(f.row);
  const responses = await Promise.all([f.call('complete', { received: true, paymentStatus: 'UNPAID', total: 0 }), f.call()]);
  assert.deepEqual(responses.map(r => r.code).sort(), [200, 409]); assert.equal(f.writes, 1);
  assert.equal(f.row.status, 'COMPLETED'); assert.ok(Number.isFinite(Date.parse(f.row.completedAt))); assert.equal(f.row.completedByProviderId, 10);
  assert.equal(f.row.archived, undefined);
  for (const key of ['paymentStatus', 'paymongoPaymentReference', 'paidAt', 'total', 'items', 'fulfillmentMethod', 'deliveryAddress']) assert.deepEqual(f.row[key], original[key]);
  assert.deepEqual(customerOrderStatus(f.row), { status: 'COMPLETED', tone: 'completed', canPay: false });
  assert.equal((await f.call('archive', { archived: true })).code, 200); assert.equal(f.row.archived, true);
  assert.equal((await f.call('archive', { archived: false })).code, 200); assert.equal(f.row.status, 'COMPLETED'); assert.equal(f.row.paymentStatus, 'PAID');
});
test('completion endpoint rejects wrong provider, unauthenticated, missing receipt confirmation, invalid IDs and ineligible states', async () => {
  for (const changes of [{ status: 'PENDING' }, { status: 'CANCELLED' }, { status: 'COMPLETED' }, { paymentStatus: 'UNPAID' }, { paymentStatus: 'PENDING' }, { paymentStatus: 'FAILED' }, { archived: true }]) {
    const f = fixture(changes); assert.equal((await f.call()).code, 409); assert.equal(f.writes, 0);
  }
  const f = fixture(); assert.equal((await f.call('complete', {})).code, 400); assert.equal((await f.call('complete', { received: true }, 'invalid')).code, 400);
  f.setProvider(20); assert.equal((await f.call()).code, 404);
  f.signOut(); assert.equal((await f.call()).code, 401); assert.equal(f.writes, 0);
});
