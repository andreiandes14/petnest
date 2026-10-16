import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const start = source.indexOf('function VaccinationCourseSelect(');
const end = source.indexOf('function RecordCategoryTabs(', start);
assert.ok(start >= 0 && end > start);
const compile = (text, jsx) => ts.transpileModule(text, {
  fileName: 'component.tsx', compilerOptions: { module: ts.ModuleKind.ESNext, jsx, target: ts.ScriptTarget.ES2022 },
}).outputText;
const labels = compile(readFileSync(new URL('../src/lib/booking-status.ts', import.meta.url), 'utf8'));
const { vaccinationCourseLabel, bookingStatusDisplay } = await import(`data:text/javascript;base64,${Buffer.from(labels).toString('base64')}`);
const Select = new Function('React', 'vaccinationCourseLabel', `${compile(source.slice(start, end), ts.JsxEmit.React)}; return VaccinationCourseSelect;`)(React, vaccinationCourseLabel);

test('actual vaccination select renders exactly Ongoing / Not Continued with compatible saved values', () => {
  const html = renderToStaticMarkup(React.createElement(Select, { disabled: false, onCancel() {} }));
  const options = [...html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(match => [match[1], match[2]]);
  assert.deepEqual(options, [['ongoing', 'Ongoing'], ['cancelled', 'Not Continued']]);
  assert.equal(html.includes('>Cancelled<'), false);
  assert.equal(html.includes('disabled=""'), false);
  assert.equal(bookingStatusDisplay('cancelled').label, 'Cancelled');
});
test('selecting discontinued course opens existing confirmation, while Ongoing does not save', () => {
  let confirmations = 0;
  const select = Select({ disabled: false, onCancel() { confirmations++; } });
  select.props.onChange({ target: { value: 'ongoing' } });
  assert.equal(confirmations, 0);
  select.props.onChange({ target: { value: 'cancelled' } });
  assert.equal(confirmations, 1);
});
