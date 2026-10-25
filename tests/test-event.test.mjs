import {test} from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ensureTest, findTests, removeExtras, identicalTest, TEST_EVENT, TEST_EVENT_ID } from '../src/test-event.ts';
const old = id => ({id, etag:'"version1"', ...TEST_EVENT, start:{dateTime:'2026-11-03T12:00:00+11:00'}, end:{dateTime:'2026-11-03T12:30:00+11:00'}});
const http = status => Object.assign(new Error('HTTP '+status),{status});
test('identity hashes date, type and ordinal, excluding hours', () => {
 assert.equal(TEST_EVENT_ID, createHash('sha256').update('2026-11-03|prototype1-test|0').digest('hex'));
 assert.match(TEST_EVENT_ID,/^[0-9a-v]{5,1024}$/);
});
test('first click inserts once; repeats including another session reuse existing event', async () => {
 const events=[]; let writes=0;
 const api = async (path, token, method='GET', body) => {
  assert(path.startsWith('/calendars/roster%40test/events'));
  if(method==='POST') { writes++; const event={...body}; events.push(event); return event; }
  return {items:events.map(e=>old(e.id))};
 };
 assert.equal((await ensureTest(api,'roster@test','mock')).created,true);
 assert.equal((await ensureTest(api,'roster@test','mock')).created,false);
 assert.equal((await ensureTest(api,'roster@test','new-session-token')).created,false);
 assert.equal(writes,1);
});
test('two existing legacy copies produce no insert and offer only the extra copy', async () => {
 const api = async (path,token,method='GET') => { assert.equal(method,'GET'); return {items:[old('b'),old('a')]}; };
 const result=await ensureTest(api,'roster','mock');
 assert.equal(result.created,false); assert.equal(result.event.id,'a'); assert.deepEqual(result.duplicates.map(e=>e.id),['b']);
});
test('legacy matching paginates and compares instants across offsets', async () => {
 let pages=0;
 const result = await findTests(async path => { pages++; return path.includes('pageToken=next') ? {items:[old('old')]} : {items:[], nextPageToken:'next'}; },'roster','mock');
 assert.equal(pages,2); assert.equal(result.length,1);
});
test('a concurrent 409 fetches the same stable event instead of a second insertion', async () => {
 let writes=0;
 const result=await ensureTest(async(path,token,method='GET')=>{
  if(method==='POST'){writes++; throw http(409);}
  if(path.endsWith('/'+TEST_EVENT_ID)) return old(TEST_EVENT_ID);
  return {items:[]};
 },'roster','mock');
 assert.equal(writes,1); assert.equal(result.created,false);
});
test('a cancelled conflicting ID stops without resurrecting or choosing a fresh ID', async () => {
 await assert.rejects(ensureTest(async(path,token,method='GET')=>{
  if(method==='POST') throw http(409);
  if(path.endsWith('/'+TEST_EVENT_ID)) return {id:TEST_EVENT_ID,status:'cancelled'};
  return {items:[]};
 },'roster','mock'), /deleted or changed/);
});
test('a list error fails closed before any calendar write', async () => {
 await assert.rejects(ensureTest(async(path,token,method='GET')=>{assert.equal(method,'GET');throw http(403);},'roster','mock'), /403/);
});
test('only exact one-off synthetic events qualify for cleanup', () => {
 assert(identicalTest(old('a')));
 for(const change of [{summary:'Real shift'},{description:'edited'},{location:'Ward'},{attendees:[{}]},{status:'cancelled'},{recurringEventId:'series'},{reminders:{useDefault:true}},{start:{dateTime:'2026-11-03T12:30:00+11:00'}}]) assert.equal(identicalTest({...old('a'),...change}),false);
});
test('cleanup deletes only approved extras from the same calendar and keeps one', async () => {
 const removed=[];
 const api=async(path,token,method='GET',body,ifMatch)=>{if(method==='DELETE'){assert.equal(ifMatch,'"version1"');removed.push(path);return {};} return {items:[old('a'),old('b'),{...old('c'),summary:'Keep this'}]};};
 assert.equal(await removeExtras(api,'roster@test','mock','a',['b']),1);
 assert.deepEqual(removed,['/calendars/roster%40test/events/b']);
});
test('cleanup stops if preview changes or the keeper disappears', async () => {
 for(const items of [[old('a'),old('b'),old('new')],[old('b')]]) {
  await assert.rejects(removeExtras(async(path,token,method='GET')=>{assert.equal(method,'GET');return {items};},'roster','mock','a',['b']), /changed|disappeared/);
 }
});
test('lost insert response is surfaced and a retry safely finds the created event', async () => {
 let inserted=false; let writes=0;
 const api=async(path,token,method='GET',body)=>{
  if(method==='POST'){inserted=true;writes++;throw new Error('Network lost');}
  return {items:inserted?[old(TEST_EVENT_ID)]:[]};
 };
 await assert.rejects(ensureTest(api,'roster','mock'),/Network lost/);
 assert.equal((await ensureTest(api,'roster','mock')).created,false);
 assert.equal(writes,1);
});
