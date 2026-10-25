import{test}from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{readFileSync}from'node:fs';
const source=readFileSync('public/refresh.js','utf8');
function setup(fail=false){
 let click,redirect;const removed=[],unregistered=[],button={disabled:false,addEventListener(name,fn){assert.equal(name,'click');click=fn;}},status={textContent:''},scope='https://example.github.io/roster-calendar-prototype-1/';
 const context={URL,Date,Error,document:{getElementById(id){return id==='refresh'?button:status;}},location:{href:scope+'refresh.html',replace(url){redirect=url;}},window:{caches:true},navigator:{serviceWorker:{async getRegistrations(){if(fail)throw Error('Unavailable');return[{scope,async unregister(){unregistered.push(scope);}},{scope:'https://example.github.io/other/',async unregister(){unregistered.push('other');}}];}}},caches:{async keys(){return['roster-prototype1:/roster-calendar-prototype-1/:old','roster-prototype1:/other/:old','unrelated'];},async delete(key){removed.push(key);return true;}}};
 Object.defineProperty(context,'indexedDB',{get(){throw Error('Saved calendar settings must not be touched');}});
 vm.runInNewContext(source,context);return{click:()=>click(),button,status,removed,unregistered,redirect:()=>redirect,scope};
}
test('refresh changes only this app worker/cache and preserves stored calendar settings',async()=>{
 const s=setup();assert.equal(s.redirect(),undefined);assert.deepEqual(s.removed,[]);await s.click();
 assert.deepEqual(s.unregistered,[s.scope]);assert.deepEqual(s.removed,['roster-prototype1:/roster-calendar-prototype-1/:old']);
 const url=new URL(s.redirect());assert.equal(url.pathname,'/roster-calendar-prototype-1/cards.html');assert.equal(url.searchParams.get('v'),'0.21');assert(url.searchParams.get('refresh'));assert.equal(s.button.disabled,true);
});
test('a failed refresh stays on the recovery page with a retryable error',async()=>{
 const s=setup(true);await s.click();assert.equal(s.redirect(),undefined);assert.equal(s.button.disabled,false);assert.match(s.status.textContent,/Could not refresh/);assert.deepEqual(s.removed,[]);
});
