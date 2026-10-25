import {test} from 'node:test';import assert from 'node:assert/strict';
import {detectCards,classify,green,labelFromText,explicitRange,proposal,dayCell,findGrid} from '../src/card-data.ts';
function image(){const w=200,h=180,d=new Uint8ClampedArray(w*h*4).fill(255);function rectangle(x,y,width,height,rgb){for(let j=y;j<y+height;j++)for(let i=x;i<x+width;i++){const k=(j*w+i)*4;d.set([...rgb,255],k);}}return{w,h,d,rectangle};}
test('detect separate stacked green cards and reject purple/grey decorations',()=>{const x=image();x.rectangle(20,20,50,40,[160,200,0]);x.rectangle(20,75,50,45,[35,185,35]);x.rectangle(100,20,50,40,[110,90,130]);x.rectangle(100,80,50,40,[170,170,150]);const cards=detectCards(x.d,x.w,x.h);assert.equal(cards.length,2);assert.equal(cards[0].colour,'light');assert.equal(cards[1].colour,'dark');assert.equal(cards[0].x,20);assert.equal(cards[1].y,75);});
test('small green icons do not become shift cards',()=>{const x=image();x.rectangle(20,20,10,10,[30,190,30]);assert.equal(detectCards(x.d,x.w,x.h).length,0);});
test('ambiguous hue and desaturated colours stay uncertain',()=>{assert.equal(classify(97,.8),'uncertain');assert.equal(classify(75,.1),'uncertain');assert.equal(green(120,70,120),false);});
test('top line distinguishes N from N10 and does not invent unknown labels',()=>{assert.equal(labelFromText('N\n19:00 - 07:00'),'N');assert.equal(labelFromText('N10'),'N10');assert.equal(labelFromText('N 10'),'N10');assert.equal(labelFromText('N12'),undefined);assert.equal(labelFromText('ANNUAL'),undefined);});
test('explicit time ranges override label/colour defaults',()=>{const p=proposal('A','light','A\n11:00 – 19:30');assert.equal(p.range.start,'11:00');assert.equal(p.range.end,'19:30');assert.equal(p.range.minutes,510);assert.match(p.basis,/Printed/);});
test('both staff roles share 8h A/P defaults when no range is printed',()=>{assert.equal(proposal('A','dark','A').range.end,'15:00');assert.equal(proposal('P','dark','P').range.end,'21:30');assert.equal(proposal('A','light','A').range.end,'15:00');assert.equal(proposal('P','light','P').range.end,'21:30');});
test('floor-staff night labels have their own rules',()=>{const n=proposal('N','dark','N').range;assert.equal(n.start,'19:00');assert.equal(n.end,'07:00');assert.equal(n.nextDay,true);const n10=proposal('N10','dark','N10').range;assert.equal(n10.start,'21:45');assert.equal(n10.end,'07:45');assert.equal(n10.minutes,600);});
test('unknown role colour does not change hours, but an unclear label stays unassigned',()=>{assert.equal(proposal('A','uncertain','A').range.end,'15:00');assert.equal(proposal(undefined,'light','???').range,undefined);});
test('invalid, identical or multiple ranges are not silently chosen',()=>{assert.equal(explicitRange('24:00 - 07:00'),undefined);assert.equal(explicitRange('07:00 - 07:00'),undefined);assert.equal(explicitRange('07:00 - 15:00 13:30 - 21:30'),undefined);});
test('grid evidence associates stacked cards with one column without assigning a full date',()=>{const grid={columns:[0,30,60,90,120,150,180,210],rows:[0,100,200]};const card={x:32,y:60,width:25,height:20};assert.deepEqual(dayCell(card,grid),{column:1,top:0,bottom:100});assert.equal(dayCell(card,undefined),undefined);});

test('ambiguous printed times prevent inferred fallback',()=>{assert.equal(proposal('A','light','A 07:00 - 07:00').range,undefined);assert.equal(proposal('P','dark','P 13:30').range,undefined);});
test('grid detection finds regular column borders and refuses an absent grid',()=>{const w=300,h=240,d=new Uint8ClampedArray(w*h*4).fill(255);const put=(x,y,rgb)=>d.set([...rgb,255],(y*w+x)*4);for(let i=0;i<8;i++)for(let y=30;y<=220;y++)put(20+i*35,y,[225,225,225]);for(const y of [50,120,200])for(let x=20;x<=265;x++)put(x,y,[225,225,225]);for(let y=65;y<95;y++)for(let x=25;x<50;x++)put(x,y,[30,190,30]);const cards=detectCards(d,w,h),g=findGrid(d,w,h,cards);assert(g);assert.equal(g.columns.length,8);assert.equal(dayCell(cards[0],g).column,0);assert.equal(findGrid(new Uint8ClampedArray(w*h*4).fill(255),w,h,cards),undefined);});

test('repeated identical readings are one range; conflicting passes stay ambiguous',()=>{assert.equal(explicitRange('07:00 - 15:30\\nTime line: 07:00 - 15:30').end,'15:30');assert.equal(explicitRange('07:00 - 18:30\\nTime line: 07:00 - 19:30'),undefined);});

test('educator role does not imply 12h, but printed times take precedence',()=>{assert.equal(proposal('N','light','N').range.end,'07:00');assert.equal(proposal('A','light','A 08:00 - 16:00').range.end,'16:00');assert.equal(proposal('A','light','A').range.end,'15:00');});

test('a tightly cropped single card is not rejected for spanning most image width',()=>{const x=image();x.rectangle(4,4,192,170,[160,200,0]);assert.equal(detectCards(x.d,x.w,x.h).length,1);});

function tallFinalRow(spanLeave=false,visibleBottom=true){const w=400,h=520,d=new Uint8ClampedArray(w*h*4).fill(255);const put=(x,y,rgb)=>d.set([...rgb,255],(y*w+x)*4);
 const borderEnd=visibleBottom?420:315;
 for(let k=0;k<8;k++)for(let y=50;y<=borderEnd;y++)put(20+k*45,y,[225,225,225]);
 for(const y of [50,120,190,260,...(visibleBottom?[420]:[])])for(let x=20;x<=335;x++)put(x,y,[225,225,225]);
 for(const [left,top]of[[25,65],[25,280],[115,280],[205,280]])for(let y=top;y<top+35;y++)for(let x=left;x<left+30;x++)put(x,y,[35,185,35]);
 if(spanLeave)for(let y=340;y<370;y++)for(let x=20;x<=335;x++)put(x,y,[180,180,150]);
 for(let x=20;x<=335;x++)put(x,505,[225,225,225]);
 return{d,w,h,cards:detectCards(d,w,h)};
}
test('tall final date row is completed from visible vertical borders',()=>{const p=tallFinalRow();const g=findGrid(p.d,p.w,p.h,p.cards);assert(g.rows.includes(420));for(const card of p.cards.slice(1))assert.equal(dayCell(card,g).bottom,420);});
test('a leave bar can interrupt borders without truncating the last row',()=>{const p=tallFinalRow(true);const g=findGrid(p.d,p.w,p.h,p.cards);assert(g.rows.includes(420));assert.equal(g.rows.includes(505),false);});
test('a missing final border is not invented from a distant footer line',()=>{const p=tallFinalRow(false,false);const g=findGrid(p.d,p.w,p.h,p.cards);assert.equal(g.rows.includes(420),false);assert.equal(g.rows.includes(505),false);assert.equal(dayCell(p.cards[1],g).bottom,undefined);});
