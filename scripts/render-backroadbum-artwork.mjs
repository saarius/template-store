// Rasterize source-authored SVG merchandise art for native Media Library upload.
// Outputs belong in ignored runs/, never git. A sidecar records the exact source and framing.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  source: { type: 'string' }, output: { type: 'string' },
  'view-box': { type: 'string' }, width: { type: 'string', default: '1200' }, height: { type: 'string', default: '900' },
} });
if (!values.source || !values.output) throw new Error('Provide --source and --output (under runs/).');
const source = resolve(values.source), output = resolve(values.output);
if (!output.startsWith(resolve('runs') + '/') || !output.endsWith('.png')) throw new Error('PNG output must be under ignored runs/.');
const width = Number(values.width), height = Number(values.height);
if (![width, height].every(n => Number.isInteger(n) && n >= 100 && n <= 2400)) throw new Error('Invalid raster dimensions.');
const original = await readFile(source, 'utf8');
if (!/<svg\b[^>]*\bviewBox="[^"]+"/u.test(original)) throw new Error('Source SVG needs a viewBox.');
let svg = original;
if (values['view-box']) {
  const box = values['view-box'].split(',').map(Number);
  if (box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) throw new Error('Invalid --view-box=x,y,width,height.');
  svg = svg.replace(/(<svg\b[^>]*\bviewBox=")[^"]+("[^>]*>)/u, `$1${box.join(' ')}$2`);
}
const browser = await chromium.launch();
await mkdir(dirname(output), { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}img{display:block;width:100%;height:100%}</style><img alt="Source artwork" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" />`);
  await page.locator('img').evaluate(image => image.decode());
  await page.locator('img').screenshot({ path: output });
} finally { await browser.close(); }
const sha256 = value => createHash('sha256').update(value).digest('hex');
const provenance = { generatedAt: new Date().toISOString(), source: values.source, sourceSha256: sha256(original),
  viewBox: values['view-box'] ?? null, width, height, renderer: 'Chromium SVG rasterization',
  subject: 'Source-authored fictional Backroad Bum merchandise illustration; not product photography.',
  rasterSha256: sha256(await readFile(output)) };
await writeFile(output + '.json', JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify(provenance, null, 2));
