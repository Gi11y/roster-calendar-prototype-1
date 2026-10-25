import{OWNER_MARKER,prepareEvents,stableEventId,type ReviewedShift,type ApprovedEvent}from'./approved-events.ts';
import{isStatus,coverageBounds,planComparison,type RemoteEvent}from'./calendar-compare.ts';
import{verifyRosterCalendar,type CalendarReadApi}from'./calendar-selection.ts';
import type{CalendarProgress}from'./calendar-progress';
import type{ApplyOptions}from'./calendar-apply';
export interface SwapPlan {calendarId:string;old:RemoteEvent;after?:ApprovedEvent;target?:RemoteEvent;kind:'remove'|'update'|'replace'}
export interface SwapResult {complete:boolean;replacementSaved:boolean;originalRemoved:boolean;detail:string}
export class SwapRecoveryRequired extends Error{}
function protectedEvent(e:RemoteEvent){return!!e.recurrence||!!e.recurringEventId||!!e.attendees?.length||!!e.locked||!!(e.eventType&&e.eventType!=='default');}
export async function swappable(e:RemoteEvent):Promise<boolean>{
 const p=e.extendedProperties?.private,n=Number(p?.rosterOrdinal);
 return e.status!=='cancelled'&&!protectedEvent(e)&&!!e.etag&&p?.rosterImporter===OWNER_MARKER&&['A','P','N','N10'].includes(p.rosterType)&&Number.isSafeInteger(n)&&n>=0&&String(n)===p.rosterOrdinal&&e.id===await stableEventId(p.rosterDate,p.rosterType,n)&&Number.isFinite(Date.parse(e.start?.dateTime||''))&&Number.isFinite(Date.parse(e.end?.dateTime||''));
}
async function get(api:CalendarReadApi,path:string,token:string,id:string):Promise<RemoteEvent|undefined>{
 try{const e=await api<RemoteEvent>(path+'/'+encodeURIComponent(id),token);if(e.id!==id)throw Error('Google returned a different shift ID.');return e;}
 catch(error){if(isStatus(error,404))return undefined;if(isStatus(error,410))return{id,status:'cancelled'};throw error;}
}
export async function listSwapShifts(api:CalendarReadApi,calendarId:string,token:string,start:string,end:string,progress:(p:CalendarProgress)=>void=()=>{}):Promise<RemoteEvent[]>{
 const bounds=coverageBounds({start,end,confirmed:true});await verifyRosterCalendar(api,calendarId,token);const path='/calendars/'+encodeURIComponent(calendarId)+'/events',all=new Map<string,RemoteEvent>(),seen=new Set<string>();let page:string|undefined,pages=0;
 progress({phase:'listing',completed:0});
 do{const q=new URLSearchParams({...bounds,singleEvents:'false',showDeleted:'false',maxResults:'2500',privateExtendedProperty:'rosterImporter='+OWNER_MARKER});if(page)q.set('pageToken',page);
 const result=await api<{items?:RemoteEvent[];nextPageToken?:string}>(path+'?'+q,token);for(const e of result.items||[])if(await swappable(e))all.set(e.id,e);
 progress({phase:'listing',completed:++pages});page=result.nextPageToken;if(page){if(seen.has(page)||seen.size>=100)throw Error('Calendar list did not finish safely. Try loading shifts again.');seen.add(page);}
 }while(page);
 return[...all.values()].sort((a,b)=>Date.parse(a.start!.dateTime!)-Date.parse(b.start!.dateTime!)||a.id.localeCompare(b.id));
}
function matching(e:RemoteEvent|undefined,after:ApprovedEvent):boolean{return /^[a-f0-9]{64}$/.test((after.extendedProperties.private as Record<string,string>).rosterSwapId||'')&&!!e&&planComparison([after],[e])[0].kind==='unchanged'&&e.extendedProperties?.private?.rosterSwapId===(after.extendedProperties.private as Record<string,string>).rosterSwapId;}
function body(after:ApprovedEvent,before?:RemoteEvent){return{summary:after.summary,description:after.description,start:after.start,end:after.end,reminders:{useDefault:false,overrides:after.reminders.overrides||[]},extendedProperties:{private:{...before?.extendedProperties?.private,...after.extendedProperties.private}}};}
function recoveryCheck(target:RemoteEvent,after:ApprovedEvent,calendarId:string,recovery:ApplyOptions['recovery']){
 if(protectedEvent(target))throw Error('This deleted shift is protected and cannot be restored.');
 const p=target.extendedProperties?.private;
 if(p&&Object.entries(after.extendedProperties.private).some(([key,value])=>key!=='rosterSwapId'&&p[key]!==undefined&&p[key]!==value))throw Error('The deleted replacement has a different importer identity.');
 if(!recovery||recovery.calendarId!==calendarId)throw new SwapRecoveryRequired('This replacement was deleted previously. Run the recovery check below, then review the swap again.');
 if(recovery.strategy==='patch'&&!target.etag)throw Error('Google did not provide a version tag for the deleted replacement. It cannot be safely restored here.');
}
export async function prepareSwap(api:CalendarReadApi,calendarId:string,token:string,selected:RemoteEvent,replacement?:ReviewedShift,reminder:number|null=null,recovery?:ApplyOptions['recovery'],assertCurrent:()=>void=()=>{}):Promise<SwapPlan>{
 assertCurrent();await verifyRosterCalendar(api,calendarId,token);assertCurrent();
 const path='/calendars/'+encodeURIComponent(calendarId)+'/events',old=await get(api,path,token,selected.id);assertCurrent();
 if(!old||!await swappable(old)||old.etag!==selected.etag)throw Error('The selected shift changed. Load shifts again before reviewing.');
 if(!replacement)return{calendarId,old,kind:'remove'};
 const after=(await prepareEvents([{...replacement,reviewed:true}],reminder))[0].event,p=old.extendedProperties!.private!;
 if(p.rosterDate===replacement.date&&p.rosterType===replacement.label){after.id=await stableEventId(replacement.date,replacement.label,Number(p.rosterOrdinal));after.extendedProperties.private.rosterOrdinal=p.rosterOrdinal;}
 const op=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([calendarId,old.id,old.etag,after])));
 (after.extendedProperties.private as Record<string,string>).rosterSwapId=Array.from(new Uint8Array(op),b=>b.toString(16).padStart(2,'0')).join('');
 if(after.id===old.id)return{calendarId,old,after,kind:'update'};
 const target=await get(api,path,token,after.id);assertCurrent();
 if(target?.status==='cancelled')recoveryCheck(target,after,calendarId,recovery);
 else if(target&&!matching(target,after))throw Error('Another shift already uses this date and shift type. It will not be overwritten. Check your calendar or choose different replacement details.');
 return{calendarId,old,after,target,kind:'replace'};
}
export async function applySwap(api:CalendarReadApi,token:string,reviewed:SwapPlan,assertCurrent:()=>void=()=>{},progress:(p:CalendarProgress)=>void=()=>{},recovery?:ApplyOptions['recovery']):Promise<SwapResult>{
 const plan=structuredClone(reviewed),{calendarId,after}=plan,path='/calendars/'+encodeURIComponent(calendarId)+'/events';let replacementSaved=false,attempted=false;
 try{
  if(!await swappable(plan.old))throw Error('The reviewed original shift is invalid.');
  if((plan.kind==='remove'&&after)||(plan.kind==='replace'&&(!after||after.id===plan.old.id)))throw Error('The reviewed swap is inconsistent. Review again.');
  if(after){const p=after.extendedProperties?.private;if(!p||p.rosterImporter!==OWNER_MARKER||after.id!==await stableEventId(p.rosterDate,p.rosterType,Number(p.rosterOrdinal)))throw Error('The replacement identity is invalid. Review the swap again.');}
  assertCurrent();progress({phase:'validating',completed:0,total:after?2:1});await verifyRosterCalendar(api,calendarId,token);assertCurrent();
  let old=await get(api,path,token,plan.old.id);assertCurrent();
  if(plan.kind==='update'){
   if(!after||after.id!==plan.old.id)throw Error('The reviewed update is invalid.');
   if(matching(old,after))return{complete:true,replacementSaved:true,originalRemoved:false,detail:'This change was already saved. No duplicate was added.'};
   if(!old||!await swappable(old)||old.etag!==plan.old.etag)throw Error('The original shift changed. Load shifts and review again.');
   progress({phase:'saving',completed:0,total:1});assertCurrent();attempted=true;await api(path+'/'+old.id,token,'PATCH',body(after,old),old.etag);assertCurrent();
   const saved=await get(api,path,token,old.id);if(!matching(saved,after))throw Error('The updated shift could not be verified.');assertCurrent();progress({phase:'saving',completed:1,total:1});
   return{complete:true,replacementSaved:true,originalRemoved:false,detail:'The selected shift was updated. There is still only one event.'};
  }
  let target=after?await get(api,path,token,after.id):undefined;assertCurrent();replacementSaved=!!after&&matching(target,after);
  if(!old||old.status==='cancelled'){
   if(!after||replacementSaved)return{complete:true,replacementSaved,originalRemoved:true,detail:after?'This swap was already completed.':'The selected shift is already removed.'};
   throw Error('The original shift is no longer available. Load shifts again before making another change.');
  }
  if(!await swappable(old)||old.etag!==plan.old.etag)throw Error('The original shift changed since review. It has not been removed.');
  progress({phase:'validating',completed:1,total:after?2:1});
  if(after&&!replacementSaved){
   if(target?.status==='cancelled'){
    recoveryCheck(target,after,calendarId,recovery);
    if(recovery!.strategy==='patch'&&target.etag!==plan.target?.etag)throw Error('The deleted replacement changed since review. Review the swap again.');
   }else if(target)throw Error('The replacement ID is now in use. It was not overwritten.');
   else if(plan.target)throw Error('The replacement changed since review. Review the swap again.');
  }
  const total=after?2:1;progress({phase:'saving',completed:replacementSaved?1:0,total});
  if(after&&!replacementSaved){
   assertCurrent();attempted=true;
   if(target?.status==='cancelled'&&recovery!.strategy==='patch')await api(path+'/'+after.id,token,'PATCH',{...body(after,target),status:'confirmed'},target.etag);
   else try{await api(path,token,'POST',{id:after.id,...body(after)});}catch(error){if(!isStatus(error,409))throw error;}
   assertCurrent();target=await get(api,path,token,after.id);if(!matching(target,after))throw Error('The replacement could not be verified. The original was kept.');replacementSaved=true;
   progress({phase:'saving',completed:1,total});
  }
  // Preserve the original until the replacement is verified, then delete using its reviewed version.
  assertCurrent();old=await get(api,path,token,plan.old.id);assertCurrent();
  if(old&&old.status!=='cancelled'){
   if(!await swappable(old)||old.etag!==plan.old.etag)throw Error('The original changed while the replacement was saved. It was not removed.');
   attempted=true;await api(path+'/'+old.id,token,'DELETE',undefined,old.etag);assertCurrent();
  }
  const remaining=await get(api,path,token,plan.old.id);assertCurrent();if(remaining&&remaining.status!=='cancelled')throw Error('Google did not confirm removal of the original.');
  progress({phase:'saving',completed:total,total});return{complete:true,replacementSaved,originalRemoved:true,detail:after?'Replacement saved and original shift removed.':'Selected shift removed.'};
 }catch(error){return{complete:false,replacementSaved,originalRemoved:false,detail:(replacementSaved?'The replacement is saved. The original may still be present. ':'')+(error instanceof Error?error.message:'Google could not complete this change.')+(attempted?' A request may have reached Google. Review or retry this same change before starting another.':' No change was sent.')};}
}
