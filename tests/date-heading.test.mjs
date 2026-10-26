import{test}from'node:test';import assert from'node:assert/strict';import{dateHeadingArea,dateHeadingBands,recoverHeaderMonthYear}from'../src/date-heading.ts';import{headerMonths,inferDateAnchor}from'../src/auto-dates.ts';
test('a clear initial month/year makes no retry requests',async()=>{let calls=0;const result=await recoverHeaderMonthYear('25 Oct 2026',[{}],async()=>{calls++;return'Nov 2025';});assert.equal(calls,0);assert.equal(result.attempts,0);assert.equal(result.text,'25 Oct 2026');});
test('a focused heading recovers month/year without accepting department numbers',async()=>{
 let n=0;const r=await recoverHeaderMonthYear('265617 ACS GWW CRC',[{},{},{}],async()=>['252379 ACS','25 Oct 2026','07:00 - 15:30'][n++]);
 assert.deepEqual(headerMonths(r.text),[{year:2026,month:9}]);assert.equal(r.attempts,3);assert(!r.text.includes('07:00'));
});
test('unreadable focused headings stay unresolved and failures do not discard earlier evidence',async()=>{
 const r=await recoverHeaderMonthYear('Mon Tue Wed Thu Fri Sat Sun',[{},{}],async()=>{throw Error('Reader interrupted');});assert.equal(r.attempts,2);assert.equal(headerMonths(r.text).length,0);assert(r.text.includes('Mon Tue'));assert.equal(inferDateAnchor([],undefined,r.text).anchor,undefined);
});
test('focused retries are bounded and preserve conflicting years for rejection',async()=>{
 let n=0;const r=await recoverHeaderMonthYear('',Array.from({length:20},()=>({})),async()=>++n===1?'Oct 2024':'Oct 2026');assert.equal(n,6);assert.equal(headerMonths(r.text).length,2);
 const grid={columns:[0,100,200,300,400,500,600,700],rows:[0,100]};assert.match(inferDateAnchor([],grid,r.text+'\nMon Tue Wed Thu Fri Sat Sun').reason,/Conflicting/);
});
test('heading crops isolate short text lines above weekdays and ignore horizontal borders',()=>{
 const width=700,height=500,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(const y0 of [100,200,310])for(let y=y0;y<y0+15;y++)for(let x=30;x<190;x+=20)for(let dx=0;dx<6;dx++)data.set([45,45,45,255],(y*width+x+dx)*4);
 for(let x=0;x<434;x++)data.set([80,80,80,255],(280*width+x)*4);
 const bands=dateHeadingBands(data,width,height,0,700,400,300);assert.equal(bands.length,2);assert(bands.every(b=>b.y+b.height<=300));assert(bands[0].y>bands[1].y);assert(bands.every(b=>b.width<434&&b.height<60));
 assert.deepEqual(dateHeadingBands(data,width,height,0,0,400),[]);assert.deepEqual(dateHeadingBands(new Uint8ClampedArray(),width,height,0,700,400),[]);
});

test('heading area follows weekdays even if the first detected grid row is far below the header',()=>{
 const bounds=dateHeadingArea(1200,1500,100,1150,1000,350);assert.equal(bounds.y,0);assert.equal(bounds.height,350);assert.equal(bounds.x,100);
 const width=1200,height=1500,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(let y=150;y<170;y++)for(let x=200;x<440;x+=24)for(let dx=0;dx<8;dx++)data.set([40,40,40,255],(y*width+x+dx)*4);
 const bands=dateHeadingBands(data,width,height,100,1150,1000,350);assert.equal(bands.length,1);assert(bands[0].y<=150&&bands[0].y+bands[0].height>=170);
});
test('heading search scales to wide screenshots instead of using a fixed 520 pixel reach',()=>{
 const bounds=dateHeadingArea(2000,2400,100,1900,1600);assert.equal(bounds.y,160);assert.equal(bounds.height,1440);assert.equal(dateHeadingArea(0,0,0,0,0),undefined);
});
test('rejected retry text is retained for diagnosis but never used as accepted month evidence',async()=>{
 const r=await recoverHeaderMonthYear('Weekday row:',[{x:0,y:0,width:100,height:30}],async()=>'Oet 2O26');assert.equal(r.readings[0].text,'Oet 2O26');assert.equal(headerMonths(r.text).length,0);assert(!r.text.includes('Oet'));
});
