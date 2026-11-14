import { spawnSync } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { verifyProductDetails } from '../../scripts/verify-backroadbum-product-details.mjs';

const command = 'scripts/verify-backroadbum-product-details.mjs';
describe('read-only native product-details verifier', () => {
  it('requires an explicit check before launching a browser', () => {
    const result = spawnSync(process.execPath, [command], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No action. --check');
    expect(result.stderr).toBe('');
  });

  it('rejects other actions instead of falling through to a check', () => {
    const result = spawnSync(process.execPath, [command, '--publish'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Only --check');
  });

  it('rejects a string care state before launching a browser', async () => {
    const source = JSON.parse(await readFile(new URL('../../seed/backroadbum-field-book.json', import.meta.url), 'utf8'));
    const fixture = new URL('../../seed/backroadbum-invalid-care-state.json', import.meta.url);
    await writeFile(fixture, JSON.stringify({ ...source, careOpenByDefault: 'false' }), { flag: 'wx' });
    try {
      await expect(verifyProductDetails('backroadbum-invalid-care-state.json')).rejects.toThrow('Product-details checklist is incomplete.');
    } finally {
      await rm(fixture);
    }
  });

  it('refuses paths outside a source checklist and incomplete non-product manuscripts', async () => {
    for (const source of ['../../etc/private.json', '/etc/private.json', 'https://example.test/source.json']) {
      await expect(verifyProductDetails(source)).rejects.toThrow('Choose a product-details checklist in seed/.');
    }
    await expect(verifyProductDetails('backroadbum-pages.json')).rejects.toThrow('Product-details checklist is incomplete.');
  });
});
