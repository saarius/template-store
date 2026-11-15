/** An authored, rendered native fragment link already provides the buying-panel
 * shortcut. Unused link definitions and empty spans do not provide navigation.
 */
export function summaryLinksToDetails(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some(block => {
    if (block?._type !== 'block' || !Array.isArray(block.children) || !Array.isArray(block.markDefs)) return false;
    const links = new Set(block.markDefs.filter((mark: { _type?: string; _key?: unknown; href?: unknown } | null) =>
      mark?._type === 'link' && typeof mark._key === 'string' && mark.href === '#product-details')
      .map((mark: { _key: string }) => mark._key));
    return block.children.some((span: { _type?: string; text?: unknown; marks?: unknown } | null) =>
      span?._type === 'span' && typeof span.text === 'string' && span.text.trim() && Array.isArray(span.marks)
      && span.marks.some(mark => links.has(mark)));
  });
}
