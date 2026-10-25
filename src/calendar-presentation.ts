import {applyEligibility,type ApplyOptions} from './calendar-apply.ts';
import {DateTime} from 'luxon';
import type {Comparison,RemoteEvent} from './calendar-compare.ts';
export type CalendarStage='connect'|'select'|'compare'|'results';
export function calendarStage(connected:boolean,verified:boolean,hasComparison:boolean):CalendarStage{return !connected?'connect':!verified?'select':hasComparison?'results':'compare';}
export function comparisonCounts(changes:Comparison[]){const count=(kind:Comparison['kind'])=>changes.filter(x=>x.kind===kind).length;return{new:count('new'),changed:count('changed'),unchanged:count('unchanged'),removed:count('removed'),restore:count('restore'),conflict:count('conflict')};}
export function calendarTime(event:RemoteEvent|undefined):{date:string;hours:string}{
 if(!event)return{date:'',hours:''};
 if(event.start?.date){const d=DateTime.fromISO(event.start.date,{zone:'Australia/Sydney'});return{date:d.isValid?d.toFormat('ccc d LLL'):'Date needs review',hours:'All day'};}
 const start=DateTime.fromISO(event.start?.dateTime||'',{setZone:true}).setZone('Australia/Sydney'),end=DateTime.fromISO(event.end?.dateTime||'',{setZone:true}).setZone('Australia/Sydney');
 if(!start.isValid||!end.isValid)return{date:'Date needs review',hours:'Check times'};
 return{date:start.toFormat('ccc d LLL'),hours:start.toFormat('HH:mm')+'–'+end.toFormat('HH:mm')+(end.toISODate()!==start.toISODate()?' · next day':'')};
}
function reminder(event:RemoteEvent|undefined):string{if(!event)return'None';if(event.reminders?.useDefault)return'Calendar default';const items=event.reminders?.overrides||[];return items.length?items.map(r=>r.minutes+' min before').join(', '):'None';}
export function renderCalendarChanges(root:HTMLElement,changes:Comparison[]):void{
 root.replaceChildren();const labels:Record<Comparison['kind'],string>={new:'New',changed:'Update',unchanged:'Unchanged',removed:'Remove',restore:'Restore',conflict:'Needs review'};
 function row(change:Comparison){
  const item=document.createElement('details');item.className='calendar-change';if(change.kind==='conflict'||change.kind==='restore')item.classList.add('needs-attention');
  const summary=document.createElement('summary'),copy=document.createElement('span');copy.className='calendar-change-copy';const value=change.after||change.before,when=calendarTime(value),date=document.createElement('strong');date.textContent=when.date;
  const hours=document.createElement('span');hours.className='calendar-change-hours';hours.textContent=when.hours;const title=document.createElement('span');title.className='calendar-change-title';title.textContent=value?.summary||'Roster shift';copy.append(date,hours,title);
  const badge=document.createElement('span');badge.className='calendar-change-badge';badge.textContent=labels[change.kind];summary.append(copy,badge);item.append(summary);
  const detail=document.createElement('div');detail.className='calendar-change-detail';const reason=document.createElement('p');reason.textContent=change.reason;detail.append(reason);
  for(const [label,event]of [['Calendar',change.before],['Reviewed',change.after]]as const){if(!event)continue;const time=calendarTime(event),p=document.createElement('p');p.textContent=label+': '+(event.summary||'Roster shift')+' · '+time.date+' '+time.hours+'. Reminder: '+reminder(event)+'.';detail.append(p);}
  item.append(detail);return item;
 }
 for(const change of changes.filter(x=>x.kind!=='unchanged'))root.append(row(change));
 const same=changes.filter(x=>x.kind==='unchanged');if(same.length){const group=document.createElement('details');group.className='calendar-unchanged';const summary=document.createElement('summary');summary.textContent=same.length+' unchanged '+(same.length===1?'shift':'shifts');group.append(summary);for(const change of same)group.append(row(change));root.append(group);}
}

export function applyActionState(changes:Comparison[]|undefined,hasComparison:boolean,connected:boolean,verified:boolean,busy:boolean,pending:boolean,applying:boolean,result?:{complete:boolean},options:ApplyOptions={}){
 const eligibility=applyEligibility(changes||[],options),count=eligibility.count;
 const removed=changes?.filter(c=>c.kind==='removed').length||0,restored=changes?.filter(c=>c.kind==='restore').length||0;
 const label=applying?'Saving…':result?(result.complete?'Changes saved':'Check again to continue'):!changes?'Check again to apply':count?'Apply '+count+' '+(count===1?'change':'changes')+(removed?' · '+removed+' to remove':'')+(restored?' · '+restored+' to restore':''):'No changes to apply';
 const reason=applying?'Keep this page open while your shifts are saved.':result?'Check the calendar again before making further changes.':!changes?'Check the calendar again to prepare a fresh preview.':!connected?'Reconnect Google, then check your calendar again.':!verified?'Choose and verify your Roster calendar.':pending?'Finish the synthetic test cleanup in Options before applying.':eligibility.reason||'Saves only the changes listed above, including any removals and restorations you confirmed.';
 return{hidden:!hasComparison,disabled:busy||!connected||!verified||pending||!!result||!changes||!!eligibility.reason||!count,label,reason};
}
