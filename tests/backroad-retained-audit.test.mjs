import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { retainedAuditSnapshot } from '../scripts/lib/retained-receipt-proof.mjs';

const merchant = fileURLToPath(new URL('../', import.meta.url));
const fonts = ['/backroad/fonts/dm-sans-latin.woff2', '/backroad/fonts/fraunces-latin.woff2'];
const art = '/_emdash/api/media/file/receipt-fixture.svg';
const body = `<style>.a{src:url('${fonts[0]}')}.b{src:url('${fonts[1]}')}</style><img src="${art}" alt="Illustrative cap fixture">`;

test('paid static audit embeds the fixture art and both merchant fonts without scripts or a live origin', () => {
  const snapshot = retainedAuditSnapshot(`<script>console.log('must disappear');</script>${body}`, merchant);
  assert.doesNotMatch(snapshot, /must disappear|<script|127\.0\.0\.1|\/_emdash\/api|\/backroad\/fonts/);
  for (const font of fonts) {
    assert.ok(snapshot.includes(`data:font/woff2;base64,${readFileSync(`${merchant}public${font}`).toString('base64')}`));
  }
  const actual = readFileSync(`${merchant}public/backroad/cap.svg`).toString('base64');
  assert.ok(snapshot.includes(`src="data:image/svg+xml;base64,${actual}" alt="Illustrative cap fixture"`));
});

test('the static audit fails if the fixture art is missing rather than silently auditing a broken asset', () => {
  assert.throws(() => retainedAuditSnapshot(body.replace(art, '/gone.svg'), merchant), /Expected authored asset/);
});
