import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const source: { tableHeading: string; rows: { label: string; value: string }[]; care: string; careHeading: string;
  pictures: { filename: string; alt: string; caption: string; viewBox: string }[] } =
  JSON.parse(readFileSync(new URL('../../seed/backroadbum-mug-details.json', import.meta.url), 'utf8'));
const script = fileURLToPath(new URL('../../scripts/verify-backroadbum-mug.mjs', import.meta.url));

describe('merchant mug content', () => {
  it('keeps specifications explicitly illustrative and separate from commerce authority', () => {
    expect(source.tableHeading).toBe('Illustrated demo design');
    expect(source.rows).toEqual([
      { label: 'Capacity', value: '12 fl oz' }, { label: 'Body', value: 'Enamel-coated steel' }, { label: 'Finish', value: 'Blue rim' },
    ]);
    expect(JSON.stringify(source)).not.toMatch(/"(?:price|regular|sale|stock|availability|weight|catalogItemId)"/);
  });
  it('retains the original care and hot-handle/microwave cautions', () => {
    expect(source.care).toBe('Hand wash and dry after use. Not for the microwave; hot drinks can heat the handle.');
    expect(source.careHeading).toBe('Care at camp');
  });
  it('gives two distinct pictures bounded 4:3 crops and explicit illustration provenance', () => {
    expect(source.pictures).toHaveLength(2);
    expect(new Set(source.pictures.map(picture => picture.filename)).size).toBe(2);
    expect(new Set(source.pictures.map(picture => picture.alt)).size).toBe(2);
    for (const picture of source.pictures) {
      expect(picture.filename).toMatch(/^creekside-mug-[a-z-]+\.png$/);
      const [x, y, width, height] = picture.viewBox.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(640); expect(y + height).toBeLessThanOrEqual(480);
      expect(width / height).toBeCloseTo(4 / 3);
      expect(picture.alt).toContain('illustrated detail');
      expect(picture.caption).toContain('not product photography or a tested sample');
    }
  });
  it('has no check on import or without explicit opt-in; refuses mutation-like arguments', () => {
    expect(execFileSync(process.execPath, [script], { encoding: 'utf8' })).toMatch(/^No action\./);
    expect(execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../../scripts/verify-backroadbum-mug.mjs', import.meta.url).href)})`], { encoding: 'utf8' })).toBe('');
    expect(spawnSync(process.execPath, [script, '--publish'], { encoding: 'utf8' }).status).toBe(1);
  });
});
