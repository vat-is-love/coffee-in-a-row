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
await writeFile('dist/sw.js', `
const ROOT = new URL('./', self.location.href);
const PREFIX = 'coffee-match-' + ROOT.pathname + '-';
const CACHE = PREFIX + '${version}';
const FILES = ${JSON.stringify(files)}.map(file => new URL(file, ROOT).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
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
