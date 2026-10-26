import{test}from'node:test';import assert from'node:assert/strict';
import{ensureRosterCalendar,withCalendarCreationLock,firstTimeCalendarState,calendarName}from'../src/calendar-create.ts';
import{ROSTER_DESCRIPTION,calendarSetupId,isRosterMetadata}from'../src/calendar-selection.ts';
const token='memory-only',setupId='a'.repeat(64),id=n=>n+'@group.calendar.google.com';
function fixture(initial=[]){
 const calendars=new Map(initial.map(c=>[c.id,{summary:'Roster',accessRole:'owner',...c}])),calls=[],state={saved:undefined,pending:undefined,failSave:false,failPending:false,listError:undefined,postError:undefined,lost:false};
 const settings={async readId(){return state.saved;},async saveId(value){if(state.failSave)throw Error('Storage failed');state.saved=value;},async readPending(){return state.pending&&structuredClone(state.pending);},async savePending(value){if(state.failPending)throw Error('Storage failed');state.pending=value&&structuredClone(value);}};
 const api=async(path,t,method='GET',body)=>{
  assert.equal(t,token);calls.push({path,method,body});const url=new URL('https://example.com'+path);
  if(path.startsWith('/users/me/calendarList')){if(state.listError)throw state.listError;return{items:[...calendars.values()].filter(c=>!c.hiddenFromList)};}
  if(method==='POST'){assert.equal(path,'/calendars');assert(state.pending,'Pending marker must precede POST');if(state.postError)throw state.postError;const calendar={id:id('new-'+calls.filter(c=>c.method==='POST').length),accessRole:'owner',...body};calendars.set(calendar.id,calendar);if(state.lost)throw Error('Lost response');return structuredClone(calendar);}
  const value=decodeURIComponent(url.pathname.split('/')[2]),calendar=calendars.get(value);if(!calendar)throw{status:404};if(calendar.denied)throw{status:403};
  if(path.includes('/events?'))return{items:[]};
  return structuredClone(calendar);
 };
 return{calendars,calls,state,settings,api,posts:()=>calls.filter(c=>c.method==='POST')};
}
test('creates one empty Roster calendar with Sydney timezone, persists ID and verifies access',async()=>{
 const f=fixture(),result=await ensureRosterCalendar(f.api,token,f.settings,setupId);
 assert.equal(result.kind,'created');assert.equal(f.posts().length,1);assert.equal(f.posts()[0].body.summary,'Roster');assert.equal(f.posts()[0].body.timeZone,'Australia/Sydney');
 assert.equal(calendarSetupId(f.posts()[0].body.description),setupId);assert.equal(f.state.saved,result.calendar.id);assert.equal(f.state.pending,undefined);
 assert(f.calls.every(c=>c.method==='GET'||c.path==='/calendars')); // No shift insertion.
});
test('fresh discovery reuses an existing accessible Roster; multiple candidates require a choice',async()=>{
 for(const count of [1,2]){const f=fixture(Array.from({length:count},(_,n)=>({id:id('existing'+n)}))),result=await ensureRosterCalendar(f.api,token,f.settings,setupId);
 assert.equal(result.kind,count===1?'existing':'choose');assert.equal(f.posts().length,0);}
});
test('a saved calendar is rechecked and reused even when missing from the list',async()=>{
 const f=fixture([{id:id('saved'),hiddenFromList:true}]);f.state.saved=id('saved');const result=await ensureRosterCalendar(f.api,token,f.settings,setupId);assert.equal(result.kind,'existing');assert.equal(f.posts().length,0);
});
test('calendar-list failures and network errors stop creation; foreign same-name calendars do not pass access checks',async()=>{
 for(const error of [{status:403},Error('Network failure')]){const f=fixture();f.state.listError=error;await assert.rejects(ensureRosterCalendar(f.api,token,f.settings,setupId));assert.equal(f.posts().length,0);}
 const f=fixture([{id:id('foreign'),denied:true}]);assert.equal((await ensureRosterCalendar(f.api,token,f.settings,setupId)).kind,'created');assert.equal(f.posts().length,1);
});
test('a lost response is recovered by its setup marker without a second POST',async()=>{
 const f=fixture();f.state.lost=true;await assert.rejects(ensureRosterCalendar(f.api,token,f.settings,setupId),/Lost response/);assert.equal(f.state.pending.setupId,setupId);
 f.state.lost=false;const result=await ensureRosterCalendar(f.api,token,f.settings,'b'.repeat(64));assert.equal(result.kind,'existing');assert.equal(f.posts().length,1);assert.equal(f.state.pending,undefined);
});
test('an unresolved earlier request blocks blind retries even in another empty account',async()=>{
 const f=fixture();f.state.pending={setupId};await assert.rejects(ensureRosterCalendar(f.api,token,f.settings,'b'.repeat(64)),/earlier calendar creation/);assert.equal(f.posts().length,0);
});
test('storage failure before POST makes no calendar; failure after POST is recoverable',async()=>{
 const f=fixture();f.state.failPending=true;await assert.rejects(ensureRosterCalendar(f.api,token,f.settings,setupId),/Storage failed/);assert.equal(f.posts().length,0);
 const g=fixture();g.state.failSave=true;await assert.rejects(ensureRosterCalendar(g.api,token,g.settings,setupId),/Storage failed/);assert.equal(g.posts().length,1);assert(g.state.pending.calendarId);
 g.state.failSave=false;assert.equal((await ensureRosterCalendar(g.api,token,g.settings,'b'.repeat(64))).kind,'existing');assert.equal(g.posts().length,1);
});
test('definite Google rejection clears pending setup; unknown server failure preserves it',async()=>{
 for(const status of [400,401,403,429,500]){const f=fixture();f.state.postError={status};await assert.rejects(ensureRosterCalendar(f.api,token,f.settings,setupId));assert.equal(!!f.state.pending,status===500);}
});
test('renamed created calendars remain discoverable from their setup description',()=>{
 const description=ROSTER_DESCRIPTION+'\nSetup ID: '+setupId;assert.equal(isRosterMetadata('My shifts',description),true);assert.equal(calendarSetupId(description),setupId);
 assert.equal(isRosterMetadata('My shifts',ROSTER_DESCRIPTION),true);assert.equal(calendarSetupId(description+'unexpected'),undefined);
});
test('first-time creation is offered only after successful discovery with no verified calendar',()=>{
 assert.equal(firstTimeCalendarState(true,false,true,true,0).showCreate,true);
 for(const args of [[false,false,true,true,0],[true,true,true,true,0],[true,false,false,true,0],[true,false,true,false,0],[true,false,true,true,1]])assert.equal(firstTimeCalendarState(...args).showCreate,false);
});
test('cross-tab creation lock serializes checks so a second attempt reuses the first calendar',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let chain=Promise.resolve();
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request(name,task){assert.equal(name,'roster-calendar:calendar-creation');const next=chain.then(task);chain=next.catch(()=>{});return next;}}}});
 try{const f=fixture();const results=await Promise.all([setupId,'b'.repeat(64)].map(nonce=>withCalendarCreationLock(()=>ensureRosterCalendar(f.api,token,f.settings,nonce))));assert.deepEqual(results.map(r=>r.kind),['created','existing']);assert.equal(f.posts().length,1);}
 finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
