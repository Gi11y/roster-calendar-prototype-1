import {dayCell,type Card,type Grid} from './card-data.ts';
export interface DateAnchor {cardId:number;date:string;mondayFirst:boolean;source?:'auto'|'manual'}
export interface DateCard {card:Card;day?:string;manualDate?:string}
export interface AssignedDate {cardId:number;date?:string;candidate?:string;basis:string;warning?:string}
export function validDate(value:string|undefined):value is string{
 if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [y,m,d]=value.split('-').map(Number);if(y<1900||y>2200||m<1||m>12||d<1||d>31)return false;
 const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
export function addDays(value:string,days:number):string{
 if(!validDate(value)||!Number.isInteger(days))throw Error('A valid calendar date and whole-day offset are required.');
 const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d+days));const result=date.toISOString().slice(0,10);if(!validDate(result))throw Error('Date is outside supported range.');return result;
}
function position(card:Card,grid:Grid|undefined):{row:number;column:number}|undefined{
 const cell=dayCell(card,grid);if(!grid||!cell||cell.top===undefined||cell.bottom===undefined)return;
 const row=grid.rows.indexOf(cell.top);if(row<0||grid.rows[row+1]!==cell.bottom)return;
 return{row,column:cell.column};
}
export function associateDates(items:DateCard[],grid:Grid|undefined,anchor:DateAnchor|undefined):AssignedDate[]{
 const selected=anchor&&items.find(x=>x.card.id===anchor.cardId);
 const origin=selected?position(selected.card,grid):undefined;
 let anchorProblem:string|undefined;
 if(anchor&&!validDate(anchor.date))anchorProblem='The anchor date is invalid.';
 else if(anchor&&grid&&!anchor.mondayFirst)anchorProblem='Confirm the weekday column order.';
 else if(anchor&&grid?.partial&&(!Number.isInteger(grid.startWeekday)||grid.startWeekday!<0||grid.startWeekday!+grid.columns.length-1>7))anchorProblem='Choose the first visible weekday.';
 else if(anchor&&origin){const weekday=(new Date(anchor.date+'T00:00:00Z').getUTCDay()+6)%7;if(weekday!==origin.column+(grid?.startWeekday??0))anchorProblem='The anchor weekday does not match its grid column. Check the chosen card/date or the grid.';}
 if(selected&&anchor&&anchor.source!=='manual'&&selected.day&&Number(selected.day)!==Number(anchor.date.slice(-2)))anchorProblem='The chosen anchor conflicts with its OCR day number. Correct that card manually or check the anchor date.';
 return items.map(item=>{
  if(item.manualDate!==undefined){return validDate(item.manualDate)?{cardId:item.card.id,date:item.manualDate,basis:'Date entered manually - confirm against screenshot'}:{cardId:item.card.id,basis:'Needs date review',warning:'The manually entered date is invalid.'};}
  if(!anchor||!selected)return{cardId:item.card.id,basis:'Needs date review',warning:'Choose one numbered card and confirm its exact date.'};
  if(anchorProblem)return{cardId:item.card.id,basis:'Needs date review',warning:anchorProblem};
  if(item.card.id===anchor.cardId)return{cardId:item.card.id,date:anchor.date,basis:anchor.source==='auto'?'Automatically detected anchor - review':'User-confirmed anchor card'};
  const target=position(item.card,grid);
  if(!origin||!target)return{cardId:item.card.id,basis:'Needs date review',warning:'Grid row or column is uncertain. Enter this date manually.'};
  let candidate:string;try{candidate=addDays(anchor.date,(target.row-origin.row)*7+target.column-origin.column);}catch{return{cardId:item.card.id,basis:'Needs date review',warning:'The proposed date is outside the supported range.'};}
  if(item.day&&Number(item.day)!==Number(candidate.slice(-2)))return{cardId:item.card.id,candidate,basis:'Date conflict - check image',warning:'Grid proposes '+candidate+' but OCR read day '+item.day+'. No date was assigned.'};
  return{cardId:item.card.id,date:candidate,basis:(anchor.source==='auto'?'Inferred from detected header and grid - review':'Inferred from confirmed anchor and grid - review')+(item.day?' (day OCR agrees)':' (day OCR unavailable)')};
 });
}
export function validClock(value:string|undefined):value is string{return !!value&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);}
export function reviewTiming(date:string|undefined,start:string|undefined,end:string|undefined,nextDay:boolean):{endDate?:string;error?:string}{
 if(!validDate(date))return{error:'Confirm the date.'};if(!validClock(start)||!validClock(end))return{error:'Enter valid start and end times.'};
 const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3)),duration=minutes(end)-minutes(start)+(nextDay?1440:0);
 if(duration<=0)return{error:'End must be after start. Check overnight or identical times.'};if(duration>16*60)return{error:'Duration exceeds 16 clock hours. Check the times and overnight setting.'};
 try{return{endDate:addDays(date,nextDay?1:0)};}catch{return{error:'The end date is outside the supported range.'};}
}
export function sortReview<T extends {cardId:number;date?:string;start?:string}>(items:T[]):T[]{return items.slice().sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.start||'99:99').localeCompare(b.start||'99:99')||a.cardId-b.cardId);}
