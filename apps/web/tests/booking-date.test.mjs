import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/booking-date.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { bookingDateParts } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('full booking date and left badge agree across device timezones and year boundaries', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['Asia/Manila', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      process.env.TZ = zone;
      assert.deepEqual(bookingDateParts('2026-10-22'), { full: 'October 22, 2026', day: '22', month: 'Oct' });
      assert.equal(bookingDateParts('2027-01-01').full, 'January 1, 2027');
      assert.equal(bookingDateParts('2028-02-29').full, 'February 29, 2028');
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
test('invalid saved dates never roll over to a different appointment day', () => {
  for (const value of ['', 'invalid', '2026-02-29', '2026-13-01']) {
    assert.equal(bookingDateParts(value).full, 'Date unavailable');
  }
});
