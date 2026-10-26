import{test}from'node:test';import assert from'node:assert/strict';import{markAllReviewed}from'../src/bulk-review.ts';import{reviewTiming}from'../src/date-review.ts';
test('tick all confirms valid shifts without altering their dates or hours',()=>{
 const rows=[{date:'2026-11-01',start:'07:00',end:'15:00',next:false,reviewed:false},{date:'2026-11-02',start:'19:00',end:'07:00',next:true}];
 const output=markAllReviewed(rows,row=>!!reviewTiming(row.date,row.start,row.end,row.next).error);
 assert(output.every(row=>row.reviewed));assert.equal(rows[0].reviewed,false);assert.equal(output[1].date,rows[1].date);assert.equal(output[1].next,true);
});
test('tick all cannot confirm missing dates, invalid times or recognised unresolved warnings',()=>{
 const rows=[{problem:undefined},{problem:'Date needed'},{problem:'Time unclear',reviewed:true},{problem:'Ambiguous daylight-saving time'}];
 assert.deepEqual(markAllReviewed(rows,row=>!!row.problem).map(row=>row.reviewed),[true,false,false,false]);
});
test('tick all remains repeatable and empty review stays empty',()=>{
 const rows=[{reviewed:false},{reviewed:true}],first=markAllReviewed(rows,()=>false);assert.deepEqual(markAllReviewed(first,()=>false),first);assert.deepEqual(markAllReviewed([],()=>false),[]);
});
