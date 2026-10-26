import {validateCalendarId,verifyRosterCalendar,isRosterMetadata,calendarSetupId,type CalendarReadApi,type RosterCalendar}from'./calendar-selection.ts';
export interface CalendarListEntry {id?:string;summary?:string;summaryOverride?:string;description?:string;primary?:boolean;accessRole?:string}
export interface CalendarChoice {id:string;label:string;setupId?:string}
export function rosterChoices(entries:CalendarListEntry[]):CalendarChoice[]{
 const unique=new Map<string,{id:string;name:string;setupId?:string}>();
 for(const entry of entries){
  if(!entry.id||entry.primary||entry.accessRole!=='owner'||!isRosterMetadata(entry.summary,entry.description))continue;
  try{validateCalendarId(entry.id);}catch{continue;}
  unique.set(entry.id,{id:entry.id,name:entry.summaryOverride||entry.summary||'Roster',setupId:calendarSetupId(entry.description)});
 }
 const names=[...unique.values()],count=(name:string)=>names.filter(x=>x.name===name).length;
 return names.map(x=>({id:x.id,...(x.setupId?{setupId:x.setupId}:{}),label:x.name+(count(x.name)>1?' · …'+x.id.split('@')[0].slice(-8):'')})).sort((a,b)=>a.label.localeCompare(b.label)||a.id.localeCompare(b.id));
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

export async function readUsableRosterChoices(api:CalendarReadApi,token:string):Promise<CalendarChoice[]>{
 const choices=await readRosterChoices(api,token),usable:CalendarChoice[]=[];
 for(const choice of choices){
  try{await verifyRosterCalendar(api,choice.id,token);usable.push(choice);}
  catch(error){if(![403,404,410].some(status=>typeof error==='object'&&error!==null&&'status'in error&&error.status===status))throw error;}
 }
 return usable;
}

// A successful current account list is authoritative; do not resurrect a remembered calendar.
export async function readRosterSelection(api:CalendarReadApi,token:string,savedId:string|undefined):Promise<{choices:CalendarChoice[];selectedId:string|undefined;unavailable:boolean}>{
 const choices=await readUsableRosterChoices(api,token);
 return{choices,selectedId:savedId&&choices.some(c=>c.id===savedId)?savedId:undefined,unavailable:!!savedId&&!choices.some(c=>c.id===savedId)};
}
