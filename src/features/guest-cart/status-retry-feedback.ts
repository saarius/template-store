// Keep the original control mounted/focusable during a read. The controller's
// checking/budget guards, not ARIA, refuse duplicate activation.
export function syncStatusRetryFeedback(
  button: HTMLButtonElement | null,
  status: HTMLElement | null,
  state: { checking: boolean; visible: boolean; limited: boolean },
): void {
  if (!button) return;
  button.setAttribute('aria-disabled', String(state.checking || state.limited));
  if (state.checking) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
  // Only an explicit check whose button STILL owns focus may move it to the
  // result before that button disappears. Initial reads and moved-away shoppers
  // retain their own position, even after a slow cart-settlement read.
  if (!state.visible && button.ownerDocument.activeElement === button && status && !status.hidden) {
    status.focus();
  }
  button.hidden = !state.visible;
}
