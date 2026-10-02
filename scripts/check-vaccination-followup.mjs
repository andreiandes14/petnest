import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { vaccinationReturnTarget } from '../apps/api/src/lib/vaccination-followup.ts';
import { availableFollowupDates, closestFollowupDate, followupDisplayWindow, monthsInRange } from '../apps/web/src/lib/vaccination-followup.ts';
import { CreateBookingBody, CreateBookingResponse, GetProviderResponse, GetPetRecordsResponse } from '../packages/api-zod/dist/index.js';

assert.equal(vaccinationReturnTarget('2026-10-02', 2), '2026-12-02');
assert.equal(vaccinationReturnTarget('2027-01-31', 1), '2027-02-28');
assert.equal(vaccinationReturnTarget('2028-01-31', 1), '2028-02-29');
assert.throws(() => vaccinationReturnTarget('2026-02-30', 2));
assert.throws(() => vaccinationReturnTarget('2026-10-02', 0));
assert.equal(followupDisplayWindow('14'), 14);
assert.equal(followupDisplayWindow(undefined), 30);
assert.deepEqual(monthsInRange('2026-11-02', '2027-01-01'), ['2026-11', '2026-12', '2027-01']);
for (const dates of [
  ['2026-11-28', '2026-11-30', '2026-12-02', '2026-12-04', '2026-12-07', '2026-12-10'],
  ['2026-11-30', '2026-12-01', '2026-12-04', '2026-12-06'],
]) {
  const response = { dates: Object.fromEntries(dates.map(date => [date, ['09:00']])) };
  const choices = availableFollowupDates([response], '2026-11-02', '2027-01-01', '2026-10-02');
  assert.deepEqual(choices, dates);
  assert.equal(closestFollowupDate(choices, '2026-12-02'), dates.includes('2026-12-02') ? '2026-12-02' : '2026-12-01');
}
assert.deepEqual(availableFollowupDates([{ dates: { '2026-12-02': [], '2027-02-04': ['09:00'] } }], '2026-11-02', '2027-01-01', '2026-10-02'), []);
assert.deepEqual(availableFollowupDates([{ dates: { '2027-02-04': ['09:00'] } }], '2027-02-01', '2027-02-28', '2026-10-02'), ['2027-02-04']);

// Run the actual route handlers against isolated repositories, never live data.
const source = readFileSync(new URL('../apps/api/src/routes/petnest.ts', import.meta.url), 'utf8');
const transpile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const manilaNow = () => ({ date: '2026-10-02', minutes: 480 });
const scheduling = new Function('manilaNow', `${transpile(source.slice(source.indexOf('function isValidBookingDate('), source.indexOf('function manilaNow(')))}; return { isValidBookingDate, timeToMinutes, minutesToTime, providerSchedule };`)(manilaNow);
const service = { id: 11, name: 'Vaccination', category: 'vaccination', available: true, durationMinutes: 30, price: 100, description: '' };
const provider = { id: 1, name: 'Provider A', location: '', description: '', categories: ['vaccination'], rating: 0, reviewCount: 0, startingPrice: 100, imageUrl: '', verified: true, contact: '', hours: 'Mon-Sat 9AM-5PM', services: [service], products: [] };
const providerB = { ...provider, id: 2, name: 'Provider B', services: [{ ...service, id: 22 }] };
const providers = [provider, providerB];
const record = { id: 101, petId: 9, ownerId: 'customer', providerId: 1, serviceId: 11, providerName: 'Provider A', type: 'vaccination', title: 'Vaccination', date: '2026-10-02', status: 'completed', notes: '', nextDue: null };
const bookings = [];
const handlers = new Map();
let providerAccess = 1;
const matches = (value, filter) => Object.entries(filter).every(([key, wanted]) => {
  if (wanted && typeof wanted === 'object') return (
    ('$nin' in wanted ? !wanted.$nin.includes(value[key]) : true) &&
    ('$gte' in wanted ? value[key] >= wanted.$gte : true) &&
    ('$lte' in wanted ? value[key] <= wanted.$lte : true) &&
    ('$ne' in wanted ? value[key] !== wanted.$ne : true));
  return value[key] === wanted;
});
const deps = {
  router: { get(path, fn) { handlers.set(path, fn); }, post(path, fn) { handlers.set(path, fn); }, patch(path, fn) { handlers.set(path, fn); } },
  requireCustomer: async () => ({ userId: 'customer' }), requireProvider: async () => ({ providerId: providerAccess }),
  providerCollection: { async findOne(filter) { return providers.find(item => matches(item, filter)) ?? null; } },
  recordCollection: {
    async findOne(filter) { return matches(record, filter) ? record : null; },
    async findOneAndUpdate(filter, update) { if (!matches(record, filter)) return null; Object.assign(record, update.$set); for (const key of Object.keys(update.$unset ?? {})) delete record[key]; return record; },
  },
  bookingCollection: {
    async findOne() { return null; },
    find(filter) { return { project() { return this; }, async toArray() { return bookings.filter(item => matches(item, filter)); } }; },
    async insertOne(booking) { bookings.push(booking); },
  },
  petCollection: { async findOne(filter) { return filter.id === 9 && filter.ownerId === 'customer' ? { id: 9, name: 'Pet' } : null; } },
  vaccinationReturnTarget, GetProviderResponse, CreateBookingBody, CreateBookingResponse,
  ...scheduling, manilaNow,
  isIsoDate: value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value),
  validText: value => typeof value === 'string' && value.trim().length > 0,
  syncPetNextVaccination: async () => {}, acquireBookingLock: async () => async () => {},
  nextId: async () => bookings.length + 1, createNotification: async () => {}, notifyProvider: async () => {},
};
function install(startMarker, endMarker, result = '') {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start);
  return new Function(...Object.keys(deps), `${transpile(source.slice(start, end))}${result}`)(...Object.values(deps));
}
deps.vaccinationFollowupService = install('async function vaccinationFollowupService(', 'router.get("/provider/records"', '; return vaccinationFollowupService;');
install('router.patch("/provider/records/:recordId"', 'router.get("/bookings"');
install('router.get("/providers/:providerId/availability"', 'router.get("/services"');
install('router.post("/bookings"', 'router.delete("/bookings/:bookingId"');

