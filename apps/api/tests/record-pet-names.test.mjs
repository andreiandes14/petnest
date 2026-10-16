import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const helper = compile(readFileSync(new URL('../src/lib/record-pet-names.ts', import.meta.url), 'utf8'));
const { withRecordPetNames } = await import(`data:text/javascript;base64,${Buffer.from(helper).toString('base64')}`);

test('all service/progress types use registered pet names without modifying history', () => {
  const records = ['grooming', 'vaccination', 'vaccination', 'vaccination'].map((type, id) => ({ id, petId: 11, ownerId: 'customer', type, vaccinationProgress: ['completed', 'ongoing', 'completed', 'cancelled'][id] }));
  const before = structuredClone(records);
  const result = withRecordPetNames(records, [{ id: 11, ownerId: 'customer', name: ' Max ' }]);
  assert.ok(result.every(record => record.petName === 'Max'));
  assert.deepEqual(records, before);
  assert.deepEqual(result.map(({ petName, ...record }) => record), records);
});
test('missing, blank and wrong-owner pets use the neutral fallback, never a numeric ID', () => {
  const records = [{ petId: 11, ownerId: 'customer' }];
  for (const pets of [[], [{ id: 11, ownerId: 'other', name: 'Wrong pet' }], [{ id: 11, ownerId: 'customer', name: ' ' }]]) {
    assert.equal(withRecordPetNames(records, pets)[0].petName, 'Pet name unavailable');
  }
});
test('actual authorized provider history route fetches names in one batch for all cards', async () => {
  const source = readFileSync(new URL('../src/routes/petnest.ts', import.meta.url), 'utf8');
  const start = source.indexOf('router.get("/provider/records"');
  const end = source.indexOf('router.get("/provider/pets"', start);
  let handler, petReads = 0;
  const records = [{ id: 1, petId: 11, ownerId: 'customer', type: 'grooming' }, { id: 2, petId: 11, ownerId: 'customer', type: 'vaccination' }];
  const deps = {
    router: { get(path, fn) { handler = fn; } }, requireProvider: async () => ({ providerId: 10 }),
    providerCollection: { async findOne() { return { categories: ['grooming', 'vaccination'] }; } },
    assignedCareCategories: p => p.categories,
    bookingCollection: { find() { return { async toArray() { return []; } }; } }, ensureCompletedBookingRecord: async () => {},
    recordCollection: { find(filter) { assert.equal(filter.providerId, 10); return { sort() { return this; }, async toArray() { return records; } }; } },
    petCollection: { find(filter, options) {
      petReads++; assert.deepEqual(filter.id.$in, [11]); assert.deepEqual(filter.ownerId.$in, ['customer']);
      assert.equal(options.projection.name, 1);
      return { async toArray() { return [{ id: 11, ownerId: 'customer', name: 'Max' }]; } };
    } }, withRecordPetNames,
  };
  new Function(...Object.keys(deps), compile(source.slice(start, end)))(...Object.values(deps));
  const res = { json(body) { this.body = body; } };
  await handler({ query: {} }, res);
  assert.equal(petReads, 1);
  assert.ok(res.body.every(record => record.petName === 'Max'));
});
