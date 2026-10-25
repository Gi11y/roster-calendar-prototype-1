import {defineConfig,type Plugin} from 'vite';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
function offlineShell():Plugin{
 return{name:'offline-shell',writeBundle(options){
  const dir=String(options.dir||'dist');
  function files(folder:string,prefix=''):string[]{return readdirSync(folder,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(folder+'/'+e.name,prefix+e.name+'/'):[prefix+e.name]);}
  // Read the final files: Vite can merge/remove identical HTML entry chunks after generateBundle.
  const final=files(dir).filter(f=>f!=='sw.js'&&f!=='build-info.json').sort();
  const digest=createHash('sha256').update(final.map(f=>f+'\n'+readFileSync(dir+'/'+f).toString('base64')).join('\n')).digest('hex').slice(0,16);
  writeFileSync(dir+'/build-info.json',JSON.stringify({version:digest}));
  const shell=[...final,'build-info.json'];
  writeFileSync(dir+'/sw.js',`
const ROOT = new URL('./', self.location.href);
const PREFIX = 'roster-prototype1:' + ROOT.pathname + ':';
const CACHE = PREFIX + '${digest}';
const SHELL = ${JSON.stringify(shell)}.map(f => new URL(f, ROOT).href);
self.addEventListener('message', event => { if(event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage('${digest}'); });
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
 const req = event.request, url = new URL(req.url);
 if(req.method !== 'GET' || url.origin !== ROOT.origin) return;
 const key = req.mode === 'navigate' ? new URL(url.pathname === ROOT.pathname ? 'index.html' : url.pathname, ROOT).href : req.url;
 if(!SHELL.includes(key)) return;
 event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(req)));
});`);
 }};
}
const repo=process.env.GITHUB_REPOSITORY?.split('/')[1];
export default defineConfig({base:repo&&!repo.endsWith('.github.io')?'/'+repo+'/':'/',plugins:[offlineShell()],build:{rollupOptions:{input:{main:resolve('index.html'),ocr:resolve('ocr.html'),cards:resolve('cards.html'),googleTest:resolve('google-test.html'),baseline:resolve('baseline-cards.html'),experimental:resolve('experimental-cards.html'),comparison:resolve('recognition-comparison.html'),calendarDesign:resolve('calendar-design-preview.html')}}},server:{port:5173,strictPort:true}});
