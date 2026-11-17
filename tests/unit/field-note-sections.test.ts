import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fieldNoteSections } from '../../src/features/store-shell/field-note-sections.js';
import type { PortableTextBlock } from 'emdash';

const heading = (text: string, extra = {}): PortableTextBlock => ({
  _type: 'block', _key: 'same-key', style: 'h2', children: [{ _type: 'span', text }], ...extra,
});
describe('Native Field Note sections', () => {
  it('leaves preview and native inline-editor arrays with the original renderer', () => {
    const source = readFileSync('src/pages/[slug].astro', 'utf8');
    expect(source).toContain('note && !context?.preview && !context?.editMode && !getEditMeta(content)');
    expect(source).toContain('const textComponents = reading ?');
    expect(source).toContain('value={reading?.content ?? content}');
    const component = readFileSync('src/features/store-shell/FieldNoteSections.astro', 'utf8');
    expect(component).toContain('sections.length > 1');
    expect(component).toContain('@media print{.field-note-sections{display:none}}');
  });
  it('uses actual heading spans, keeps marks/alignment, and never mutates CMS input', () => {
    const blocks = [heading('Plan ', { textAlign: 'center', children: [
      { _type: 'span', text: 'Plan ', marks: ['strong'] },
      { _type: 'span', text: 'the stop', marks: ['native-link'] },
      { _type: 'image', text: 'not text' }, null,
    ], markDefs: [{ _key: 'native-link', _type: 'link', href: '/shipping' }] })];
    const before = structuredClone(blocks);
    const result = fieldNoteSections(blocks);
    expect(result.sections).toEqual([{ id: 'note-section-1', title: 'Plan the stop' }]);
    expect(result.content[0]).toEqual({ ...blocks[0], backroadSectionId: 'note-section-1' });
    expect(blocks).toEqual(before);
  });
  it('keeps repeated titles/keys and non-ASCII headings separately addressable', () => {
    const { sections } = fieldNoteSections([heading('同じ場所'), heading('同じ場所'), heading('<script> & “camp”')]);
    expect(sections).toEqual([
      { id: 'note-section-1', title: '同じ場所' },
      { id: 'note-section-2', title: '同じ場所' },
      { id: 'note-section-3', title: '<script> & “camp”' },
    ]);
  });
  it('ignores empty/malformed headings, other blocks and list-styled headings', () => {
    const blocks = [heading(' '), heading('', { children: {} }), heading('', { children: [null] }),
      heading('A paragraph', { style: 'normal' }), heading('A subheading', { style: 'h3' }),
      heading('A list item', { listItem: 'number' }), heading('An embed', { _type: 'embed' })];
    expect(fieldNoteSections(blocks)).toEqual({ content: blocks, sections: [] });
    expect(fieldNoteSections([])).toEqual({ content: [], sections: [] });
  });
});
