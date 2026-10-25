import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyRosterCalendar, validateCalendarId, connectionLabel, mayCreateCalendar} from '../src/calendar-selection.ts';
const id='existing123@group.calendar.google.com';
test('existing selection verifies metadata and event access without writes', async()=>{
 const calls=[];
 const api=async(path,token,method='GET')=>{calls.push(path);assert.equal(method,'GET');assert.equal(token,'mock');return path.includes('/events?')?{items:[]}:{id,summary:'Roster'};};
 assert.equal((await verifyRosterCalendar(api,'  '+id+'  ','mock')).id,id);
 assert.equal(calls.length,2); assert(calls[0].includes(encodeURIComponent(id))); assert(calls[1].endsWith('/events?maxResults=1'));
});
test('primary, email, URL and token are rejected before API access',async()=>{
 for(const input of ['primary','person@gmail.com','https://calendar.google.com/','ya29.secret','']) {
  await assert.rejects(verifyRosterCalendar(()=>{throw Error('must not call API');},input,'mock'),/Paste the secondary/);
 }
});
test('wrong account or insufficient access fails verification',async()=>{
 await assert.rejects(verifyRosterCalendar(async()=>{throw Error('HTTP 403');},id,'mock'),/403/);
 let calls=0;
 await assert.rejects(verifyRosterCalendar(async()=>{if(++calls===1)return{id,summary:'Roster'};throw Error('HTTP 404');},id,'mock'),/404/);
});
test('unrelated and mismatched calendars cannot be selected',async()=>{
 for(const calendar of [{id,summary:'Personal'},{id:'other@group.calendar.google.com',summary:'Roster'}]) {
  await assert.rejects(verifyRosterCalendar(async()=>calendar,id,'mock'),/not a recognised/);
 }
});
test('app-created calendar may be renamed without losing selection',async()=>{
 const calendar={id,summary:'My Roster',description:'Dedicated calendar for roster imports (prototype test)'};
 assert.equal((await verifyRosterCalendar(async path=>path.includes('/events?')?{}:calendar,id,'mock')).id,id);
});
test('connected badge becomes disconnected on expiry and token loss',()=>{
 assert.equal(connectionLabel(true,200,100),'Google connected');
 assert.match(connectionLabel(true,200,200),/not connected/);
 assert.match(connectionLabel(false,200,100),/not connected/);
});
test('new-calendar button is gated by deliberate confirmation, connection and storage',()=>{
 assert.equal(mayCreateCalendar(true,false,true,undefined,true),true);
 for(const args of [[true,false,true,undefined,false],[false,false,true,undefined,true],[true,true,true,undefined,true],[true,false,false,undefined,true],[true,false,true,id,true]])assert.equal(mayCreateCalendar(...args),false);
});
