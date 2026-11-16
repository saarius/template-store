import assert from 'node:assert/strict';
import { test } from 'node:test';
import { options, retainedCapability, readOnlyCollection } from '../scripts/qualify-backroadbum-retained-storage.mjs';

const state = (origin = 'https://backroadbum.com', kept = { capabilityId: 'fixture', capability: 'fixture.not-real', attemptId: 'fixture-attempt' }) => ({
  origins: [{ origin, localStorage: [{ name: 'dinkus.guest-checkout.v1', value: JSON.stringify(kept) }] }],
});
test('is opt-in and accepts only one source path', () => {
  assert.equal(options([]), null);
  assert.ok(options(['--check', '--candidate=/source']).candidate.endsWith('/source'));
  for (const args of [
    ['--candidate=/source'], ['--check', '--candidate='], ['--check', '--database=/private'],
    ['--check', '--candidate=/source', '--url=https://elsewhere.test'], ['--check', '--check'],
  ]) assert.throws(() => options(args));
});
test('reads only the original canonical retained authority', () => {
  assert.equal(retainedCapability(state()).capability, 'fixture.not-real');
  assert.throws(() => retainedCapability(state('https://foreign.example.test')));
  assert.throws(() => retainedCapability({ origins: [...state().origins, ...state().origins] }));
});
test('rejects absent, ambiguous and malformed checkout storage', () => {
  assert.throws(() => retainedCapability({ origins: [] }));
  const duplicate = state();
  duplicate.origins[0].localStorage.push(duplicate.origins[0].localStorage[0]);
  assert.throws(() => retainedCapability(duplicate));
  assert.throws(() => retainedCapability(state(undefined, { capabilityId: 'different', capability: 'fixture.not-real', attemptId: 'a' })));
  assert.throws(() => retainedCapability(state(undefined, { capabilityId: 'fixture', capability: 'fixture.not-real' })));
});
test('allowlisted repository reads preserve method receiver', async () => {
  const counters = { writes: 0 };
  const repository = { data: 'fixture', get() { return this.data; }, getVersioned() { return { value: this.data, revision: '1' }; }, query() { return []; }, getMany() { return []; } };
  const read = readOnlyCollection(repository, counters);
  assert.equal(await read.get('x'), 'fixture');
  assert.equal((await read.getVersioned('x')).revision, '1');
  assert.deepEqual(await read.query(), []);
  assert.deepEqual(await read.getMany(['x']), []);
  assert.equal(counters.writes, 0);
});
test('all write methods and unknown methods are trapped before reaching storage', () => {
  let reached = false;
  const counters = { writes: 0 };
  const read = readOnlyCollection({ put() { reached = true; } }, counters);
  for (const name of ['put', 'delete', 'compareAndSet', 'compareAndDelete', 'futureMutation']) {
    assert.throws(() => read[name]('fixture'), /Read-only/);
  }
  assert.equal(reached, false);
  assert.equal(counters.writes, 5);
});
