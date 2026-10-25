import{test}from'node:test';import assert from'node:assert/strict';
import{prepareEvents}from'../src/approved-events.ts';import{planComparison}from'../src/calendar-compare.ts';import{applyCalendarChanges,applyEligibility}from'../src/calendar-apply.ts';
const calendar='test@group.calendar.google.com',token='memory-only';
const shift=(cardId,date,start='07:00',end='15:00')=>({cardId,date,label:'A',role:'Educator',start,end,nextDay:false,reviewed:true,order:cardId});
const desired=async(count=1)=>(await prepareEvents(Array.from({length:count},(_,i)=>shift(i+1,'2026-11-'+String(4+i).padStart(2,'0'))))).map(p=>p.event);
const live=e=>({...structuredClone(e),etag:'v1',status:'confirmed'});
function server(initial=[]){
 const state=new Map(initial.map(e=>[e.id,structuredClone(e)])),calls=[];let hook=()=>{},version=1;
 const api=async(path,t,method='GET',body,etag)=>{
  assert.equal(t,token);calls.push({path,method,body:structuredClone(body),etag});await hook({path,method,body,etag,state,calls});
  if(path==='/calendars/'+encodeURIComponent(calendar))return{id:calendar,summary:'Roster'};
  if(path.endsWith('/events?maxResults=1'))return{items:[]};
  const id=path.split('/').at(-1);
  if(method==='GET'){if(!state.has(id))throw{status:404};return structuredClone(state.get(id));}
  if(method==='POST'){if(state.has(body.id))throw{status:409};const created={...structuredClone(body),etag:'v'+(++version),status:'confirmed'};state.set(body.id,created);return structuredClone(created);}
  if(method==='PATCH'){const current=state.get(id);if(!current)throw{status:404};assert.equal(etag,current.etag);const updated={...current,...structuredClone(body),etag:'v'+(++version)};state.set(id,updated);return structuredClone(updated);}
  if(method==='DELETE'){const current=state.get(id);assert.equal(etag,current.etag);state.set(id,{id,status:'cancelled',etag:'v'+(++version)});return{};}
  throw Error('Unexpected method '+method);
 };
 return{api,state,calls,setHook(fn){hook=fn;},writes(){return calls.filter(c=>c.method!=='GET');}};
}
test('inserts approved shifts with their stable IDs and verifies the destination and saved fields',async()=>{
 const events=await desired(),s=server(),plan=planComparison(events,[]),progress=[];
 const result=await applyCalendarChanges(s.api,calendar,token,plan,()=>{},(n,total)=>progress.push([n,total]));
 assert.equal(result.complete,true);assert.equal(result.items[0].kind,'created');assert.equal(s.writes().length,1);assert.equal(s.writes()[0].body.id,events[0].id);assert.deepEqual(progress,[[1,1]]);
 assert.equal(s.calls[0].path,'/calendars/'+encodeURIComponent(calendar));assert(s.calls[1].path.endsWith('/events?maxResults=1'));
});
test('repeating the same apply after success skips the deterministic ID instead of duplicating',async()=>{
 const events=await desired(),s=server(),plan=planComparison(events,[]);
 await applyCalendarChanges(s.api,calendar,token,plan);const result=await applyCalendarChanges(s.api,calendar,token,plan);
 assert.equal(result.items[0].kind,'unchanged');assert.equal(s.writes().length,1);assert.equal(s.state.size,1);
});
test('updates use the reviewed version tag and preserve unrelated private metadata',async()=>{
 const [after]=await desired(),before=live({...after,end:{dateTime:'2026-11-04T14:00:00+11:00',timeZone:'Australia/Sydney'}});before.extendedProperties.private.otherSetting='keep';
 const s=server([before]),plan=planComparison([after],[before]),result=await applyCalendarChanges(s.api,calendar,token,plan);
 assert.equal(result.items[0].kind,'updated');assert.equal(s.writes()[0].method,'PATCH');assert.equal(s.writes()[0].etag,'v1');assert.equal(s.writes()[0].body.id,undefined);assert.equal(s.state.get(after.id).extendedProperties.private.otherSetting,'keep');
});
test('all targets are preflighted before any write; a late changed target prevents the batch',async()=>{
 const events=await desired(2),before=events.map(e=>live({...e,summary:'Old title'})),s=server(before);
 const plan=planComparison(events,before);s.state.get(events[1].id).etag='newer';
 await assert.rejects(applyCalendarChanges(s.api,calendar,token,plan),/changed since/);assert.equal(s.writes().length,0);
});
test('foreign IDs, deleted IDs, missing version tags and changed identity metadata cannot be patched',async()=>{
 const [after]=await desired();
 for(const extra of [{extendedProperties:{}},{status:'cancelled'},{etag:undefined},{extendedProperties:{private:{...after.extendedProperties.private,rosterDate:'2026-11-05'}}},{attendees:[{email:'guest@example.com'}]},{eventType:'outOfOffice'},{locked:true}]){
  const before={...live({...after,summary:'Old'}),...extra},s=server([before]),plan=[{kind:'changed',id:after.id,before,after,reason:''}];
  await assert.rejects(applyCalendarChanges(s.api,calendar,token,plan));assert.equal(s.writes().length,0);
 }
});
test('409 from concurrent identical insertion is verified and skipped, never randomly re-IDed',async()=>{
 const [after]=await desired(),s=server();s.setHook(({method,state})=>{if(method==='POST')state.set(after.id,live(after));});
 const result=await applyCalendarChanges(s.api,calendar,token,planComparison([after],[]));
 assert.equal(result.complete,true);assert.equal(result.items[0].kind,'unchanged');assert.equal(s.writes().length,1);assert.equal(s.state.size,1);
});
test('409 collision with different content stops without patching',async()=>{
 const [after]=await desired(),s=server();s.setHook(({method,state})=>{if(method==='POST')state.set(after.id,live({...after,summary:'Someone changed this'}));});
 const result=await applyCalendarChanges(s.api,calendar,token,planComparison([after],[]));
 assert.equal(result.complete,false);assert.equal(result.items[0].kind,'failed');assert.equal(s.writes().length,1);
});
test('conditional update rejection stops sequential writes and reports unattempted shifts',async()=>{
 const events=await desired(2),before=events.map(e=>live({...e,summary:'Old'})),s=server(before);s.setHook(({method})=>{if(method==='PATCH')throw{status:412};});
 const result=await applyCalendarChanges(s.api,calendar,token,planComparison(events,before));
 assert.equal(result.complete,false);assert.deepEqual(result.items.map(i=>i.kind),['failed','not-attempted']);assert.match(result.items[0].detail,/changed in Google/);assert.equal(s.writes().length,1);
});
test('lost insert response is reported as uncertain; a later comparison finds the saved shift',async()=>{
 const events=await desired(2),s=server();s.setHook(({method,body,state})=>{if(method==='POST'){state.set(body.id,live(body));throw Error('Network response lost');}});
 const result=await applyCalendarChanges(s.api,calendar,token,planComparison(events,[]));
 assert.equal(result.complete,false);assert.match(result.items[0].detail,/may have reached Google/);assert.equal(result.items[1].kind,'not-attempted');
 assert.equal(planComparison(events,[...s.state.values()])[0].kind,'unchanged');assert.equal(s.writes().length,1);
});
test('connection/review invalidation stops further writes even after a response succeeds',async()=>{
 const events=await desired(2),s=server();let current=true;s.setHook(({method})=>{if(method==='POST')current=false;});
 const result=await applyCalendarChanges(s.api,calendar,token,planComparison(events,[]),()=>{if(!current)throw Error('Connection changed');});
 assert.equal(result.complete,false);assert.equal(s.writes().length,1);assert.equal(result.items[1].kind,'not-attempted');
});
test('removals and restorations require their specific approval gates',async()=>{
 assert.equal(applyEligibility([{kind:'restore'}]).count,1);assert.match(applyEligibility([{kind:'restore'}]).reason,/recovery check/);
 assert.match(applyEligibility([{kind:'new'},{kind:'conflict'}]).reason,/Resolve/);
 const [after]=await desired(),s=server();await assert.rejects(applyCalendarChanges(s.api,calendar,token,[...planComparison([after],[]),{kind:'removed',id:'other',before:live(after),reason:''}]),/full roster/);assert.equal(s.writes().length,0);
});
test('bad event identity, duplicate plan IDs or unverified destination stop without writes',async()=>{
 const [after]=await desired(),s=server(),bad={...after,id:'invalid'};
 await assert.rejects(applyCalendarChanges(s.api,calendar,token,[{kind:'new',id:'invalid',after:bad,reason:''}]),/identity/);
 const plan=planComparison([after],[]);await assert.rejects(applyCalendarChanges(s.api,calendar,token,[...plan,...plan]),/Duplicate/);
 await assert.rejects(applyCalendarChanges(s.api,'primary',token,plan));assert.equal(s.writes().length,0);
});
test('permission and expiry errors stop before the first write',async()=>{
 const [after]=await desired();for(const status of [401,403]){const s=server();s.setHook(()=>{throw{status};});await assert.rejects(applyCalendarChanges(s.api,calendar,token,planComparison([after],[])));assert.equal(s.writes().length,0);}
});

