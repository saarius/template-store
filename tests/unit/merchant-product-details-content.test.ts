import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const source = JSON.parse(readFileSync(new URL('../../seed/backroadbum-tote-details.json', import.meta.url), 'utf8'));
const script = fileURLToPath(new URL('../../scripts/verify-backroadbum-product-details.mjs', import.meta.url));

describe('merchant tote authorship checklist', () => {
  it('retains the original design facts without becoming commerce authority', () => {
    expect(source.slug).toBe('glovebox-field-tote');
    expect(source.rows).toEqual([
      { label: 'Material', value: 'Unbleached canvas' },
      { label: 'Body dimensions', value: '16 × 15 inches' },
      { label: 'Opening', value: 'Open top' },
      { label: 'Carry', value: 'Two handles' },
    ]);
    expect(JSON.stringify(source)).not.toMatch(/"(?:price|regular|sale|stock|availability|weight|catalogItemId)"/);
  });

  it('separates useful packing and care advice from untested sample claims', () => {
    expect(source.care).toHaveLength(3);
    expect(source.care.join(' ')).toContain('allow it to dry fully');
    expect(source.care.join(' ')).toContain('not a measured sample');
    expect(source.care.join(' ')).toContain('No carrying-load rating has been tested');
    expect(source.care.join(' ')).toContain('not waterproof');
    expect(source.rows.every((row: { label: string; value: string }) => row.label && row.value)).toBe(true);
    expect(new Set(source.rows.map((row: { label: string }) => row.label)).size).toBe(source.rows.length);
  });

  it('keeps the reusable read-only verifier inert without explicit opt-in', () => {
    expect(execFileSync(process.execPath, [script], { encoding: 'utf8' })).toMatch(/^No action\./);
    expect(execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../../scripts/verify-backroadbum-product-details.mjs', import.meta.url).href)})`], { encoding: 'utf8' })).toBe('');
    expect(spawnSync(process.execPath, [script, '--publish'], { encoding: 'utf8' }).status).toBe(1);
  });
});
