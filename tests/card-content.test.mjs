import{test}from'node:test';import assert from'node:assert/strict';import{isMetadata,shiftTextOnly,planTimeBand}from'../src/card-content.ts';import{proposal}from'../src/card-data.ts';
const word=(text,x,y,w=30,h=10)=>({text,confidence:90,bbox:{x0:x,y0:y,x1:x+w,y1:y+h}});
test('standard Educator card metadata is never treated as a time',()=>{const text='A\n252379 ACS\nGWW CRC\nGOS CNEs -\nCC - Gos';assert.equal(shiftTextOnly(text),'A');assert.equal(proposal('A','light',shiftTextOnly(text)).range.end,'15:00');});
test('printed Educator override before metadata is retained',()=>{const text='A\n07:00 - 15:30\n252379 ACS\nGWW CRC';assert.equal(proposal('A','light',shiftTextOnly(text)).range.end,'15:30');});
test('OCR clock-like corruption in metadata cannot override or block a shift',()=>{const text='A\n25:23 79 ACS\n07:00 - 19:30';assert.equal(shiftTextOnly(text),'A');assert.equal(proposal('A','light',shiftTextOnly(text)).range.end,'15:00');});
test('same-line time plus metadata keeps only the valid prefix',()=>{assert.equal(shiftTextOnly('A\n07:00 - 15:30 252379 ACS'),'A\n07:00 - 15:30');assert(isMetadata('252379ACS'));});
test('time ROI ends before metadata and starts after label',()=>{const band=planTimeBand([word('A',2,5,8,10),word('07:00',2,25),word('-',34,25),word('15:30',45,25),word('252379',2,45),word('ACS',50,45)],15,100);assert.equal(band.metadataFound,true);assert(band.top>15);assert(band.top+band.height<45);});
test('missing metadata does not trigger an unbounded time pass',()=>{assert.equal(planTimeBand([word('A',2,5)],15,100).height,0);});
test('valid pre-metadata disagreements still require review',()=>{assert.equal(proposal('A','light',shiftTextOnly('A\n07:00 - 15:30\n07:00 - 16:00\n252379 ACS')).range,undefined);});
