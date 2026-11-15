import { describe, expect, it, vi } from 'vitest';
import { collectionFieldNotes, loadCollectionFieldNotes } from '../../src/features/store-shell/collection-field-notes.js';

const paths = new Set(['/products/field-book', '/products/field-tote']);
const block = (href: string) => ({ _type: 'block', style: 'normal', children: [
  { _type: 'span', text: 'A useful read.' }, { _type: 'span', text: 'The gear', marks: ['gear'] },
], markDefs: [{ _type: 'link', _key: 'gear', href }] });
const page = (slug = 'field-note-a', content: unknown = [block('/products/field-book')]) => ({ id: slug, data: { title: 'A published title', content } });

describe('Collection reading from native published links', () => {
  it('keeps CMS title/prose, uses current product paths and does not mutate inputs', () => {
    const entries = [page()];
    const before = structuredClone(entries);
    expect(collectionFieldNotes(entries, paths)).toEqual([{ slug: 'field-note-a', title: 'A published title', excerpt: 'A useful read.The gear' }]);
    expect(collectionFieldNotes(entries, new Set(['/products/camp-mug']))).toEqual([]);
    expect(entries).toEqual(before);
  });
  it('excludes unused definitions, empty or non-span links and wrong mark keys', () => {
    for (const children of [[], [{ _type: 'span', text: 'No link' }], [{ _type: 'span', text: ' ', marks: ['gear'] }],
      [{ _type: 'image', text: 'Not a span', marks: ['gear'] }], [{ _type: 'span', text: 'Gear', marks: ['other'] }], [null]]) {
      expect(collectionFieldNotes([page('field-note-a', [{ ...block('/products/field-book'), children }])], paths)).toEqual([]);
    }
  });
  it('never guesses from product names, external links, paths with queries, fragments or unsafe slugs', () => {
    for (const href of ['https://other.example/products/field-book', '//other.example/products/field-book',
      '/products/field-book?x=1', '/products/field-book#details', '/products/../field-book', '/products/%66ield-book',
      '/products/field-book/', '/products/Field-book', 'javascript:alert(1)']) {
      expect(collectionFieldNotes([page('field-note-a', [block(href)])], paths)).toEqual([]);
    }
    expect(collectionFieldNotes([page('field-note-a', [{ _type: 'block', children: [{ _type: 'span', text: 'field-book' }] }])], paths)).toEqual([]);
  });
  it('accepts only field notes with titles and ignores malformed optional content', () => {
    for (const content of [undefined, null, {}, [null], [{ _type: 'block', children: [] }], [{ ...block('/products/field-book'), markDefs: [null] }]]) {
      expect(collectionFieldNotes([{ id: 'field-note-a', data: { title: 'A title', content } }], paths)).toEqual([]);
    }
    expect(collectionFieldNotes([page('shipping'), page('field-note-../private'), { ...page(), data: { title: ' ', content: [block('/products/field-book')] } }], paths)).toEqual([]);
  });
  it('returns at most two unique notes in stable slug order and bounds preview prose', () => {
    const entry = page('field-note-a', [{ ...block('/products/field-book'), children: [{ _type: 'span', text: 'A long opening paragraph. '.repeat(20), marks: ['gear'] }] }, block('/products/field-tote')]);
    const notes = collectionFieldNotes([page('field-note-z'), page('field-note-b'), entry], paths);
    expect(notes.map(note => note.slug)).toEqual(['field-note-a', 'field-note-b']);
    expect(notes[0].excerpt.length).toBeLessThanOrEqual(221);
    expect(notes[0].excerpt).toMatch(/…$/);
  });
  it('omits optional reading on CMS failure, preview/edit contexts and empty collections', async () => {
    const read = vi.fn(async () => [page()]);
    expect(await loadCollectionFieldNotes(paths, true, read)).toEqual([]);
    expect(await loadCollectionFieldNotes(new Set(), false, read)).toEqual([]);
    expect(read).not.toHaveBeenCalled();
    expect(await loadCollectionFieldNotes(paths, false, read)).toHaveLength(1);
    expect(await loadCollectionFieldNotes(paths, false, async () => { throw new Error('unavailable'); })).toEqual([]);
  });
});
