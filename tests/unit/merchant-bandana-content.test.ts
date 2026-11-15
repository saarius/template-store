import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = JSON.parse(readFileSync(new URL('../../seed/backroadbum-bandana-details.json', import.meta.url), 'utf8'));

describe('merchant bandana authorship checklist', () => {
  it('separates the existing material, size and artwork without owning commerce facts', () => {
    expect(source.slug).toBe('switchback-bandana');
    expect(source.rows).toEqual([
      { label: 'Material', value: 'Cotton' },
      { label: 'Design size', value: '22 × 22 inches' },
      { label: 'Artwork', value: 'Cream contour lines on blue' },
      { label: 'Corner detail', value: 'Yellow BRB corner' },
    ]);
    expect(JSON.stringify(source)).not.toMatch(/"(?:price|regular|sale|stock|availability|weight|catalogItemId)"/);
    expect(new Set(source.rows.map((row: { label: string }) => row.label)).size).toBe(4);
  });

  it('retains cool-wash care and the decorative pattern boundary without physical-sample claims', () => {
    expect(source.careHeading).toBe('Using & caring for it');
    expect(source.care).toHaveLength(3);
    expect(source.care.join(' ')).toContain('Wash cool with similar colors and air dry');
    expect(source.care.join(' ')).toContain('not a measured sample');
    expect(source.care.join(' ')).toContain('decorative, not a map');
    expect(source.care.join(' ')).toContain('No protective performance rating is claimed');
    expect(source.care.join(' ')).toContain('rather than wiping muddy gear with the same cloth');
  });
});
