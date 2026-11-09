// One-time adoption of starter memberships, through authenticated EmDash content routes.
// Later runs leave the merchant's collection copy and non-starter memberships alone.
import { readFileSync } from 'node:fs';
import { openAdmin } from './backroadbum-admin.mjs';
const collections = JSON.parse(readFileSync(new URL('../seed/backroadbum-collections.json', import.meta.url)));
const origin = 'https://backroadbum.com';
const apply = process.argv.includes('--apply');
const admin = await openAdmin();
try {
  await admin.signIn();
  const api = async (path, body, method = 'GET') => {
    const response = await admin.page.request.fetch(origin + '/_emdash/api/content/' + path, {
      method, headers: { 'X-EmDash-Request': '1' }, ...(body ? { data: body } : {}),
    });
    const value = await response.json();
    if (!response.ok() || !value.success) throw Error('EmDash collection operation refused: ' + path);
    return value.data;
  };
  const categories = (await api('categories')).items;
  const products = (await api('products')).items;
  const ids = new Map(categories.map(category => [category.slug, category.id]));
  for (const collection of collections) {
    if (ids.has(collection.slug)) continue;
    console.log(apply ? 'Creating collection:' : 'Would create collection:', collection.slug);
    if (!apply) continue;
    const { item } = await api('categories', { slug: collection.slug, data: { title: collection.title, description: collection.description } }, 'POST');
    await api(`categories/${item.id}/publish`, {}, 'POST');
    ids.set(collection.slug, item.id);
  }
  const starterIds = new Set(categories.filter(category => ['hats', 'hoodies', 'tees'].includes(category.slug)).map(category => category.id));
  for (const product of products) {
    const desired = collections.filter(collection => collection.products.includes(product.slug));
    if (!desired.length) continue;
    const { item } = await api(`products/${product.id}`);
    const selected = item.references?.categories?.children?.map(child => child.id) ?? [];
    if (selected.some(id => !starterIds.has(id))) {
      console.log('Keeping existing non-starter memberships:', product.slug);
      continue;
    }
    console.log(apply ? 'Setting memberships:' : 'Would set memberships:', product.slug, desired.map(collection => collection.slug).join(', '));
    if (!apply) continue;
    await api(`products/${product.id}`, { references: { categories: desired.map(collection => ids.get(collection.slug)) } }, 'PUT');
    await api(`products/${product.id}/publish`, {}, 'POST');
  }
} finally { await admin.saveKey(); await admin.browser.close(); }
