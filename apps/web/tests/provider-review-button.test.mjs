import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Dialog from '@radix-ui/react-dialog';
import ts from 'typescript';
const source = readFileSync(new URL('../src/components/provider-review-button.tsx', import.meta.url), 'utf8');
const component = source.slice(source.indexOf('export function ProviderReviewButton')).replace('export function', 'function');
const code = ts.transpileModule(component, { fileName: 'button.tsx', compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
function render(customerId, bookings, providerId = 10, extra = {}) {
  const deps = { React, Dialog, useRef: value => ({ current: value }), useState: value => [value, () => {}], useQuery: () => ({ data: bookings, isError: false }),
    useMutation: () => ({ isPending: false, isError: false }), useQueryClient: () => ({}), apiRequest() {}, getListProvidersQueryKey() {}, getGetProviderQueryKey() {} };
  const Button = new Function(...Object.keys(deps), `${code};return ProviderReviewButton;`)(...Object.values(deps));
  return renderToStaticMarkup(React.createElement(Button, { customerId, providerId, ...extra }));
}
test('actual card review control is hidden for signed-out, ineligible, already-reviewed and other-provider customers', () => {
  const booking = { bookingId: 1, providerId: 10, serviceName: 'Grooming', date: '2026-10-16' };
  assert.equal(render(undefined, [booking]), '');
  assert.equal(render('customer', []), '');
  assert.equal(render('customer', [booking], 20), '');
  assert.match(render('customer', [booking]), />Add a Review</);
  assert.match(render('customer', [{ ...booking, bookingId: 2 }]), />Add a Review</);
});

test('rapid form submissions send one request; success immediately removes only the reviewed booking from eligibility', async () => {
  let options, state = 0;
  let bookings = [1, 2].map(bookingId => ({ bookingId, providerId: 10, serviceName: 'Service', date: '2026-10-16' }));
  const sent = [];
  const deps = { React, Dialog, useRef: value => ({ current: value }), useState: () => [[true, 0, '5', 'Review'][state++], () => {}],
    useQuery: () => ({ data: bookings, isError: false }),
    useMutation: config => { options = config; return { isPending: false, isError: false, mutate: id => sent.push(id) }; },
    useQueryClient: () => ({ setQueryData(key, update) { bookings = update(bookings); }, async invalidateQueries() {} }),
    apiRequest() {}, getListProvidersQueryKey() {}, getGetProviderQueryKey() {} };
  const Button = new Function(...Object.keys(deps), `${code};return ProviderReviewButton;`)(...Object.values(deps));
  const tree = Button({ customerId: 'customer', providerId: 10 });
  const findForm = element => {
    if (!element || typeof element !== 'object') return null;
    if (element.type === 'form') return element;
    for (const child of React.Children.toArray(element.props?.children)) { const form = findForm(child); if (form) return form; }
    return null;
  };
  const form = findForm(tree); assert.ok(form);
  form.props.onSubmit({ preventDefault() {} }); form.props.onSubmit({ preventDefault() {} });
  assert.deepEqual(sent, [1]);
  await options.onSuccess({ saved: true }, 1);
  assert.deepEqual(bookings.map(b => b.bookingId), [2]);
  await options.onSuccess({ saved: true }, 2);
  assert.deepEqual(bookings, []);
});


test('booking-specific control never borrows another booking eligibility and restores Reviewed from backend data',()=>{
  const bookings=[{bookingId:1,providerId:10,serviceName:'Bath',date:'2026-10-16',reviewed:true},{bookingId:2,providerId:10,serviceName:'Anti-rabies',date:'2026-10-17',reviewed:false}];
  assert.match(render('customer',bookings,10,{bookingId:1,providerName:'Shop'}),/Reviewed/);
  assert.doesNotMatch(render('customer',bookings,10,{bookingId:1}),/Add a Review/);
  assert.match(render('customer',bookings,10,{bookingId:2}),/Add a Review/);
  assert.equal(render('customer',bookings,10,{bookingId:3}),'');
  assert.equal(render(undefined,bookings,10,{bookingId:2}),'');
});
