import{detectCards,findGrid,findPartialGrid,green,hue,type Card,type Grid,type Rect}from'./card-data.ts';
export type SpecialKind='ANNUAL'|'LWOP'|'COURSE';
export function specialKind(text:string):SpecialKind|undefined{
 const first=text.trim().toUpperCase().replace(/LW0P/g,'LWOP').split(/\r?\n/).slice(0,2).join(' ').replace(/[^A-Z ]/g,' ').replace(/\s+/g,' ').trim();
 if(/^ANNUAL(?: LEAVE)?(?:\s|$)/.test(first))return'ANNUAL';
 if(first.replace(/\s/g,'')==='LWOP'||/^LWOP(?:\s|$)/.test(first)||/^LEAVE WITHOUT PAY(?:\s|$)/.test(first))return'LWOP';
 if(/^COURSES?(?:\s|$)/.test(first))return'COURSE';
}
export function isLeave(label:string|undefined){return label==='ANNUAL'||label==='LWOP';}
export function isSpecial(label:string|undefined){return isLeave(label)||label==='COURSE';}
export function entryName(label:string|undefined){return label==='ANNUAL'?'Annual leave':label==='LWOP'?'LWOP':label==='COURSE'?'Courses':'';}
export function detectOtherBlocks(data:Uint8ClampedArray,width:number,height:number):Rect[]{
 const mask=new Uint8Array(width*height),queue=new Uint32Array(width*height),out:Rect[]=[];
 for(let i=0;i<mask.length;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2],max=Math.max(r,g,b),min=Math.min(r,g,b);mask[i]=!green(r,g,b)&&max>=95&&max<=240&&max-min>=13?1:0;}
 for(let seed=0;seed<mask.length;seed++){if(!mask[seed])continue;let head=0,tail=1,x0=width,x1=0,y0=height,y1=0,count=0;queue[0]=seed;mask[seed]=0;
 while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);count++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(const n of[x>0?i-1:-1,x+1<width?i+1:-1,y>0?i-width:-1,y+1<height?i+width:-1])if(n>=0&&mask[n]){mask[n]=0;queue[tail++]=n;}}
 const w=x1-x0+1,h=y1-y0+1;if(w>=22&&h>=14&&h<height*.5&&count>=180&&count/(w*h)>=.5)out.push({x:x0,y:y0,width:w,height:h});
 }return out;
}
function probe(rect:Rect,width:number):Card{return{...rect,width:Math.max(22,width),id:0,rgb:[180,180,150],hue:60,colour:'uncertain',coverage:1};}
export function detectRosterEntries(data:Uint8ClampedArray,width:number,height:number):{cards:Card[];grid?:Grid}{
 const work=detectCards(data,width,height),blocks=detectOtherBlocks(data,width,height);let grid=findGrid(data,width,height,work)??findPartialGrid(data,width,height,work);
 if(!grid){for(const divisions of[7,1]){const probes=blocks.map(b=>probe({...b,x:b.x+3},b.width/divisions-6));grid=findGrid(data,width,height,probes);if(grid)break;}}
 if(!grid)return{cards:work};
 const step=(grid.columns.at(-1)!-grid.columns[0])/(grid.columns.length-1),margin=Math.max(5,step*.16);
 const selected=blocks.flatMap(b=>{
 const first=grid!.columns.findIndex((x,i)=>i<grid!.columns.length-1&&Math.abs(b.x-x)<=margin),last=grid!.columns.findIndex((x,i)=>i>first&&Math.abs(b.x+b.width-x)<=margin);
 if(first<0||last<=first||b.y+b.height>Math.max(...grid!.rows,0)+step*2)return[];
 const rgbIndex=(Math.min(height-1,Math.round(b.y+b.height/2))*width+Math.min(width-1,Math.round(b.x+Math.min(b.width-1,3))))*4,rgb=[data[rgbIndex],data[rgbIndex+1],data[rgbIndex+2]] as [number,number,number];
 return[{...b,x:Math.max(b.x,grid!.columns[first]+2),width:Math.min(b.width,grid!.columns[first+1]-Math.max(b.x,grid!.columns[first]+2)-2),id:0,rgb,hue:hue(...rgb),colour:'uncertain' as const,coverage:1,nonShiftCandidate:true,spanDays:last-first,sourceRect:b}];
 });
 if(selected.length){const probes=selected.flatMap(c=>[c,...(c.spanDays!>1?[{...c,x:grid!.columns[grid!.columns.findIndex(x=>x>c.x)-1+c.spanDays!-1]+3,width:step-6}]:[])]),expanded=findGrid(data,width,height,[...work,...probes])??findPartialGrid(data,width,height,[...work,...probes]);if(expanded)grid=expanded;}
 grid={...grid,rows:grid.rows.filter(y=>!selected.some(c=>c.spanDays!>1&&y>=c.y-step*.06&&y<=c.y+c.height+step*.06))};
 return{cards:[...work,...selected].sort((a,b)=>a.y-b.y||a.x-b.x).map((c,i)=>({...c,id:i+1})),grid};
}
