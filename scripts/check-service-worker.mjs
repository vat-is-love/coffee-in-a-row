// Execute the generated production worker without a network server.
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
const source = await readFile('dist/sw.js', 'utf8');
const entries = new Map();
const deleted = [];
let offline = false, mismatch = false, claimed = false;
const handlers = {};
const cache = {
  put: async (url, response) => entries.set(url, response),
  match: async key => entries.get(typeof key === 'string' ? key : key.url)?.clone()
};
vm.runInNewContext(source, {
  URL, Request, Uint8Array, crypto: webcrypto,
  self: { location: { href: 'https://game.test/coffee/sw.js' }, clients: { claim: async () => { claimed = true; } }, addEventListener: (kind, fn) => { handlers[kind] = fn; } },
  caches: { open: async () => cache, keys: async () => ['coffee-match-/coffee/-old', 'other-app'], delete: async key => { deleted.push(key); } },
  fetch: async request => {
    if (offline) throw Error('offline');
    if (mismatch) return new Response('wrong build');
    return new Response(await readFile('dist/' + new URL(request.url).pathname.replace('/coffee/', '')));
  }
});
async function install() { let pending; handlers.install({ waitUntil: p => { pending = p; } }); await pending; }
await install();
assert(entries.size > 0);
offline = true;
let response;
handlers.fetch({ request: { method: 'GET', url: 'https://game.test/coffee/', mode: 'navigate' }, respondWith: p => { response = p; } });
assert.match(await (await response).text(), /Coffee Match/);
let activation;
handlers.activate({ waitUntil: p => { activation = p; } }); await activation;
assert.deepEqual(deleted, ['coffee-match-/coffee/-old']);
assert(claimed);
await assert.rejects(install(), /offline/);
offline = false; mismatch = true;
await assert.rejects(install(), /Build mismatch/);
console.log('PASS: atomic install, offline navigation, previous cache cleanup, unrelated cache preservation, mismatched release rejected');
