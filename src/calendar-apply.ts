import {OWNER_MARKER,stableEventId,type ApprovedEvent} from './approved-events.ts';
import {isStatus,planComparison,coverageBounds,type Coverage,type Comparison,type RemoteEvent} from './calendar-compare.ts';
import {verifyRosterCalendar,type CalendarReadApi} from './calendar-selection.ts';
import {validDate} from './date-review.ts';
export type ApplyKind='created'|'updated'|'removed'|'restored'|'unchanged'|'failed'|'not-attempted';
export interface ApplyItem {id:string;kind:ApplyKind;detail:string}
export interface ApplyResult {items:ApplyItem[];complete:boolean}
export interface ApplyOptions {coverage?:Coverage;removalsConfirmed?:boolean;recovery?:{calendarId:string;strategy:'insert'|'patch'}}
export function applyEligibility(changes:Comparison[],options:ApplyOptions={}):{count:number;reason:string}{
 const count=changes.filter(c=>['new','changed','removed','restore'].includes(c.kind)).length;
 let reason='';
 if(changes.some(c=>c.kind==='conflict'))reason='Resolve flagged shifts and check the calendar again before applying.';
 else if(changes.some(c=>c.kind==='restore')&&!options.recovery)reason='Run the deleted-shift recovery check for this connection before applying.';
 else if(changes.some(c=>c.kind==='removed')){
  try{if(!options.coverage)throw Error('Confirm the full roster period in Options, then check again.');coverageBounds(options.coverage);if(!options.removalsConfirmed)reason='Confirm removal of the listed shifts below before applying.';}
  catch(error){reason=error instanceof Error?error.message:'Confirm the full roster coverage.';}
 }
 if(!reason&&!count)reason='No changes to apply.';
 return{count,reason};
}
function message(error:unknown):string{
 if(isStatus(error,412))return'This event changed in Google after the preview. Check the calendar again.';
 if(isStatus(error,401))return'Google connection expired. Reconnect and check the calendar again.';
 if(isStatus(error,403))return'Google refused access. Check the account and calendar before trying again.';
 return error instanceof Error?error.message:'The request failed. Check the calendar again before retrying.';
}
async function validateAfter(event:ApprovedEvent,id:string){
 const p=event.extendedProperties?.private,ordinal=Number(p?.rosterOrdinal);
 if(event.id!==id||!p||p.rosterImporter!==OWNER_MARKER||!validDate(p.rosterDate)||!['A','P','N','N10'].includes(p.rosterType)||!Number.isSafeInteger(ordinal)||ordinal<0||String(ordinal)!==p.rosterOrdinal||await stableEventId(p.rosterDate,p.rosterType,ordinal)!==id)throw Error('The approved event identity is invalid. Review shifts again.');
 if(event.start?.timeZone!=='Australia/Sydney'||event.end?.timeZone!=='Australia/Sydney'||!Number.isFinite(Date.parse(event.start.dateTime))||!Number.isFinite(Date.parse(event.end.dateTime))||Date.parse(event.end.dateTime)<=Date.parse(event.start.dateTime)||event.reminders?.useDefault!==false)throw Error('The approved event fields are invalid. Review shifts again.');
}
function fields(after:ApprovedEvent,before?:RemoteEvent){
 return{summary:after.summary,description:after.description,start:after.start,end:after.end,reminders:{useDefault:false,overrides:after.reminders.overrides||[]},extendedProperties:{private:{...before?.extendedProperties?.private,...after.extendedProperties.private}}};
}
export async function applyCalendarChanges(api:CalendarReadApi,calendarId:string,token:string,reviewed:Comparison[],assertCurrent:()=>void=()=>{},progress:(done:number,total:number)=>void=()=>{},options:ApplyOptions={}):Promise<ApplyResult>{
 options=structuredClone(options);
 const changes=structuredClone(reviewed),eligibility=applyEligibility(changes,options),items:ApplyItem[]=changes.filter(c=>c.kind==='unchanged').map(c=>({id:c.id,kind:'unchanged',detail:'No change requested for this shift.'}));
 if(eligibility.reason)throw Error(eligibility.reason);
 if(new Set(changes.map(c=>c.id)).size!==changes.length)throw Error('Duplicate event identifiers. Check the calendar again.');
 if(changes.some(c=>c.kind==='restore')&&options.recovery?.calendarId!==calendarId)throw Error('Recovery check belongs to a different calendar. Run it again.');
 const desired=changes.flatMap(c=>c.after?[c.after]:[]);
 if(options.coverage)planComparison(desired,[],options.coverage);
 const operations=changes.filter(c=>['new','changed','restore','removed'].includes(c.kind)).sort((a,b)=>Number(a.kind==='removed')-Number(b.kind==='removed')),path='/calendars/'+encodeURIComponent(calendarId)+'/events';
 // Revalidate the destination and every target before making the first write.
 assertCurrent();await verifyRosterCalendar(api,calendarId,token);assertCurrent();
 for(const c of changes.filter(c=>c.after)){await validateAfter(c.after!,c.id);assertCurrent();}
 const fetchEvent=async(id:string)=>{assertCurrent();try{const event=await api<RemoteEvent>(path+'/'+id,token);assertCurrent();if(event.id!==id)throw Error('Google returned a different event ID.');return event;}catch(error){if(isStatus(error,404))return undefined;if(isStatus(error,410))return{id,status:'cancelled'};throw error;}};
 function check(change:Comparison,fresh:RemoteEvent|undefined):'skip'|'write'{
  if(change.kind==='removed'){
   if(!fresh||fresh.status==='cancelled')return'skip';
   const removal=planComparison(desired,[fresh],options.coverage).find(c=>c.id===change.id);
   if(removal?.kind==='removed'&&fresh.etag&&fresh.etag===change.before?.etag)return'write';
   throw Error('A removal target changed or moved outside the confirmed period. Check again.');
  }
  const next=planComparison([change.after!],fresh?[fresh]:[])[0];
  if(change.kind==='restore'&&next.kind==='restore'){
   if(fresh?.recurrence||fresh?.recurringEventId||fresh?.attendees?.length||fresh?.locked||(fresh?.eventType&&fresh.eventType!=='default'))throw Error('The deleted event is protected and cannot be restored.');
   const metadata=fresh?.extendedProperties?.private;
   if(metadata&&['rosterImporter','rosterDate','rosterType','rosterOrdinal'].some(k=>metadata[k]!==undefined&&metadata[k]!==change.after!.extendedProperties.private[k as keyof ApprovedEvent['extendedProperties']['private']]))throw Error('The deleted event belongs to a different importer identity.');
   if(options.recovery?.strategy==='insert')return'write';
   if(fresh?.etag&&fresh.etag===change.before?.etag)return'write';
   throw Error('The deleted event has no matching version tag. Check again before restoring.');
  }
  if(change.kind==='restore'&&!fresh&&options.recovery?.strategy==='insert')return'write';
  if(next.kind==='unchanged')return'skip';
  if(change.kind==='new'&&!fresh)return'write';
  if(change.kind==='changed'&&next.kind==='changed'&&fresh?.etag&&change.before?.etag===fresh.etag)return'write';
  throw Error('An event changed since your preview. Check the calendar again before applying.');
 }
 async function checkRemovalIdentity(event:RemoteEvent){
  const p=event.extendedProperties?.private,ordinal=Number(p?.rosterOrdinal);
  if(!p||p.rosterImporter!==OWNER_MARKER||!validDate(p.rosterDate)||!['A','P','N','N10'].includes(p.rosterType)||!Number.isSafeInteger(ordinal)||ordinal<0||String(ordinal)!==p.rosterOrdinal||await stableEventId(p.rosterDate,p.rosterType,ordinal)!==event.id)throw Error('Removal target has an invalid importer identity. No removal was made.');
 }
 for(const change of operations){const fresh=await fetchEvent(change.id);if(change.kind==='removed'){if(!change.before)throw Error('Removal has no reviewed event.');await checkRemovalIdentity(change.before);if(fresh&&fresh.status!=='cancelled')await checkRemovalIdentity(fresh);}check(change,fresh);assertCurrent();}
 for(let index=0;index<operations.length;index++){
  const change=operations[index];let attempted=false;
  try{
   assertCurrent();const fresh=await fetchEvent(change.id);
   if(change.kind==='removed'&&fresh&&fresh.status!=='cancelled')await checkRemovalIdentity(fresh);
   if(check(change,fresh)==='skip'){items.push({id:change.id,kind:'unchanged',detail:change.kind==='removed'?'Already absent from the calendar.':'Already matches the reviewed shift.'});}
   else{
    assertCurrent();attempted=true;
    if(change.kind==='removed'){
     await api(path+'/'+change.id,token,'DELETE',undefined,fresh!.etag);
    }else if(change.kind==='restore'){
     if(options.recovery!.strategy==='insert')await api(path,token,'POST',{id:change.id,...fields(change.after!)});
     else await api(path+'/'+change.id,token,'PATCH',{...fields(change.after!,fresh),status:'confirmed'},fresh!.etag);
    }else if(change.kind==='new'){
     try{await api(path,token,'POST',{id:change.id,...fields(change.after!)});}
     catch(error){
      if(!isStatus(error,409))throw error;
      // Another tab may have inserted it. Never replace a collision or choose a random ID.
      const existing=await fetchEvent(change.id);
      if(planComparison([change.after!],existing?[existing]:[])[0].kind!=='unchanged')throw Error('The stable ID is already in use. Check the calendar again; it was not overwritten.');
      items.push({id:change.id,kind:'unchanged',detail:'The same shift was already added.'});
     }
    }else await api(path+'/'+change.id,token,'PATCH',fields(change.after!,fresh),fresh!.etag);
    assertCurrent();
    const saved=await fetchEvent(change.id);
    if(change.kind==='removed'){if(saved&&saved.status!=='cancelled')throw Error('Google did not confirm removal.');}
    else if(planComparison([change.after!],saved?[saved]:[])[0].kind!=='unchanged')throw Error('Google did not return the expected saved shift.');
    if(!items.some(x=>x.id===change.id))items.push({id:change.id,kind:change.kind==='new'?'created':change.kind==='removed'?'removed':change.kind==='restore'?'restored':'updated',detail:change.kind==='new'?'Added to Roster.':change.kind==='removed'?'Removed from the confirmed roster period.':change.kind==='restore'?'Restored using the same stable ID.':'Updated in Roster.'});
   }
   progress(index+1,operations.length);
  }catch(error){
   // A lost response can still mean a write succeeded. A fresh comparison resolves it safely.
   const previous=items.findIndex(x=>x.id===change.id);if(previous>=0)items.splice(previous,1);
   items.push({id:change.id,kind:'failed',detail:message(error)+(attempted?' A save may have reached Google; check again before retrying.':' No write was sent for this shift.')});
   for(const rest of operations.slice(index+1))items.push({id:rest.id,kind:'not-attempted',detail:'Stopped after the earlier issue. Check the calendar again.'});
   return{items,complete:false};
  }
 }
 return{items,complete:true};
}
