import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Dialog from '@radix-ui/react-dialog';
import ts from 'typescript';
const source = readFileSync(new URL('../src/components/provider-reviews.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source.slice(source.indexOf('export function ProviderReviews')).replace('export function', 'function'), {
  fileName: 'reviews.tsx', compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
test('actual View Reviews control renders for visitors and zero reviews without auth or eligibility dependencies', () => {
  const deps = { React, Dialog, useState: value => [value, () => {}], useQuery: options => {
    assert.equal(options.enabled, false);
    return { data: { averageRating: 0, reviewCount: 0, reviews: [] }, isLoading: false, isError: false };
  }, apiRequest() {}, Star: props => React.createElement('svg', props), X: props => React.createElement('svg', props) };
  const Reviews = new Function(...Object.keys(deps), `${code};return ProviderReviews;`)(...Object.values(deps));
  const html = renderToStaticMarkup(React.createElement(Reviews, { providerId: 10, providerName: 'Shop' }));
  assert.match(html, /View Reviews/); assert.match(html, /type="button"/); assert.doesNotMatch(html, /disabled|Sign in/);
});
