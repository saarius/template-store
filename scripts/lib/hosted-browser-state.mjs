import { writeFileSync, renameSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Never replace the provisioned owner login with an empty/default browser context.
export function writeHostedStorageState(state, path, now = Date.now() / 1000) {
  const session = state?.cookies?.some(cookie =>
    ['dinkuskit.com', '.dinkuskit.com'].includes(cookie.domain) &&
    cookie.name === '__Secure-dk-merchant.session_token' && cookie.secure === true &&
    typeof cookie.value === 'string' && cookie.value.length > 0 &&
    (cookie.expires === -1 || cookie.expires > now));
  if (!session) throw new Error('Hosted browser state has no DinkusKit session; existing file left unchanged');
  const temp = `${path}.${randomUUID()}.next`;
  try {
    writeFileSync(temp, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}
