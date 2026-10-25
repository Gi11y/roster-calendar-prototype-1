import{DateTime}from'luxon';
import{coverageBounds}from'./calendar-compare.ts';
export function swapRangeError(start:string,end:string):string{
 try{coverageBounds({start,end,confirmed:true});return'';}
 catch(error){return error instanceof Error&&error.message.includes('93')?'Choose a date range of 93 days or fewer.':'Choose both dates, with To on or after From.';}
}
export function shiftSearchResult(count:number,start:string,end:string):{message:string;placeholder:string}{
 const date=(value:string)=>DateTime.fromISO(value).toFormat('d LLL yyyy');
 return count>0?{message:'Search complete. Found '+count+' '+(count===1?'shift':'shifts')+'. Choose one below.',placeholder:'Choose a shift'}:{message:'Search complete. No shifts available to swap were found from '+date(start)+' to '+date(end)+'. Try another date range.',placeholder:'No shifts found for these dates'};
}
