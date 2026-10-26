import{test}from'node:test';import assert from'node:assert/strict';import{rosterChoices,includeVerifiedChoice,readRosterChoices,readRosterSelection}from'../src/calendar-list.ts';
const id=n=>n+'@group.calendar.google.com',entry=(n,extra={})=>({id:id(n),summary:'Roster',accessRole:'owner',...extra});
test('only owned secondary Roster candidates are listed; primary/unrelated/read-only entries are excluded',()=>{const result=rosterChoices([entry('good'),entry('work',{summary:'Work'}),entry('reader',{accessRole:'reader'}),entry('primary',{id:'person@gmail.com',primary:true}),entry('bad',{id:'https://example.com'})]);assert.deepEqual(result,[{id:id('good'),label:'Roster'}]);});
test('renamed app calendars and duplicate names remain distinguishable',()=>{const choices=rosterChoices([entry('a12345678'),entry('b87654321'),entry('renamed',{summary:'My shifts',description:'Dedicated calendar for roster imports (prototype test)'})]);assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>c.label)).size,3);assert(choices.some(c=>c.label==='My shifts'));});
test('list reads all pages using only GET and the narrow metadata fields',async()=>{let calls=0;const api=async(path,token,method='GET')=>{assert.equal(method,'GET');assert.equal(token,'memory-token');assert(path.startsWith('/users/me/calendarList?'));const q=new URLSearchParams(path.split('?')[1]);assert.equal(q.get('minAccessRole'),'owner');assert.equal(q.get('showHidden'),'true');assert(!q.get('fields').includes('events'));return++calls===1?{items:[entry('first')],nextPageToken:'next'}:{items:[entry('second')]};};assert.equal((await readRosterChoices(api,'memory-token')).length,2);assert.equal(calls,2);});
test('API errors and pagination loops stop listing',async()=>{await assert.rejects(readRosterChoices(async()=>{throw Error('403');},'t'),/403/);await assert.rejects(readRosterChoices(async()=>({nextPageToken:'same'}),'t'),/pagination/);});
test('only an already verified saved calendar can be merged into the displayed list',()=>{const c={id:id('saved'),summary:'My Roster'};assert.deepEqual(includeVerifiedChoice([],c),[{id:c.id,label:'My Roster (saved)'}]);assert.equal(includeVerifiedChoice([{id:c.id,label:'Roster'}],c).length,1);assert.deepEqual(includeVerifiedChoice([],undefined),[]);});

test('deleted saved calendar is not resurrected even if its metadata endpoint still responds',async()=>{
 const calls=[];const result=await readRosterSelection(async(path,t,method='GET')=>{calls.push(path);assert.equal(method,'GET');if(path.startsWith('/users/me/calendarList'))return{items:[]};return{id:id('deleted'),summary:'Roster'};},'t',id('deleted'));
 assert.deepEqual(result,{choices:[],selectedId:undefined,unavailable:true});assert.equal(calls.length,1);
});
test('fresh list and access checks preserve an existing selection, without writes',async()=>{
 const result=await readRosterSelection(async(path,t,method='GET')=>{assert.equal(method,'GET');return path.startsWith('/users/me/calendarList')?{items:[entry('saved')]}:path.includes('/events?')?{items:[]}:{id:id('saved'),summary:'Roster'};},'t',id('saved'));
 assert.equal(result.selectedId,id('saved'));assert.equal(result.unavailable,false);assert.equal(result.choices.length,1);
});
test('a listed calendar with denied or deleted event access is not retained',async()=>{
 for(const status of [403,404,410]){const result=await readRosterSelection(async path=>{if(path.startsWith('/users/me/calendarList'))return{items:[entry('saved')]};throw{status};},'t',id('saved'));assert.equal(result.selectedId,undefined);assert.equal(result.unavailable,true);assert.deepEqual(result.choices,[]);}
});
test('list and transient verification failures propagate instead of declaring a calendar deleted',async()=>{
 await assert.rejects(readRosterSelection(async()=>{throw Error('Network unavailable');},'t',id('saved')),/Network/);
 await assert.rejects(readRosterSelection(async path=>{if(path.startsWith('/users/me/calendarList'))return{items:[entry('saved')]};throw Error('Temporary failure');},'t',id('saved')),/Temporary/);
});
test('missing selection retains other valid choices and does not auto-select another account calendar',async()=>{
 const result=await readRosterSelection(async path=>path.startsWith('/users/me/calendarList')?{items:[entry('other')]}:path.includes('/events?')?{}:{id:id('other'),summary:'Roster'},'t',id('deleted'));
 assert.equal(result.selectedId,undefined);assert.equal(result.unavailable,true);assert.equal(result.choices[0].id,id('other'));
});
