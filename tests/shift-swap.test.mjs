import{test}from'node:test';import assert from'node:assert/strict';
import{prepareEvents}from'../src/approved-events.ts';import{prepareSwap,applySwap,listSwapShifts,SwapRecoveryRequired}from'../src/shift-swap.ts';
const cal='roster@group.calendar.google.com',token='memory';
const shift=(date='2030-01-14',label='A',start='07:00',end='15:00',nextDay=false)=>({cardId:1,date,label,start,end,nextDay,role:'Floor staff',reviewed:true,order:0});
const replacement=()=>shift('2030-01-15','P','13:30','21:30');
async function initial(){return{...(await prepareEvents([shift()]))[0].event,status:'confirmed',etag:'v1'};}
function server(events){
 const state=new Map(events.map(e=>[e.id,structuredClone(e)])),calls=[];let hook=()=>{},version=1;
 const api=async(path,t,method='GET',body,etag)=>{
  assert.equal(t,token);calls.push({path,method,body:structuredClone(body),etag});await hook({path,method,body,etag,state,calls});
  if(path==='/calendars/'+encodeURIComponent(cal))return{id:cal,summary:'Roster'};
  if(path.endsWith('/events?maxResults=1'))return{items:[]};
  if(path.includes('?'))return{items:[...state.values()].filter(e=>e.status!=='cancelled')};
  const id=decodeURIComponent(path.split('/').at(-1));
  if(method==='GET'){if(!state.has(id))throw{status:404};return structuredClone(state.get(id));}
  if(method==='POST'){if(state.has(body.id))throw{status:409};const value={...structuredClone(body),etag:'v'+(++version),status:'confirmed'};state.set(value.id,value);return value;}
  if(method==='PATCH'){const before=state.get(id);if(!before)throw{status:404};if(before.etag!==etag)throw{status:412};const value={...before,...structuredClone(body),etag:'v'+(++version)};state.set(id,value);return value;}
  if(method==='DELETE'){const before=state.get(id);if(!before)throw{status:404};if(before.etag!==etag)throw{status:412};state.set(id,{id,status:'cancelled',etag:'d'+(++version)});return{};}
  throw Error('Unexpected request');
 };
 return{api,state,calls,hook(fn){hook=fn;},writes(){return calls.filter(c=>c.method!=='GET');}};
}
test('swap listing contains only simple managed stable IDs, with no writes',async()=>{
 const original=await initial(),s=server([original,{...original,id:'unrelated',extendedProperties:{}},{...original,id:'other',attendees:[{}]},{...original,id:'locked',locked:true}]);
 const found=await listSwapShifts(s.api,cal,token,'2030-01-01','2030-01-31');assert.deepEqual(found.map(e=>e.id),[original.id]);assert.equal(s.writes().length,0);
});
test('reviewing a manual replacement is read-only and validates date and Sydney clocks',async()=>{
 const original=await initial(),s=server([original]),plan=await prepareSwap(s.api,cal,token,original,replacement());
 assert.equal(plan.kind,'replace');assert.notEqual(plan.after.id,original.id);assert.equal(s.writes().length,0);
 await assert.rejects(prepareSwap(s.api,cal,token,original,{...replacement(),date:'2030-02-30'}));
 await assert.rejects(prepareSwap(s.api,cal,token,original,shift('2026-10-04','A','02:30','10:30')));
});
test('replacement is verified before conditional removal; repeating the plan adds no duplicate',async()=>{
 const original=await initial(),s=server([original]),plan=await prepareSwap(s.api,cal,token,original,replacement());
 const result=await applySwap(s.api,token,plan);assert.equal(result.complete,true);assert.equal(result.replacementSaved,true);assert.equal(result.originalRemoved,true);
 assert.deepEqual(s.writes().map(c=>c.method),['POST','DELETE']);assert.equal(s.writes()[1].etag,'v1');assert.equal(s.state.get(original.id).status,'cancelled');assert.equal(s.state.get(plan.after.id).status,'confirmed');
 const again=await applySwap(s.api,token,plan);assert.equal(again.complete,true);assert.equal(s.writes().length,2);
});
test('remove-only deletes exactly the chosen shift and does not add an event',async()=>{
 const original=await initial(),extra=(await prepareEvents([replacement()]))[0].event,s=server([original,{...extra,etag:'other'}]),plan=await prepareSwap(s.api,cal,token,original);
 const result=await applySwap(s.api,token,plan);assert.equal(result.complete,true);assert.equal(result.replacementSaved,false);assert.deepEqual(s.writes().map(c=>c.method),['DELETE']);assert(s.state.has(extra.id));
});
test('same-date/type changes update one event, preserving a nonzero ordinal',async()=>{
 const prepared=await prepareEvents([{...shift(),cardId:1},{...shift(),cardId:2,order:1}]),original={...prepared[1].event,etag:'v1',status:'confirmed'},s=server([original]);
 const plan=await prepareSwap(s.api,cal,token,original,shift('2030-01-14','A','08:00','16:00'));assert.equal(plan.kind,'update');assert.equal(plan.after.id,original.id);assert.equal(plan.after.extendedProperties.private.rosterOrdinal,'1');
 const result=await applySwap(s.api,token,plan);assert.equal(result.complete,true);assert.deepEqual(s.writes().map(c=>c.method),['PATCH']);assert.equal(s.state.size,1);
});
test('stale originals and target collisions are never overwritten',async()=>{
 const original=await initial(),s=server([original]);s.state.get(original.id).etag='changed';await assert.rejects(prepareSwap(s.api,cal,token,original,replacement()),/changed/);assert.equal(s.writes().length,0);
 const t=server([original]),plan=await prepareSwap(t.api,cal,token,original,replacement());t.state.set(plan.after.id,{...plan.after,etag:'foreign',extendedProperties:{}});
 const result=await applySwap(t.api,token,plan);assert.equal(result.complete,false);assert.equal(t.writes().length,0);assert.equal(t.state.get(original.id).status,'confirmed');
});
test('a failed replacement save keeps the original',async()=>{
 const original=await initial(),s=server([original]),plan=await prepareSwap(s.api,cal,token,original,replacement());s.hook(({method})=>{if(method==='POST')throw Error('Offline');});
 const result=await applySwap(s.api,token,plan);assert.equal(result.complete,false);assert.equal(s.state.get(original.id).status,'confirmed');assert(s.writes().every(c=>c.method!=='DELETE'));
});
test('lost insertion response is safely retried with the same ID, without deleting before verification',async()=>{
 const original=await initial(),s=server([original]),plan=await prepareSwap(s.api,cal,token,original,replacement());s.hook(({method,body,state})=>{if(method==='POST'){state.set(body.id,{...body,etag:'saved',status:'confirmed'});throw Error('Lost response');}});
 const interrupted=await applySwap(s.api,token,plan);assert.equal(interrupted.complete,false);assert.equal(s.state.get(original.id).status,'confirmed');
 s.hook(()=>{});const retried=await applySwap(s.api,token,plan);assert.equal(retried.complete,true);assert.equal(s.writes().filter(c=>c.method==='POST').length,1);
});
test('partial swaps can be reviewed again without duplicating their saved replacement',async()=>{
 const original=await initial(),s=server([original]),plan=await prepareSwap(s.api,cal,token,original,replacement());s.hook(({method})=>{if(method==='DELETE')throw Error('Connection lost');});
 const interrupted=await applySwap(s.api,token,plan);assert.equal(interrupted.complete,false);assert.equal(interrupted.replacementSaved,true);assert.equal(s.state.get(original.id).status,'confirmed');
 s.hook(()=>{});const renewed=await prepareSwap(s.api,cal,token,original,replacement());assert.equal(renewed.after.id,plan.after.id);const result=await applySwap(s.api,token,renewed);assert.equal(result.complete,true);assert.equal(s.writes().filter(c=>c.method==='POST').length,1);
});
test('deleted replacement IDs require same-calendar recovery proof and a reviewed version',async()=>{
 const original=await initial(),s=server([original]),draft=await prepareSwap(s.api,cal,token,original,replacement());s.state.set(draft.after.id,{id:draft.after.id,status:'cancelled',etag:'d1'});
 await assert.rejects(prepareSwap(s.api,cal,token,original,replacement()),SwapRecoveryRequired);
 const proof={calendarId:cal,strategy:'patch'},plan=await prepareSwap(s.api,cal,token,original,replacement(),null,proof);
 const missing=await applySwap(s.api,token,plan);assert.equal(missing.complete,false);assert.equal(s.writes().length,0);
 const result=await applySwap(s.api,token,plan,undefined,undefined,proof);assert.equal(result.complete,true);assert.deepEqual(s.writes().map(c=>c.method),['PATCH','DELETE']);
});
test('an intervening old-event edit after replacement save stops removal',async()=>{
 const original=await initial(),s=server([original]),plan=await prepareSwap(s.api,cal,token,original,replacement());s.hook(({method,state})=>{if(method==='POST')state.get(original.id).etag='changed';});
 const result=await applySwap(s.api,token,plan);assert.equal(result.complete,false);assert.equal(result.replacementSaved,true);assert.equal(s.state.get(original.id).status,'confirmed');assert(s.writes().every(c=>c.method!=='DELETE'));
});
test('connection invalidation prevents subsequent writes',async()=>{
 const original=await initial(),s=server([original]),plan=await prepareSwap(s.api,cal,token,original,replacement());let current=true;s.hook(({method})=>{if(method==='POST')current=false;});
 const result=await applySwap(s.api,token,plan,()=>{if(!current)throw Error('Account changed');});assert.equal(result.complete,false);assert(s.writes().every(c=>c.method!=='DELETE'));
});

