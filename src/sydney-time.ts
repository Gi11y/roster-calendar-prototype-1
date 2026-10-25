import {DateTime} from 'luxon';
import {validDate,validClock,reviewTiming} from './date-review.ts';
export const ROSTER_ZONE='Australia/Sydney';
export interface SydneyRange {start:string;end:string;startUtc:string;endUtc:string;endDate:string;clockMinutes:number;elapsedMinutes:number;changesOffset:boolean}
export type SydneyResult={range:SydneyRange;error?:undefined}|{range?:undefined;error:string};
function resolve(date:string,clock:string):DateTime{
 const local=date+'T'+clock;
 const value=DateTime.fromISO(local,{zone:ROSTER_ZONE});
 if(!value.isValid||value.toFormat("yyyy-MM-dd'T'HH:mm")!==local)throw Error(local.replace('T',' ')+' does not exist in Sydney because the clocks move forward. Check the printed time.');
 if(value.getPossibleOffsets().length!==1)throw Error(local.replace('T',' ')+' occurs twice in Sydney when the clocks move back. An explicit offset needs confirmation before this shift can be sent.');
 return value;
}
export function sydneyRange(date:string|undefined,start:string|undefined,end:string|undefined,nextDay:boolean):SydneyResult{
 const clockCheck=reviewTiming(date,start,end,nextDay);
 if(clockCheck.error)return{error:clockCheck.error};
 if(!validDate(date)||!validClock(start)||!validClock(end)||!clockCheck.endDate)return{error:'Confirm the date and both times.'};
 try{
  const first=resolve(date,start),last=resolve(clockCheck.endDate,end),elapsedMinutes=last.diff(first,'minutes').minutes;
  if(elapsedMinutes<=0||elapsedMinutes>17*60)return{error:'The elapsed Sydney duration is outside the supported range. Check both times.'};
  const minutes=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3));
  return{range:{start:first.toISO({suppressMilliseconds:true})!,end:last.toISO({suppressMilliseconds:true})!,startUtc:first.toUTC().toISO({suppressMilliseconds:true})!,endUtc:last.toUTC().toISO({suppressMilliseconds:true})!,endDate:clockCheck.endDate,clockMinutes:minutes(end)-minutes(start)+(nextDay?1440:0),elapsedMinutes,changesOffset:first.offset!==last.offset}};
 }catch(error){return{error:error instanceof Error?error.message:'Sydney timezone validation failed.'};}
}
export function hoursText(minutes:number):string{return (Math.round(minutes/6)/10).toString()+' h';}
