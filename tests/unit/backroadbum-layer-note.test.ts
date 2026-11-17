import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fieldNotes } from '../../src/features/store-shell/field-notes.js';
import { collectionFieldNotes } from '../../src/features/store-shell/collection-field-notes.js';

const source = JSON.parse(readFileSync('seed/backroadbum-layer-note.json', 'utf8'));
const blocks = source.sections.map((b: { style: string; text: string; link?: { text: string; href: string }; after?: string; listItem?: string }, i: number) => ({
  _type: 'block', _key: `b-${i}`, style: b.style, ...(b.listItem ? { listItem: b.listItem, level: 1 } : {}),
  markDefs: b.link ? [{ _type: 'link', _key: `l-${i}`, href: b.link.href }] : [],
  children: [{ _type: 'span', text: b.text, marks: [] }, ...(b.link ? [
    { _type: 'span', text: b.link.text, marks: [`l-${i}`] }, { _type: 'span', text: b.after, marks: [] },
  ] : [])],
}));
const page = { id: source.slug, data: { title: source.title, content: blocks } };

describe('Layer field-note authorship checklist (not runtime content)', () => {
  it('projects native title and opening paragraph into the published journal', () => {
    expect(fieldNotes([page])).toEqual([{ slug: source.slug, title: source.title, excerpt: source.sections[0].text }]);
  });
  it('has four chapters and a three-step parking-only packing routine', () => {
    expect(blocks.filter((b: { style: string }) => b.style === 'h2')).toHaveLength(4);
    expect(blocks.filter((b: { listItem?: string }) => b.listItem === 'number')).toHaveLength(3);
    expect(JSON.stringify(source)).toContain('not while the vehicle is moving');
    expect(JSON.stringify(source)).toContain('away from pedals, seat belts and airbags');
  });
  it('distinguishes illustrative comfort clothing from technical protection', () => {
    const text = JSON.stringify(source);
    expect(text).toContain('not a waterproof shell or technical weather protection');
    expect(text).toContain('not a manufactured sample');
    expect(text).toContain('follow each garment\'s care label');
    expect(text).not.toMatch(/\$\d|guarantee|tested warmth|UPF/);
  });
  it('uses a real native product link for reading, not a separate recommendation map', () => {
    expect(collectionFieldNotes([page], new Set([source.productPath]))).toHaveLength(1);
    expect(collectionFieldNotes([page], new Set(['/products/wrong-turn-tee']))).toEqual([]);
    expect(blocks.flatMap((b: { markDefs: { href: string }[] }) => b.markDefs.map(m => m.href))).toEqual([
      '/products/last-light-fleece', '/field-note-wet-gear-reset',
    ]);
  });
});
