import { parseBusinessHours, bookingDuration } from '../shared/business-hours.ts';
import assert from 'node:assert/strict';
import { vaccinationReturnWindow } from '../shared/vaccination-window.ts';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { vaccinationReturnTarget } from '../apps/api/src/lib/vaccination-followup.ts';
import { availableFollowupDates, closestFollowupDate, followupDisplayWindow, monthsInRange } from '../apps/web/src/lib/vaccination-followup.ts';
import { CreateBookingBody, CreateBookingResponse, GetProviderResponse, GetPetRecordsResponse, GetPetRecordsParams } from '../packages/api-zod/dist/index.js';

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
const scheduling = new Function('manilaNow', 'parseBusinessHours', `${transpile(source.slice(source.indexOf('function isValidBookingDate('), source.indexOf('function manilaNow(')))}; return { isValidBookingDate, timeToMinutes, minutesToTime, providerSchedule };`)(manilaNow, parseBusinessHours);
const service = { id: 11, name: 'Vaccination', category: 'vaccination', available: true, durationMinutes: 30, price: 100, description: '' };
const provider = { id: 1, name: 'Provider A', location: '', description: '', categories: ['vaccination'], rating: 0, reviewCount: 0, startingPrice: 100, imageUrl: '', verified: true, contact: '', hours: 'Mon-Sat 9AM-5PM', services: [service], products: [] };
const providerB = { ...provider, id: 2, name: 'Provider B', services: [{ ...service, id: 22 }] };
const providers = [provider, providerB];
const record = { id: 101, petId: 9, ownerId: 'customer', providerId: 1, serviceId: 11, providerName: 'Provider A', type: 'vaccination', title: 'Vaccination', date: '2026-10-02', status: 'completed', notes: '', nextDue: null };
const bookings = [];
const createdRecords = [];
let creationBooking = null;
let recordWrites = 0;
const handlers = new Map();
let providerAccess = 1;
const matches = (value, filter) => Object.entries(filter).every(([key, wanted]) => {
  if (wanted && typeof wanted === 'object') return (
    ('$in' in wanted ? wanted.$in.includes(value[key]) : true) &&
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
    find(filter) { return { sort() { return this; }, async toArray() { return matches(record, filter) ? [record] : []; } }; },
    async insertOne(value) { createdRecords.push(value); return { acknowledged: true }; },
    async findOne(filter) { return matches(record, filter) ? record : null; },
    async findOneAndUpdate(filter, update) { if (!matches(record, filter)) return null; recordWrites++; Object.assign(record, update.$set); for (const key of Object.keys(update.$unset ?? {})) delete record[key]; return record; },
  },
  bookingCollection: {
    async findOne(filter) { return creationBooking && matches(creationBooking, filter) ? creationBooking : null; },
    find(filter) { return { project() { return this; }, sort() { return this; }, async toArray() { return bookings.filter(item => matches(item, filter)); } }; },
    async insertOne(booking) { bookings.push(booking); },
  },
  petCollection: { async findOne(filter) { return filter.id === 9 && filter.ownerId === 'customer' ? { id: 9, name: 'Pet' } : null; } },
  bookingDuration, vaccinationReturnWindow, vaccinationReturnTarget, GetProviderResponse, GetPetRecordsParams, GetPetRecordsResponse, CreateBookingBody, CreateBookingResponse,
  assignedCareCategories: provider => provider?.categories.filter(category => ["grooming", "vaccination"].includes(category)) ?? [],
  ensureCompletedBookingRecord: async () => {},
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
install('router.get("/provider/archive"', 'router.get("/admin/orders"');
install('router.get("/provider/records"', 'router.get("/provider/pets"');
handlers.set("/provider/records/list", handlers.get("/provider/records"));
install('router.get("/pets/:petId/records"', 'async function vaccinationFollowupService(');
install('router.post("/provider/records"', 'router.patch("/provider/records/:recordId"');
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
assert.deepEqual(vaccinationReturnWindow('2027-10-21'), { start: '2027-10-21', end: '2027-10-31' });
assert.deepEqual(vaccinationReturnWindow('2027-12-27'), { start: '2027-12-27', end: '2028-01-06' });
assert.deepEqual(vaccinationReturnWindow('2028-02-25'), { start: '2028-02-25', end: '2028-03-06' });
assert.throws(() => vaccinationReturnWindow('2027-02-30'));
const window = vaccinationReturnWindow('2027-10-21');
assert.deepEqual(availableFollowupDates([{ dates: {
  '2027-10-20': ['09:00'], '2027-10-21': ['09:00'], '2027-10-22': [],
  '2027-10-31': ['09:00'], '2027-11-01': ['09:00'],
} }], window.start, window.end, '2027-10-01'), ['2027-10-21', '2027-10-31']);
const bookingInput = { providerId: 1, serviceId: 11, petId: 9, recordId: 101, date: '2026-12-04', time: '09:00' };
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-06' })).code, 409);
assert.equal((await request('/bookings', { ...bookingInput, providerId: 2, serviceId: 22 })).code, 400);
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-01' })).code, 400);
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-14' })).code, 400);
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-02' })).code, 201);
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-12' })).code, 201);
const booked = await request('/bookings', bookingInput);
assert.equal(booked.code, 201);
assert.equal(booked.body.date, '2026-12-04');
assert.equal(booked.body.petId, 9);
assert.equal(booked.body.providerId, 1);
assert.equal(booked.body.recordId, 101);
assert.equal((await request('/bookings', bookingInput)).code, 409); // Taken after another request.
assert.equal(bookings.length, 3);
assert.equal((await request('/provider/records/:recordId', { expectedReturnMonths: -1 }, { recordId: '101' })).code, 400);
assert.equal(record.nextDue, '2026-12-02');
providerB.categories = ['vaccination', 'grooming'];
providerB.services.push({ ...service, id: 33, name: 'Grooming', category: 'grooming' });
const grooming = await request('/bookings', { ...bookingInput, providerId: 2, serviceId: 33, recordId: null });
assert.equal(grooming.code, 201);
assert.equal(grooming.body.serviceCategory, 'grooming');
// Completion is provider-confirmed, independent of appointments and boosters.
assert.equal(record.vaccinationProgress, undefined);
assert.equal((await request('/provider/records/:recordId', { vaccinationProgress: 'ongoing' }, { recordId: '101' })).code, 400);
const writesBeforeCompletion = recordWrites;
const completedResponses = await Promise.all([1, 2].map(() => request('/provider/records/:recordId', { vaccinationProgress: 'completed' }, { recordId: '101' })));
assert.ok(completedResponses.every(response => response.code === 200));
assert.equal(recordWrites, writesBeforeCompletion + 1);
assert.equal(record.vaccinationProgress, 'completed');
assert.equal(record.status, 'completed');
assert.equal(record.nextDue, '2026-12-02');
assert.equal(record.expectedReturnMonths, 2);
assert.equal(GetPetRecordsResponse.parse({ grooming: [], vaccinations: [record] }).vaccinations[0].vaccinationProgress, 'completed');
assert.equal((await request('/provider/records/:recordId', { vaccinationProgress: 'invalid' }, { recordId: '101' })).code, 409);
assert.equal((await request('/provider/records/:recordId', { vaccinationProgress: null }, { recordId: '101' })).code, 409);
providerAccess = 2;
assert.equal((await request('/provider/records/:recordId', { vaccinationProgress: 'completed' }, { recordId: '101' })).code, 404);
providerAccess = 1;
provider.categories = ['grooming'];
assert.equal((await request('/provider/records/:recordId', { vaccinationProgress: 'completed' }, { recordId: '101' })).code, 403);
provider.categories = ['vaccination'];
creationBooking = { providerId: 1, petId: 9, serviceCategory: 'vaccination', status: 'completed', serviceName: 'Vaccination', ownerId: 'customer' };
const input = { type: 'vaccination', petId: 9, date: '2026-10-02', title: 'Vaccination' };
assert.equal((await request('/provider/records', input)).code, 201);
assert.equal(createdRecords[0].vaccinationProgress, 'ongoing');
assert.equal(createdRecords[0].nextDue, null);
assert.equal(createdRecords[0].ownerId, 'customer');
assert.equal((await request('/provider/records', { ...input, nextDue: '2026-12-02' })).code, 201);
assert.equal(createdRecords[1].vaccinationProgress, 'ongoing');
assert.equal((await request('/provider/records', { ...input, vaccinationProgress: ['ongoing'] })).code, 400);
assert.equal((await request('/provider/records', { ...input, vaccinationProgress: 'completed' })).code, 400);
assert.equal((await request('/provider/records', { ...input, vaccinationProgress: null })).code, 201);
assert.equal(createdRecords[2].vaccinationProgress, 'ongoing');
assert.equal((await request('/provider/records/:recordId', { notes: 'forbidden' }, { recordId: '101' })).code, 409);
assert.equal((await request('/provider/records/:recordId', { nextDue: '2027-01-01' }, { recordId: '101' })).code, 409);
assert.equal((await request('/pets/:petId/records/:recordId/follow-up', {}, { petId: '9', recordId: '101' })).code, 409);
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-05' })).code, 409);
providerAccess = 2;
assert.equal((await request('/provider/records/:recordId/archive', { archived: true }, { recordId: '101' })).code, 404);
providerAccess = 1;
record.vaccinationProgress = 'ongoing';
assert.equal((await request('/provider/records/:recordId/archive', { archived: true }, { recordId: '101' })).code, 409);
record.vaccinationProgress = 'completed';
const beforeArchive = recordWrites;
assert.equal((await request('/provider/records/:recordId/archive', { archived: true }, { recordId: '101' })).code, 200);
assert.equal((await request('/provider/records/:recordId/archive', { archived: true }, { recordId: '101' })).code, 200);
assert.equal(recordWrites, beforeArchive + 1);
assert.equal(record.archived, true);
assert.equal((await request('/provider/records/list')).body.length, 0);
assert.equal((await request('/provider/archive')).body.vaccinationRecords[0].id, 101);
assert.equal((await request('/pets/:petId/records', {}, { petId: '9' })).body.vaccinations[0].id, 101);
assert.equal((await request('/provider/records/:recordId', { vaccinationProgress: 'completed' }, { recordId: '101' })).code, 409);
assert.equal((await request('/provider/records/:recordId', { notes: 'forbidden' }, { recordId: '101' })).code, 409);
assert.equal((await request('/provider/records/:recordId/archive', { archived: false }, { recordId: '101' })).code, 200);
assert.equal(record.vaccinationProgress, 'completed');
assert.equal(record.nextDue, '2026-12-02');
assert.equal(record.expectedReturnMonths, 2);
assert.equal((await request('/provider/records/list')).body[0].id, 101);
assert.equal((await request('/pets/:petId/records/:recordId/follow-up', {}, { petId: '9', recordId: '101' })).code, 409);
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-05' })).code, 409);
// The same provider-hour rules serve new/repeat grooming and vaccination bookings.
provider.hours = '8AM - 9PM';
let hoursAvailability = await request('/providers/:providerId/availability', {}, { providerId: '1' }, { serviceId: '11', month: '2026-12' });
assert.equal(hoursAvailability.body.slots['2026-12-05'][0].time, '08:00');
assert.equal(hoursAvailability.body.slots['2026-12-05'].at(-1).time, '20:30');
provider.hours = '10:30 AM - 7:30 PM';
hoursAvailability = await request('/providers/:providerId/availability', {}, { providerId: '1' }, { serviceId: '11', month: '2026-12' });
assert.equal(hoursAvailability.body.slots['2026-12-05'][0].time, '10:30');
assert.equal(hoursAvailability.body.slots['2026-12-05'].at(-1).time, '19:00');
service.durationMinutes = 60;
hoursAvailability = await request('/providers/:providerId/availability', {}, { providerId: '1' }, { serviceId: '11', month: '2026-12' });
assert.equal(hoursAvailability.body.slots['2026-12-05'].at(-1).time, '19:00');
assert.equal((await request('/bookings', { ...bookingInput, recordId: null, date: '2026-12-05', time: '09:00' })).code, 409);
assert.equal((await request('/bookings', { ...bookingInput, recordId: null, date: '2026-12-05', time: '19:30' })).code, 409);
assert.equal((await request('/bookings', { ...bookingInput, recordId: null, date: '2026-12-05', time: '11:15' })).code, 409);
assert.equal((await request('/bookings', { ...bookingInput, recordId: null, date: '2026-12-05', time: '19:00' })).code, 201);
hoursAvailability = await request('/providers/:providerId/availability', {}, { providerId: '1' }, { serviceId: '11', month: '2026-12' });
assert.equal(hoursAvailability.body.slots['2026-12-05'].find(slot => slot.time === '19:00').status, 'unavailable');
assert.equal(hoursAvailability.body.slots['2026-12-05'].find(slot => slot.time === '18:30').status, 'unavailable');
const confirmedCount = bookings.length;
provider.hours = '10AM - 6PM';
hoursAvailability = await request('/providers/:providerId/availability', {}, { providerId: '1' }, { serviceId: '11', month: '2026-12' });
assert.equal(hoursAvailability.body.slots['2026-12-05'][0].time, '10:00');
assert.equal(hoursAvailability.body.slots['2026-12-05'].at(-1).time, '17:30');
assert.equal(bookings.length, confirmedCount); // Saving narrower hours doesn't change old bookings.
service.durationMinutes = undefined;
hoursAvailability = await request('/providers/:providerId/availability', {}, { providerId: '1' }, { serviceId: '11', month: '2026-12' });
assert.equal(hoursAvailability.body.slots['2026-12-05'].at(-1).time, '17:30');
service.durationMinutes = 30;
// Closing cutoff is a fixed 30 minutes, independent of service duration.
provider.hours = '9AM-5PM';
service.durationMinutes = 90;
hoursAvailability = await request('/providers/:providerId/availability', {}, { providerId: '1' }, { serviceId: '11', month: '2026-12' });
assert.equal(hoursAvailability.body.slots['2026-12-12'].at(-1).time, '16:30');
record.vaccinationProgress = 'ongoing';
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-12', time: '16:30' })).code, 201);
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-12', time: '17:00' })).code, 409);
assert.equal((await request('/bookings', { ...bookingInput, date: '2026-12-12', time: '17:30' })).code, 409);
providerB.hours = '10AM-6PM';
providerB.services.find(item => item.id === 33).durationMinutes = 90;
const groomingSlots = await request('/providers/:providerId/availability', {}, { providerId: '2' }, { serviceId: '33', month: '2026-12' });
assert.equal(groomingSlots.body.slots['2026-12-05'].at(-1).time, '17:30');
assert.equal((await request('/bookings', { providerId: 2, serviceId: 33, petId: 9, recordId: null, date: '2026-12-05', time: '17:30' })).code, 201);
assert.equal((await request('/bookings', { providerId: 2, serviceId: 33, petId: 9, recordId: null, date: '2026-12-05', time: '18:00' })).code, 409);
provider.hours = 'invalid hours';
assert.equal((await request('/providers/:providerId/availability', {}, { providerId: '1' }, { serviceId: '11', month: '2026-12' })).code, 409);
assert.equal((await request('/bookings', { ...bookingInput, recordId: null, date: '2026-12-05', time: '11:00' })).code, 409);
console.log('PASS: provider-specific opening/closing, closing-minus-30 cutoff regardless of duration, hours updates, conflict and off-grid rejection, old bookings preserved; vaccination return-window, archive and progress regressions.');