test('unsupported creation locks fail before running a creation task',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
 try{let ran=false;await assert.rejects(withCalendarCreationLock(async()=>{ran=true;}),/current Safari or Chrome/);assert.equal(ran,false);}
 finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});

test('custom calendar name is trimmed, created in Google and remains discoverable',async()=>{
 const f=fixture();const result=await ensureRosterCalendar(f.api,token,f.settings,setupId,()=>{},'  Sam’s shifts  ');
 assert.equal(result.calendar.summary,'Sam’s shifts');assert.equal(f.posts()[0].body.summary,'Sam’s shifts');
 assert(isRosterMetadata(result.calendar.summary,result.calendar.description));
 const again=await ensureRosterCalendar(f.api,token,f.settings,'b'.repeat(64),()=>{},'Another name');assert.equal(again.calendar.summary,'Sam’s shifts');assert.equal(f.posts().length,1);
});
test('blank calendar name defaults to Roster; invalid names stop before requests',async()=>{
 assert.equal(calendarName('   '),'Roster');
 for(const name of ['x'.repeat(101),'Morning\nRoster','Bad\u0000name']){
  const f=fixture();await assert.rejects(ensureRosterCalendar(f.api,token,f.settings,setupId,()=>{},name),/calendar name/);assert.equal(f.calls.length,0);
 }
});
test('custom name survives lost creation response without duplicate or rename',async()=>{
 const f=fixture();f.state.lost=true;await assert.rejects(ensureRosterCalendar(f.api,token,f.settings,setupId,()=>{},'Night roster'),/Lost response/);
 f.state.lost=false;const result=await ensureRosterCalendar(f.api,token,f.settings,'b'.repeat(64),()=>{},'Different name');
 assert.equal(result.calendar.summary,'Night roster');assert.equal(f.posts().length,1);
});
