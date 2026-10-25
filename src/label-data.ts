import type {Rect} from './card-data';
export interface LabelPixels {bounds:Rect;mask:Uint8Array;width:number;height:number;components:number}
export function isolateLabel(data:Uint8ClampedArray,width:number,height:number,background:[number,number,number]):LabelPixels|undefined{
 if(data.length!==width*height*4)throw Error('Label pixel dimensions do not match.');
 const bg=.299*background[0]+.587*background[1]+.114*background[2],mask=new Uint8Array(width*height),seen=new Uint8Array(width*height);
 for(let i=0;i<mask.length;i++)mask[i]=(.299*data[i*4]+.587*data[i*4+1]+.114*data[i*4+2])<Math.min(145,bg*.74)?1:0;
 const parts:Rect[]=[];
 for(let seed=0;seed<mask.length;seed++){if(!mask[seed]||seen[seed])continue;const queue=[seed];seen[seed]=1;let n=0,x0=width,y0=height,x1=0,y1=0;
 for(let k=0;k<queue.length;k++){const i=queue[k],x=i%width,y=Math.floor(i/width);n++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*width+xx;if(xx>=0&&xx<width&&yy>=0&&yy<height&&mask[j]&&!seen[j]){seen[j]=1;queue.push(j);}}}
 if(n>=5&&y1-y0+1>=4&&x1-x0+1>=2)parts.push({x:x0,y:y0,width:x1-x0+1,height:y1-y0+1});
 }
 if(!parts.length)return;parts.sort((a,b)=>a.x-b.x||a.y-b.y);
 // Select the first character near the upper-left; avoid a lower time line.
 const anchor=parts.filter(p=>p.x<width*.45).sort((a,b)=>a.y-b.y||a.x-b.x)[0];if(!anchor)return;
 const line=parts.filter(p=>Math.abs((p.y+p.height/2)-(anchor.y+anchor.height/2))<=Math.max(3,anchor.height*.4)).sort((a,b)=>a.x-b.x);
 const selected=[anchor];let right=anchor.x+anchor.width;
 for(const p of line){if(p.x<=anchor.x)continue;if(p.x-right>Math.max(5,anchor.height*.6))break;selected.push(p);right=p.x+p.width;}
 const x=Math.max(0,anchor.x-2),y=Math.max(0,Math.min(...selected.map(p=>p.y))-2),x1=Math.min(width,Math.max(...selected.map(p=>p.x+p.width))+2),y1=Math.min(height,Math.max(...selected.map(p=>p.y+p.height))+2);
 return{bounds:{x,y,width:x1-x,height:y1-y},mask,width,height,components:selected.length};
}
export interface LabelReading {label?:string;confidence:number;source:string}
export function chooseLabel(readings:LabelReading[]):{label?:string;confidence?:number;reason:string}{
 const valid=readings.filter(r=>r.label&&['A','P','N','N10'].includes(r.label)&&r.confidence>=25);
 const strong=new Set(valid.filter(r=>r.confidence>=60).map(r=>r.label));
 if(strong.size>1)return{reason:'Label readings disagree - review the enlarged crop.'};
 const groups=new Map<string,LabelReading[]>();for(const r of valid){const list=groups.get(r.label!)||[];list.push(r);groups.set(r.label!,list);}
 const ranked=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length||Math.max(...b[1].map(x=>x.confidence))-Math.max(...a[1].map(x=>x.confidence)));
 if(!ranked.length)return{reason:'No reliable label reading - select A, P, N or N10 manually.'};
 const [label,items]=ranked[0],score=Math.max(...items.map(r=>r.confidence));
 if(items.length>=2&&(ranked.length===1||items.length>ranked[1][1].length))return{label,confidence:score,reason:'Matching label readings; check against the enlarged crop.'};
 if(score>=85&&ranked.length===1)return{label,confidence:score,reason:'One strong label reading; check against the enlarged crop.'};
 return{reason:'Label is uncertain - select it manually after checking the crop.'};
}
