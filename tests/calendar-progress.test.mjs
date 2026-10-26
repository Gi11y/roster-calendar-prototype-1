import{test}from'node:test';import assert from'node:assert/strict';import{calendarProgressText,mountCalendarProgress}from'../src/calendar-progress.ts';
test('known work shows completed/total while paginated reads never invent a total',()=>{
 assert.equal(calendarProgressText({phase:'checking',completed:3,total:14}),'Checking shifts · 3 of 14');
 assert.equal(calendarProgressText({phase:'saving',completed:2,total:5}),'Saving shifts · 2 of 5');
 assert.equal(calendarProgressText({phase:'listing',completed:2}),'Reading your calendar · 2 pages loaded');
 assert(!calendarProgressText({phase:'listing',completed:0}).includes('%'));
});
function elements(){
 const attributes={},bar={max:1,value:0,removeAttribute(key){attributes[key]='removed';},setAttribute(key,value){attributes[key]=value;}},label={textContent:''},elapsed={textContent:''},hint={textContent:''},busy={setAttribute(key,value){attributes['comparison-'+key]=value;}};
 const root={hidden:true,querySelector(key){return key==='progress'?bar:key==='[data-progress-label]'?label:key==='[data-progress-elapsed]'?elapsed:hint;},closest(){return{querySelector(){return busy;}};}};
 return{root,bar,label,elapsed,hint,attributes};
}
test('progress starts immediately, switches between unknown and known work and stops cleanly',()=>{
 const e=elements(),view=mountCalendarProgress(e.root);try{
 view.start({phase:'listing',completed:0});assert.equal(e.root.hidden,false);assert.equal(e.attributes.value,'removed');
 view.update({phase:'checking',completed:3,total:14});assert.equal(e.bar.max,14);assert.equal(e.bar.value,3);assert.equal(e.label.textContent,'Checking shifts · 3 of 14');
 view.update({phase:'listing',completed:2});assert.equal(e.attributes.value,'removed');
 }finally{view.stop();}assert.equal(e.root.hidden,true);assert.equal(e.attributes['comparison-aria-busy'],'false');
});
test('elapsed time and a longer-wait message update without advancing completed work',()=>{
 const e=elements(),view=mountCalendarProgress(e.root),oldNow=Date.now,oldSet=globalThis.setInterval,oldClear=globalThis.clearInterval;let now=1000,tick,cleared=false;
 Date.now=()=>now;globalThis.setInterval=fn=>{tick=fn;return 1;};globalThis.clearInterval=()=>{cleared=true;};
 try{view.start({phase:'saving',completed:1,total:5});now=18000;tick();assert.equal(e.elapsed.textContent,'17s elapsed');assert.match(e.hint.textContent,/Still waiting for Google/);assert.equal(e.bar.value,1);assert.equal(e.bar.max,5);view.stop();assert.equal(cleared,true);}
 finally{Date.now=oldNow;globalThis.setInterval=oldSet;globalThis.clearInterval=oldClear;}
});
test('legacy pages with no progress panel remain supported',()=>{const view=mountCalendarProgress(null);view.start({phase:'checking',completed:0,total:2});view.update({phase:'checking',completed:1,total:2});view.stop();});

import{withCalendarNamesProgress}from'../src/calendar-progress.ts';
test('calendar-name loading uses an indeterminate label without a guessed total',()=>{
 const e=elements(),view=mountCalendarProgress(e.root);
 try{view.start({phase:'calendars',completed:0});assert.equal(e.label.textContent,'Getting calendar names…');assert.equal(e.attributes.value,'removed');assert.equal(e.root.hidden,false);}finally{view.stop();}
});
test('post-login progress starts before the first lookup and stays until names are ready',async()=>{
 const calls=[];let resolve;const pending=new Promise(r=>{resolve=r;});
 const indicator={start(value){calls.push(['start',value.phase]);},stop(){calls.push(['stop']);}};
 const result=withCalendarNamesProgress(indicator,async()=>{calls.push(['lookup']);return await pending;},loading=>calls.push(['loading',loading]));
 assert.deepEqual(calls,[['start','calendars'],['loading',true],['lookup']]);
 resolve(['Roster']);assert.deepEqual(await result,['Roster']);assert.deepEqual(calls.slice(-2),[['stop'],['loading',false]]);
});
test('failed calendar-name loading removes progress and releases the loading state',async()=>{
 const calls=[],indicator={start(){calls.push('start');},stop(){calls.push('stop');}};
 await assert.rejects(withCalendarNamesProgress(indicator,async()=>{throw Error('Google unavailable');},loading=>calls.push(loading)),/Google unavailable/);
 assert.deepEqual(calls,['start',true,'stop',false]);
});
