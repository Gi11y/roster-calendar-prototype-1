import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recoveryProbe,cleanupProbe} from '../src/recovery-probe.ts';
const id='a'.repeat(64);
function fake({restore='insert',failCleanup=false,alterRestored=false}={}){
 let event,posts=0,deletes=0;const calls=[];
 const api=async(path,token,method='GET',body,etag)=>{
  calls.push({path,method,etag});assert.equal(token,'token');
  if(method==='GET'){if(!event)throw{status:404};return structuredClone(event);}
  if(method==='POST'){
   posts++;if(posts===2&&restore==='fail')throw{status:503};
   if(posts===2&&restore==='patch')throw{status:409};
   event={...structuredClone(body),status:'confirmed',etag:'v'+posts};
   if(posts===2&&alterRestored)event.description='User edited';
   return structuredClone(event);
  }
  if(method==='DELETE'){
   assert.equal(etag,event.etag);deletes++;if(deletes===2&&failCleanup)throw{status:503};
   event={id,status:'cancelled',etag:'deleted'};return{};
  }
  if(method==='PATCH'){assert.equal(etag,'deleted');event={...structuredClone(body),id,etag:'patched'};return event;}
  throw Error(method);
 };
 return{api,calls,current:()=>event};
}
test('live-ID reinsertion strategy is verified and synthetic event is cleaned up',async()=>{
 const f=fake(),r=await recoveryProbe(f.api,'calendar','token',id);
 assert.equal(r.passed,true);assert.equal(r.strategy,'insert');assert.equal(r.cleanupRequired,false);assert.equal(f.current().status,'cancelled');
 assert.equal(f.calls.filter(c=>c.method==='DELETE').length,2);
});
test('409 uses a version-checked cancelled-event patch, verifies it, and cleans up',async()=>{
 const f=fake({restore:'patch'}),r=await recoveryProbe(f.api,'calendar','token',id);
 assert.equal(r.passed,true);assert.equal(r.strategy,'patch');assert.equal(f.calls.find(c=>c.method==='PATCH').etag,'deleted');
 assert.equal(f.current().status,'cancelled');
});
test('restore failure cannot produce PASS and still checks cleanup',async()=>{
 const f=fake({restore:'fail'}),r=await recoveryProbe(f.api,'calendar','token',id);
 assert.equal(r.passed,false);assert.equal(r.cleanupRequired,false);assert.equal(f.current().status,'cancelled');
});
test('cleanup failure is explicit and never reports a clean pass',async()=>{
 const f=fake({failCleanup:true}),r=await recoveryProbe(f.api,'calendar','token',id);
 assert.equal(r.passed,false);assert.equal(r.cleanupRequired,true);assert.match(r.detail,/Cleanup needs attention/);
});
test('an event edited during the probe is neither accepted nor deleted',async()=>{
 const f=fake({alterRestored:true}),r=await recoveryProbe(f.api,'calendar','token',id);
 assert.equal(r.passed,false);assert.equal(r.cleanupRequired,true);assert.equal(f.calls.filter(c=>c.method==='DELETE').length,1);
});
test('pre-existing IDs are not written or cleaned up; missing/previously deleted cleanup is safe',async()=>{
 const calls=[];const existing=async(path,token,method='GET')=>{calls.push(method);return{id,status:'confirmed'};};
 assert.equal((await recoveryProbe(existing,'cal','token',id)).passed,false);assert.deepEqual(calls,['GET']);
 for(const status of [404,410])await cleanupProbe(async()=>{throw{status};},'cal','token',id);
 await assert.rejects(()=>cleanupProbe(existing,'cal','token','bad'));
});
test('401 during creation never proceeds to restoration and reports any unfinished cleanup',async()=>{
 const calls=[];const api=async(path,token,method='GET')=>{calls.push(method);if(calls.length===1)throw{status:404};throw{status:401};};
 const r=await recoveryProbe(api,'cal','token',id);assert.equal(r.passed,false);assert.equal(r.cleanupRequired,true);assert.deepEqual(calls,['GET','POST','GET']);
});
