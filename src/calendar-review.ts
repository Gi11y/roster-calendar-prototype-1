import {calendarStage,comparisonCounts,renderCalendarChanges} from './calendar-presentation';
import {loadGoogleScript,tokenClient,scopeGranted,calendarApi as rawApi,type TokenResponse} from './google';
import {readCalendarId,saveCalendarId} from './idb';
import {verifyRosterCalendar,connectionLabel,type CalendarReadApi} from './calendar-selection';
import {compareCalendar,isStatus,type Coverage,type Comparison} from './calendar-compare';
import {recoveryProbe,cleanupProbe,PROBE_TITLE} from './recovery-probe';
import type {ApprovedEvent} from './approved-events';
export function mountCalendarReview(){
 const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
 const auth=el<HTMLButtonElement>('review-auth'),disconnect=el<HTMLButtonElement>('review-disconnect'),use=el<HTMLButtonElement>('review-use-calendar'),input=el<HTMLInputElement>('review-calendar-id'),compare=el<HTMLButtonElement>('compare-calendar'),probe=el<HTMLButtonElement>('recovery-probe'),consent=el<HTMLInputElement>('probe-consent'),cleanup=el<HTMLButtonElement>('probe-cleanup');
 const removals=el<HTMLInputElement>('compare-removals'),from=el<HTMLInputElement>('coverage-start'),to=el<HTMLInputElement>('coverage-end');
 const clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID as string|undefined;
 let token:string|undefined,deadline=0,timer:ReturnType<typeof setTimeout>|undefined,prepared=false,busy=false,storageReady=false,verified=false,calendarId:string|undefined,epoch=0,revision=0,events:ApprovedEvent[]=[];
 let pending:{calendarId:string;id:string}|undefined;
 const minimal=!!document.getElementById('calendar-overview');let hasComparison=false;let lastCounts:ReturnType<typeof comparisonCounts>|undefined;
 const openOptions=(selection=false)=>{if(!minimal)return;el<HTMLDetailsElement>('calendar-options').open=true;if(selection){el<HTMLDetailsElement>('calendar-selection').open=true;input.focus();}};
 if(minimal){el('open-calendar-settings').addEventListener('click',()=>openOptions(true));el('review-reconnect').addEventListener('click',()=>auth.click());}
 const say=(text:string)=>{el('calendar-review-status').textContent=text;if(minimal)el('calendar-review-status').hidden=!text;};
 const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);
 const invalidate=()=>{revision++;hasComparison=false;lastCounts=undefined;if(minimal){el('comparison-results').hidden=true;el('comparison-summary').replaceChildren();}el('calendar-comparison').replaceChildren();el('comparison-status').textContent='Prepare reviewed events, then compare. No real roster events will be written.';};
 function refresh(){
  const connected=!!token&&Date.now()<deadline;
  el('review-connection').textContent=connectionLabel(connected,deadline);el('review-connection').dataset.connected=String(connected);
  el('review-destination').textContent=calendarId?(verified?'Verified Roster calendar: ':'Saved calendar; sign in to verify: ')+calendarId:'No saved Roster calendar. Copy its calendar ID from the working Google prototype.';
  auth.disabled=busy||!clientId;auth.textContent=!prepared?'Prepare Google sign-in':connected?'Reconnect Google account':'Connect Google account';
  disconnect.disabled=!connected||busy;input.disabled=busy;use.disabled=busy||!connected||!storageReady||!input.value.trim()||!!pending;
  compare.disabled=busy||!connected||!verified||!events.length;
  consent.disabled=busy;probe.disabled=busy||!connected||!verified||!consent.checked||!!pending;
  cleanup.hidden=!pending;cleanup.disabled=busy||!connected||!verified||pending?.calendarId!==calendarId;
  removals.disabled=busy;from.disabled=busy||!removals.checked;to.disabled=busy||!removals.checked;
  if(minimal){
   const stage=calendarStage(connected,verified,hasComparison),count=events.length;
   el('calendar-approved-count').textContent=count+' confirmed '+(count===1?'shift':'shifts');
   el('review-connection').textContent=connected?'Google connected':'Not connected';
   el('review-destination').textContent=connected&&verified?'Roster calendar selected':'';
   el('review-destination').hidden=!connected||!verified;
   el('calendar-id-detail').textContent=calendarId?'Saved calendar ID: '+calendarId:'No calendar selected.';
   auth.hidden=stage!=='connect';auth.textContent=prepared?'Choose Google account':'Connect Google';
   el('open-calendar-settings').hidden=stage!=='select';el<HTMLButtonElement>('open-calendar-settings').disabled=busy||!storageReady;
   compare.hidden=stage!=='compare'&&stage!=='results';compare.textContent=busy?'Checking…':hasComparison?'Check again':'Check calendar';
   el('calendar-account-actions').hidden=!connected;el<HTMLButtonElement>('review-reconnect').disabled=busy;
   el('calendar-step-title').textContent=stage==='connect'?'Connect Google':stage==='select'?'Choose your Roster calendar':stage==='compare'?'Ready to compare':lastCounts&&(lastCounts.conflict+lastCounts.restore)>0?'Some shifts need review':lastCounts&&(lastCounts.new+lastCounts.changed+lastCounts.removed)>0?'Your calendar changes':'Already up to date';
   el('calendar-step-copy').textContent=stage==='connect'?'Use your personal Google account.':stage==='select'?'Select the existing calendar from your working setup.':stage==='compare'?'Check your confirmed shifts against Google.':'Nothing has been changed.';
   el('calendar-cleanup-notice').hidden=!pending||busy;
   if(pending&&!busy){openOptions();el<HTMLDetailsElement>('calendar-developer-tests').open=true;el<HTMLDetailsElement>('calendar-probe-details').open=true;}
  }
 }
 function clearToken(){token=undefined;deadline=0;clearTimeout(timer);verified=false;epoch++;invalidate();refresh();}
 function requireToken(){if(!token||Date.now()>=deadline){clearToken();throw Error('Google connection expired. Reconnect and compare again.');}return token;}
 function guardedApi(connectionEpoch:number):CalendarReadApi{
  return async<T>(path:string,accessToken:string,method='GET',body?:unknown,ifMatch?:string):Promise<T>=>{
   if(connectionEpoch!==epoch||requireToken()!==accessToken)throw Error('Google account or connection changed. Start this step again.');
   try{const value=await rawApi<T>(path,accessToken,method,body,ifMatch);if(connectionEpoch!==epoch)throw Error('Connection changed while the request was running.');return value;}
   catch(error){if(isStatus(error,401))clearToken();throw error;}
  };
 }
 async function verifySaved(connectionEpoch:number){
  if(!calendarId)return;
  const id=calendarId,accessToken=requireToken();
  await verifyRosterCalendar(guardedApi(connectionEpoch),id,accessToken);
  if(connectionEpoch!==epoch)throw Error('Google connection changed.');
  verified=true;
 }
 auth.addEventListener('click',async()=>{
  if(busy)return;
  if(!prepared){busy=true;refresh();if(minimal)say('Preparing sign-in…');try{await loadGoogleScript();prepared=true;say(minimal?'Ready. Tap Choose Google account.':'Google sign-in ready. Tap Connect Google account to open the popup.');}catch(error){say(errorText(error));}finally{busy=false;refresh();}return;}
  if(!clientId)return;
  clearToken();const connectionEpoch=epoch;busy=true;refresh();say('Opening Google account popup…');
  try{
   // Keep popup opening synchronous with this deliberate second tap, including on iPhone.
   tokenClient(clientId,async(response:TokenResponse)=>{
    if(connectionEpoch!==epoch)return;
    try{
     const seconds=Number(response.expires_in??3600);
     if(response.error||!response.access_token||!scopeGranted(response)||!Number.isFinite(seconds)||seconds<=60)throw Error('Google permission was not granted or the connection is already expired.');
     token=response.access_token;const lifetime=seconds*1000-60000;deadline=Date.now()+lifetime;
     timer=setTimeout(()=>{clearToken();say('Google connection expired. Your reviewed shifts remain available; reconnect.');},lifetime);
     await verifySaved(connectionEpoch);
     say(minimal?'':verified?'Google connected. Existing Roster calendar verified. Comparison is read only.':'Google connected. Enter your existing Roster calendar ID below.');
    }catch(error){say('Connection/calendar check: '+errorText(error));}
    finally{busy=false;refresh();}
   },message=>{if(connectionEpoch!==epoch)return;busy=false;say('Google popup: '+message+'. Try a normal Safari/Chrome tab if the home-screen popup is blocked.');refresh();}).requestAccessToken({prompt:'select_account'});
  }catch(error){busy=false;say(errorText(error));refresh();}
 });
 disconnect.addEventListener('click',()=>{clearToken();say('Google disconnected in this app. Reviewed shifts stay on this device.');});
 input.addEventListener('input',refresh);
 use.addEventListener('click',async()=>{
  if(busy||pending)return;
  busy=true;refresh();const connectionEpoch=epoch;
  try{
   const calendar=await verifyRosterCalendar(guardedApi(connectionEpoch),input.value,requireToken());
   await saveCalendarId(calendar.id);
   if(connectionEpoch!==epoch)throw Error('Google connection changed.');
   calendarId=calendar.id;verified=true;invalidate();say(minimal?'':'Existing Roster calendar verified and selected. No calendar was created.');
  }catch(error){say('Calendar selection: '+errorText(error));}finally{busy=false;refresh();}
 });
 for(const field of [removals,from,to])field.addEventListener('change',()=>{invalidate();refresh();});
 compare.addEventListener('click',async()=>{
  if(busy||!verified||!calendarId||!events.length)return;
  busy=true;invalidate();refresh();const currentRevision=revision,connectionEpoch=epoch,destination=calendarId,approved=events.slice();
  try{
   const coverage:Coverage|undefined=removals.checked?{start:from.value,end:to.value,confirmed:true}:undefined;
   say(minimal?'Checking your calendar…':'Reading existing Roster events. No calendar changes are being made.');
   const changes=await compareCalendar(guardedApi(connectionEpoch),destination,requireToken(),approved,coverage);
   if(currentRevision!==revision||connectionEpoch!==epoch)return;
   renderChanges(changes);
   const counts=(kind:Comparison['kind'])=>changes.filter(c=>c.kind===kind).length;
   el('comparison-status').textContent=counts('new')+' new; '+counts('changed')+' changed; '+counts('restore')+' need restoration; '+counts('removed')+' removal candidates; '+counts('unchanged')+' unchanged; '+counts('conflict')+' conflicts. '+(coverage?'Coverage confirmed: '+coverage.start+' to '+coverage.end+'.':'Removals excluded; complete coverage was not confirmed.')+' Preview only. No real roster events were written.';
   if(minimal)el('comparison-status').textContent=(counts('conflict')||counts('restore')?'Expand flagged shifts to review the issue. ':'Tap a shift for details. ')+(coverage?'Coverage: '+coverage.start+' to '+coverage.end+'.':'New and updated shifts only.');
   say(minimal?'':'Calendar comparison complete. Review the before/after details. Real roster writes remain disabled.');
  }catch(error){if(currentRevision===revision)say('Comparison stopped: '+errorText(error));}
  finally{busy=false;refresh();}
 });
 function renderChanges(changes:Comparison[]){
  const root=el('calendar-comparison');root.replaceChildren();
  if(minimal){
   hasComparison=true;lastCounts=comparisonCounts(changes);el('comparison-results').hidden=false;
   const stats=el('comparison-summary');stats.replaceChildren();
   for(const [key,label]of [['new','New'],['changed','Updated'],['unchanged','Unchanged'],['removed','Removal candidates'],['restore','Recovery'],['conflict','Need review']]as const){
    if((key==='removed'||key==='restore'||key==='conflict')&&!lastCounts[key])continue;
    const item=document.createElement('div'),number=document.createElement('strong'),caption=document.createElement('span');number.textContent=String(lastCounts[key]);caption.textContent=label;item.append(number,caption);stats.append(item);
   }
   renderCalendarChanges(root,changes);return;
  }
  for(const change of changes){
   const article=document.createElement('article');article.className='shift-card';
   const title=document.createElement('h3');title.textContent=change.kind.toUpperCase()+': '+(change.after?.summary||change.before?.summary||'Roster event');
   const reason=document.createElement('p');reason.textContent=change.reason;article.append(title,reason);
   const line=(name:string,event:Comparison['before']|Comparison['after'])=>{if(!event)return;const p=document.createElement('p');p.textContent=name+': '+(event.start?.dateTime||event.start&&'date'in event.start&&event.start.date||'unknown start')+' → '+(event.end?.dateTime||event.end&&'date'in event.end&&event.end.date||'unknown end');article.append(p);};
   line('Calendar',change.before);line('Reviewed roster',change.after);root.append(article);
  }
 }
 consent.addEventListener('change',refresh);
 probe.addEventListener('click',async()=>{
  if(busy||!consent.checked||!verified||!calendarId||pending)return;
  busy=true;refresh();const connectionEpoch=epoch,destination=calendarId;
  const bytes=crypto.getRandomValues(new Uint8Array(32)),id=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  pending={calendarId:destination,id};el('probe-status').textContent='Running synthetic test '+id+'. Please keep this page open.';
  try{
   const result=await recoveryProbe(guardedApi(connectionEpoch),destination,requireToken(),id);
   if(!result.cleanupRequired)pending=undefined;
   el('probe-status').textContent=(result.passed?'PASS: ':'NOT PASSED: ')+result.detail+' Test ID: '+result.id+'. Result applies only to this account/calendar connection; real roster writes remain disabled.';
  }catch(error){el('probe-status').textContent='Test stopped: '+errorText(error)+'. Test ID: '+id+'. Reconnect to the same Roster calendar and retry cleanup.';}
  finally{consent.checked=false;busy=false;refresh();}
 });
 cleanup.addEventListener('click',async()=>{
  if(busy||!pending||calendarId!==pending.calendarId||!verified)return;
  busy=true;refresh();const job=pending,connectionEpoch=epoch;
  try{await cleanupProbe(guardedApi(connectionEpoch),job.calendarId,requireToken(),job.id);pending=undefined;el('probe-status').textContent='Synthetic test event cleanup completed. No real roster event was changed.';}catch(error){el('probe-status').textContent='Cleanup stopped: '+errorText(error)+'. Find "'+PROBE_TITLE+'" in the selected Roster calendar if manual cleanup is needed. ID: '+job.id;}finally{busy=false;refresh();}
 });
 readCalendarId().then(id=>{calendarId=id;storageReady=true;refresh();}).catch(error=>say('Saved calendar settings unavailable: '+errorText(error)));
 window.addEventListener('pagehide',clearToken);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(token&&Date.now()>=deadline)clearToken();refresh();}});
 if(!clientId)say('Google client ID is missing from this build. Local review remains available.');
 refresh();
 return{setEvents(approved:ApprovedEvent[]){events=structuredClone(approved);invalidate();refresh();}};
}
