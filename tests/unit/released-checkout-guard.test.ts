import { describe, expect, it } from 'vitest';
import { releasedCheckoutBrowserState } from '../../scripts/lib/backroadbum-released-checkout.mjs';

const origin = 'https://backroadbum.com';
const checkout = { name: 'dinkus.guest-checkout.v1', value: JSON.stringify({ capability: 'fixture-secret', attemptId: 'original' }) };
const cart = { name: 'dinkus.guest-cart.v1', value: JSON.stringify({ version: 1, lines: [{ id: 'mug', quantity: 2 }] }) };
const state = (entries = [checkout, cart]) => ({ cookies: [{ name: 'staff', value: 'private' }], origins: [
  { origin: 'https://other.example', localStorage: [{ name: 'secret', value: 'private' }] },
  { origin, localStorage: [...entries, { name: 'checkout.contact', value: 'private address' }, { name: 'backroadbum.theme', value: 'dark' }] },
] });

describe('released checkout proof browser isolation', () => {
  it('restores only the original capability and validated cart, without mutating its input', () => {
    const original = state(); const before = structuredClone(original);
    expect(releasedCheckoutBrowserState(original)).toEqual({ cookies: [], origins: [{ origin, localStorage: [checkout, cart] }] });
    expect(original).toEqual(before);
  });
  it.each([
    [], [checkout], [checkout, cart, cart],
    [checkout, { ...cart, value: '{' }],
    [checkout, { ...cart, value: JSON.stringify({ version: 1, lines: [] }) }],
    [checkout, { ...cart, value: JSON.stringify({ version: 1, lines: [{ id: '../private', quantity: 1 }] }) }],
    [checkout, { ...cart, value: JSON.stringify({ version: 1, lines: [{ id: 'mug', quantity: 0 }] }) }],
    [checkout, { ...cart, value: JSON.stringify({ version: 1, lines: [{ id: 'mug', quantity: 1 }, { id: 'mug', quantity: 2 }] }) }],
    [checkout, { ...cart, value: JSON.stringify({ version: 1, lines: [{ id: 'mug', quantity: 1 }], email: 'private' }) }],
  ])('refuses missing, ambiguous or invalid original browser cart (%#)', (...entries) => {
    expect(() => releasedCheckoutBrowserState(state(entries))).toThrow();
  });
});
