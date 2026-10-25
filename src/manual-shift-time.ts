import{DateTime}from'luxon';import{validClock}from'./date-review.ts';import{sydneyRange,hoursText}from'./sydney-time.ts';
export function inferredNextDay(start:string,end:string):boolean|undefined{return validClock(start)&&validClock(end)&&start!==end?end<start:undefined;}
export function shiftFinish(date:string,start:string,end:string,nextDay:boolean):{text:string;error?:string}{
 if(!date||!start||!end)return{text:''};const result=sydneyRange(date,start,end,nextDay);if(result.error)return{text:result.error,error:result.error};
 const range=result.range!,finish=DateTime.fromISO(range.end,{setZone:true}).toFormat('ccc d LLL, h:mma').replace(/AM|PM/g,x=>x.toLowerCase());
 return{text:'Finishes '+finish+(range.changesOffset?' · '+hoursText(range.elapsedMinutes)+' elapsed (daylight saving changes during this shift)':'')};
}
