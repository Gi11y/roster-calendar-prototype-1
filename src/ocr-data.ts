export interface Box {x0:number;y0:number;x1:number;y1:number}
export interface Word {text:string;confidence:number;bbox:Box}
export interface Crop {x:number;y:number;width:number;height:number;scale:number}
export function makeCrop(width:number,height:number,bounds:number[]):Crop {
 const [l,t,r,b]=bounds;
 if(bounds.length!==4||bounds.some(n=>!Number.isFinite(n)||n<0||n>100)||l>=r||t>=b||width<=0||height<=0)throw Error('Crop must be inside the image, with left < right and top < bottom.');
 const x=Math.floor(width*l/100),y=Math.floor(height*t/100);
 const w=Math.max(1,Math.ceil(width*r/100)-x),h=Math.max(1,Math.ceil(height*b/100)-y);
 const scale=Math.min(2,Math.sqrt(8_000_000/(w*h)));
 return {x,y,width:w,height:h,scale};
}
export function sourceBox(box:Box,crop:Crop):Box{return {x0:Math.max(crop.x,Math.round(box.x0/crop.scale+crop.x)),y0:Math.max(crop.y,Math.round(box.y0/crop.scale+crop.y)),x1:Math.min(crop.x+crop.width,Math.round(box.x1/crop.scale+crop.x)),y1:Math.min(crop.y+crop.height,Math.round(box.y1/crop.scale+crop.y))};}
export function parseTsv(tsv:string):Word[]{
 return tsv.split(/\r?\n/).slice(1).flatMap(line=>{
 const cols=line.split('\t'); if(cols[0]!=='5'||cols.length<12)return [];
 const [x,y,w,h,confidence]=cols.slice(6,11).map(Number),text=cols.slice(11).join('\t').trim();
 if(!text||![x,y,w,h,confidence].every(Number.isFinite)||w<=0||h<=0||confidence<0)return [];
 return [{text,confidence,bbox:{x0:x,y0:y,x1:x+w,y1:y+h}}];
 });
}
