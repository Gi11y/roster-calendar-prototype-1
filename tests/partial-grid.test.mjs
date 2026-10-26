import{test}from'node:test';import assert from'node:assert/strict';import{detectCards,findGrid,findPartialGrid}from'../src/card-data.ts';import{associateDates}from'../src/date-review.ts';import{calendarFixture}from'./helpers/calendar-fixture.mjs';
test('full seven-day landscape layout remains a full grid',()=>{const p=calendarFixture({landscape:true}),cards=detectCards(p.data,p.width,p.height),g=findGrid(p.data,p.width,p.height,cards);assert(g);assert.equal(g.columns.length,8);assert.equal(g.partial,undefined);assert.equal(cards.length,p.expectedCards);});
test('two to six visible columns are detected without labelling them Monday',()=>{for(const columns of [1,2,3,4,5,6]){const p=calendarFixture({columns}),cards=detectCards(p.data,p.width,p.height);assert.equal(findGrid(p.data,p.width,p.height,cards),undefined);const g=findPartialGrid(p.data,p.width,p.height,cards);assert(g);assert.equal(g.columns.length,columns+1);assert.equal(g.partial,true);assert.equal(g.startWeekday,undefined);}});
test('partial grid dates require a confirmed first weekday and compatible exact date',()=>{const grid={columns:[0,100,200,300],rows:[0,150,300],partial:true},item=(id,col,row)=>({card:{id,x:col*100+5,y:row*150+30,width:90,height:80}}),items=[item(1,0,0),item(2,2,0),item(3,0,1)],anchor={cardId:1,date:'2026-11-04',mondayFirst:true,source:'manual'};
 assert(associateDates(items,grid,anchor).every(r=>!r.date));grid.startWeekday=2;assert.deepEqual(associateDates(items,grid,anchor).map(r=>r.date),['2026-11-04','2026-11-06','2026-11-11']);grid.startWeekday=1;assert(associateDates(items,grid,anchor).every(r=>!r.date));grid.startWeekday=6;assert(associateDates(items,grid,anchor).every(r=>!r.date));
});
test('absent borders cannot fabricate a partial grid',()=>{const p=calendarFixture({columns:3}),cards=detectCards(p.data,p.width,p.height);assert.equal(findPartialGrid(new Uint8ClampedArray(p.width*p.height*4).fill(255),p.width,p.height,cards),undefined);});

test('a confirmed manual date can correct anchor day OCR while other conflicts remain flagged',()=>{
 const grid={columns:[0,100,200],rows:[0,150,300],partial:true,startWeekday:2},items=[{card:{id:1,x:5,y:30,width:90,height:80},day:'9'},{card:{id:2,x:105,y:30,width:90,height:80},day:'8'}];
 const result=associateDates(items,grid,{cardId:1,date:'2026-11-04',mondayFirst:true,source:'manual'});assert.equal(result[0].date,'2026-11-04');assert.equal(result[1].date,undefined);assert.equal(result[1].candidate,'2026-11-05');
});

test('wide landscape whitespace does not change grid pitch or lose date columns',()=>{
 const p=calendarFixture(),width=2400,height=p.height,data=new Uint8ClampedArray(width*height*4).fill(255),offset=800;
 for(let y=0;y<height;y++)data.set(p.data.subarray(y*p.width*4,(y+1)*p.width*4),(y*width+offset)*4);
 const cards=detectCards(data,width,height),g=findGrid(data,width,height,cards);assert(g);assert.equal(g.columns.length,8);assert.equal(cards.length,p.expectedCards);assert.equal(g.columns[0],820);
});
