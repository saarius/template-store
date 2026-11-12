/** Keep a removal near its old position, even if another tab changed the cart. */
export function cartRemovalFocusId(
  previousIds: readonly string[],
  removedId: string,
  currentIds: readonly string[],
): string | null {
  const remaining = new Set(currentIds.filter(id => id !== removedId));
  const index = previousIds.indexOf(removedId);
  if (index >= 0) {
    // Prefer the next surviving row; at the end, walk back toward the start.
    const neighbours = [...previousIds.slice(index + 1), ...previousIds.slice(0, index).reverse()];
    const neighbour = neighbours.find(id => remaining.has(id));
    if (neighbour) return neighbour;
  }
  return currentIds.find(id => remaining.has(id)) ?? null;
}
