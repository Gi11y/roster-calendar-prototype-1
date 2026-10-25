import {explicitRange} from './card-data.ts';
import type {Word} from './ocr-data';
export function isMetadata(text:string):boolean{return /(?:\b\d[\d\s]{4,10}\s*AC[S5]\b|\bAC[S5]\b|\bGWW\b|\bGOS\s+CNE|\bCC\s*[-–]\s*GOS\b)/i.test(text);}
export function shiftTextOnly(text:string):string{
 const kept:string[]=[];
 for(const line of text.split(/\r?\n/)){
  if(/^Label readings:|^Glyph isolation:|^Time-line OCR/i.test(line.trim()))break;
  if(isMetadata(line)){
   // A valid printed range may share an OCR line with the metadata; retain only that prefix.
   const marker=line.search(/(?:\b\d[\d\s]{4,10}\s*AC[S5]\b|\bAC[S5]\b|\bGWW\b|\bGOS\s+CNE|\bCC\s*[-–]\s*GOS\b)/i);
   const prefix=line.slice(0,Math.max(0,marker));if(explicitRange(prefix))kept.push(prefix);
   break;
  }
  kept.push(line);
 }
 return kept.join('\n').trim();
}
export interface TimeBand {top:number;height:number;reason:string;metadataFound:boolean}
export function planTimeBand(words:Word[],labelBottom:number,cardHeight:number):TimeBand{
 const lines:Word[][]=[];
 for(const word of words.slice().sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0)){
  const line=lines.find(row=>Math.abs(row[0].bbox.y0-word.bbox.y0)<=Math.max(3,(word.bbox.y1-word.bbox.y0)*.45));
  if(line)line.push(word);else lines.push([word]);
 }
 const metadata=lines.filter(line=>isMetadata(line.slice().sort((a,b)=>a.bbox.x0-b.bbox.x0).map(w=>w.text).join(' '))).sort((a,b)=>a[0].bbox.y0-b[0].bbox.y0)[0];
 if(!metadata)return{top:0,height:0,metadataFound:false,reason:'Metadata boundary was not recognised; no blind time crop was read.'};
 const topOfMetadata=Math.min(...metadata.map(w=>w.bbox.y0)),font=Math.max(5,Math.min(...metadata.map(w=>w.bbox.y1-w.bbox.y0))),top=Math.max(0,Math.ceil(labelBottom+font*.12)),bottom=Math.min(cardHeight,Math.floor(topOfMetadata-font*.12)),height=Math.max(0,bottom-top);
 return{top,height,metadataFound:true,reason:height<font*.35?'No separate time-line space before the fixed metadata.':'Time search restricted to the gap above fixed metadata.'};
}
