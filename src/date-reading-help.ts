export function dateReadingHelp(missing:number,total:number,reason:string):string{
 if(!missing||!total)return'';
 const prefix=missing===total?'The shift dates could not be read confidently.':missing+' '+(missing===1?'shift still needs':'shifts still need')+' a date.';
 let detail='';
 if(/month and year/.test(reason))detail=' The month and year were not clear. Keep the date heading in your screenshot crop.';
 else if(/column headings/.test(reason))detail=' The weekday headings were not clear.';
 else if(/three distinct/.test(reason))detail=' Too few day numbers were read clearly.';
 else if(/date grid/.test(reason))detail=' The calendar grid was not clear.';
 else if(/More than one|Conflicting|do not agree/.test(reason))detail=' The date evidence did not agree.';
 else if(/did not finish/.test(reason))detail=' Date reading did not finish on this device.';
 return prefix+detail+' Set one shift’s exact date below, then check the remaining dates. You can also edit each shift separately.';
}
