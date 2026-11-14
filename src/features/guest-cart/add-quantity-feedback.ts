/** Product quantity corrections are distinct from cart persistence failures. */
export function clearAddQuantityFeedback(root: Element | null | undefined): void {
  const feedback = root?.querySelector<HTMLElement>('[data-add-to-cart-status]');
  const input = root?.querySelector<HTMLInputElement>('[data-add-to-cart-qty]');
  if (!feedback || !input || feedback.dataset.addQuantityError !== '1') return;
  feedback.hidden = true;
  feedback.textContent = '';
  delete feedback.dataset.addQuantityError;
  input.removeAttribute('aria-invalid');
  const descriptions = (input.getAttribute('aria-describedby') ?? '').split(/\s+/u)
    .filter(id => id && id !== feedback.id);
  if (descriptions.length) input.setAttribute('aria-describedby', descriptions.join(' '));
  else input.removeAttribute('aria-describedby');
}

/** Called only after an explicit rejected Add; editing never takes focus. */
export function setAddQuantityFeedback(root: Element | null | undefined): void {
  const feedback = root?.querySelector<HTMLElement>('[data-add-to-cart-status]');
  const input = root?.querySelector<HTMLInputElement>('[data-add-to-cart-qty]');
  if (!feedback?.id || !input) return;
  feedback.dataset.addQuantityError = '1';
  input.setAttribute('aria-invalid', 'true');
  const descriptions = new Set((input.getAttribute('aria-describedby') ?? '').split(/\s+/u).filter(Boolean));
  descriptions.add(feedback.id);
  input.setAttribute('aria-describedby', [...descriptions].join(' '));
  input.focus();
  input.scrollIntoView({ block: 'center', behavior: 'instant' });
}
