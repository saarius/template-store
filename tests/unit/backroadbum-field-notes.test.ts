import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fieldNote, fieldNotes, nextFieldNotes } from '../../src/features/store-shell/field-notes.js';

const intro = (text: string) => ({ _type: 'block', style: 'normal', children: [{ _type: 'span', text }] });
describe('EmDash field-note navigation', () => {
  it('names each whole-row link from its published heading without hiding its excerpt', () => {
    const source = readFileSync('src/pages/field-notes.astro', 'utf8');
    expect(source).toContain('aria-labelledby={`${note.slug}-title`}');
    expect(source).toContain('<h2 id={`${note.slug}-title`}>{note.title}</h2>');
    expect(source).toContain('{note.excerpt && <p>{note.excerpt}</p>}');
    // Only the decorative ordinal is hidden, never the published title or excerpt.
    expect(source.match(/aria-hidden=/g)).toHaveLength(1);
    expect(source).toContain('class="field-number" aria-hidden="true"');
    expect(source).not.toContain('tabindex');
  });
  it('uses published CMS titles and prose, without seed text or commerce facts', () => {
    expect(fieldNote({ id: 'field-note-new-story', data: {
      title: '  A merchant-edited title  ', content: [
        { _type: 'block', style: 'h2', children: [{ _type: 'span', text: 'Not the intro' }] },
        { _type: 'block', style: 'normal', children: [
          { _type: 'span', text: 'First ' }, { _type: 'span', text: 'paragraph.' },
          { _type: 'inline-image', text: 'Not prose' }, null,
        ] },
      ],
    } })).toEqual({ slug: 'field-note-new-story', title: 'A merchant-edited title', excerpt: 'First paragraph.' });
  });
  it('excludes ordinary policies, malformed slugs and untitled entries', () => {
    for (const id of ['shipping', 'field-note-', 'field-note-../secret', 'field-note-%2fsecret', 'field-note-foo?bar', 'field-note-Foo']) {
      expect(fieldNote({ id, data: { title: 'Title', content: [intro('Body')] } })).toBeNull();
    }
    expect(fieldNote(null)).toBeNull();
    expect(fieldNote({ id: 'field-note-empty', data: { title: ' ' } })).toBeNull();
  });
  it('keeps notes addressable when optional prose is absent or malformed', () => {
    for (const content of [undefined, null, {}, [], [null], [{ _type: 'image' }], [{ _type: 'block', children: 'not spans' }]]) {
      expect(fieldNote({ id: 'field-note-no-intro', data: { title: 'Title', content } })?.excerpt).toBe('');
    }
  });
  it('continues through every published note and wraps without repeating the current one', () => {
    const entries = ['g', 'e', 'c', 'a', 'f', 'd', 'b'].map(letter => ({
      id: `field-note-${letter}`, data: { title: `Native title ${letter}` },
    }));
    const before = structuredClone(entries);
    const ordered = fieldNotes(entries);
    for (const [index, note] of ordered.entries()) {
      expect(nextFieldNotes(entries, note.slug)).toEqual([
        ordered[(index + 1) % ordered.length], ordered[(index + 2) % ordered.length],
      ]);
    }
    let slug = ordered[0].slug;
    const visited = new Set<string>();
    for (let i = 0; i < ordered.length; i++) {
      visited.add(slug);
      slug = nextFieldNotes(entries, slug)[0].slug;
    }
    expect([...visited]).toEqual(ordered.map(note => note.slug));
    expect(slug).toBe(ordered[0].slug);
    expect(entries).toEqual(before);
  });
  it('handles empty, one-note, two-note and absent-current collections without inventing links', () => {
    const a = { id: 'field-note-a', data: { title: 'A' } };
    const b = { id: 'field-note-b', data: { title: 'B' } };
    const ignored = { id: 'shipping', data: { title: 'Not a note' } };
    expect(nextFieldNotes([], a.id)).toEqual([]);
    expect(nextFieldNotes([a, ignored], a.id)).toEqual([]);
    expect(nextFieldNotes([b, a], a.id)).toEqual([fieldNote(b)]);
    expect(nextFieldNotes([b, a], b.id)).toEqual([fieldNote(a)]);
    expect(nextFieldNotes([b, ignored, a], 'field-note-preview')).toEqual(fieldNotes([a, b]));
  });
  it('orders notes consistently without mutating CMS entries', () => {
    const entries = [
      { id: 'field-note-z', data: { title: 'Z', content: [intro('Last')] } },
      { id: 'returns', data: { title: 'Returns' } },
      { id: 'field-note-a', data: { title: 'A', content: [intro('First')] } },
    ];
    const before = structuredClone(entries);
    expect(fieldNotes(entries).map(note => note.slug)).toEqual(['field-note-a', 'field-note-z']);
    expect(entries).toEqual(before);
  });
});
