import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sydneyRange} from '../src/sydney-time.ts';
const range=(...args)=>{const value=sydneyRange(...args);assert.equal(value.error,undefined);return value.range;};
test('winter and summer Sydney offsets do not depend on the device timezone',()=>{
 assert.equal(range('2026-07-01','07:00','15:00',false).start,'2026-07-01T07:00:00+10:00');
 assert.equal(range('2026-11-03','07:00','15:00',false).startUtc,'2026-11-02T20:00:00Z');
});
test('N and N10 end on the following day, including month/year boundaries',()=>{
 const night=range('2026-12-31','19:00','07:00',true);assert.equal(night.endDate,'2027-01-01');assert.equal(night.elapsedMinutes,720);
 assert.equal(range('2026-11-03','21:45','07:45',true).elapsedMinutes,600);
 assert.equal(range('2028-02-29','19:00','07:00',true).endDate,'2028-03-01');
});
test('DST forward night preserves printed clock times and exposes 11 elapsed hours',()=>{
 const r=range('2026-10-03','19:00','07:00',true);
 assert.equal(r.start,'2026-10-03T19:00:00+10:00');assert.equal(r.end,'2026-10-04T07:00:00+11:00');assert.equal(r.clockMinutes,720);assert.equal(r.elapsedMinutes,660);assert.equal(r.changesOffset,true);
});
test('DST backward night preserves printed clock times and exposes 13 elapsed hours',()=>{
 const r=range('2026-04-04','19:00','07:00',true);assert.equal(r.elapsedMinutes,780);assert.equal(r.clockMinutes,720);assert.equal(r.changesOffset,true);
});
test('nonexistent Sydney start and end times are blocked rather than normalised',()=>{
 assert.match(sydneyRange('2026-10-04','02:30','07:00',false).error,/does not exist/);
 assert.match(sydneyRange('2026-10-03','19:00','02:30',true).error,/does not exist/);
});
test('both ambiguous start and end times are blocked rather than picking an offset',()=>{
 assert.match(sydneyRange('2026-04-05','02:30','07:00',false).error,/occurs twice/);
 assert.match(sydneyRange('2026-04-04','19:00','02:30',true).error,/occurs twice/);
});
test('invalid and identical dates/times, forgotten overnight and excessive durations fail',()=>{
 for(const input of [['2026-02-29','07:00','15:00',false],['2026-11-03','24:00','15:00',false],['2026-11-03','07:00','07:00',false],['2026-11-03','19:00','07:00',false],['2026-11-03','07:00','15:00',true]])assert.ok(sydneyRange(...input).error);
});
test('printed 07:00–15:30 remains 8.5 hours, without adding breaks',()=>{
 assert.equal(range('2026-11-04','07:00','15:30',false).elapsedMinutes,510);
});

test('conversion is identical when the device timezone changes',async()=>{
 const {execFileSync}=await import('node:child_process');
 const code="import {sydneyRange} from './src/sydney-time.ts';console.log(JSON.stringify(sydneyRange('2026-10-03','19:00','07:00',true)))";
 const run=TZ=>execFileSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',code],{env:{...process.env,TZ},encoding:'utf8'});
 assert.equal(run('Pacific/Honolulu'),run('Australia/Sydney'));assert.equal(run('America/New_York'),run('UTC'));
});
