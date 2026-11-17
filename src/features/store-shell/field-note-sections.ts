import type { PortableTextBlock } from 'emdash';

export type FieldNoteSection = { id: string; title: string };

/** A request-local reading aid, never a write to the native article. Only real,
 * non-list h2 blocks become chapters; inline marks stay with PortableText. */
export function fieldNoteSections(blocks: readonly PortableTextBlock[]): {
  content: PortableTextBlock[];
  sections: FieldNoteSection[];
} {
  const sections: FieldNoteSection[] = [];
  const content = blocks.map(block => {
    if (block?._type !== 'block' || block.style !== 'h2' || block.listItem) return block;
    const title = Array.isArray(block.children) ? block.children
      .filter(span => span?._type === 'span' && typeof span.text === 'string')
      .map(span => span.text).join('').trim() : '';
    if (!title) return block;
    // Ordinals distinguish repeated headings and need no unsafe CMS key in an ID.
    const id = `note-section-${sections.length + 1}`;
    sections.push({ id, title });
    return { ...block, backroadSectionId: id };
  });
  return { content, sections };
}
