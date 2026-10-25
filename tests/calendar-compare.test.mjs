import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareEvents} from '../src/approved-events.ts';
import {planComparison,compareCalendar,coverageBounds} from '../src/calendar-compare.ts';
const desired=async()=> (await prepareEvents([{cardId:1,date:'2026-11-04',label:'A',role:'Educator',start:'07:00',end:'15:00',nextDay:false,reviewed:true,order:0}]))[0].event;
const live=e=>({...structuredClone(e),etag:'v1',status:'confirmed'});
const coverage={start:'2026-11-01',end:'2026-11-30',confirmed:true};
test('new, unchanged, time/reminder changes, cancelled ID and foreign ID are distinguished',async()=>{
 const e=await desired();
 assert.equal(planComparison([e],[])[0].kind,'new');
 assert.equal(planComparison([e],[live(e)])[0].kind,'unchanged');
 assert.equal(planComparison([e],[{...live(e),end:{dateTime:'2026-11-04T06:00:00Z'}}])[0].kind,'changed');
 assert.equal(planComparison([e],[{...live(e),reminders:{useDefault:true}}])[0].kind,'changed');
 assert.equal(planComparison([e],[{id:e.id,status:'cancelled'}])[0].kind,'restore');
 assert.equal(planComparison([e],[{...live(e),extendedProperties:{}}])[0].kind,'conflict');
 assert.equal(planComparison([e],[{...live(e),attendees:[{email:'guest@example.com'}]}])[0].kind,'conflict');
});
test('removals require complete coverage and exclude unrelated, moved, recurring and boundary-crossing events',async()=>{
 const e=await desired(),extra={...live(e),id:'extra'};
 assert.equal(planComparison([e],[extra]).length,1);
 assert.equal(planComparison([e],[extra],coverage)[1].kind,'removed');
 assert.equal(planComparison([e],[{...extra,extendedProperties:{}}],coverage).length,1);
 assert.equal(planComparison([e],[{...extra,start:{dateTime:'2026-10-31T22:00:00+11:00'}}],coverage).length,1);
 assert.equal(planComparison([e],[{...extra,extendedProperties:{private:{rosterImporter:'roster-calendar-v1',rosterDate:'2026-10-31'}}}],coverage).length,1);
 assert.equal(planComparison([e],[{...extra,recurringEventId:'series'}],coverage)[1].kind,'conflict');
 assert.throws(()=>planComparison([e],[],{...coverage,confirmed:false}));
 assert.throws(()=>planComparison([e],[],{...coverage,start:'2026-11-05'}));
});
test('coverage boundaries use Sydney midnight and exclusive following-day end across DST',()=>{
 assert.deepEqual(coverageBounds({start:'2026-10-03',end:'2026-10-04',confirmed:true}),{timeMin:'2026-10-03T00:00:00+10:00',timeMax:'2026-10-05T00:00:00+11:00'});
 for(const c of [{...coverage,start:'2026-02-30'},{...coverage,end:'2026-10-01'},{start:'2026-01-01',end:'2026-12-31',confirmed:true}])assert.throws(()=>coverageBounds(c));
});
test('comparison reads all pages and directly checks stable IDs outside the date window, with no writes',async()=>{
 const e=await desired(),calls=[];
 const api=async(path,token,method='GET')=>{
  assert.equal(method,'GET');assert.equal(token,'memory-only');calls.push(path);
  if(path.includes('?'))return path.includes('pageToken=next')?{items:[]}:{items:[{...live(e),id:'removed'}],nextPageToken:'next'};
  return{...live(e),end:{dateTime:'2026-11-04T17:00:00+11:00'}};
 };
 const changes=await compareCalendar(api,'test@group.calendar.google.com','memory-only',[e],coverage);
 assert.equal(calls.length,3);assert.equal(changes[0].kind,'changed');assert.equal(changes[1].kind,'removed');
 assert.ok(calls[0].includes('privateExtendedProperty=rosterImporter%3Droster-calendar-v1'));
});
test('missing IDs are new, but permission/network errors and pagination loops stop comparison',async()=>{
 const e=await desired();
 assert.equal((await compareCalendar(async()=>{throw{status:404};},'id','token',[e]))[0].kind,'new');
 for(const status of [401,403,500])await assert.rejects(()=>compareCalendar(async()=>{throw{status};},'id','token',[e]));
 await assert.rejects(()=>compareCalendar(async()=>({items:[],nextPageToken:'same'}),'id','token',[e],coverage),/pagination/);
});

test('410 direct lookup is a recovery candidate rather than a new random ID',async()=>{
 const e=await desired();const plan=await compareCalendar(async()=>{throw{status:410};},'id','token',[e]);
 assert.equal(plan[0].kind,'restore');assert.equal(plan[0].id,e.id);
});
