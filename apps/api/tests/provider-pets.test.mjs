import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/routes/petnest.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source.slice(source.indexOf('router.get("/provider/pets"'), source.indexOf('router.post("/provider/records"')), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function harness() {
  const bookings = [
    { id: 1, providerId: 1, petId: 1, ownerId: 'a', serviceCategory: 'grooming', serviceName: 'Bath', date: '2026-10-12', time: '10:00', status: 'completed', archived: false },
    { id: 2, providerId: 1, petId: 1, ownerId: 'a', serviceCategory: 'grooming', serviceName: 'Trim', date: '2026-09-12', time: '10:00', status: 'completed', archived: true },
    { id: 3, providerId: 1, petId: 2, ownerId: 'b', serviceCategory: 'vaccination', serviceName: 'Vaccine', date: '2026-10-10', time: '09:00', status: 'confirmed' },
    { id: 4, providerId: 2, petId: 4, ownerId: 'd', serviceCategory: 'grooming', serviceName: 'Other', date: '2026-10-14', time: '11:00', status: 'completed', archived: true },
  ];
  const records = [
    { id: 11, providerId: 1, petId: 1, ownerId: 'a', type: 'grooming', title: 'Bath', date: '2026-10-12', time: '10:00', bookingId: 1, notes: 'Preserved notes', status: 'completed' },
    { id: 12, providerId: 1, petId: 3, ownerId: 'c', type: 'vaccination', title: 'Anti-rabies', date: '2026-10-13', notes: 'History only', status: 'completed', vaccinationProgress: 'completed', archived: true, nextDue: '2027-10-13' },
    { id: 13, providerId: 2, petId: 4, ownerId: 'd', type: 'grooming', title: 'Private', date: '2026-10-14', status: 'completed' },
  ];
  const pets = [1,2,3,4].map(id => ({ id, name: `Pet ${id}`, species: 'Dog', breed: 'Breed', age: '2', ownerId: String(id) }));
  const owners = ['a','b','c','d'].map(id => ({ id, name: `Owner ${id}`, email: `${id}@example.test` }));
  const matches = (row, filter) => Object.entries(filter).every(([key, value]) => value && typeof value === 'object' ? ('$in' in value ? value.$in.includes(row[key]) : '$ne' in value ? row[key] !== value.$ne : true) : row[key] === value);
  const project = (row, projection) => !projection ? { ...row } : Object.values(projection).includes(1) ? Object.fromEntries(Object.entries(row).filter(([key]) => projection[key] === 1)) : Object.fromEntries(Object.entries(row).filter(([key]) => projection[key] !== 0));
  const collection = rows => ({
    async findOne(filter, options) { const row = rows.find(row => matches(row, filter)); return row ? project(row, options?.projection) : null; },
    find(filter, options) { let selected = rows.filter(row => matches(row, filter)); return { sort(order) { selected = [...selected].sort((a,b) => { for (const [key,direction] of Object.entries(order)) { const comparison = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { numeric: true }); if (comparison) return comparison * direction; } return 0; }); return this; }, async toArray() { return selected.map(row => project(row, options?.projection)); } }; },
  });
  const handlers = new Map(); let providerId = 1;
  const deps = {
    router: { get(path, handler) { handlers.set(path, handler); } },
    requireProvider: async () => ({ providerId }),
    providerCollection: collection([{ id: 1, categories: ['grooming', 'vaccination'] }, { id: 2, categories: ['grooming', 'vaccination'] }]),
    bookingCollection: collection(bookings), recordCollection: collection(records), petCollection: collection(pets), userCollection: collection(owners),
    assignedCareCategories: provider => provider?.categories ?? [], ensureCompletedBookingRecord: async () => {},
  };
  new Function(...Object.keys(deps), code)(...Object.values(deps));
  return { bookings, records, setProvider(id) { providerId = id; }, async request(path, petId) { const response = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; await handlers.get(path)({ params: { petId: String(petId) } }, response); return response; } };
}
test('archiving does not remove pets, duplicate entries, owner details or latest service', async () => {
  const api = harness();
  const before = (await api.request('/provider/pets')).body;
  api.bookings[0].archived = true;
  const after = (await api.request('/provider/pets')).body;
  assert.deepEqual(after, before);
  assert.deepEqual(after.map(pet => pet.id), [1,2,3]);
  assert.equal(after[0].lastService, 'Bath'); assert.equal(after[0].lastBooking, '2026-10-12'); assert.equal(after[0].ownerName, 'Owner a');
  const modal = await api.request('/provider/pets/:petId/records', 1);
  assert.equal(modal.code, 200); assert.equal(modal.body.records[0].notes, 'Preserved notes'); assert.equal(modal.body.records[0].bookingId, 1);
});
test('provider-owned history alone grants access, including archived completed vaccination history', async () => {
  const api = harness();
  const modal = await api.request('/provider/pets/:petId/records', 3);
  assert.equal(modal.code, 200); assert.equal(modal.body.owner.name, 'Owner c');
  assert.equal(modal.body.records[0].vaccinationProgress, 'completed'); assert.equal(modal.body.records[0].archived, true); assert.equal(modal.body.records[0].nextDue, '2027-10-13');
});
test('unrelated provider pets and history remain inaccessible', async () => {
  const api = harness();
  assert.equal((await api.request('/provider/pets/:petId/records', 4)).code, 404);
  api.setProvider(2);
  assert.deepEqual((await api.request('/provider/pets')).body.map(pet => pet.id), [4]);
  assert.equal((await api.request('/provider/pets/:petId/records', 1)).code, 404);
});
