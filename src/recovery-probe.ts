import type {CalendarReadApi} from './calendar-selection';
import {isStatus,type RemoteEvent} from './calendar-compare.ts';
export interface ProbeResult {passed:boolean;id:string;detail:string;cleanupRequired:boolean;strategy?:'insert'|'patch'}
export const PROBE_TITLE='Roster recovery test — safe to delete';
function fixture(id:string){return{id,summary:PROBE_TITLE,description:'Synthetic deleted-ID recovery test only. No real shift.',start:{dateTime:'2026-11-03T12:40:00+11:00',timeZone:'Australia/Sydney'},end:{dateTime:'2026-11-03T12:45:00+11:00',timeZone:'Australia/Sydney'},reminders:{useDefault:false},extendedProperties:{private:{rosterRecoveryProbe:id}}};}
function matches(event:RemoteEvent,id:string):boolean{
 const expected=fixture(id);
 return event.id===id&&event.summary===expected.summary&&event.description===expected.description&&event.extendedProperties?.private?.rosterRecoveryProbe===id&&!event.recurrence&&!event.recurringEventId&&!event.attendees?.length&&Date.parse(event.start?.dateTime||'')===Date.parse(expected.start.dateTime)&&Date.parse(event.end?.dateTime||'')===Date.parse(expected.end.dateTime);
}
export async function cleanupProbe(api:CalendarReadApi,calendarId:string,token:string,id:string):Promise<void>{
 if(!/^[0-9a-f]{64}$/.test(id))throw Error('Invalid probe identifier.');
 const path='/calendars/'+encodeURIComponent(calendarId)+'/events/'+id;
 let event:RemoteEvent;
 try{event=await api<RemoteEvent>(path,token);}catch(error){if(isStatus(error,404)||isStatus(error,410))return;throw error;}
 if(event.id!==id)throw Error('Probe cleanup received a mismatched ID.');
 if(event.status==='cancelled')return;
 if(!matches(event,id)||!event.etag)throw Error('The synthetic event changed or has no version tag. It was not deleted. Check it manually in Google Calendar.');
 await api(path,token,'DELETE',undefined,event.etag);
}
export async function recoveryProbe(api:CalendarReadApi,calendarId:string,token:string,id:string):Promise<ProbeResult>{
 if(!/^[0-9a-f]{64}$/.test(id))throw Error('Invalid probe identifier.');
 const path='/calendars/'+encodeURIComponent(calendarId)+'/events',item=path+'/'+id,body=fixture(id);
 let attempted=false,passed=false,detail='',strategy:'insert'|'patch'|undefined,cleanupRequired=false;
 try{
  // Refuse an ID already in use, including a previously cancelled event.
  try{await api(item,token);throw Error('Probe ID already exists. Start a new test.');}catch(error){if(!isStatus(error,404))throw error;}
  attempted=true;await api(path,token,'POST',body);
  const created=await api<RemoteEvent>(item,token);
  if(created.status!=='confirmed'||!matches(created,id)||!created.etag)throw Error('The created synthetic event could not be verified.');
  await api(item,token,'DELETE',undefined,created.etag);
  const deleted=await api<RemoteEvent>(item,token).catch(error=>{if(isStatus(error,404)||isStatus(error,410))return undefined;throw error;});
  if(deleted&&deleted.status!=='cancelled')throw Error('Deletion was not confirmed. Recovery test stopped.');
  try{await api(path,token,'POST',body);strategy='insert';}
  catch(error){
   if(!isStatus(error,409))throw error;
   const tombstone=await api<RemoteEvent>(item,token);
   if(tombstone.id!==id||tombstone.status!=='cancelled'||!tombstone.etag)throw Error('The deleted event cannot be safely restored with its version tag.');
   const {id:unused,...patch}=body;void unused;
   await api(item,token,'PATCH',{...patch,status:'confirmed'},tombstone.etag);strategy='patch';
  }
  const restored=await api<RemoteEvent>(item,token);
  if(restored.status!=='confirmed'||!matches(restored,id))throw Error('The restored event did not match the synthetic fixture.');
  passed=true;detail='Deleted event restored successfully using '+strategy+'.';
 }catch(error){detail=error instanceof Error?error.message:String(error);}
 finally{
  if(attempted)try{await cleanupProbe(api,calendarId,token,id);}catch(error){cleanupRequired=true;passed=false;detail+=' Cleanup needs attention: '+(error instanceof Error?error.message:String(error));}
 }
 return{passed,id,detail:detail+(attempted&&!cleanupRequired?' Synthetic event cleanup completed.':''),cleanupRequired,strategy};
}
