import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = [];
async function walk(dir) {
  for (const entry of await readdir(`dist/${dir}`, { withFileTypes: true })) {
    const name = `${dir}${entry.name}`;
    if (entry.isDirectory()) await walk(`${name}/`);
    else if (!name.endsWith('.map') && name !== 'sw.js') files.push(name);
  }
}
await walk('');
files.sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(`dist/${file}`));
const version = hash.digest('hex').slice(0, 16);
const digests = Object.fromEntries(await Promise.all(files.map(async file => [new URL(file, 'https://placeholder/').pathname.slice(1), createHash('sha256').update(await readFile('dist/' + file)).digest('hex')])));
await writeFile('dist/sw.js', `
const ROOT = new URL('./', self.location.href);
const PREFIX = 'coffee-match-' + ROOT.pathname + '-';
const CACHE = PREFIX + '${version}';
const DIGESTS = ${JSON.stringify(digests)};
const FILES = ${JSON.stringify(files)}.map(file => new URL(file, ROOT).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await Promise.all(FILES.map(async url => {
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok) throw new Error('Precache HTTP error');
      const bytes = await response.clone().arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
      if (digest !== DIGESTS[url.slice(ROOT.href.length)]) throw new Error('Build mismatch');
      await cache.put(url, response);
    }));
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const key = event.request.mode === 'navigate' ? new URL('index.html', ROOT).href : event.request;
    return (await cache.match(key)) || fetch(event.request);
  }));
});
`);
console.log(`Offline cache: ${files.length} files, version ${version}`);
