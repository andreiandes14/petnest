import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { supportedFulfillmentMethods, supportsFulfillmentMethod } from '../apps/api/src/lib/fulfillment.ts';

// Exercise the actual frontend resolver without loading the app or any database.
const source = readFileSync(new URL('../apps/web/src/App.tsx', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('const defaultFulfillmentMethods'), source.indexOf('type UserRole'));
const js = ts.transpileModule(helpers, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const frontend = new Function(`${js}; return { getFulfillmentMethods, fulfillmentLabel };`)();
for (const configured of [undefined, [], ['PICKUP'], ['DELIVERY'], ['PICKUP', 'DELIVERY']]) {
  const expected = configured?.includes('DELIVERY') ? ['PICKUP', 'DELIVERY'] : ['PICKUP'];
  assert.deepEqual(supportedFulfillmentMethods(configured), expected);
  assert.deepEqual(frontend.getFulfillmentMethods({ fulfillmentMethods: configured }), expected);
  assert.equal(supportsFulfillmentMethod(configured, 'PICKUP'), true);
  assert.equal(supportsFulfillmentMethod(configured, 'DELIVERY'), expected.includes('DELIVERY'));
}
assert.equal(frontend.fulfillmentLabel(undefined), 'Not specified');
// Execute the real per-provider cart selection and warning calculations.
const start = source.indexOf('  const selectedProviderIds =');
const end = source.indexOf('  const cartTotal =', start);
const cartJs = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const resolve = new Function('selected', 'fulfillmentSelections', 'defaultFulfillmentMethods', `${cartJs}; return { hasPickupOnlyOrder, selectedMethodForProvider };`);
for (const configured of [['PICKUP'], ['PICKUP', 'DELIVERY'], ['PICKUP'], undefined]) {
  const methods = frontend.getFulfillmentMethods({ fulfillmentMethods: configured });
  const result = resolve([{ providerId: 1, fulfillmentMethods: methods, fulfillmentLoaded: true }], { 1: 'DELIVERY' }, ['PICKUP']);
  assert.equal(result.hasPickupOnlyOrder, !methods.includes('DELIVERY'));
  assert.equal(result.selectedMethodForProvider(1), methods.includes('DELIVERY') ? 'DELIVERY' : 'PICKUP');
}
const mixed = resolve([
  { providerId: 1, fulfillmentMethods: ['PICKUP'], fulfillmentLoaded: true },
  { providerId: 2, fulfillmentMethods: ['PICKUP', 'DELIVERY'], fulfillmentLoaded: true },
], { 2: 'DELIVERY' }, ['PICKUP']);
assert.equal(mixed.hasPickupOnlyOrder, true);
assert.equal(mixed.selectedMethodForProvider(1), 'PICKUP');
assert.equal(mixed.selectedMethodForProvider(2), 'DELIVERY');
console.log('PASS: frontend/backend rules, A-D checkout decisions, mixed providers, historical display');
