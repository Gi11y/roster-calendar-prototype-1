import{test}from'node:test';import assert from'node:assert/strict';
import{cropFromGrid,proposeRosterCrop,clampCrop,scaleCrop,excludedCards}from'../src/roster-crop.ts';
const width=1000,height=2200,grid={columns:[250,350,450,550,650,750,850,950],rows:[550,650,750,850,1050]},weekdays={x:250,y:525,width:700,height:25};
const cards=[{x:255,y:585,width:90,height:40},{x:855,y:870,width:90,height:90}];
test('crop retains all seven columns, heading margin, trailing blanks and secondary rows',()=>{
 const result=cropFromGrid(width,height,cards,grid,weekdays);assert.equal(result.automatic,true);assert(result.rect.x<250);assert(result.rect.x+result.rect.width>950);
 assert(result.rect.y<=325);assert(result.rect.y+result.rect.height>1050);assert.equal(excludedCards(result.rect,cards),0);
});
test('leading leave rows above the first green card remain inside the crop',()=>{
 const lower=[{x:455,y:900,width:90,height:80}];const result=cropFromGrid(width,height,lower,{...grid,rows:[850,1050]},weekdays);
 assert.equal(result.automatic,true);assert(result.rect.y<525);assert(result.rect.y+result.rect.height>=1050);
});
test('uncertain or absent grids/weekday headings and isolated card images keep the original',()=>{
 for(const candidate of [undefined,{...grid,columns:[250,350]},{...grid,rows:[550]}]){const result=cropFromGrid(width,height,cards,candidate,weekdays);assert.equal(result.automatic,false);assert.deepEqual(result.rect,{x:0,y:0,width,height});}
 assert.equal(cropFromGrid(width,height,cards,grid,undefined).automatic,false);assert.equal(cropFromGrid(width,height,[],grid,weekdays).automatic,false);
});
test('bad geometry or any detected card outside the selection falls back to the full image',()=>{
 const bad=[{x:5,y:100,width:100,height:80},...cards];assert.equal(cropFromGrid(width,height,bad,grid,weekdays).automatic,false);
 assert.equal(cropFromGrid(width,height,cards,{...grid,columns:[250,350,450,455,650,750,850,950]},weekdays).automatic,false);
});
test('mapping to original pixels expands outwards and never drops edge pixels',()=>{
 const original=scaleCrop({x:10,y:20,width:61,height:83},101,201,404,804);assert.deepEqual(original,{x:40,y:80,width:244,height:332});
 const fractional=scaleCrop({x:1,y:1,width:2,height:2},7,7,13,13);assert.equal(fractional.x,1);assert.equal(fractional.width,5);
});
test('manual crops remain within bounds with at least one pixel and can restore the full image',()=>{
 assert.deepEqual(clampCrop({x:-20,y:-5,width:200,height:500},100,200),{x:0,y:0,width:100,height:200});
 assert.deepEqual(clampCrop({x:200,y:400,width:-5,height:0},100,200),{x:99,y:199,width:1,height:1});
 assert.equal(excludedCards({x:0,y:0,width:1000,height:2200},cards),0);assert.equal(excludedCards({x:300,y:600,width:300,height:100},cards),2);
});
test('blank pixels never fabricate a crop or shift',()=>{
 const data=new Uint8ClampedArray(100*100*4);data.fill(255);const result=proposeRosterCrop(data,100,100);assert.equal(result.automatic,false);assert.equal(result.cards.length,0);assert.deepEqual(result.rect,{x:0,y:0,width:100,height:100});
});
