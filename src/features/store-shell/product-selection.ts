/** Resolve URL selection only against this product's current Commerce members. */
export function productSelection<T extends { id: string; availability: { sellable: boolean } }>(
  members: readonly T[],
  search: URLSearchParams,
): { member: T | null; stale: boolean } {
  if (!members.length) return { member: null, stale: false };
  const requested = search.getAll("item");
  if (!requested.length) {
    return { member: members.find(member => member.availability.sellable) ?? members[0] ?? null, stale: false };
  }
  const member = requested.length === 1 ? members.find(member => member.id === requested[0]) ?? null : null;
  // An empty, foreign, duplicate or removed member must not silently choose a sibling.
  return { member, stale: member === null };
}

/** Replace (not push) the current selection, preserving unrelated query/fragment state. */
export function productSelectionUrl(href: string, item: string | null): string {
  const url = new URL(href);
  url.searchParams.set("item", item ?? "");
  return url.href;
}
