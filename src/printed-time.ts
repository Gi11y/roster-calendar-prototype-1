import {explicitRange,type TimeRange} from './card-data.ts';
import {shiftTextOnly,isMetadata} from './card-content.ts';
import type {Word} from './ocr-data';
export function normalizePrintedTime(text:string):string{
 // Substitutions apply only to paired time contexts, never to arbitrary IDs.
 const token='(?:[0-2]?\\d[:.°º][0-5]\\d|\\d{4})';
 return text.replace(new RegExp('(^|[^0-9])('+token+')\\s*[-–—]\\s*('+token+')(?!\\d)','g'),(all,prefix,left,right)=>{
  const clock=(value:string)=>value.length===4&&!/[:.°º]/.test(value)?value.slice(0,2)+':'+value.slice(2):value.replace(/[.°º]/,':');
  const first=clock(left),last=clock(right);
  return Number(first.split(':')[0])<24&&Number(last.split(':')[0])<24?prefix+first+' - '+last:all;
 });

}
export function printedLine(words:Word[],labelBottom:number):{top:number;height:number}|undefined{
 const rows:Word[][]=[];
 for(const w of words.slice().sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0)){
  const row=rows.find(r=>r.some(p=>Math.min(p.bbox.y1,w.bbox.y1)>Math.max(p.bbox.y0,w.bbox.y0)));if(row)row.push(w);else rows.push([w]);
 }
 for(const row of rows){
  const text=row.slice().sort((a,b)=>a.bbox.x0-b.bbox.x0).map(w=>w.text).join(' ');
  if(isMetadata(text))break;
  if(Math.min(...row.map(w=>w.bbox.y0))<labelBottom-2)continue;
  const normalized=normalizePrintedTime(text);
  if(!explicitRange(normalized)&&!/(?:\d{1,2}[:.°º]\d{2}|\d{4})\s*[-–—]/.test(text))continue;
  const top=Math.max(0,Math.min(...row.map(w=>w.bbox.y0))-6),bottom=Math.max(...row.map(w=>w.bbox.y1))+6;
  return{top,height:bottom-top};
 }
}
export function agreeFocusedTimes(readings:string[]):{range?:TimeRange;warning?:string}{
 const ranges=readings.map(s=>explicitRange(normalizePrintedTime(shiftTextOnly(s))));
 const valid=ranges.filter((r):r is TimeRange=>!!r),keys=new Set(valid.map(r=>r.start+'|'+r.end));
 if(valid.length>=2&&keys.size===1)return{range:valid[0]};
 return{warning:'Printed hours could not be confirmed by both focused readings. Check the screenshot and enter both times.'};
}
