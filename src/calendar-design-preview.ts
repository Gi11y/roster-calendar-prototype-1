import {firstTimeCalendarState} from './calendar-create';
import './style.css';import './cards-theme.css';
import {comparisonCounts,renderCalendarChanges,applyActionState}from'./calendar-presentation';
import type{ApprovedEvent}from'./approved-events';
import type{Comparison}from'./calendar-compare';
const el=(id:string)=>document.getElementById(id)!;
function event(day:number,start:string,end:string,title:string):ApprovedEvent{return{id:'demo'+day,summary:title,description:'Synthetic design example.',start:{dateTime:'2030-01-'+day+'T'+start+':00+11:00',timeZone:'Australia/Sydney'},end:{dateTime:'2030-01-'+day+'T'+end+':00+11:00',timeZone:'Australia/Sydney'},reminders:{useDefault:false},extendedProperties:{private:{rosterImporter:'demo',rosterDate:'2030-01-'+day,rosterType:'A',rosterOrdinal:'0'}}};}
const a=event(14,'07:00','15:00','Educator — Morning shift'),b=event(15,'13:30','21:30','Floor staff — Afternoon shift'),c=event(16,'07:00','15:30','Educator — Morning shift'),d=event(17,'07:00','15:00','Educator — Morning shift'),e=event(18,'13:30','21:30','Floor staff — Afternoon shift');
const changes:Comparison[]=[{kind:'new',id:a.id,after:a,reason:'New in your confirmed roster.'},{kind:'new',id:b.id,after:b,reason:'New in your confirmed roster.'},{kind:'changed',id:c.id,before:{...c,end:{dateTime:'2030-01-16T15:00:00+11:00'}},after:c,reason:'The confirmed end time is 30 minutes later.'},{kind:'unchanged',id:d.id,before:d,after:d,reason:'Already matches.'},{kind:'unchanged',id:e.id,before:e,after:e,reason:'Already matches.'}];
el('start-screen').hidden=true;el('calendar-screen').hidden=false;el('review-auth').hidden=true;el('calendar-step-title').textContent='5 changes found';el('calendar-overview').dataset.stage='results';el('calendar-main-actions').hidden=true;el('calendar-step-copy').textContent='Review the listed changes before applying.';el('calendar-approved-count').textContent='6 confirmed shifts';el('review-connection').textContent='Demo connection';el('review-connection').dataset.connected='true';el('review-destination').textContent='Example Roster calendar';
const removed=event(19,'07:00','15:00','Educator — Morning shift'),restored=event(20,'19:00','23:00','Floor staff — Night shift');
changes.push({kind:'removed',id:removed.id,before:removed,reason:'Absent from the complete roster period you confirmed.'},{kind:'restore',id:restored.id,before:{id:restored.id,status:'cancelled'},after:restored,reason:'This deleted shift is in the reviewed roster again.'});
el('comparison-results').hidden=false;el('comparison-status').textContent='Tap a shift for details. Complete coverage: 14–20 January.';
const counts=comparisonCounts(changes),stats=el('comparison-summary');for(const [key,label]of[['new','New'],['changed','Updated'],['unchanged','Unchanged'],['removed','To remove'],['restore','To restore']]as const){const item=document.createElement('div'),n=document.createElement('strong'),caption=document.createElement('span');n.textContent=String(counts[key]);caption.textContent=label;item.append(n,caption);stats.append(item);}
renderCalendarChanges(el('calendar-comparison'),changes);document.querySelectorAll('button').forEach(button=>{button.disabled=true;});el('reader-metric').textContent='Design preview only';
const action=applyActionState(changes,true,true,true,false,false,false,undefined,{coverage:{start:'2030-01-14',end:'2030-01-20',confirmed:true},removalsConfirmed:true,recovery:{calendarId:'demo',strategy:'patch'}}),apply=el('apply-calendar')as HTMLButtonElement;
apply.hidden=action.hidden;apply.textContent=action.label;apply.disabled=true;
el('calendar-apply-hint').textContent='Design preview only. The live app requires complete coverage, removal confirmation and a passed recovery check.';
el('calendar-removal-confirmation').hidden=false;(el('confirm-calendar-removals')as HTMLInputElement).checked=true;el('calendar-removal-label').textContent='Remove the 1 listed shift. Complete coverage confirmed: 14–20 January.';


if(new URLSearchParams(location.search).get('view')==='setup'){
 const state=firstTimeCalendarState(true,false,true,true,0);
 el('calendar-overview').dataset.stage='select';el('comparison-results').hidden=true;el('calendar-main-actions').hidden=false;
 el('calendar-step-title').textContent=state.title;el('calendar-step-copy').textContent=state.copy;
 el('review-connection').textContent='Google connected ✓ (example)';
 el('calendar-approved-count').textContent='Your confirmed shifts';el('review-destination').hidden=true;
 el('review-create-calendar').hidden=false;el('open-calendar-settings').hidden=false;el('open-calendar-settings').textContent='Use an existing calendar';
 el('calendar-review-status').hidden=false;el('calendar-review-status').textContent='Design preview only. These controls do not contact Google.';
}
