import { describe, expect, it, vi } from 'vitest';
import { syncStatusRetryFeedback } from '../../src/features/guest-cart/status-retry-feedback.js';

function fixture() {
  const attrs = new Map<string, string>();
  const doc = { activeElement: null as unknown };
  const button = { ownerDocument: doc, hidden: false,
    setAttribute: (key: string, value: string) => attrs.set(key, value),
    removeAttribute: (key: string) => attrs.delete(key) } as unknown as HTMLButtonElement;
  const status = { hidden: false, focus: vi.fn(() => { doc.activeElement = status; }) } as unknown as HTMLElement;
  doc.activeElement = button;
  return { attrs, button, status, doc };
}

describe('saved checkout status retry feedback', () => {
  it('signals pending without native disabling, hiding or moving focus', () => {
    const f = fixture();
    syncStatusRetryFeedback(f.button, f.status, { checking: true, visible: true, limited: false });
    expect(f.attrs.get('aria-disabled')).toBe('true'); expect(f.attrs.get('aria-busy')).toBe('true');
    expect(f.button.hidden).toBe(false); expect(f.button.disabled).not.toBe(true);
    expect(f.doc.activeElement).toBe(f.button); expect(f.status.focus).not.toHaveBeenCalled();
  });
  it('clears pending and admits the next explicit read', () => {
    const f = fixture();
    syncStatusRetryFeedback(f.button, f.status, { checking: true, visible: true, limited: false });
    syncStatusRetryFeedback(f.button, f.status, { checking: false, visible: true, limited: false });
    expect(f.attrs.get('aria-disabled')).toBe('false'); expect(f.attrs.has('aria-busy')).toBe(false);
    expect(f.doc.activeElement).toBe(f.button);
  });
  it('focuses the terminal result before hiding the still-focused trigger', () => {
    const f = fixture();
    syncStatusRetryFeedback(f.button, f.status, { checking: false, visible: false, limited: false });
    expect(f.status.focus).toHaveBeenCalledOnce(); expect(f.button.hidden).toBe(true);
    expect(f.doc.activeElement).toBe(f.status);
  });
  it('never steals focus on automatic reads or after the shopper moves away', () => {
    for (const active of [null, { tagName: 'A' }]) {
      const f = fixture(); f.doc.activeElement = active;
      syncStatusRetryFeedback(f.button, f.status, { checking: false, visible: false, limited: false });
      expect(f.status.focus).not.toHaveBeenCalled(); expect(f.doc.activeElement).toBe(active);
    }
  });
  it('keeps the exhausted control focusable and describes its refusal without loading', () => {
    const f = fixture();
    syncStatusRetryFeedback(f.button, f.status, { checking: false, visible: true, limited: true });
    expect(f.attrs.get('aria-disabled')).toBe('true'); expect(f.attrs.has('aria-busy')).toBe(false);
    expect(f.button.hidden).toBe(false); expect(f.doc.activeElement).toBe(f.button);
  });
  it('tolerates absent controls and does not focus a hidden result', () => {
    const f = fixture(); f.status.hidden = true;
    expect(() => syncStatusRetryFeedback(null, null, { checking: false, visible: false, limited: false })).not.toThrow();
    syncStatusRetryFeedback(f.button, f.status, { checking: false, visible: false, limited: false });
    expect(f.status.focus).not.toHaveBeenCalled();
  });
});