import{prepareExtraShift,applyExtraShift}from'../src/shift-swap.ts';
test('an extra shift is reviewed without writes and added once after confirmation',async()=>{
 const s=server([]),plan=await prepareExtraShift(s.api,cal,token,replacement());assert.equal(s.writes().length,0);
 const first=await applyExtraShift(s.api,token,plan);assert.equal(first.complete,true);assert.equal(first.originalRemoved,false);assert.deepEqual(s.writes().map(c=>c.method),['POST']);
 const again=await applyExtraShift(s.api,token,plan);assert.equal(again.complete,true);assert.equal(s.writes().length,1);
});
test('extra shifts never overwrite an occupied date/type or delete another shift',async()=>{
 const original=await initial(),s=server([original]);await assert.rejects(prepareExtraShift(s.api,cal,token,shift('2030-01-14','A','08:00','16:00')),/already uses/);assert.equal(s.writes().length,0);
});
test('extra-shift retries resolve a lost response without duplicating the event',async()=>{
 const s=server([]),plan=await prepareExtraShift(s.api,cal,token,replacement());s.hook(({method,body,state})=>{if(method==='POST'){state.set(body.id,{...body,etag:'saved',status:'confirmed'});throw Error('Lost response');}});
 assert.equal((await applyExtraShift(s.api,token,plan)).complete,false);s.hook(()=>{});assert.equal((await applyExtraShift(s.api,token,plan)).complete,true);assert.equal(s.writes().filter(c=>c.method==='POST').length,1);
});
test('a removed extra-shift ID stays gated by recovery proof',async()=>{
 const s=server([]),plan=await prepareExtraShift(s.api,cal,token,replacement());s.state.set(plan.after.id,{id:plan.after.id,status:'cancelled',etag:'d1'});
 await assert.rejects(prepareExtraShift(s.api,cal,token,replacement()),SwapRecoveryRequired);assert.equal(s.writes().length,0);
});
