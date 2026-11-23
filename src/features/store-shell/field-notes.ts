type PageEntry = { id: string; data: { title?: unknown; content?: unknown } };
type DatedPageEntry = PageEntry & { data: { status?: unknown; publishedAt?: unknown; layout?: unknown } };
export type FieldNote = { slug: string; title: string; excerpt: string };

/** EmDash entry IDs are the published page slugs, not private content-row IDs. */
export function fieldNote(entry: PageEntry | null | undefined): FieldNote | null {
  if (!entry || !/^field-note-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) return null;
  const title = typeof entry.data.title === "string" ? entry.data.title.trim() : "";
  if (!title) return null;
  const blocks = Array.isArray(entry.data.content) ? entry.data.content : [];
  const intro = blocks.find(block => block?._type === "block" && (!block.style || block.style === "normal"));
  const excerpt = Array.isArray(intro?.children) ? intro.children
    .filter((span: { _type?: string; text?: unknown }) => span?._type === "span" && typeof span.text === "string")
    .map((span: { text: string }) => span.text).join("").trim() : "";
  return { slug: entry.id, title, excerpt };
}

/** Select the home teaser by publication, not by edit time or index position. */
export function latestFieldNote(entries: readonly DatedPageEntry[]): FieldNote | null {
  let latest: FieldNote | null = null;
  let latestAt = -Infinity;
  for (const entry of entries) {
    if (entry.data.status !== 'published' || (Array.isArray(entry.data.layout) && entry.data.layout.length)) continue;
    const value = entry.data.publishedAt;
    const publishedAt = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN;
    if (!Number.isFinite(publishedAt) || publishedAt < latestAt) continue;
    const note = fieldNote(entry);
    if (!note || (publishedAt === latestAt && latest && note.slug >= latest.slug)) continue;
    latest = note;
    latestAt = publishedAt;
  }
  if (!latest || latest.excerpt.length <= 180) return latest;
  const clip = latest.excerpt.slice(0, 181);
  const boundary = clip.lastIndexOf(' ');
  return { ...latest, excerpt: `${boundary > 0 ? clip.slice(0, boundary) : clip.slice(0, 180)}…` };
}

/** Continue in the index's stable slug order, then wrap once. The caller supplies
 * published-only entries; this is a reading sequence, not relevance or chronology.
 */
export function nextFieldNotes(entries: readonly PageEntry[], currentSlug: string): FieldNote[] {
  const notes = fieldNotes(entries);
  const current = notes.findIndex(note => note.slug === currentSlug);
  if (current < 0) return notes.slice(0, 2);
  return [...notes.slice(current + 1), ...notes.slice(0, current)].slice(0, 2);
}

export function fieldNotes(entries: readonly PageEntry[]): FieldNote[] {
  return entries.flatMap(entry => {
    const note = fieldNote(entry);
    return note ? [note] : [];
  }).sort((a, b) => a.slug.localeCompare(b.slug));
}
