import type {Rect} from './card-data';
export interface LabelPixels {bounds:Rect;mask:Uint8Array;width:number;height:number;components:number;lightInk:boolean}
export function isolateLabel(data:Uint8ClampedArray,width:number,height:number,background:[number,number,number],lightInk=false):LabelPixels|undefined{
 if(data.length!==width*height*4)throw Error('Label pixel dimensions do not match.');
 const bg=.299*background[0]+.587*background[1]+.114*background[2],mask=new Uint8Array(width*height),seen=new Uint8Array(width*height);
 for(let i=0;i<mask.length;i++)mask[i]=(lightInk?(.299*data[i*4]+.587*data[i*4+1]+.114*data[i*4+2])>Math.min(245,bg+45):(.299*data[i*4]+.587*data[i*4+1]+.114*data[i*4+2])<Math.min(145,bg*.74))?1:0;
 const parts:Rect[]=[];
 for(let seed=0;seed<mask.length;seed++){if(!mask[seed]||seen[seed])continue;const queue=[seed];seen[seed]=1;let n=0,x0=width,y0=height,x1=0,y1=0;
 for(let k=0;k<queue.length;k++){const i=queue[k],x=i%width,y=Math.floor(i/width);n++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*width+xx;if(xx>=0&&xx<width&&yy>=0&&yy<height&&mask[j]&&!seen[j]){seen[j]=1;queue.push(j);}}}
 if(n>=5&&y1-y0+1>=4&&x1-x0+1>=2&&(!lightInk||(x0>0&&y0>0&&x1<width-1&&y1<height-1)))parts.push({x:x0,y:y0,width:x1-x0+1,height:y1-y0+1});
 }
 if(!parts.length)return lightInk?undefined:isolateLabel(data,width,height,background,true);parts.sort((a,b)=>a.x-b.x||a.y-b.y);
 // Select the first character near the upper-left; avoid a lower time line.
 const anchor=parts.filter(p=>p.x<width*.45).sort((a,b)=>a.y-b.y||a.x-b.x)[0];if(!anchor)return lightInk?undefined:isolateLabel(data,width,height,background,true);
 const line=parts.filter(p=>Math.abs((p.y+p.height/2)-(anchor.y+anchor.height/2))<=Math.max(3,anchor.height*.4)).sort((a,b)=>a.x-b.x);
 const selected=[anchor];let right=anchor.x+anchor.width;
 for(const p of line){if(p.x<=anchor.x)continue;if(p.x-right>Math.max(5,anchor.height*.6))break;selected.push(p);right=p.x+p.width;}
 const x=Math.max(0,anchor.x-2),y=Math.max(0,Math.min(...selected.map(p=>p.y))-2),x1=Math.min(width,Math.max(...selected.map(p=>p.x+p.width))+2),y1=Math.min(height,Math.max(...selected.map(p=>p.y+p.height))+2);
 return{bounds:{x,y,width:x1-x,height:y1-y},mask,width,height,components:selected.length,lightInk};
}
export interface LabelReading {label?:string;confidence:number;source:string;rawText?:string;detail?:string}
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

export interface GlyphCheck {reading?:LabelReading;reason:string;metrics?:Record<string,number>}
export function pGlyphCheck(label:LabelPixels|undefined):GlyphCheck{
 if(!label)return{reason:'No isolated glyph was found.'};
 if(label.components!==1)return{reason:'Not a single connected glyph ('+label.components+' components); P contour check skipped.'};
 const b=label.bounds,points:Array<[number,number]>=[];for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)if(label.mask[y*label.width+x])points.push([x,y]);if(!points.length)return{reason:'The isolated label contains no ink pixels.'};
 const x0=Math.min(...points.map(p=>p[0])),x1=Math.max(...points.map(p=>p[0])),y0=Math.min(...points.map(p=>p[1])),y1=Math.max(...points.map(p=>p[1])),w=x1-x0+1,h=y1-y0+1;
 const metrics:Record<string,number>={width:w,height:h,aspect:Number((w/h).toFixed(3))};
 if(w<4||h<6||w/h<.4||w/h>1.05)return{reason:'Glyph size or aspect is outside the conservative P range.',metrics};
 const ink=(x:number,y:number)=>label.mask[(y0+y)*label.width+x0+x]===1;
 function density(left:number,top:number,right:number,bottom:number){let yes=0,n=0;for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){yes+=ink(x,y)?1:0;n++;}return n?yes/n:0;}
 const stem=density(0,Math.floor(h*.55),Math.max(1,Math.ceil(w*.3)),h),lowerRight=density(Math.floor(w*.5),Math.floor(h*.75),w,h),upperRight=density(Math.floor(w*.5),0,w,Math.ceil(h*.6));
 Object.assign(metrics,{lowerLeftInk:Number(stem.toFixed(3)),lowerRightInk:Number(lowerRight.toFixed(3)),upperRightInk:Number(upperRight.toFixed(3))});
 if(stem<.55)return{reason:'P shape rejected: lower-left stem density '+stem.toFixed(3)+' is below 0.55.',metrics};
 if(lowerRight>.12)return{reason:'P shape rejected: lower-right ink density '+lowerRight.toFixed(3)+' exceeds 0.12 (the bowl may extend into this region).',metrics};
 if(upperRight<.25)return{reason:'P shape rejected: upper-right ink density '+upperRight.toFixed(3)+' is below 0.25.',metrics};
 const seen=new Uint8Array(w*h);let upperLoop=false;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const seed=y*w+x;if(ink(x,y)||seen[seed])continue;const queue=[seed];seen[seed]=1;let edge=false,sumY=0,count=0;for(let k=0;k<queue.length;k++){const i=queue[k],xx=i%w,yy=Math.floor(i/w);sumY+=yy;count++;if(xx===0||yy===0||xx===w-1||yy===h-1)edge=true;for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=xx+dx,ny=yy+dy,j=ny*w+nx;if(nx>=0&&nx<w&&ny>=0&&ny<h&&!seen[j]&&!ink(nx,ny)){seen[j]=1;queue.push(j);}}}if(!edge&&count&&sumY/count<h*.65)upperLoop=true;}
 return upperLoop?{reading:{label:'P',confidence:93,source:'P glyph contour (upper loop and lower stem)'},reason:'P shape accepted: upper closed loop and lower-left stem found.',metrics}:{reason:'P shape rejected: no closed upper loop was found.',metrics};
}
export function pGlyphEvidence(label:LabelPixels|undefined):LabelReading|undefined{return pGlyphCheck(label).reading;}
