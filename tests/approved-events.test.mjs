import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareEvents,stableEventId} from '../src/approved-events.ts';
const shift=(overrides={})=>({cardId:1,date:'2026-11-04',label:'A',role:'Educator',start:'07:00',end:'15:00',nextDay:false,reviewed:true,order:0,...overrides});
test('same reviewed roster yields identical IDs and payloads; edited time/role keeps ID',async()=>{
 const [a]=await prepareEvents([shift()]),[b]=await prepareEvents([shift()]),[changed]=await prepareEvents([shift({end:'15:30',role:'Floor staff'})]);
 assert.deepEqual(a,b);assert.equal(a.event.id,changed.event.id);assert.notDeepEqual(a.event.end,changed.event.end);assert.notEqual(a.event.summary,changed.event.summary);
 assert.match(a.event.id,/^[0-9a-f]{64}$/);assert.equal(a.event.id,await stableEventId('2026-11-04','A',0));
});
test('same-type ordinals follow original card order, even when edited times cross',async()=>{
 const a=shift({cardId:1,order:0}),b=shift({cardId:2,order:1,start:'08:00',end:'16:00'});
 const before=await prepareEvents([b,a]),after=await prepareEvents([a,{...b,start:'06:00',end:'14:00'}]);
 assert.equal(before[0].cardId,1);assert.equal(before[1].event.id,after[1].event.id);assert.notEqual(before[0].event.id,before[1].event.id);
});
test('unreviewed, missing label/role, duplicate IDs, DST uncertainty and invalid reminder block preparation',async()=>{
 for(const s of [shift({reviewed:false}),shift({label:'?'}),shift({role:'uncertain'}),shift({date:'2026-10-04',start:'02:30'})])await assert.rejects(()=>prepareEvents([s]));
 await assert.rejects(()=>prepareEvents([]));await assert.rejects(()=>prepareEvents([shift(),shift()]));
 await assert.rejects(()=>prepareEvents([shift()],-1));
});
test('approved payload contains no raw OCR, image, staff identifier, account or token',async()=>{
 const [p]=await prepareEvents([shift({rawText:'252379 ACS',accessToken:'secret',image:'pixels'})],120);
 assert.equal(p.event.start.timeZone,'Australia/Sydney');assert.equal(p.event.start.dateTime,'2026-11-04T07:00:00+11:00');
 assert.deepEqual(p.event.reminders,{useDefault:false,overrides:[{method:'popup',minutes:120}]});
 for(const forbidden of ['252379','secret','pixels','rawText','accessToken'])assert.equal(JSON.stringify(p.event).includes(forbidden),false);
 assert.equal(p.event.extendedProperties.private.rosterImporter,'roster-calendar-v1');
});
test('reminders are off unless explicitly chosen',async()=>{const [p]=await prepareEvents([shift()]);assert.deepEqual(p.event.reminders,{useDefault:false});});
