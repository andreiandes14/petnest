import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/routes/petnest.ts', import.meta.url), 'utf8');
const start = source.indexOf('router.delete("/provider/products/:productId"');
const code = ts.transpileModule(source.slice(start, source.indexOf('router.get("/pets"', start)), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function harness({ authorized = true, providerId = 7, removed = false, fails = false } = {}) {
  let handler, writes = 0;
  const product = { id: 12, active: true, stock: 9, price: 80, ...(removed ? { removedAt: 'previous' } : {}) };
  const collection = { async updateOne(filter, update) {
    writes++;
    assert.equal(filter.products.$elemMatch.removedAt.$exists, false);
    if (fails) throw new Error('database unavailable');
    if (filter.id !== providerId || filter.products.$elemMatch.id !== product.id || product.removedAt) return { modifiedCount: 0 };
    for (const [key, value] of Object.entries(update.$set)) if (key.startsWith('products.$.')) product[key.slice(11)] = value;
    return { modifiedCount: 1 };
  } };
  new Function('router', 'requireProvider', 'providerCollection', code)(
    { delete(path, fn) { handler = fn; } }, async () => authorized ? { providerId: 7 } : null, collection);
  return { product, get writes() { return writes; }, async call(id = '12') {
    const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
    await handler({ params: { productId: id } }, response); return response;
  } };
}
test('owned product is soft-removed once without changing price or stock', async () => {
  const h = harness(); const result = await h.call();
  assert.deepEqual(result.body, { removed: true, productId: 12 });
  assert.equal(h.product.active, false); assert.ok(h.product.removedAt);
  assert.equal(h.product.stock, 9); assert.equal(h.product.price, 80);
  assert.equal((await h.call()).statusCode, 409);
});
test('unauthorized, foreign, missing and invalid product removals cannot succeed', async () => {
  const unauthorized = harness({ authorized: false }); await unauthorized.call(); assert.equal(unauthorized.writes, 0);
  assert.equal((await harness({ providerId: 8 }).call()).statusCode, 409);
  assert.equal((await harness().call('99')).statusCode, 409);
  const invalid = harness(); assert.equal((await invalid.call('NaN')).statusCode, 400); assert.equal(invalid.writes, 0);
});
test('database errors cannot report successful removal', async () => {
  await assert.rejects(harness({ fails: true }).call(), /database unavailable/);
});
test('checkout rejects stale carts and atomically excludes removed products when reserving inventory', () => {
  const checkout = source.slice(source.indexOf('const items = requested.map'));
  assert.match(checkout, /Boolean\(item.product.removedAt\)/);
  assert.match(checkout, /\$elemMatch:\s*\{\s*id: item.productId,\s*active: \{ \$ne: false \},\s*removedAt: \{ \$exists: false \}/);
});

test('simultaneous removal requests produce only one successful transition', async () => {
  const h = harness();
  const results = await Promise.all([h.call(), h.call()]);
  assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 409]);
  assert.equal(h.product.active, false);
});
