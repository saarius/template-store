import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { options } from '../../scripts/qualify-backroadbum-server-cart.mjs';

const script = fileURLToPath(new URL('../../scripts/qualify-backroadbum-server-cart.mjs', import.meta.url));
describe('disposable server-cart qualification admission', () => {
  it('does not load source checkouts or start a runtime by default or on import', () => {
    expect(options([])).toBeNull();
    expect(execFileSync(process.execPath, [script], { encoding: 'utf8' })).toMatch(/^No action\./);
    expect(execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../../scripts/qualify-backroadbum-server-cart.mjs', import.meta.url).href)})`], { encoding: 'utf8' })).toBe('');
  });
  it.each([
    ['--old=/tmp/old', '--candidate=/tmp/new'], ['--check'],
    ['--check', '--old=/tmp/old', '--db=/var/lib/backroadbum/content.db'],
    ['--check', '--old=/tmp/old', '--old=/tmp/new'],
    ['--check', '--old=', '--candidate=/tmp/new'],
    ['--check', '--old=/tmp/old', '--candidate=/tmp/new', '--send'],
  ])('refuses incomplete or additional arguments %j', (...args) => {
    expect(() => options(args)).toThrow();
    expect(spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' }).status).toBe(1);
  });
  it('accepts only explicit source checkouts, never a supplied database or capability', () => {
    expect(options(['--candidate=/tmp/new', '--check', '--old=/tmp/old'])).toEqual({ old: '/tmp/old', candidate: '/tmp/new' });
  });
  it('withholds raw errors and private source paths when source identity is unavailable', () => {
    const result = spawnSync(process.execPath, [script, '--check', '--old=/private-missing-old', '--candidate=/private-missing-new'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Server-cart qualification failed');
    expect(result.stderr).not.toMatch(/private-missing|fatal:|AssertionError/);
  });
});
