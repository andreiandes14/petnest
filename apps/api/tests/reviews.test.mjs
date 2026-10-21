import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { reviewEligible, validReviewInput } = await import(`data:text/javascript;base64,${Buffer.from(compile(readFileSync(new URL('../src/lib/reviews.ts', import.meta.url), 'utf8'))).toString('base64')}`);
const source = readFileSync(new URL('../src/routes/petnest.ts', import.meta.url), 'utf8');
const match = (row, filter) => Object.entries(filter).every(([key, value]) => value && typeof value === 'object' && '$in' in value ? value.$in.includes(row[key]) : row[key] === value);
function fixture() {
  const bookings = [1, 2].map(id => ({ id, ownerId: 'customer', providerId: 10, status: 'completed', serviceCategory: id === 1 ? 'grooming' : 'vaccination', serviceName: 'Service', date: '2026-10-16', paymentStatus: 'PAID', vaccinationCourseStatus: 'cancelled' }));
  const reviews = [], handlers = new Map(); let customer = 'customer', authenticated = true, indexCreated = false;
  const reviewCollection = {
    find(filter) { return { async toArray() { return reviews.filter(row => match(row, filter)); } }; },
    async createIndex(keys, options) { assert.deepEqual(keys, { bookingId: 1 }); assert.equal(options.unique, true); indexCreated = true; },
    async insertOne(row) { assert.equal(indexCreated, true); if (reviews.some(r => r.bookingId === row.bookingId)) throw { code: 11000 }; reviews.push(row); },
  };
  const deps = { router: { get(path, fn) { handlers.set(path, fn); }, post(path, fn) { handlers.set(path, fn); } }, requireCustomer: async (req, res) => {
    if (!authenticated) { res.status(401).json({ error: 'Sign in required' }); return null; } return { userId: customer };
  }, bookingCollection: { find(filter) { return { async toArray() { return bookings.filter(b => match(b, filter)); } }; }, async findOne(filter) { return bookings.find(b => match(b, filter)) ?? null; } }, reviewCollection, reviewEligible, validReviewInput, randomUUID: () => 'review-fixture' };
  const start = source.indexOf('router.get("/reviews/eligibility"');
  new Function(...Object.keys(deps), compile(source.slice(start, source.indexOf('router.get("/providers",', start))))(...Object.values(deps));
  return { bookings, reviews, setCustomer(value) { customer = value; }, signOut() { authenticated = false; }, async call(path, body = {}, providerId = '10', query = {}) {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handlers.get(path)({ params: { providerId }, body, query }, res); return res;
  } };
}
const input = { bookingId: 1, rating: 5, comment: 'Verified service review' };
const submit = '/providers/:providerId/reviews';
test('real route allows one review per completed booking; duplicates and concurrent submissions are rejected', async () => {
  const f = fixture();
  assert.equal((await f.call('/reviews/eligibility')).body.length, 2);
  const responses = await Promise.all([f.call(submit, input), f.call(submit, input)]);
  assert.deepEqual(responses.map(r => r.code).sort(), [201, 409]); assert.equal(f.reviews.length, 1);
  assert.deepEqual((await f.call('/reviews/eligibility')).body.map(b => b.bookingId), [2]);
  assert.equal((await f.call(submit, { ...input, bookingId: 2 })).code, 201); // Discontinued vaccination course does not disqualify completed service.
  assert.equal((await f.call('/reviews/eligibility')).body.length, 0);
  f.bookings.push({ ...f.bookings[0], id: 3 });
  assert.deepEqual((await f.call('/reviews/eligibility')).body.map(b => b.bookingId), [3]);
});
test('API denies unpaid or paid non-completed appointments, wrong provider/owner/service and unauthenticated requests', async () => {
  for (const status of ['pending', 'awaiting_payment', 'confirmed', 'cancelled', 'no_show']) {
    const f = fixture(); f.bookings.forEach(b => b.status = status);
    assert.equal((await f.call(submit, input)).code, 403); assert.equal((await f.call('/reviews/eligibility')).body.length, 0);
  }
  const f = fixture(); assert.equal((await f.call(submit, input, '20')).code, 403);
  f.setCustomer('other'); assert.equal((await f.call(submit, input)).code, 403); assert.equal((await f.call('/reviews/eligibility')).body.length, 0);
  f.setCustomer('customer'); f.bookings[0].serviceCategory = 'pet-supplies'; assert.equal((await f.call(submit, input)).code, 403);
  f.signOut(); assert.equal((await f.call(submit, input)).code, 401);
  assert.equal(f.reviews.length, 0);
});
test('review validation rejects tampered booking IDs, ratings and empty/oversized comments', async () => {
  for (const changes of [{ bookingId: '1' }, { bookingId: -1 }, { rating: 6 }, { rating: 1.5 }, { comment: '' }, { comment: 'x'.repeat(1001) }]) {
    const f = fixture(); assert.equal((await f.call(submit, { ...input, ...changes })).code, 400); assert.equal(f.reviews.length, 0);
  }
});
test('public rating/count summaries reflect actual submitted reviews without overwriting provider documents', async () => {
  const start = source.indexOf('async function withReviewRatings');
  const end = source.indexOf('const petCollection:', start);
  const reviewCollection = { aggregate() { return { async toArray() { return [{ _id: 10, count: 2, total: 6 }]; } }; } };
  const summarize = new Function('reviewCollection', `${compile(source.slice(start, end))};return withReviewRatings;`)(reviewCollection);
  const providers = [{ id: 10, rating: 4, reviewCount: 5 }, { id: 20, rating: 0, reviewCount: 0 }];
  const before = structuredClone(providers);
  const result = await summarize(providers);
  assert.equal(result[0].reviewCount, 2); assert.equal(result[0].rating, 3);
  assert.deepEqual(result[1], providers[1]); assert.deepEqual(providers, before);
});


test('booking history reports reviewed state from saved reviews without including unperformed or unrelated bookings', async () => {
  const f=fixture();
  await f.call(submit,input);
  const history=await f.call('/reviews/eligibility',{},'10',{includeReviewed:'1'});
  assert.deepEqual(history.body.map(b=>[b.bookingId,b.reviewed]),[[1,true],[2,false]]);
  assert.equal((await f.call(submit,{...input,bookingId:2})).code,201);
  const refreshed=await f.call('/reviews/eligibility',{},'10',{includeReviewed:'1'});
  assert.ok(refreshed.body.every(b=>b.reviewed));
  f.bookings[1].status='no_show';
  assert.deepEqual((await f.call('/reviews/eligibility',{},'10',{includeReviewed:'1'})).body.map(b=>b.bookingId),[1]);
  f.setCustomer('other');assert.deepEqual((await f.call('/reviews/eligibility',{},'10',{includeReviewed:'1'})).body,[]);
});