async function request(path, body = {}, params = {}, query = {}) {
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handlers.get(path)({ body, params, query }, res);
  return res;
}
assert.equal((await request('/provider/records/:recordId', { expectedReturnMonths: 2 }, { recordId: '101' })).code, 200);
assert.equal(record.nextDue, '2026-12-02');
assert.equal(record.expectedReturnMonths, 2);
assert.equal(GetPetRecordsResponse.parse({ grooming: [], vaccinations: [record] }).vaccinations[0].expectedReturnMonths, 2);
const context = await request('/pets/:petId/records/:recordId/follow-up', {}, { petId: '9', recordId: '101' });
assert.equal(context.body.provider.id, 1);
assert.equal(context.body.service.id, 11);
assert.equal(context.body.targetDate, '2026-12-02');
assert.equal((await request('/pets/:petId/records/:recordId/follow-up', {}, { petId: '99', recordId: '101' })).code, 404);
providerAccess = 2;
assert.equal((await request('/provider/records/:recordId', { expectedReturnMonths: 3 }, { recordId: '101' })).code, 404);
providerAccess = 1;
const availability = await request('/providers/:providerId/availability', {}, { providerId: '1' }, { serviceId: '11', month: '2026-12' });
assert.ok(availability.body.dates['2026-12-04'].includes('09:00'));
assert.deepEqual(availability.body.dates['2026-12-06'], []); // Provider A is closed Sunday.
const bookingInput = { providerId: 1, serviceId: 11, petId: 9, recordId: 101, date: '2026-12-04', time: '09:00' };
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-06' })).code, 409);
assert.equal((await request('/bookings', { ...bookingInput, providerId: 2, serviceId: 22 })).code, 400);
const booked = await request('/bookings', bookingInput);
assert.equal(booked.code, 201);
assert.equal(booked.body.date, '2026-12-04');
assert.equal(booked.body.petId, 9);
assert.equal(booked.body.providerId, 1);
assert.equal(booked.body.recordId, 101);
assert.equal((await request('/bookings', bookingInput)).code, 409); // Taken after another request.
assert.equal(bookings.length, 1);
assert.equal((await request('/provider/records/:recordId', { expectedReturnMonths: -1 }, { recordId: '101' })).code, 400);
assert.equal(record.nextDue, '2026-12-02');
providerB.categories = ['vaccination', 'grooming'];
providerB.services.push({ ...service, id: 33, name: 'Grooming', category: 'grooming' });
const grooming = await request('/bookings', { ...bookingInput, providerId: 2, serviceId: 33, recordId: null });
assert.equal(grooming.code, 201);
assert.equal(grooming.body.serviceCategory, 'grooming');
console.log('PASS: calendar-month target, saved recommendation/schema, nearby choices without exact target, more future dates, actual availability, provider isolation, alternative date booking, unavailable/taken slot rejection.');
