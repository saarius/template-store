import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fieldNote, fieldNotes } from '../../src/features/store-shell/field-notes.js';

const intro = (text: string) => ({ _type: 'block', style: 'normal', children: [{ _type: 'span', text }] });
describe('EmDash field-note navigation', () => {
  it('names each whole-row link from its published heading without hiding its excerpt', () => {
    const source = readFileSync('src/pages/field-notes.astro', 'utf8');
    expect(source).toContain('aria-labelledby={`${note.slug}-title`}><h2 id={`${note.slug}-title`}>{note.title}</h2>');
    expect(source).toContain('{note.excerpt && <p>{note.excerpt}</p>}');
    expect(source).not.toContain('aria-hidden');
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
