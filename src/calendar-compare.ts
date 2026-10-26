import type {CalendarProgress} from './calendar-progress';
import {DateTime} from 'luxon';
import {validDate,addDays} from './date-review.ts';
import {OWNER_MARKER,type ApprovedEvent} from './approved-events.ts';
import type {CalendarReadApi} from './calendar-selection';
export interface RemoteEvent {id:string;etag?:string;status?:string;summary?:string;description?:string;start?:{dateTime?:string;date?:string;timeZone?:string};end?:{dateTime?:string;date?:string;timeZone?:string};reminders?:{useDefault?:boolean;overrides?:{method:string;minutes:number}[]};extendedProperties?:{private?:Record<string,string>};recurrence?:string[];recurringEventId?:string;attendees?:unknown[];locked?:boolean;eventType?:string}
export interface Coverage {start:string;end:string;confirmed:boolean;partial?:boolean}
export type ChangeKind='new'|'changed'|'unchanged'|'restore'|'removed'|'conflict';
export interface Comparison {kind:ChangeKind;id:string;before?:RemoteEvent;after?:ApprovedEvent;reason:string}
export function isStatus(error:unknown,status:number):boolean{return typeof error==='object'&&error!==null&&'status'in error&&error.status===status;}
export function coverageBounds(coverage:Coverage):{timeMin:string;timeMax:string}{
 if(coverage.partial)throw Error('Partial screenshots cannot be used to remove missing shifts.');
 if(!coverage.confirmed||!validDate(coverage.start)||!validDate(coverage.end)||coverage.end<coverage.start)throw Error('Confirm the full roster coverage dates before previewing removals.');
 const first=DateTime.fromISO(coverage.start,{zone:'Australia/Sydney'}),last=DateTime.fromISO(addDays(coverage.end,1),{zone:'Australia/Sydney'});
 if(last.diff(first,'days').days>93)throw Error('Use a roster coverage period of at most 93 days.');
 return{timeMin:first.toISO({suppressMilliseconds:true})!,timeMax:last.toISO({suppressMilliseconds:true})!};
}
export function managed(event:RemoteEvent):boolean{return event.extendedProperties?.private?.rosterImporter===OWNER_MARKER;}
function sameEvent(a:RemoteEvent,b:ApprovedEvent):boolean{
 const overrides=(x:RemoteEvent['reminders'])=>JSON.stringify((x?.overrides||[]).slice().sort((a,b)=>a.minutes-b.minutes||a.method.localeCompare(b.method)));
 return a.summary===b.summary&&(a.description||'')===b.description&&Date.parse(a.start?.dateTime||'')===Date.parse(b.start.dateTime)&&Date.parse(a.end?.dateTime||'')===Date.parse(b.end.dateTime)&&a.reminders?.useDefault===false&&overrides(a.reminders)===overrides(b.reminders);
}
export function planComparison(approved:ApprovedEvent[],remote:RemoteEvent[],coverage?:Coverage):Comparison[]{
 if(!approved.length)throw Error('Prepare reviewed events first.');
 if(new Set(approved.map(x=>x.id)).size!==approved.length)throw Error('Duplicate approved event IDs.');
 if(new Set(remote.map(x=>x.id)).size!==remote.length)throw Error('Duplicate calendar event IDs in comparison.');
 if(coverage){coverageBounds(coverage);if(approved.some(x=>x.extendedProperties.private.rosterDate<coverage.start||x.extendedProperties.private.rosterDate>coverage.end))throw Error('Every approved shift must be inside the confirmed coverage period.');}
 const existing=new Map(remote.map(x=>[x.id,x])),desired=new Set(approved.map(x=>x.id));
 const output:Comparison[]=approved.map(after=>{
  const before=existing.get(after.id);
  if(!before)return{kind:'new',id:after.id,after,reason:'No event with this stable ID was found.'};
  if(before.status==='cancelled')return{kind:'restore',id:after.id,before,after,reason:'This shift was removed previously. It needs help to restore.'};
  if(!managed(before)||before.recurrence||before.recurringEventId||before.attendees?.length||before.locked||(before.eventType&&before.eventType!=='default')||['rosterDate','rosterType','rosterOrdinal'].some(key=>before.extendedProperties?.private?.[key]!==after.extendedProperties.private[key as keyof ApprovedEvent['extendedProperties']['private']]))return{kind:'conflict',id:after.id,before,after,reason:'An existing event has this ID but is not a simple event managed by this importer. It will not be overwritten.'};
  return{kind:sameEvent(before,after)?'unchanged':'changed',id:after.id,before,after,reason:sameEvent(before,after)?'The approved fields already match.':'Approved title, times, description or reminder differ.'};
 });
 if(coverage)for(const before of remote){
  if(desired.has(before.id)||before.status==='cancelled'||!managed(before))continue;
  const original=before.extendedProperties!.private!.rosterDate;
  const actual=DateTime.fromISO(before.start?.dateTime||'',{setZone:true}).setZone('Australia/Sydney').toISODate();
  // Require both the stored roster date and actual Sydney start inside coverage.
  // Events moved across the boundary or missing metadata are never removal candidates.
  if(!validDate(original)||!actual||original<coverage.start||original>coverage.end||actual<coverage.start||actual>coverage.end)continue;
  const protectedEvent=!!before.recurrence||!!before.recurringEventId||!!before.attendees?.length||!!before.locked||!!(before.eventType&&before.eventType!=='default');
  output.push({kind:protectedEvent?'conflict':'removed',id:before.id,before,reason:protectedEvent?'A managed event now has recurrence or guests; manual review is required.':'Managed event is absent from the approved roster inside the complete period you confirmed.'});
 }
 return output;
}
export async function compareCalendar(api:CalendarReadApi,calendarId:string,token:string,approved:ApprovedEvent[],coverage?:Coverage,onProgress:(progress:CalendarProgress)=>void=()=>{}):Promise<Comparison[]>{
 if(!approved.length)throw Error('Prepare reviewed events first.');
 const byId=new Map<string,RemoteEvent>(),path='/calendars/'+encodeURIComponent(calendarId)+'/events';
 if(coverage){
  const bounds=coverageBounds(coverage),seen=new Set<string>();let page:string|undefined,pages=0;
  onProgress({phase:'listing',completed:0});
  do{
   const query=new URLSearchParams({...bounds,singleEvents:'true',showDeleted:'false',maxResults:'2500',privateExtendedProperty:'rosterImporter='+OWNER_MARKER});
   if(page)query.set('pageToken',page);
   const response=await api<{items?:RemoteEvent[];nextPageToken?:string}>(path+'?'+query,token);
   for(const event of response.items||[])byId.set(event.id,event);
   onProgress({phase:'listing',completed:++pages});
   page=response.nextPageToken;
   if(page){if(seen.has(page)||seen.size>=100)throw Error('Calendar pagination did not finish safely. No comparison is available.');seen.add(page);}
  }while(page);
 }
 let checked=0;onProgress({phase:'checking',completed:0,total:approved.length});
 // Direct lookup finds existing IDs even if the event was moved outside the date window.
 for(const event of approved){
  try{const found=await api<RemoteEvent>(path+'/'+encodeURIComponent(event.id),token);if(found.id!==event.id)throw Error('Calendar returned a mismatched event ID.');byId.set(found.id,found);}
  catch(error){if(isStatus(error,410))byId.set(event.id,{id:event.id,status:'cancelled'});else if(!isStatus(error,404))throw error;}
  onProgress({phase:'checking',completed:++checked,total:approved.length});
 }
 return planComparison(approved,[...byId.values()],coverage);
}
