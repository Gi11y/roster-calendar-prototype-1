import { defineConfig, type Plugin } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
function offlineShell(): Plugin {
 return { name: 'offline-shell', generateBundle(_, bundle) {
  function publicFiles(dir: string, prefix = ''): string[] { return readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? publicFiles(`${dir}/${e.name}`, `${prefix}${e.name}/`) : [`${prefix}${e.name}`]); }
  const statics = publicFiles('public');
  const files = [...new Set(['index.html', 'ocr.html', 'cards.html', 'build-info.json', ...Object.keys(bundle), ...statics])];
  const digest = createHash('sha256').update(statics.map(f => readFileSync(`public/${f}`).toString('base64')).join('')).update(Object.values(bundle).map(x => x.type === 'chunk' ? x.code : String(x.source)).join('')).digest('hex').slice(0,16);
  this.emitFile({type:'asset',fileName:'build-info.json',source:JSON.stringify({version:digest})});
  this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const ROOT = new URL('./', self.location.href);
const PREFIX = 'roster-prototype1:' + ROOT.pathname + ':';
const CACHE = PREFIX + '${digest}';
const SHELL = ${JSON.stringify(files)}.map(f => new URL(f, ROOT).href);
self.addEventListener('message', event => { if(event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage('${digest}'); });
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
 const req = event.request;
 if (req.method !== 'GET' || new URL(req.url).origin !== ROOT.origin) return;
 const key = req.mode === 'navigate' && new URL(req.url).pathname === ROOT.pathname ? new URL('index.html', ROOT).href : req.url;
 if (!SHELL.includes(key)) return;
 event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(req)));
});` });
 }};
}
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
export default defineConfig({ base: repo && !repo.endsWith('.github.io') ? `/${repo}/` : '/', plugins: [offlineShell()], build:{rollupOptions:{input:{main:resolve('index.html'),ocr:resolve('ocr.html'),cards:resolve('cards.html')}}}, server: { port: 5173, strictPort: true } });
