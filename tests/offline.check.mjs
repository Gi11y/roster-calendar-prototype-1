import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let online=false;const requests=[];
const handlers = {}; let stored; let pending; const deleted = [];
const html = readFileSync('dist/index.html','utf8');
const base = html.match(/src="([^"]*)assets\//)?.[1];
assert(base);
const root = 'https://example.github.io' + base;
const cache = { async addAll(urls) { stored = urls; }, async match(key) { return stored.includes(key) ? new Response('cached') : undefined; } };
vm.runInNewContext(readFileSync('dist/sw.js','utf8'), { URL, self: {location:{href:root+'sw.js'}, clients:{ async claim(){} }, addEventListener(name, fn) { handlers[name] = fn; }}, caches: {async open(){return cache;}, async keys(){return ['unrelated-app', 'roster-prototype1:/other/:old', 'roster-prototype1:' + base + ':old'];}, async delete(key){deleted.push(key);}}, fetch(request,options){requests.push({request,options});if(online)return Promise.resolve(new Response('fresh online HTML'));throw Error('Offline');} });
handlers.install({waitUntil(p){pending=p;}}); await pending;
assert(stored.includes(root+'index.html')); assert(stored.some(x=>x.endsWith('.js'))); assert(stored.some(x=>x.endsWith('.css')));
for (const url of stored) assert(existsSync('dist/'+url.slice(root.length)), url);
handlers.activate({waitUntil(p){pending=p;}}); await pending;
assert.deepEqual(deleted, ['roster-prototype1:' + base + ':old']);
let response;
handlers.fetch({request:{method:'GET',url:root,mode:'navigate'},respondWith(p){response=p;}});
assert.equal(await (await response).text(),'cached');
response=undefined;
handlers.fetch({request:{method:'GET',url:'https://www.googleapis.com/calendar/v3/calendars',mode:'cors'},respondWith(p){response=p;}});
assert.equal(response,undefined);
assert(html.includes(base + 'assets/'));
assert(!html.includes('src="https://accounts.google.com'));
console.log('PASS: complete precache, offline navigation, scoped cache cleanup, Google bypass, GitHub Pages asset base, lazy GIS.');

assert(stored.includes(root+'cards.html'));
assert(stored.includes(root+'google-test.html'));
assert(html.includes('Add your roster'));
assert(readFileSync('dist/google-test.html','utf8').includes('id="auth"'));
console.log('PASS: new upload landing and preserved Google test both precached.');

response=undefined;
handlers.fetch({request:{method:'GET',url:root+'cards.html?v=0.12',mode:'navigate'},respondWith(p){response=p;}});
assert.equal(await (await response).text(),'cached');
console.log('PASS: versioned review navigation works offline.');

assert(stored.includes(root+'baseline-cards.html'));
assert(readFileSync('index.html','utf8').includes('src="/src/new-reader.ts"'));
assert(readFileSync('cards.html','utf8').includes('src="/src/new-reader.ts"'));
assert(readFileSync('baseline-cards.html','utf8').includes('src="/src/cards.ts"'));
console.log('PASS: normal entry points select the promoted reader and baseline remains precached.');

online=true;response=undefined;
handlers.fetch({request:{method:'GET',url:root+'cards.html?v=0.17.2',mode:'navigate'},respondWith(p){response=p;}});
assert.equal(await(await response).text(),'fresh online HTML');
assert.equal(requests.at(-1).options.cache,'no-store');
online=false;response=undefined;
handlers.fetch({request:{method:'GET',url:root+'cards.html?v=0.17.2',mode:'navigate'},respondWith(p){response=p;}});
assert.equal(await(await response).text(),'cached');
assert(!stored.includes(root+'refresh.html'));assert(!stored.includes(root+'refresh.js'));
response=undefined;
handlers.fetch({request:{method:'GET',url:root+'refresh.html',mode:'navigate'},respondWith(p){response=p;}});
assert.equal(response,undefined);
console.log('PASS: online HTML bypasses stale caches, offline HTML retains its complete build, refresh tools bypass service worker.');

assert(stored.includes(root+'swap.html'));
assert(readFileSync('dist/swap.html','utf8').includes('Change a shift'));
assert(html.includes(base+'change.html'));assert(!/href="[^"]*[?&]v=/.test(html));
console.log('PASS: shift swap page and landing link are included in the offline build.');

assert(stored.includes(root+'change.html'));assert(stored.includes(root+'privacy.html'));assert(stored.includes(root+'install.html'));
const manifest=JSON.parse(readFileSync('dist/manifest.webmanifest','utf8'));
assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');
for(const icon of manifest.icons){const bytes=readFileSync('dist/'+icon.src);const [w,h]=icon.sizes.split('x').map(Number);assert.equal(bytes.readUInt32BE(16),w);assert.equal(bytes.readUInt32BE(20),h);assert(stored.includes(root+icon.src));}
console.log('PASS: clean shared links, change/privacy/install pages and installable manifest/icons are cached.');
