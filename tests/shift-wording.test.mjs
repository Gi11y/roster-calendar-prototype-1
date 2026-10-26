import{test}from'node:test';import assert from'node:assert/strict';import{shiftCount,shiftSaveSummary}from'../src/shift-wording.ts';
const items=(kind,n)=>Array.from({length:n},()=>({kind}));
test('shift wording uses singular and plural save counts',()=>{assert.equal(shiftCount(1),'1 Shift');assert.equal(shiftCount(8),'8 Shifts');});
test('success headings describe the actual saved shifts',()=>{
 for(const [kind,verb]of [['created','Added'],['updated','Updated'],['removed','Removed'],['restored','Restored']])assert.equal(shiftSaveSummary(items(kind,8)).headline,'8 Shifts '+verb);
 assert.equal(shiftSaveSummary([{kind:'updated'}]).headline,'1 Shift Updated');
});
test('mixed saves retain separate additions updates and removals',()=>{
 const result=shiftSaveSummary([...items('created',2),...items('updated',3),{kind:'removed'}]);assert.equal(result.headline,'6 Shifts Saved');assert.equal(result.detail,'2 Shifts Added · 3 Shifts Updated · 1 Shift Removed');
});
test('partial and retried saves do not count failed unattempted or unchanged shifts as saved',()=>{
 const result=shiftSaveSummary([{kind:'updated'},{kind:'failed'},{kind:'not-attempted'},{kind:'unchanged'}]);assert.equal(result.headline,'1 Shift Updated');assert.match(result.detail,/1 Shift Needs Checking/);assert.match(result.detail,/1 Shift Not Attempted/);
 assert.equal(shiftSaveSummary(items('unchanged',8)).headline,'8 Shifts Unchanged');assert.equal(shiftSaveSummary([{kind:'failed'}]).headline,'No Shifts Confirmed Saved');
});
