import {explicitRange,type TimeRange} from './card-data.ts';
import {shiftTextOnly,isMetadata} from './card-content.ts';
import type {Word} from './ocr-data';
export function normalizePrintedTime(text:string):string{
 // Substitutions apply only to paired time contexts, never to arbitrary IDs.
 return text.replace(/([0-2]?\d)[°º]([0-5]\d)(?=\s*(?:[-–—]|to|$))/gi,'$1:$2')
 .replace(/(?:^|[^\d])(\d{2})([0-5]\d)\s*[-–—]\s*(\d{2})([0-5]\d)(?!\d)/g,(all,a,b,c,d)=>Number(a)<24&&Number(c)<24?' '+a+':'+b+' - '+c+':'+d:all);
}
export function printedLine(words:Word[],labelBottom:number):{top:number;height:number}|undefined{
 const rows:Word[][]=[];
 for(const w of words.slice().sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0)){
  const row=rows.find(r=>Math.abs(r[0].bbox.y0-w.bbox.y0)<=Math.max(3,(w.bbox.y1-w.bbox.y0)*.45));if(row)row.push(w);else rows.push([w]);
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
