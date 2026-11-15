import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { explicitAnyCount } from '../../scripts/source-type-audit.mjs';
import { textFailures } from '../../scripts/worktree-text-audit.mjs';

test('type audit permits ordinary prose, comments, strings and property names', () => {
  assert.equal(explicitAnyCount(`---
// Commerce owns any charge.
const label = 'any';
const options: { any: string } = { any: 'any' };
---
<p title="any">Use any three-digit CVC.</p>
<script>const message = "any"; /* any */</script>`, 'fixture.astro'), 0);
  assert.equal(explicitAnyCount(`// any\nconst any = 'any'; const x: { any: string } = { any };`, 'fixture.ts'), 0);
  assert.equal(explicitAnyCount('const label = "any";', 'fixture.mjs'), 0);
});

test('type audit rejects nested explicit types in every Astro code surface', () => {
  for (const source of [
    '---\ninterface Props { status: any }\n---\n<p>Hello</p>',
    '<p>{items.map((item: any) => item)}</p>',
    '<script>const x: Array<any> = [];</script>',
    '<button data-value={null as any}>Test</button>',
  ]) assert.equal(explicitAnyCount(source, 'fixture.astro'), 1);
  assert.equal(explicitAnyCount('type X = Promise<any[]>; const y = null as any;', 'fixture.ts'), 2);
});

test('invalid syntax fails closed rather than silently passing the audit', () => {
  assert.throws(() => explicitAnyCount('---\nconst x: = ;\n---', 'bad.astro'), /invalid Astro/);
  assert.throws(() => explicitAnyCount('const x: = ;', 'bad.ts'), /invalid TypeScript/);
});

test('word-boundary false positives are qualified against unchanged merchant prose', () => {
  for (const file of ['src/features/guest-cart/GuestCheckout.astro', 'src/pages/shipping.astro']) {
    assert.equal(explicitAnyCount(readFileSync(file, 'utf8'), file), 0);
  }
});

test('text audit exempts only the exact two preserved third-party license copies', () => {
  for (const file of ['public/backroad/fonts/Fraunces-OFL.txt', 'public/backroad/fonts/OFL.txt']) {
    const bytes = readFileSync(file);
    assert.deepEqual(textFailures(file, bytes), []);
    assert.ok(textFailures(file, Buffer.concat([bytes, Buffer.from('changed \n')])).length > 0);
    assert.ok(textFailures('different-OFL.txt', bytes).length > 0);
  }
  assert.deepEqual(textFailures('ordinary.ts', Buffer.from('ok\n')), []);
  assert.deepEqual(textFailures('ordinary.ts', Buffer.from('bad \n')), ['ordinary.ts:1: trailing whitespace']);
  assert.deepEqual(textFailures('ordinary.ts', Buffer.from('ok\n\n')), ['ordinary.ts: blank line at end of file']);
  assert.deepEqual(textFailures('image.bin', Buffer.from([0, 32, 10])), []);
});
