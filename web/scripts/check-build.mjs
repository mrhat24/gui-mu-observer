import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const read = (name) => readFile(resolve(root, name));
const manifest = JSON.parse(await read('manifest.webmanifest'));
const base = manifest.start_url;
assert(base.startsWith('/') && base.endsWith('/'), 'Invalid base path');
assert.equal(manifest.scope, base);
assert.equal(manifest.id, base);
assert.equal(manifest.display, 'standalone');
for (const size of [192, 512]) {
  const icon = manifest.icons.find(
    (icon) => icon.sizes === `${size}x${size}` && icon.purpose === 'any',
  );
  assert(icon, `Missing ${size}px installation icon`);
  const bytes = await read(icon.src);
  assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
}
assert(
  manifest.icons.some((icon) => icon.purpose === 'maskable'),
  'Missing maskable icon',
);
const html = (await read('index.html')).toString();
const sw = (await read('sw.js')).toString();
assert(sw.includes(`${base}index.html`), 'Wrong service worker navigation fallback');
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert(url.startsWith(base), `Asset escapes the deployment base: ${url}`);
  const relative = url.slice(base.length);
  await read(relative);
  assert(sw.includes(relative), `Asset missing from offline cache: ${relative}`);
}
console.log(
  `PWA build verified: base=${base}, standalone manifest, icons, assets and offline precache.`,
);
