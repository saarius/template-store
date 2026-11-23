import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fieldNote, fieldNotes, journalFieldNotes, latestFieldNote, nextFieldNotes } from '../../src/features/store-shell/field-notes.js';

const intro = (text: string) => ({ _type: 'block', style: 'normal', children: [{ _type: 'span', text }] });
describe('EmDash field-note navigation', () => {
  it('names each whole-row link from its published heading without hiding its excerpt', () => {
    const source = readFileSync('src/pages/field-notes.astro', 'utf8');
    expect(source).toContain('aria-labelledby="field-feature-title"');
    expect(source).toContain('<h2 id="field-feature-title">{journal.latest.title}</h2>');
    expect(source).toContain('aria-labelledby={`${note.slug}-title`}');
    expect(source).toContain('<h3 id={`${note.slug}-title`}>{note.title}</h3>');
    expect(source).toContain('{note.excerpt && <p class="field-excerpt">{note.excerpt}</p>}');
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
  it('teases the most recently published native note without ranking by edit time or slug', () => {
    const older = { id: 'field-note-a', data: { title: 'Older', status: 'published', publishedAt: new Date('2026-11-15'), updatedAt: new Date('2026-11-24') } };
    const latest = { id: 'field-note-z', data: { title: 'Newer', status: 'published', publishedAt: '2026-11-23T17:25:07Z', content: [intro('Start here.')] } };
    const excluded = [
      { id: 'test-store', data: { ...latest.data, publishedAt: '2026-11-24' } },
      { id: 'field-note-draft', data: { ...latest.data, status: 'draft', publishedAt: '2026-11-24' } },
      { id: 'field-note-no-date', data: { ...latest.data, publishedAt: null } },
      { id: 'field-note-invalid', data: { ...latest.data, publishedAt: new Date(NaN) } },
      { id: 'field-note-composed', data: { ...latest.data, publishedAt: '2026-11-24', layout: [{}] } },
    ];
    expect(latestFieldNote([older, latest, ...excluded])).toEqual({ slug: latest.id, title: 'Newer', excerpt: 'Start here.' });
    expect(latestFieldNote(excluded)).toBeNull();
  });
  it('shares the home lead without duplicating it or disturbing the archive order', () => {
    const old = { id: 'field-note-c', data: { title: 'Older', status: 'published', publishedAt: '2026-11-15', updatedAt: '2026-11-24' } };
    const undated = { id: 'field-note-a', data: { title: 'Undated', status: 'published' } };
    const latest = { id: 'field-note-z', data: { title: 'Latest', status: 'published', publishedAt: '2026-11-23' } };
    const draft = { id: 'field-note-draft', data: { ...latest.data, status: 'draft', publishedAt: '2026-11-24' } };
    const entries = [old, undated, latest, draft];
    expect(journalFieldNotes(entries)).toEqual({ latest: latestFieldNote(entries), archive: [fieldNote(undated), fieldNote(old)] });
    expect(journalFieldNotes([undated, draft])).toEqual({ latest: null, archive: [fieldNote(undated)] });
    expect(journalFieldNotes([latest, draft])).toEqual({ latest: fieldNote(latest), archive: [] });
    expect(journalFieldNotes([draft])).toEqual({ latest: null, archive: [] });
  });
  it('breaks publication ties by slug and bounds the shared latest-note excerpt', () => {
    const prose = 'field notebook '.repeat(18).trim();
    const data = { title: 'A note', status: 'published', publishedAt: '2026-11-23', content: [intro(prose)] };
    const entries = [{ id: 'field-note-b', data }, { id: 'field-note-a', data }];
    const before = structuredClone(entries);
    expect(latestFieldNote(entries)).toMatchObject({ slug: 'field-note-a', excerpt: `${'field notebook '.repeat(12).trim()}…` });
    expect(fieldNotes(entries)[0].excerpt).toBe(prose);
    expect(entries).toEqual(before);
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
