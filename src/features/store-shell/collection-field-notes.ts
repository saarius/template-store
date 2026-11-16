import { fieldNotes, type FieldNote } from './field-notes.js';

type PageEntry = { id: string; data: { title?: unknown; content?: unknown } };

/** Only rendered native links count, not unused definitions or product-name guesses. */
function linkedProducts(content: unknown): Set<string> {
  const paths = new Set<string>();
  if (!Array.isArray(content)) return paths;
  for (const block of content) {
    if (block?._type !== 'block' || !Array.isArray(block.children) || !Array.isArray(block.markDefs)) continue;
    const used = new Set(block.children.flatMap((span: { _type?: string; text?: unknown; marks?: unknown } | null) =>
      span?._type === 'span' && typeof span.text === 'string' && span.text.trim() && Array.isArray(span.marks) ? span.marks : []));
    for (const link of block.markDefs) {
      if (link?._type === 'link' && typeof link._key === 'string' && used.has(link._key)
        && typeof link.href === 'string' && /^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(link.href)) paths.add(link.href);
    }
  }
  return paths;
}

/** Published CMS prose selects reading; the current shopping surface supplies product paths.
 * A product page passes a singleton set; a collection passes its current members.
 * The caller must pass published-only pages and omit this secondary shelf in preview.
 */
export function collectionFieldNotes(entries: readonly PageEntry[], productPaths: ReadonlySet<string>): FieldNote[] {
  const matching = new Set(entries.filter(entry => [...linkedProducts(entry.data.content)]
    .some(path => productPaths.has(path))).map(entry => entry.id));
  return fieldNotes(entries).filter(note => matching.has(note.slug)).slice(0, 2).map(note => ({
    ...note,
    excerpt: note.excerpt.length > 220 ? `${note.excerpt.slice(0, 220).replace(/\s+\S*$/, '')}…` : note.excerpt,
  }));
}

/** Optional reading must never prevent shopping when the CMS cannot supply it. */
export async function loadCollectionFieldNotes(productPaths: ReadonlySet<string>, preview: boolean,
  readPages: () => Promise<readonly PageEntry[]>): Promise<FieldNote[]> {
  if (preview || !productPaths.size) return [];
  try { return collectionFieldNotes(await readPages(), productPaths); }
  catch { return []; }
}
