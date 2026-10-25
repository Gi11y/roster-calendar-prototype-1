import{test}from'node:test';import assert from'node:assert/strict';import{inferredNextDay,shiftFinish}from'../src/manual-shift-time.ts';import{sydneyRange}from'../src/sydney-time.ts';
test('an earlier end clock automatically means next day; normal shifts remain same-day',()=>{assert.equal(inferredNextDay('19:00','07:00'),true);assert.equal(inferredNextDay('21:45','07:45'),true);assert.equal(inferredNextDay('07:00','15:00'),false);assert.equal(inferredNextDay('07:00','07:00'),undefined);assert.equal(inferredNextDay('','07:00'),undefined);});
test('finish text makes the weekday and morning clock explicit',()=>{assert.match(shiftFinish('2026-10-26','19:00','07:30',true).text,/Finishes Tue 27 Oct, 7:30am/);});
test('N and N10 preserve clocks while elapsed hours change on both DST weekends',()=>{
 for(const [date,expectedN,expectedN10]of [['2026-04-04',780,660],['2026-10-03',660,540],['2027-04-03',780,660],['2027-10-02',660,540]]){
 const n=sydneyRange(date,'19:00','07:00',true),n10=sydneyRange(date,'21:45','07:45',true);assert.equal(n.error,undefined);assert.equal(n.range.elapsedMinutes,expectedN);assert.equal(n10.error,undefined);assert.equal(n10.range.elapsedMinutes,expectedN10);assert.match(shiftFinish(date,'19:00','07:00',true).text,/daylight saving/);}
});
test('nonexistent and ambiguous clocks still block a manual shift',()=>{assert.match(shiftFinish('2026-10-04','02:30','07:00',false).error,/does not exist/);assert.match(shiftFinish('2026-04-05','02:30','07:00',false).error,/occurs twice/);});
