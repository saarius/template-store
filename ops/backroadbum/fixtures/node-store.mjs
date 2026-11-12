// Disposable process fixture only. No Commerce, storage, credentials or network services.
import { createServer } from '../../../node_modules/@astrojs/node/dist/standalone.js';

let plugin;
let runner;
if (['constructor', 'worker'].includes(process.env.STORE_FIXTURE)) {
  const { WorkerdSandboxRunner } = await import('@emdash-cms/sandbox-workerd');
  runner = new WorkerdSandboxRunner({ db: null });
  if (process.env.STORE_FIXTURE === 'worker') {
    plugin = await runner.load({
      id: 'shutdown-fixture', version: '1.0.0', capabilities: [], allowedHosts: [], storage: {},
    }, `export default { routes: { echo: { handler: async ({input}) => {
      await new Promise(resolve => setTimeout(resolve, input.delay));
      return { completed: true };
    } } } };`);
    await plugin.invokeRoute('echo', { delay: 1 }, { method: 'GET', url: '/fixture', headers: {} });
  }
}
if (process.env.STORE_FIXTURE === 'startup-delay') {
  process.send?.({ kind: 'importing' });
  await new Promise(resolve => setTimeout(resolve, 150));
}
if (process.env.STORE_FIXTURE === 'startup-failure') throw new Error('synthetic private error');

export function startServer() {
  if (process.env.STORE_FIXTURE === 'lingering') setInterval(() => {}, 1000);
  const server = createServer(async (req, res) => {
    if (req.url === '/hang') { process.send?.({ kind: 'entered' }); return; }
    if (req.url === '/slow') {
      process.send?.({ kind: 'entered' });
      try {
        const value = plugin
          ? await plugin.invokeRoute('echo', { delay: 400 }, { method: 'GET', url: '/fixture', headers: {} })
          : await new Promise(resolve => setTimeout(() => resolve({ completed: true }), 400));
        res.end(JSON.stringify(value));
      } catch { res.writeHead(503).end('failed'); }
    } else res.end('ok');
  }, '127.0.0.1', 0);
  server.server.listen(0, '127.0.0.1', () => process.send?.({
    kind: 'listening', port: server.server.address().port,
    // Test-only child lifetime observation; never serialized on the public site.
    worker: runner?.workerdProcess?.pid ?? null,
  }));
  return { server, done: server.closed() };
}

// Mirror standalone autostart for the known-bad control.
if (process.env.ASTRO_NODE_AUTOSTART !== 'disabled') startServer();
