import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const deleteService = useMutation(');
const end = source.indexOf('  const updateService = useMutation(', start);
const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(response) {
  let profile = { id: 10, services: [{ id: 1 }, { id: 2 }] }, cached = structuredClone(profile), notice = '';
  const deps = { useMutation: config => config, adminRequest: async () => response, draft: profile,
    setDraft: update => { profile = update(profile); }, setRemoveServiceTarget() {}, setNotice: value => { notice = value; },
    queryClient: { async cancelQueries() {}, setQueryData(key, update) { cached = update(cached); }, invalidateQueries() {} },
    getListProvidersQueryKey: () => [], getGetProviderQueryKey: () => [] };
  const mutation = new Function(...Object.keys(deps), `${code};return deleteService;`)(...Object.values(deps));
  return { mutation, get profile() { return profile; }, get cached() { return cached; }, get notice() { return notice; } };
}
test('frontend rejects missing/mismatched removal acknowledgement without hiding service or reporting success', async () => {
  for (const response of [undefined, {}, { removed: false, serviceId: 1 }, { removed: true, serviceId: 2 }]) {
    const f = fixture(response); await assert.rejects(f.mutation.mutationFn(1));
    assert.equal(f.profile.services.length, 2); assert.equal(f.notice, '');
  }
});
test('verified removal updates draft and profile cache immediately and shows the exact success message', async () => {
  const f = fixture({ removed: true, serviceId: 1 });
  await f.mutation.onMutate();
  f.mutation.onSuccess(await f.mutation.mutationFn(1));
  assert.deepEqual(f.profile.services.map(s => s.id), [2]); assert.deepEqual(f.cached.services.map(s => s.id), [2]);
  assert.equal(f.notice, 'Service removed successfully.');
});
