// Deliberate publication of operational guides and their support note, never products/prices/stories.
import { readFileSync } from 'node:fs';
import { openAdmin } from './backroadbum-admin.mjs';
if (!process.argv.includes('--publish')) {
  console.log('No action. --publish updates Test-store guide, Shipping, Returns and their shared support note from seed/backroadbum-*.json.');
  process.exit(0);
}
const slugs = ['test-store', 'shipping', 'returns'];
const guides = JSON.parse(readFileSync(new URL('../seed/backroadbum-pages.json', import.meta.url), 'utf8')).filter(p => slugs.includes(p.slug));
if (guides.length !== 3) throw Error('Guide source incomplete');
const support = JSON.parse(readFileSync(new URL('../seed/backroadbum-policy-support.json', import.meta.url), 'utf8'));
if (support.slug !== 'policy-support-note' || !Array.isArray(support.content)) throw Error('Policy support source incomplete');
const admin = await openAdmin();
try {
  await admin.signIn();
  const api = async (path, method = 'GET', data) => {
    const response = await admin.page.request.fetch('https://backroadbum.com/_emdash/api/content/pages' + path, {
      method, headers: { 'X-EmDash-Request': '1' }, ...(data ? { data } : {}),
    });
    const json = await response.json();
    if (!response.ok() || !json.success) throw Error('Guide publication refused');
    return json.data;
  };
  const pages = (await api('')).items;
  for (const guide of guides) {
    const current = pages.find(p => p.slug === guide.slug);
    if (!current) throw Error('Expected guide missing');
    const content = guide.sections.map(([style, text], index) => ({
      _type: 'block', _key: `section-${index}`, style, markDefs: [],
      children: [{ _type: 'span', _key: `section-${index}-text`, marks: [], text }],
    }));
    await api('/' + current.id, 'PUT', { data: { ...current.data, title: guide.title, content } });
    await api('/' + current.id + '/publish', 'POST');
    console.log('Published ' + guide.slug);
  }
  const saved = await admin.page.request.put('https://backroadbum.com/_emdash/api/sections/' + support.slug, {
    headers: { 'X-EmDash-Request': '1' }, data: { content: support.content },
  });
  if (!saved.ok() || !(await saved.json()).success) throw Error('Policy support publication refused');
  console.log('Saved ' + support.slug);
} finally { await admin.saveKey(); await admin.browser.close(); }
