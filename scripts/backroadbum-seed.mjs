// Adopt an untouched starter once; later runs keep merchant-edited content and prices.
import { readFileSync } from 'node:fs';
import { openAdmin } from './backroadbum-admin.mjs';
const origin = 'https://backroadbum.com';
const plugin = '/_emdash/api/plugins/r_gshdrqaldna3r7sn';
const products = JSON.parse(readFileSync(new URL('../seed/backroadbum-catalog.json', import.meta.url)));
const block = (text, key = 'copy', style = 'normal') => ({ _type: 'block', _key: key, style, markDefs: [], children: [{ _type: 'span', _key: key + '-text', marks: [], text }] });
const a = await openAdmin();
try {
  await a.signIn();
  const api = async (path, body, method = 'POST') => {
    const response = await a.page.request.fetch(origin + path, { method, headers: { 'X-EmDash-Request': '1' }, ...(body === undefined ? {} : { data: body }) });
    const json = await response.json();
    if (!response.ok() || !json.success) throw new Error(`${path}: ${JSON.stringify(json)}`);
    return json.data;
  };
  const entries = (await api('/_emdash/api/content/products', undefined, 'GET')).items;
  const catalog = (await api(plugin + '/catalog', { op: 'list' })).products;
  for (const p of products) {
    if (catalog.some(item => item.sku === p.sku)) continue;
    const old = entries.find(item => item.slug === p.sourceSlug || item.slug === p.slug);
    const data = { title: p.name, description: p.description, summary: [block(p.summary)], details: [{ _type: 'collapsible_section', _version: 1, _key: 'design', heading: 'Design & care', open_by_default: true, content: [block(p.specs)] }], visual_label: p.art.toUpperCase() };
    const saved = await api('/_emdash/api/content/products' + (old ? '/' + old.id : ''), { slug: p.slug, data }, old ? 'PUT' : 'POST');
    const entryId = (saved.item ?? saved).id;
    const { catalogItemId } = await api(plugin + '/catalog', { op: 'create', commandId: `brb-${p.sku}`, name: p.name, sku: p.sku, entryId });
    const priced = await api(plugin + '/catalog', { op: 'prices', catalogItemId, regular: p.regular, sale: p.sale, stockStatus: 'in-stock' });
    if (priced.saved === false) throw new Error(priced.message);
    const art = await a.context.newPage();
    await art.setViewportSize({ width: 640, height: 480 });
    await art.setContent(readFileSync(new URL(`../public/backroad/${p.art}.svg`, import.meta.url), 'utf8'));
    await art.addStyleTag({content:'html,body{margin:0;padding:0}svg{display:block;width:640px;height:480px}'});
    const buffer = await art.screenshot();
    await art.close();
    const upload = await a.page.request.post(origin + '/_emdash/api/media', { headers: { 'X-EmDash-Request': '1' }, multipart: { file: { name: p.slug + '.png', mimeType: 'image/png', buffer }, alt: `${p.name} — illustrated demo design`, width: '640', height: '480' } });
    const media = await upload.json();
    if (!upload.ok() || !media.success) throw new Error('Product illustration upload failed: ' + JSON.stringify(media));
    const mediaId = (media.data.item ?? media.data).id;
    await api(plugin + '/catalog', { op: 'media', catalogItemId, image: mediaId });
    await api('/_emdash/api/content/products/' + entryId + '/publish');
    // A page already published by the starter may not transition on publish again.
    await api(plugin + '/catalog-items/set-on-sale', { entryId, onSale: true });
    console.log('Created', p.slug);
  }
  const pages = (await api('/_emdash/api/content/pages', undefined, 'GET')).items;
  const home = pages.find(p => p.slug === 'home');
  if (home?.data.title === 'DinkusKit Store Starter') {
    await api('/_emdash/api/content/pages/' + home.id, { data: { title: 'Take the long way back.', content: [], layout: [{ _type: 'home_opener', _version: 1, _key: 'backroad-home', headline: 'Take the long way back.', deck: 'Good company. A little camp gear. One more turn before home. Everyday goods for the miles in between.', primary_label: 'Find your weekend gear', primary_href: '/shop', secondary_label: 'Read the field notes', secondary_href: '/field-notes' }] } }, 'PUT');
    await api('/_emdash/api/content/pages/' + home.id + '/publish');
  }
  const editorial = JSON.parse(readFileSync(new URL('../seed/backroadbum-pages.json', import.meta.url)));
  for (const page of editorial) {
    const existing = pages.find(p => p.slug === page.slug);
    const isStarter = page.replaceStarter && existing?.data.content?.some(b => b.children?.some(s => /Describe which|Describe when/.test(s.text ?? '')));
    if (existing && !isStarter) continue;
    const saved = await api('/_emdash/api/content/pages' + (existing ? '/' + existing.id : ''), { slug: page.slug, data: { title: page.title, layout: [], content: page.sections.map(([style, text], i) => block(text, `section-${i}`, style)) } }, existing ? 'PUT' : 'POST');
    await api('/_emdash/api/content/pages/' + (saved.item ?? saved).id + '/publish');
    console.log('Published', page.slug);
  }
} finally { await a.saveKey(); await a.browser.close(); }
