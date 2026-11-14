import { describe, expect, it, vi } from 'vitest';
import { clearAddQuantityFeedback, setAddQuantityFeedback } from '../../src/features/guest-cart/add-quantity-feedback.js';

function fixture() {
  const attrs = new Map<string, string>([['aria-describedby', 'quantity-hint']]);
  const input = {
    getAttribute: (key: string) => attrs.get(key) ?? null,
    setAttribute: (key: string, value: string) => attrs.set(key, value),
    removeAttribute: (key: string) => attrs.delete(key),
    focus: vi.fn(), scrollIntoView: vi.fn(),
  };
  const feedback = { id: 'quantity-error', hidden: false, textContent: 'Use a whole number.', dataset: {} as Record<string, string> };
  const root = { querySelector: (selector: string) => selector === '[data-add-to-cart-status]' ? feedback : input } as unknown as Element;
  return { root, input, feedback, attrs };
}

describe('product Add quantity correction', () => {
  it('associates the visible rejection with its quantity, retaining prior guidance', () => {
    const f = fixture();
    setAddQuantityFeedback(f.root);
    expect(f.attrs.get('aria-invalid')).toBe('true');
    expect(f.attrs.get('aria-describedby')).toBe('quantity-hint quantity-error');
    expect(f.feedback.dataset.addQuantityError).toBe('1');
    expect(f.input.focus).toHaveBeenCalledOnce();
    expect(f.input.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' });
  });

  it('does not duplicate its description after repeated rejection', () => {
    const f = fixture();
    setAddQuantityFeedback(f.root); setAddQuantityFeedback(f.root);
    expect(f.attrs.get('aria-describedby')).toBe('quantity-hint quantity-error');
  });

  it('clears only its own correction on an edit, without focusing again', () => {
    const f = fixture(); setAddQuantityFeedback(f.root);
    f.input.focus.mockClear(); f.input.scrollIntoView.mockClear();
    clearAddQuantityFeedback(f.root);
    expect(f.feedback.hidden).toBe(true);
    expect(f.feedback.textContent).toBe('');
    expect(f.feedback.dataset.addQuantityError).toBeUndefined();
    expect(f.attrs.has('aria-invalid')).toBe(false);
    expect(f.attrs.get('aria-describedby')).toBe('quantity-hint');
    expect(f.input.focus).not.toHaveBeenCalled();
    expect(f.input.scrollIntoView).not.toHaveBeenCalled();
  });

  it('removes an otherwise empty description attribute', () => {
    const f = fixture(); f.attrs.delete('aria-describedby');
    setAddQuantityFeedback(f.root); clearAddQuantityFeedback(f.root);
    expect(f.attrs.has('aria-describedby')).toBe(false);
  });

  it('does not clear a cart storage failure or a successful Add message on edit', () => {
    for (const text of ['Browser storage is unavailable.', 'Added to cart.']) {
      const f = fixture(); f.feedback.textContent = text;
      clearAddQuantityFeedback(f.root);
      expect(f.feedback.hidden).toBe(false);
      expect(f.feedback.textContent).toBe(text);
      expect(f.input.focus).not.toHaveBeenCalled();
    }
  });

  it('does nothing without a uniquely addressable feedback element or mounted controls', () => {
    const f = fixture(); f.feedback.id = '';
    setAddQuantityFeedback(f.root);
    expect(f.attrs.has('aria-invalid')).toBe(false);
    expect(f.input.focus).not.toHaveBeenCalled();
    expect(() => setAddQuantityFeedback(null)).not.toThrow();
    expect(() => clearAddQuantityFeedback(undefined)).not.toThrow();
  });
});
