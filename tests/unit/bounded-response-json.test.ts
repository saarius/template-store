import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundedResponseJson } from '../../scripts/lib/bounded-response-json.mjs';

afterEach(() => vi.useRealTimers());

describe('bounded browser response diagnostics', () => {
  it('reads JSON without depending on a separate finished observer', async () => {
    vi.useFakeTimers();
    const body = { ok: true, checkout: { state: 'paid' } };
    const finished = vi.fn(() => new Promise(() => {}));
    expect(await boundedResponseJson({ json: async () => body, finished })).toEqual(body);
    expect(finished).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('allows the body reader to wait for completion within its deadline', async () => {
    vi.useFakeTimers();
    const result = boundedResponseJson({ json: () => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 100)) }, 500);
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('bounds a hung body and safely handles a late rejection', async () => {
    vi.useFakeTimers();
    let rejectBody: (reason?: unknown) => void = () => {};
    const result = boundedResponseJson({ json: () => new Promise((_, reject) => { rejectBody = reject; }) }, 50);
    await vi.advanceTimersByTimeAsync(50);
    expect(await result).toBeUndefined();
    rejectBody(new Error('private diagnostic must not escape'));
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['throw', 'reject'])('keeps an unreadable body unavailable after %s without leaking diagnostics', async kind => {
    vi.useFakeTimers();
    const json = () => { if (kind === 'throw') throw new Error('private body'); return Promise.reject(new Error('private body')); };
    expect(await boundedResponseJson({ json })).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});
