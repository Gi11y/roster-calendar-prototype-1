import{test}from'node:test';import assert from'node:assert/strict';import{detectCards,findGrid,dayCell}from'../src/card-data.ts';import{calendarFixture}from'./helpers/calendar-fixture.mjs';
for(const cell of [40,70,100,150,210])for(const landscape of [false,true])test('layout matrix: '+cell+'px cells, '+(landscape?'wide':'portrait'),()=>{
 const p=calendarFixture({cell,landscape}),cards=detectCards(p.data,p.width,p.height),grid=findGrid(p.data,p.width,p.height,cards);assert.equal(cards.length,p.expectedCards);assert(grid);assert.equal(grid.columns.length,8);assert(cards.every(card=>{const c=dayCell(card,grid);return c?.top!==undefined&&c?.bottom!==undefined;}));
});


for(const cell of [63.3,69.7])test('fractional column pitch: '+cell,()=>{
 const p=calendarFixture({cell,offsetX:20.3}),cards=detectCards(p.data,p.width,p.height),grid=findGrid(p.data,p.width,p.height,cards);
 assert.equal(cards.length,p.expectedCards);assert(grid,'all eight visible borders must survive fractional pixel spacing');assert.equal(grid.columns.length,8);assert(cards.every(card=>{const c=dayCell(card,grid);return c?.top!==undefined&&c?.bottom!==undefined;}));
});
