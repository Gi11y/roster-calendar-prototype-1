export type Colour='light'|'dark'|'uncertain';
export interface Rect {x:number;y:number;width:number;height:number}
export interface Card extends Rect {id:number;rgb:[number,number,number];hue:number;colour:Colour;coverage:number}
export interface Grid {columns:number[];rows:number[]}
export function hue(r:number,g:number,b:number):number {const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(!d)return 0;let h=max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4;return(h*60+360)%360;}
export function green(r:number,g:number,b:number):boolean{return g>65&&g>r*1.08&&g>b*1.2&&g-Math.min(r,b)>35;}
export function classify(h:number,saturation:number):Colour {if(saturation<.35)return'uncertain';if(h>=52&&h<=90)return'light';if(h>=104&&h<=145)return'dark';return'uncertain';}
export function detectCards(data:Uint8ClampedArray,width:number,height:number):Card[]{
 if(data.length!==width*height*4)throw Error('Image dimensions do not match pixel data.');
 const mask=new Uint8Array(width*height),queue=new Uint32Array(width*height);
 for(let i=0;i<mask.length;i++)mask[i]=green(data[i*4],data[i*4+1],data[i*4+2])?1:0;
 const found:Card[]=[];
 for(let seed=0;seed<mask.length;seed++){
  if(!mask[seed])continue;let head=0,tail=1;queue[0]=seed;mask[seed]=0;
  let x0=width,y0=height,x1=0,y1=0,count=0;const hist=new Uint32Array(360),rgbs=new Float64Array(360*3);
  while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width),r=data[i*4],g=data[i*4+1],b=data[i*4+2],h=Math.floor(hue(r,g,b));count++;hist[h]++;rgbs[h*3]+=r;rgbs[h*3+1]+=g;rgbs[h*3+2]+=b;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
   for(const next of [x>0?i-1:-1,x+1<width?i+1:-1,y>0?i-width:-1,y+1<height?i+width:-1])if(next>=0&&mask[next]){mask[next]=0;queue[tail++]=next;}
  }
  const w=x1-x0+1,h=y1-y0+1,coverage=count/(w*h);
  if(w<Math.max(22,width*.023)||h<14||(w>width*.98&&h>height*.98)||count<180||coverage<.35)continue;
  let mode=0;for(let k=1;k<360;k++)if(hist[k]>hist[mode])mode=k;
  const n=hist[mode],rgb=[rgbs[mode*3]/n,rgbs[mode*3+1]/n,rgbs[mode*3+2]/n] as [number,number,number],sat=(Math.max(...rgb)-Math.min(...rgb))/Math.max(...rgb);
  found.push({id:0,x:x0,y:y0,width:w,height:h,rgb:rgb.map(Math.round) as [number,number,number],hue:mode,colour:classify(mode,sat),coverage});
 }
 return found.sort((a,b)=>a.y-b.y||a.x-b.x).map((card,i)=>({...card,id:i+1}));
}
function peaks(scores:number[],threshold:number):number[]{const out:number[]=[];for(let i=0;i<scores.length;){if(scores[i]<threshold){i++;continue;}let sum=0,n=0;while(i<scores.length&&scores[i]>=threshold){sum+=i;n++;i++;}out.push(Math.round(sum/n));}return out;}
function grey(data:Uint8ClampedArray,i:number):boolean {const r=data[i],g=data[i+1],b=data[i+2];return Math.max(r,g,b)-Math.min(r,g,b)<=12&&r>=200&&r<=246;}
export function findGrid(data:Uint8ClampedArray,width:number,height:number,cards:Card[]):Grid|undefined{
 if(!cards.length)return;
 const top=Math.max(0,Math.min(...cards.map(c=>c.y))-45),bottom=Math.min(height,Math.max(...cards.map(c=>c.y+c.height))+60),scores=new Array<number>(width).fill(0);
 for(let x=0;x<width;x++)for(let y=top;y<bottom;y++)if(grey(data,(y*width+x)*4))scores[x]++;
 const lines=peaks(scores,(bottom-top)*.38);let columns:number[]|undefined,best=Infinity;
 for(let a=0;a<lines.length;a++)for(let b=a+1;b<lines.length;b++){
  const step=lines[b]-lines[a];if(step<width*.05||step>width*.17)continue;const candidate:number[]=[];let error=0;
  for(let k=0;k<8;k++){const target=lines[a]+step*k,near=lines.reduce((p,v)=>Math.abs(v-target)<Math.abs(p-target)?v:p,lines[0]);if(Math.abs(near-target)>Math.max(4,step*.07)){error=Infinity;break;}candidate.push(near);error+=Math.abs(near-target);}
  if(new Set(candidate).size===8&&error<best&&cards.every(c=>c.x>=candidate[0]-4&&c.x+c.width<=candidate[7]+4)){best=error;columns=candidate;}
 }
 if(!columns)return;
 // Follow visible vertical borders below the last green card. Leave/secondary
 // entries can make the final date row much taller than the green card itself.
 const cellWidth=(columns[7]-columns[0])/7,lastCardBottom=Math.max(...cards.map(c=>c.y+c.height));
 let lastBorderY=Math.min(height-1,Math.floor(lastCardBottom));
 const allowedGap=Math.max(24,Math.ceil(cellWidth*1.25));
 for(let y=lastBorderY;y<height;y++){
  let supported=0;
  for(const column of columns){let present=false;for(let dx=-2;dx<=2;dx++){const x=Math.round(column)+dx;if(x>=0&&x<width&&grey(data,(y*width+x)*4)){present=true;break;}}if(present)supported++;}
  if(supported>=5)lastBorderY=y;
  if(y-lastBorderY>allowedGap)break;
 }
 const rowBottom=Math.min(height,Math.max(bottom,lastBorderY+3));
 const rowscore=new Array<number>(height).fill(0),left=columns[0],right=columns[7];
 for(let y=top;y<rowBottom;y++)for(let x=left;x<=right;x++)if(grey(data,(y*width+x)*4))rowscore[y]++;
 let rows=peaks(rowscore,(right-left)*.52).filter(y=>y>=top&&y<=rowBottom);
 // A fixed 45px lead-in can start below the first week border on large screenshots.
 // Expand only if the earliest cards are unbounded, and still require visible grey pixels.
 const firstCardTop=Math.min(...cards.map(c=>c.y));
 if(!rows.length||rows[0]>firstCardTop){
  const earlierTop=Math.max(0,Math.floor(Math.min(top,firstCardTop-cellWidth*.65)));
  for(let y=earlierTop;y<top;y++)for(let x=left;x<=right;x++)if(grey(data,(y*width+x)*4))rowscore[y]++;
  rows=peaks(rowscore,(right-left)*.52).filter(y=>y>=earlierTop&&y<=rowBottom);
 }
 return {columns,rows};
}
export function dayCell(card:Card,grid:Grid|undefined):{column:number;top?:number;bottom?:number}|undefined{
 if(!grid)return;const cx=card.x+card.width/2;const column=grid.columns.findIndex((x,i)=>i<7&&cx>=x&&cx<grid.columns[i+1]);if(column<0)return;
 const top=grid.rows.filter(y=>y<=card.y).pop(),bottom=grid.rows.find(y=>y>card.y+card.height-3);return{column,top,bottom};
}
export function labelFromText(text:string):'A'|'P'|'N'|'N10'|undefined {const first=text.trim().toUpperCase().split(/\r?\n/)[0].trim();const m=first.match(/^(N\s*10|N|A|P)\b/);return m?m[1].replace(/\s/g,'') as 'A'|'P'|'N'|'N10':undefined;}
export interface TimeRange {start:string;end:string;nextDay:boolean;minutes:number}
function clock(h:number,m:number):string{return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
export function explicitRange(text:string):TimeRange|undefined{
 const s=text.replace(/[–—−]/g,'-');const pattern=/(?:^|[^0-9])([0-2]?\d)[:.]([0-5]\d)\s*(?:-|to)\s*([0-2]?\d)[:.]([0-5]\d)(?!\d)/gi;let match:RegExpExecArray|null;const found:TimeRange[]=[];
 while((match=pattern.exec(s))){const a=Number(match[1])*60+Number(match[2]),b=Number(match[3])*60+Number(match[4]);if(Number(match[1])>23||Number(match[3])>23||a===b)continue;const duration=(b-a+1440)%1440;if(duration>16*60)continue;found.push({start:clock(Number(match[1]),Number(match[2])),end:clock(Number(match[3]),Number(match[4])),nextDay:b<a,minutes:duration});}
 const unique=[...new Map(found.map(r=>[r.start+'|'+r.end,r])).values()];return unique.length===1?unique[0]:undefined;
}
export function proposal(label:string|undefined,colour:Colour,text:string):{range?:TimeRange;basis:string;warning?:string}{
 const printed=explicitRange(text);if(printed)return{range:printed,basis:'Printed time range - verify against image'};
 if(/\d{1,2}[:.]\d{2}/.test(text))return{basis:'Needs review',warning:'Time text is present but incomplete, invalid or ambiguous. Defaults were not substituted.'};
 let start:number,duration:number;
 if(label==='N'){start=19*60;duration=720;}else if(label==='N10'){start=21*60+45;duration=600;}
 else if((label==='A'||label==='P')){start=label==='A'?420:810;duration=480;}
 else return{basis:'Needs review',warning:'A clear A, P, N or N10 label is required.'};
 const end=(start+duration)%1440;return{range:{start:clock(Math.floor(start/60),start%60),end:clock(Math.floor(end/60),end%60),nextDay:start+duration>=1440,minutes:duration},basis:label==='N'||label==='N10'?'Inferred from confirmed night-label defaults':'Inferred 8-hour default; verify that no printed time was missed',warning:'No date/timezone has been assigned. Check the end time and any printed range.'};
}
