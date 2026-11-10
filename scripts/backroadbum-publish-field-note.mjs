// Create one new source-authored EmDash field note. Never overwrite an existing merchant page.
import { readFileSync } from 'node:fs';
import { openAdmin } from './backroadbum-admin.mjs';
const slug = process.argv.find(arg => arg.startsWith('field-note-'));
const source = JSON.parse(readFileSync(new URL('../seed/backroadbum-pages.json', import.meta.url), 'utf8'));
const note = source.find(page => page.slug === slug && /^field-note-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug));
if (!note) throw Error('Choose a field-note slug from seed/backroadbum-pages.json.');
if (!process.argv.includes('--publish')) {
  console.log(`No action. Add --publish to create ${note.slug}; existing pages are never changed.`);
  process.exit(0);
}
const admin = await openAdmin();
try {
  await admin.signIn();
  const api = async (path, method = 'GET', data) => {
    const response = await admin.page.request.fetch('https://backroadbum.com/_emdash/api/content/pages' + path, {
      method, headers: { 'X-EmDash-Request': '1' }, ...(data ? { data } : {}),
    });
    const json = await response.json();
    if (!response.ok() || !json.success) throw Error('Field-note publication refused. Inspect the protected admin.');
    return json.data;
  };
  const pages = (await api('')).items;
  if (pages.some(page => page.slug === note.slug)) {
    console.log(`Unchanged: ${note.slug} already exists. Edit or publish it in EmDash.`);
  } else {
    const content = note.sections.map(([style, text], index) => ({
      _type: 'block', _key: `section-${index}`, style, markDefs: [],
      children: [{ _type: 'span', _key: `section-${index}-text`, marks: [], text }],
    }));
    const created = await api('', 'POST', { slug: note.slug, data: { title: note.title, layout: [], content } });
    await api('/' + (created.item ?? created).id + '/publish', 'POST');
    console.log('Published ' + note.slug);
  }
} finally { await admin.saveKey(); await admin.browser.close(); }
