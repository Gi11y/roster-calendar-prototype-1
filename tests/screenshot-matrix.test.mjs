import{test}from'node:test';import assert from'node:assert/strict';import{detectCards,findGrid,dayCell}from'../src/card-data.ts';import{calendarFixture}from'./helpers/calendar-fixture.mjs';
for(const cell of [40,70,100,150,210])for(const landscape of [false,true])test('layout matrix: '+cell+'px cells, '+(landscape?'wide':'portrait'),()=>{
 const p=calendarFixture({cell,landscape}),cards=detectCards(p.data,p.width,p.height),grid=findGrid(p.data,p.width,p.height,cards);assert.equal(cards.length,p.expectedCards);assert(grid);assert.equal(grid.columns.length,8);assert(cards.every(card=>{const c=dayCell(card,grid);return c?.top!==undefined&&c?.bottom!==undefined;}));
});

for(const scale of [.633,.697])test('fractional column pitch after resize: '+scale,()=>{
 const original=calendarFixture({cell:100}),width=Math.round(original.width*scale),height=original.height,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const source=(y*original.width+Math.min(original.width-1,Math.floor(x/scale)))*4;data.set(original.data.subarray(source,source+4),(y*width+x)*4);}
 const cards=detectCards(data,width,height),grid=findGrid(data,width,height,cards);assert.equal(cards.length,original.expectedCards);assert(grid,'all eight borders must survive fractional pixel spacing');assert.equal(grid.columns.length,8);assert(cards.every(card=>{const c=dayCell(card,grid);return c?.top!==undefined&&c?.bottom!==undefined;}));
});
