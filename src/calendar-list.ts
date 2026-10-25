import {validateCalendarId,type CalendarReadApi,type RosterCalendar}from'./calendar-selection.ts';
export interface CalendarListEntry {id?:string;summary?:string;summaryOverride?:string;description?:string;primary?:boolean;accessRole?:string}
export interface CalendarChoice {id:string;label:string}
const MARKER='Dedicated calendar for roster imports (prototype test)';
export function rosterChoices(entries:CalendarListEntry[]):CalendarChoice[]{
 const unique=new Map<string,{id:string;name:string}>();
 for(const entry of entries){
  if(!entry.id||entry.primary||entry.accessRole!=='owner'||(entry.summary!=='Roster'&&entry.description!==MARKER))continue;
  try{validateCalendarId(entry.id);}catch{continue;}
  unique.set(entry.id,{id:entry.id,name:entry.summaryOverride||entry.summary||'Roster'});
 }
 const names=[...unique.values()],count=(name:string)=>names.filter(x=>x.name===name).length;
 return names.map(x=>({id:x.id,label:x.name+(count(x.name)>1?' · …'+x.id.split('@')[0].slice(-8):'')})).sort((a,b)=>a.label.localeCompare(b.label)||a.id.localeCompare(b.id));
}
export function includeVerifiedChoice(choices:CalendarChoice[],calendar:RosterCalendar|undefined):CalendarChoice[]{
 if(!calendar||choices.some(c=>c.id===calendar.id))return choices;
 return[...choices,{id:calendar.id,label:calendar.summary+' (saved)'}];
}
export async function readRosterChoices(api:CalendarReadApi,token:string):Promise<CalendarChoice[]>{
 const entries:CalendarListEntry[]=[],seen=new Set<string>();let page:string|undefined;
 do{
  const query=new URLSearchParams({maxResults:'250',minAccessRole:'owner',showHidden:'true',showDeleted:'false',fields:'items(id,summary,summaryOverride,description,primary,accessRole),nextPageToken'});
  if(page)query.set('pageToken',page);
  const result=await api<{items?:CalendarListEntry[];nextPageToken?:string}>('/users/me/calendarList?'+query,token);
  entries.push(...(result.items||[]));page=result.nextPageToken;
  if(page){if(seen.has(page)||seen.size>=100)throw Error('Calendar list pagination did not finish. Try refreshing the list.');seen.add(page);}
 }while(page);
 return rosterChoices(entries);
}
