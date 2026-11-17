const LINE = "data-guest-cart-line";
const CONTROLS = ["data-guest-cart-qty", "data-guest-cart-update", "data-guest-cart-remove"] as const;
type LineControl = typeof CONTROLS[number];
export interface CartLineFocus { id: string; index: number; control: LineControl }

/** Retain the same control, or use the next remaining row (the previous row at the end). */
export function cartLineFocusAfterRedraw(focus: CartLineFocus, ids: readonly string[]): { id: string; control: LineControl } | null {
  const id = ids.includes(focus.id) ? focus.id : ids[Math.min(Math.max(0, focus.index), ids.length - 1)];
  return id === undefined ? null : { id, control: focus.control };
}

/** Observe focus at response time, not submission time: later keyboard movement wins. */
export function replaceCartSection(previous: Element, next: Element): void {
  const active = previous.ownerDocument.activeElement;
  const ownedFocus = active instanceof HTMLElement && previous.contains(active);
  const rows = Array.from(previous.querySelectorAll<HTMLElement>(`[${LINE}]`));
  const row = ownedFocus ? active.closest<HTMLElement>(`[${LINE}]`) : null;
  const control = ownedFocus ? CONTROLS.find(attribute => active.hasAttribute(attribute)) : undefined;
  const focus = row && control ? { id: row.getAttribute(LINE)!, index: rows.indexOf(row), control } : null;
  const sectionControl = ownedFocus ? ["data-guest-cart-proceed", "data-guest-cart-resume", "data-guest-cart-empty"]
    .find(attribute => active.hasAttribute(attribute)) : undefined;
  previous.replaceWith(next);
  // A response must not pull the shopper back from navigation or another task.
  if (!ownedFocus) return;
  const alert = next.querySelector<HTMLElement>("[role=alert]");
  if (alert) {
    alert.tabIndex = -1;
    alert.focus();
    return;
  }
  if (focus) {
    const nextRows = Array.from(next.querySelectorAll<HTMLElement>(`[${LINE}]`));
    const target = cartLineFocusAfterRedraw(focus, nextRows.map(line => line.getAttribute(LINE)!));
    const nextRow = target && nextRows.find(line => line.getAttribute(LINE) === target.id);
    const input = target && nextRow?.querySelector<HTMLElement>(`[${target.control}]`);
    if (input) { input.focus(); return; }
  }
  const target = sectionControl && next.querySelector<HTMLElement>(`[${sectionControl}]`);
  (target || next.querySelector<HTMLElement>("[data-guest-cart-empty]"))?.focus();
}
