import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/routes/petnest.ts', import.meta.url), 'utf8');
const start = source.indexOf('router.get("/providers/:providerId/reviews"');
const code = ts.transpileModule(source.slice(start, source.indexOf('router.get("/reviews/eligibility"', start)), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(rows = []) {
  let handler, reads = 0;
  const deps = { router: { get(path, fn) { handler = fn; } },
    providerCollection: { async findOne(filter) { return filter.id === 10 ? { id: 10, name: 'Shop' } : null; } },
    reviewCollection: { find(filter) { reads++; assert.equal(filter.providerId, 10); return { sort(order) {
      assert.deepEqual(order, { createdAt: -1, id: -1 }); return this;
    }, async toArray() { return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); } }; } },
    userCollection: { find(filter, options) { assert.equal(options.projection.email, undefined); return { async toArray() { return [{ id: 'owner', name: 'Customer', email: 'private@example.invalid' }]; } }; } },
    bookingCollection: { find(filter) { assert.equal(filter.providerId, 10); return { async toArray() { return [{ id: 1, ownerId: 'owner', serviceCategory: 'grooming' }, { id: 2, ownerId: 'owner', serviceCategory: 'vaccination' }]; } }; } },
  };
  new Function(...Object.keys(deps), code)(...Object.values(deps));
  return { get reads() { return reads; }, async call(id = '10') {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ params: { providerId: id } }, res); return res;
  } };
}
test('public route needs no authentication, returns newest real reviews and accurate summary without private fields', async () => {
  const rows = [1, 2].map(id => ({ id: String(id), bookingId: id, ownerId: 'owner', providerId: 10, rating: id === 1 ? 3 : 5, comment: 'Review', createdAt: `2026-10-${15 + id}T00:00:00Z` }));
  const response = await fixture(rows).call();
  assert.equal(response.code, 200); assert.equal(response.body.providerName, 'Shop');
  assert.equal(response.body.averageRating, 4); assert.equal(response.body.reviewCount, 2);
  assert.deepEqual(response.body.reviews.map(r => r.id), ['2', '1']);
  assert.deepEqual(response.body.reviews.map(r => r.serviceCategory), ['vaccination', 'grooming']);
  assert.ok(response.body.reviews.every(r => r.customerName === 'Customer' && !('ownerId' in r) && !('bookingId' in r) && !('email' in r)));
});
test('empty reviews remain publicly readable with zero count/rating; invalid or missing provider fails safely', async () => {
  const f = fixture(); assert.deepEqual((await f.call()).body, { providerName: 'Shop', averageRating: 0, reviewCount: 0, reviews: [] });
  assert.equal((await f.call('bad')).code, 400); assert.equal((await f.call('20')).code, 404); assert.equal(f.reads, 1);
});
