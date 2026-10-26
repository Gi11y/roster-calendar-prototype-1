import{readUsableRosterChoices,type CalendarChoice}from'./calendar-list.ts';
import{verifyRosterCalendar,validateCalendarId,ROSTER_DESCRIPTION,type CalendarReadApi,type RosterCalendar}from'./calendar-selection.ts';
import{isStatus}from'./calendar-compare.ts';
import type{PendingCalendarCreation}from'./idb';
export interface CalendarSettings {readId():Promise<string|undefined>;saveId(id:string):Promise<void>;readPending():Promise<PendingCalendarCreation|undefined>;savePending(value:PendingCalendarCreation|undefined):Promise<void>}
export type CalendarSetupResult={kind:'created'|'existing';calendar:RosterCalendar}|{kind:'choose';choices:CalendarChoice[]};
export async function withCalendarCreationLock<T>(task:()=>Promise<T>):Promise<T>{
 if(!navigator.locks)throw Error('Calendar creation needs a current Safari or Chrome browser. You can still select an existing calendar.');
 return navigator.locks.request('roster-calendar:calendar-creation',task);
}
export function calendarName(value:string):string{
 const name=value.trim()||'Roster';
 if(name.length>100||/[\u0000-\u001f\u007f]/.test(name))throw Error('Use a calendar name of up to 100 characters, without line breaks.');
 return name;
}
export async function ensureRosterCalendar(api:CalendarReadApi,token:string,settings:CalendarSettings,setupId:string,assertCurrent:()=>void=()=>{},name='Roster'):Promise<CalendarSetupResult>{
 if(!/^[a-f0-9]{64}$/.test(setupId))throw Error('Invalid calendar setup identifier.');
 const summary=calendarName(name);
 assertCurrent();const pending=await settings.readPending(),saved=await settings.readId();
 // A fresh, successful list and access check are mandatory before any creation.
 const choices=await readUsableRosterChoices(api,token);assertCurrent();
 async function select(id:string,kind:'created'|'existing',clearPending=false):Promise<CalendarSetupResult>{
  const calendar=await verifyRosterCalendar(api,id,token);assertCurrent();
  await settings.saveId(calendar.id);assertCurrent();
  if(clearPending)await settings.savePending(undefined);
  assertCurrent();return{kind,calendar};
 }
 const recovered=pending&&choices.find(c=>c.setupId===pending.setupId);
 if(recovered)return select(recovered.id,'existing',true);
 if(pending?.calendarId){
  try{return await select(pending.calendarId,'existing',true);}catch(error){if(![403,404,410].some(s=>isStatus(error,s)))throw error;}
 }
 if(saved){
  let accessible=false;
  try{await verifyRosterCalendar(api,saved,token);accessible=true;}catch(error){if(![403,404,410].some(s=>isStatus(error,s)))throw error;}
  if(accessible)return select(saved,'existing');
 }
 if(choices.length===1)return select(choices[0].id,'existing');
 if(choices.length>1)return{kind:'choose',choices};
 if(pending)throw Error('An earlier calendar creation may have reached Google. Reconnect the original account and refresh the calendar list before trying again. Another calendar will not be created.');
 // Write this marker BEFORE the request, so a lost response cannot lead to a blind retry.
 const attempt={setupId};await settings.savePending(attempt);
 try{assertCurrent();}catch(error){await settings.savePending(undefined);throw error;}
 let result:RosterCalendar;
 try{result=await api<RosterCalendar>('/calendars',token,'POST',{summary,timeZone:'Australia/Sydney',description:ROSTER_DESCRIPTION+'\nSetup ID: '+setupId});}
 catch(error){if([400,401,403,404,429].some(s=>isStatus(error,s)))await settings.savePending(undefined);throw error;}
 const id=validateCalendarId(result.id);assertCurrent();
 await settings.savePending({...attempt,calendarId:id});assertCurrent();
 return select(id,'created',true);
}

export function firstTimeCalendarState(connected:boolean,verified:boolean,listAllowed:boolean,listReady:boolean,count:number){
 return{showCreate:connected&&!verified&&listAllowed&&listReady&&count===0,title:'Create your Roster calendar',copy:'Keep your shifts together in a separate Google calendar. Choose a name below.'};
}