test('turning a reminder off clears the previous overrides explicitly',async()=>{
 const [after]=await desired(),before=live({...after,reminders:{useDefault:false,overrides:[{method:'popup',minutes:30}]}}),s=server([before]);
 await applyCalendarChanges(s.api,calendar,token,planComparison([after],[before]));
 assert.deepEqual(s.writes()[0].body.reminders,{useDefault:false,overrides:[]});
});

const coverage={start:'2026-11-01',end:'2026-11-30',confirmed:true};
const removeOptions={coverage,removalsConfirmed:true};
const recovery=strategy=>({recovery:{calendarId:calendar,strategy}});
test('removes only a reviewed managed shift in confirmed coverage, with If-Match and deletion verification',async()=>{
 const events=await desired(2),before=events.map(live),s=server(before),plan=planComparison([events[0]],before,coverage);
 const result=await applyCalendarChanges(s.api,calendar,token,plan,undefined,undefined,removeOptions);
 assert.equal(result.complete,true);assert.equal(result.items.find(i=>i.id===events[1].id).kind,'removed');
 assert.equal(s.writes().length,1);assert.equal(s.writes()[0].method,'DELETE');assert.equal(s.writes()[0].etag,'v1');assert.equal(s.state.get(events[1].id).status,'cancelled');
});
test('removal needs both complete coverage and explicit removal confirmation',async()=>{
 const events=await desired(2),before=events.map(live),plan=planComparison([events[0]],before,coverage);
 for(const options of [{},{coverage},{coverage:{...coverage,confirmed:false},removalsConfirmed:true}]){const s=server(before);await assert.rejects(applyCalendarChanges(s.api,calendar,token,plan,undefined,undefined,options));assert.equal(s.writes().length,0);}
});
test('changed, boundary-moved, foreign, guest, recurring, locked and identity-invalid removal targets are protected',async()=>{
 const events=await desired(2),before=events.map(live),plan=planComparison([events[0]],before,coverage);
 for(const patch of [{etag:'v2'},{start:{dateTime:'2026-12-01T07:00:00+11:00'}},{extendedProperties:{}},{attendees:[{}]},{recurrence:['RRULE:FREQ=DAILY']},{locked:true},{eventType:'outOfOffice'},{extendedProperties:{private:{...events[1].extendedProperties.private,rosterType:'P'}}}]){
  const s=server(before);Object.assign(s.state.get(events[1].id),patch);await assert.rejects(applyCalendarChanges(s.api,calendar,token,plan,undefined,undefined,removeOptions));assert.equal(s.writes().length,0);
 }
});
test('a failed addition stops the batch before any removal',async()=>{
 const events=await desired(3),before=[live(events[0]),live(events[2])],plan=planComparison(events.slice(0,2),before,coverage),s=server(before);s.setHook(({method})=>{if(method==='POST')throw Error('Offline');});
 const result=await applyCalendarChanges(s.api,calendar,token,plan,undefined,undefined,removeOptions);
 assert.equal(result.complete,false);assert.equal(s.writes().length,1);assert.equal(s.writes()[0].method,'POST');assert.notEqual(s.state.get(events[2].id).status,'cancelled');
});
test('already removed targets skip safely; a lost deletion response is not reported as success',async()=>{
 const events=await desired(2),before=events.map(live),plan=planComparison([events[0]],before,coverage),s=server(before);s.state.delete(events[1].id);
 const result=await applyCalendarChanges(s.api,calendar,token,plan,undefined,undefined,removeOptions);assert.equal(result.complete,true);assert.equal(s.writes().length,0);
 const lost=server(before);lost.setHook(({method,state})=>{if(method==='DELETE'){state.delete(events[1].id);throw Error('Lost response');}});
 const interrupted=await applyCalendarChanges(lost.api,calendar,token,plan,undefined,undefined,removeOptions);assert.equal(interrupted.complete,false);assert.match(interrupted.items.find(i=>i.kind==='failed').detail,/may have reached Google/);
});
test('restores cancelled stable IDs using the patch strategy validated for the same calendar',async()=>{
 const [after]=await desired(),tombstone={id:after.id,status:'cancelled',etag:'deleted-v1'},s=server([tombstone]),plan=planComparison([after],[tombstone]);
 const result=await applyCalendarChanges(s.api,calendar,token,plan,undefined,undefined,recovery('patch'));
 assert.equal(result.complete,true);assert.equal(result.items[0].kind,'restored');assert.equal(s.writes()[0].method,'PATCH');assert.equal(s.writes()[0].etag,'deleted-v1');assert.equal(s.writes()[0].body.status,'confirmed');assert.equal(s.state.size,1);
 const repeated=await applyCalendarChanges(s.api,calendar,token,plan,undefined,undefined,recovery('patch'));assert.equal(repeated.items[0].kind,'unchanged');assert.equal(s.writes().length,1);
});
test('insert recovery keeps the same ID and never invents a replacement on 409',async()=>{
 const [after]=await desired(),tombstone={id:after.id,status:'cancelled'},plan=planComparison([after],[tombstone]),s=server([tombstone]);s.setHook(({method,state})=>{if(method==='POST')state.delete(after.id);});
 const result=await applyCalendarChanges(s.api,calendar,token,plan,undefined,undefined,recovery('insert'));assert.equal(result.complete,true);assert.equal(s.writes()[0].body.id,after.id);assert.equal(s.state.size,1);
 const collision=server([tombstone]);const failed=await applyCalendarChanges(collision.api,calendar,token,plan,undefined,undefined,recovery('insert'));assert.equal(failed.complete,false);assert.equal(collision.writes().length,1);assert.equal(collision.writes()[0].method,'POST');
});
test('recovery without passed proof, for another calendar, stale versions or conflicting metadata makes no writes',async()=>{
 const [after]=await desired(),tombstone={id:after.id,status:'cancelled',etag:'d1'},plan=planComparison([after],[tombstone]);
 for(const options of [{},{recovery:{calendarId:'other',strategy:'patch'}}]){const s=server([tombstone]);await assert.rejects(applyCalendarChanges(s.api,calendar,token,plan,undefined,undefined,options));assert.equal(s.writes().length,0);}
 for(const patch of [{etag:undefined},{etag:'d2'},{attendees:[{}]},{extendedProperties:{private:{rosterImporter:'other'}}}]){
  const s=server([{...tombstone,...patch}]);await assert.rejects(applyCalendarChanges(s.api,calendar,token,plan,undefined,undefined,recovery('patch')));assert.equal(s.writes().length,0);
 }
});

