import { describe, expect, it } from 'vitest';
import { shipmentInspectionRequestAllowed as allowed } from '../../scripts/lib/backroadbum-shipment-inspection.mjs';

const native = 'https://backroadbum.com/_emdash/api/plugins/r_ehdlg5cxkb3ffqvr/admin';
describe('read-only operator shipment inspection', () => {
  it('admits native page reads and opening an existing order, including wrapped input', () => {
    expect(allowed(native, 'POST', { type: 'page_load', page: 'shipping' })).toBe(true);
    expect(allowed(native, 'POST', { type: 'block_action', action_id: 'open', value: 'existing-test-order' })).toBe(true);
    expect(allowed(native, 'POST', { input: { type: 'block_action', action_id: 'open' } })).toBe(true);
  });
  it.each(['buy:2:order', 'prices:2:order', 'cancel:order', 'connect', 'check', 'cancel_connect', 'unknown'])('refuses %s as both form and action', action_id => {
    expect(allowed(native, 'POST', { type: 'form_submit', action_id, values: {} })).toBe(false);
    expect(allowed(native, 'POST', { type: 'block_action', action_id })).toBe(false);
  });
  it('refuses malformed interactions, other plugins, checkout and unsupported methods', () => {
    expect(allowed(native, 'POST', null)).toBe(false);
    expect(allowed(native.replace('/admin', '/other'), 'POST', { type: 'page_load' })).toBe(false);
    expect(allowed(native, 'PUT', { type: 'page_load' })).toBe(false);
    expect(allowed(native.replace('r_ehdlg5cxkb3ffqvr', 'r_gshdrqaldna3r7sn'), 'POST', { type: 'page_load' })).toBe(false);
    expect(allowed('https://backroadbum.com/api/checkout/start', 'POST', {})).toBe(false);
    expect(allowed('not a URL', 'GET')).toBe(false);
  });
  it.each(['ship.dinkuskit.com', 'payments.dinkuskit.com', 'dinkuskit.com'])('allows %s owner reads/PDFs, never writes', host => {
    expect(allowed(`https://${host}/existing`, 'GET')).toBe(true);
    expect(allowed(`https://${host}/existing`, 'HEAD')).toBe(true);
    expect(allowed(`https://${host}/existing`, 'POST', { type: 'page_load' })).toBe(false);
  });
  it('retains native merchant authentication without allowing other external writes', () => {
    expect(allowed('https://backroadbum.com/_emdash/api/auth/passkey/verify', 'POST', {})).toBe(true);
    expect(allowed('https://other.invalid/_emdash/api/auth/passkey/verify', 'POST', {})).toBe(false);
  });
});
