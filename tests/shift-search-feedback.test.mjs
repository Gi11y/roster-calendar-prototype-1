import{test}from'node:test';import assert from'node:assert/strict';import{swapRangeError,shiftSearchResult}from'../src/shift-search-feedback.ts';import{listSwapShifts}from'../src/shift-swap.ts';
test('ranges longer than 93 days have a concise date-field error and make no API requests',async()=>{
 assert.match(swapRangeError('2025-10-01','2026-12-07'),/93 days or fewer/);let calls=0;
 await assert.rejects(listSwapShifts(async()=>{calls++;},'calendar','token','2025-10-01','2026-12-07'));assert.equal(calls,0);
});
test('valid ranges clear the error while missing or reversed dates request correction',()=>{
 assert.equal(swapRangeError('2026-10-01','2026-12-07'),'');assert.match(swapRangeError('','2026-12-07'),/Choose both/);assert.match(swapRangeError('2026-12-07','2026-10-01'),/on or after/);
});
test('zero results explicitly confirm a successful search with its dates',()=>{
 const state=shiftSearchResult(0,'2026-10-01','2026-12-07');assert.match(state.message,/Search complete/);assert.match(state.message,/No shifts available to swap/);assert.match(state.message,/1 Oct 2026 to 7 Dec 2026/);assert.equal(state.placeholder,'No shifts found for these dates');
});
test('positive search results request a selection instead of leaving the pre-search placeholder',()=>{
 const state=shiftSearchResult(2,'2026-10-01','2026-12-07');assert.equal(state.message,'Search complete. Found 2 shifts. Choose one below.');assert.equal(state.placeholder,'Choose a shift');
});

import{readFileSync}from'node:fs';
test('date feedback is located after both date inputs and before Find shifts',()=>{
 const html=readFileSync('swap.html','utf8'),status=html.indexOf('id="swap-search-status"');
 assert(status>html.indexOf('id="swap-from"'));assert(status>html.indexOf('id="swap-to"'));assert(status<html.indexOf('id="swap-load"'));
});
