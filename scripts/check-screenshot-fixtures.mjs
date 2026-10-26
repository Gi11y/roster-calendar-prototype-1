import{readFileSync,writeFileSync}from'node:fs';import{resolve,dirname}from'node:path';import{gunzipSync}from'node:zlib';
import{detectCards,findGrid,findPartialGrid,dayCell}from'../src/card-data.ts';import{proposeRosterCrop,excludedCards}from'../src/roster-crop.ts';import{rotatedSize,rotationMatrix}from'../src/image-preparation.ts';
const input=process.argv[2];if(!input){console.error('Usage: node --experimental-strip-types scripts/check-screenshot-fixtures.mjs <private manifest.json> [report.json]');process.exit(2);}
const root=dirname(resolve(input)),manifest=JSON.parse(readFileSync(input,'utf8')),results=[];
for(const row of manifest.cases){
 let width=row.width,height=row.height,bytes=readFileSync(resolve(root,row.pixels)),data=new Uint8ClampedArray(row.pixels.endsWith('.gz')?gunzipSync(bytes):bytes);
 if(data.length!==width*height*4)throw Error('Pixel dimensions do not match '+row.name);
 if(row.turn){const size=rotatedSize(width,height,row.turn),next=new Uint8ClampedArray(size.width*size.height*4),[a,b,c,d,e,f]=rotationMatrix(width,height,row.turn);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const xx=Math.floor(a*(x+.5)+c*(y+.5)+e),yy=Math.floor(b*(x+.5)+d*(y+.5)+f);next.set(data.subarray((y*width+x)*4,(y*width+x+1)*4),(yy*size.width+xx)*4);}data=next;width=size.width;height=size.height;
 }
 const cards=detectCards(data,width,height),grid=findGrid(data,width,height,cards)??findPartialGrid(data,width,height,cards),crop=proposeRosterCrop(data,width,height),bounded=cards.filter(card=>{const cell=dayCell(card,grid);return cell?.top!==undefined&&cell?.bottom!==undefined;}).length;
 const errors=[];if(cards.length!==row.expected.cards)errors.push('card count');if(row.expected.columns!==undefined&&grid?.columns.length-1!==row.expected.columns)errors.push('weekday columns');if(row.expected.bounded&&bounded!==cards.length)errors.push('unbounded cards');if(excludedCards(crop.rect,cards))errors.push('automatic crop excluded cards');
 results.push({name:row.name,cards:cards.length,columns:grid?grid.columns.length-1:0,bounded,partial:!!grid?.partial,pass:!errors.length,errors});
}
const report={kind:'layout only — dates, labels and printed hours require OCR/device checks',cases:results.length,passed:results.filter(r=>r.pass).length,results};if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=results.some(r=>!r.pass)?1:0;
