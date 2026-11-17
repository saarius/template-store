import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fieldNotes } from '../../src/features/store-shell/field-notes.js';
import { collectionFieldNotes } from '../../src/features/store-shell/collection-field-notes.js';

const source = JSON.parse(readFileSync('seed/backroadbum-shade-note.json', 'utf8'));
const blocks = source.sections.map((b: { style: string; text: string; link?: { text: string; href: string }; after?: string; listItem?: string }, i: number) => ({
  _type: 'block', _key: `b-${i}`, style: b.style, ...(b.listItem ? { listItem: b.listItem, level: 1 } : {}),
  markDefs: b.link ? [{ _type: 'link', _key: `l-${i}`, href: b.link.href }] : [],
  children: [{ _type: 'span', text: b.text, marks: [] }, ...(b.link ? [
    { _type: 'span', text: b.link.text, marks: [`l-${i}`] }, { _type: 'span', text: b.after, marks: [] },
  ] : [])],
}));
const page = { id: source.slug, data: { title: source.title, content: blocks } };

describe('Shade note authorship checklist (not runtime content)', () => {
  it('projects native title and opening copy, with four chapters and three actual list items', () => {
    expect(fieldNotes([page])).toEqual([{ slug: source.slug, title: source.title, excerpt: source.sections[0].text }]);
    expect(blocks).toHaveLength(16);
    expect(blocks.filter((b: { style: string }) => b.style === 'h2')).toHaveLength(4);
    expect(blocks.filter((b: { listItem?: string }) => b.listItem === 'number')).toHaveLength(3);
  });
  it('keeps parking and protection boundaries explicit rather than inventing cap performance', () => {
    const text = JSON.stringify(source);
    for (const phrase of ['where parking and stopping are permitted', 'Do not cross a live road',
      'Shade and an open window do not make a parked vehicle safe', 'no tested UPF claim',
      'not a measured size range', 'while you are parked, not while driving']) expect(text).toContain(phrase);
    expect(text).not.toMatch(/\$\d|UPF\s*\d|blocks \d+%|tested protection|customer review/i);
  });
  it('discovers cap reading through a used native link only', () => {
    expect(collectionFieldNotes([page], new Set([source.productPath]))).toHaveLength(1);
    expect(collectionFieldNotes([page], new Set(['/products/last-light-fleece']))).toEqual([]);
    expect(blocks.flatMap((b: { markDefs: { href: string }[] }) => b.markDefs.map(m => m.href))).toEqual([
      '/products/long-way-cap', '/field-note-the-two-minute-departure',
    ]);
  });
});
