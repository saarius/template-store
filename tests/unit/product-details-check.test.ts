import { spawnSync } from 'node:child_process';
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

  it('refuses paths outside a source checklist and incomplete non-product manuscripts', async () => {
    for (const source of ['../../etc/private.json', '/etc/private.json', 'https://example.test/source.json']) {
      await expect(verifyProductDetails(source)).rejects.toThrow('Choose a product-details checklist in seed/.');
    }
    await expect(verifyProductDetails('backroadbum-pages.json')).rejects.toThrow('Product-details checklist is incomplete.');
  });
});
