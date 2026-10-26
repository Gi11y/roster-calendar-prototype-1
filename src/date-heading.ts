import{headerMonths}from'./auto-dates.ts';
import type{Rect}from'./card-data.ts';
// Isolate short heading lines, keeping the selected-date control away from department text.
export function dateHeadingBands(data:Uint8ClampedArray,width:number,height:number,left:number,right:number,gridTop:number,weekdayTop?:number):Rect[]{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||data.length<width*height*4||![left,right,gridTop].every(Number.isFinite)||right<=left)return[];
 const unit=Math.max(.5,Math.min(3,(right-left)/700));
 const x0=Math.max(0,Math.floor(left)),x1=Math.min(width,Math.ceil(left+(right-left)*.62)),span=x1-x0;
 const top=Math.max(0,Math.floor(gridTop-520)),bottom=Math.min(height,Math.floor(weekdayTop??gridTop));if(span<20||bottom<=top)return[];
 const ink:{y:number;left:number;right:number}[]=[];
 for(let y=top;y<bottom;y++){
  let count=0,min=x1,max=x0;
  for(let x=x0;x<x1;x++){const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];if(Math.max(r,g,b)<190&&Math.max(r,g,b)-Math.min(r,g,b)<45){count++;min=Math.min(min,x);max=Math.max(max,x);}}
  if(count>=Math.max(3,span*.007)&&count/span<.55)ink.push({y,left:min,right:max});
 }
 const groups:typeof ink[]=[];
 for(const row of ink){const previous=groups[groups.length-1];if(previous&&row.y-previous[previous.length-1].y<=Math.ceil(4*unit))previous.push(row);else groups.push([row]);}
 const pad=Math.ceil(8*unit),bands:Rect[]=[];
 for(const rows of groups){const y=rows[0].y,h=rows[rows.length-1].y-y+1,l=Math.min(...rows.map(r=>r.left)),r=Math.max(...rows.map(r=>r.right));
  if(h<Math.max(4,5*unit)||h>55*unit||r-l<35*unit)continue;
  const x=Math.max(x0,l-pad),start=Math.max(top,y-pad),end=Math.min(bottom,y+h+pad);
  bands.push({x,y:start,width:Math.min(x1,r+pad+1)-x,height:end-start});
 }
 return bands.reverse().slice(0,6);
}
export async function recoverHeaderMonthYear(primary:string,bands:Rect[],read:(band:Rect)=>Promise<string>):Promise<{text:string;attempts:number}>{
 if(headerMonths(primary).length)return{text:primary,attempts:0};
 const accepted:string[]=[];let attempts=0;
 for(const band of bands.slice(0,6)){
  attempts++;try{const text=await read(band);if(headerMonths(text).length)accepted.push(text);}catch{/* A failed retry must not discard the shifts already read. */}
 }
 return{text:primary+(accepted.length?'\nFocused date heading:\n'+accepted.join('\n'):''),attempts};
}