test('save progress covers preflight and advances only after saved fields are verified',async()=>{
 const events=await desired(2),s=server(),updates=[];
 s.setHook(({method})=>{if(method==='POST'){const last=updates.at(-1);assert.equal(last.phase,'saving');assert.equal(last.completed,s.writes().length-1);}});
 const result=await applyCalendarChanges(s.api,calendar,token,planComparison(events,[]),undefined,undefined,{},p=>updates.push({...p}));
 assert.equal(result.complete,true);assert.deepEqual(updates,[{phase:'validating',completed:0,total:2},{phase:'validating',completed:1,total:2},{phase:'validating',completed:2,total:2},{phase:'saving',completed:0,total:2},{phase:'saving',completed:1,total:2},{phase:'saving',completed:2,total:2}]);
});
test('failed saves retain truthful partial counts rather than reporting 100 percent',async()=>{
 const events=await desired(2),s=server(),updates=[];let posts=0;s.setHook(({method})=>{if(method==='POST'&&++posts===2)throw Error('Lost response');});
 const result=await applyCalendarChanges(s.api,calendar,token,planComparison(events,[]),undefined,undefined,{},p=>updates.push({...p}));
 assert.equal(result.complete,false);assert.equal(updates.at(-1).phase,'saving');assert.equal(updates.at(-1).completed,1);assert.equal(updates.at(-1).total,2);
});
