import { writeFileSync, renameSync, rmSync, openSync, closeSync, fstatSync, ftruncateSync, fsyncSync, constants } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Never replace the provisioned owner login with an empty/default browser context.
export function writeHostedStorageState(state, path, now = Date.now() / 1000) {
  const session = state?.cookies?.some(cookie =>
    ['dinkuskit.com', '.dinkuskit.com'].includes(cookie.domain) &&
    cookie.name === '__Secure-dk-merchant.session_token' && cookie.secure === true &&
    typeof cookie.value === 'string' && cookie.value.length > 0 &&
    (cookie.expires === -1 || cookie.expires > now));
  if (!session) throw new Error('Hosted browser state has no DinkusKit session; existing file left unchanged');
  const serialized = JSON.stringify(state);
  const temp = `${path}.${randomUUID()}.next`;
  try {
    try { writeFileSync(temp, serialized, { mode: 0o600, flag: 'wx' }); }
    catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EACCES') throw error;
      // /etc may allow refreshing the existing agent-owned file but not creating
      // siblings. Match Playwright's documented in-place storageState refresh;
      // never weaken the parent directory or follow a replacement symlink.
      const fd = openSync(path, constants.O_WRONLY | constants.O_NOFOLLOW);
      try {
        const file = fstatSync(fd);
        if (!file.isFile() || file.uid !== process.getuid?.() || (file.mode & 0o777) !== 0o600) {
          throw new Error('Hosted state refresh requires an owned private regular file');
        }
        writeFileSync(fd, serialized);
        ftruncateSync(fd, Buffer.byteLength(serialized));
        fsyncSync(fd);
      } finally { closeSync(fd); }
      return;
    }
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}
