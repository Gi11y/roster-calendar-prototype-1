import{swapRangeError,shiftSearchResult}from'./shift-search-feedback';
import './style.css';import './cards-theme.css';
import{DateTime}from'luxon';import{addDays}from'./date-review';import{calendarTime}from'./calendar-presentation';
import{loadGoogleScript,tokenClient,scopeGranted,calendarListGranted,CALENDAR_AUTH_SCOPES,calendarApi,type TokenResponse}from'./google';
import{createSignInPreparation}from'./signin-preparation';import{readUsableRosterChoices,includeVerifiedChoice,type CalendarChoice}from'./calendar-list';
import{readCalendarId,saveCalendarId}from'./idb';import{verifyRosterCalendar,type CalendarReadApi}from'./calendar-selection';
import{mountCalendarProgress,withCalendarNamesProgress,type CalendarProgress}from'./calendar-progress';import{isStatus,type RemoteEvent}from'./calendar-compare';
import{listSwapShifts,prepareSwap,applySwap,SwapRecoveryRequired,type SwapPlan}from'./shift-swap';
import{recoveryProbe,cleanupProbe}from'./recovery-probe';import type{ApplyOptions}from'./calendar-apply';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id)as T;
const auth=el<HTMLButtonElement>('swap-connect'),disconnect=el<HTMLButtonElement>('swap-disconnect'),calendar=el<HTMLSelectElement>('swap-calendar'),load=el<HTMLButtonElement>('swap-load'),old=el<HTMLSelectElement>('swap-old'),replace=el<HTMLInputElement>('swap-replace'),review=el<HTMLButtonElement>('swap-review'),confirm=el<HTMLButtonElement>('swap-confirm'),retry=el<HTMLButtonElement>('swap-retry');
const from=el<HTMLInputElement>('swap-from'),to=el<HTMLInputElement>('swap-to'),progressView=mountCalendarProgress(el('calendar-operation')),clientId=import.meta.env.VITE_GOOGLE_CLIENT_ID as string|undefined;
const progress={...progressView,start(value:CalendarProgress){progressView.start(value);el('calendar-operation').scrollIntoView({block:'nearest'});}};
let token:string|undefined,deadline=0,timer:ReturnType<typeof setTimeout>|undefined,epoch=0,revision=0,busy=false,calendarId:string|undefined,savedId:string|undefined,shifts:RemoteEvent[]=[],choices:CalendarChoice[]=[],plan:SwapPlan|undefined,recovery:ApplyOptions['recovery'],probePending:{calendarId:string;id:string}|undefined;
const fields=['swap-date','swap-type','swap-role','swap-start','swap-end','swap-next','swap-reminder']as const;
const say=(value:string)=>el('swap-status').textContent=value,errorText=(e:unknown)=>e instanceof Error?e.message:String(e);
function invalidate(){revision++;plan=undefined;el('swap-preview').hidden=true;el('swap-result').textContent='';retry.hidden=true;confirm.disabled=true;confirm.hidden=false;}
const preparation=createSignInPreparation(loadGoogleScript,()=>refresh());
function refresh(){
 const connected=!!token&&Date.now()<deadline;
 auth.hidden=connected;auth.disabled=busy||!clientId||preparation.state==='loading';auth.textContent=preparation.state==='loading'?'Preparing sign-in…':preparation.state==='failed'?'Retry sign-in setup':'Connect Google';
 disconnect.hidden=!connected;disconnect.disabled=busy;
 el('swap-connection').textContent=connected?'Google connected':'Not connected';
 el('swap-calendar-label').hidden=!connected||!choices.length;calendar.disabled=busy||!!probePending;calendar.value=calendarId||'';
 load.disabled=busy||!connected||!calendarId;old.disabled=busy||!shifts.length;from.disabled=to.disabled=busy;
 replace.disabled=busy;for(const id of fields)el<HTMLInputElement|HTMLSelectElement>(id).disabled=busy||!replace.checked;
 el('swap-choose-panel').hidden=!connected||!calendarId;el('swap-edit-panel').hidden=!connected||!old.value;
 el('swap-new-fields').hidden=!replace.checked;review.disabled=busy||!connected||!calendarId||!old.value||!!probePending;review.textContent=replace.checked?'Review swap':'Review removal';
 confirm.disabled=busy||!plan||!connected;retry.disabled=busy||!plan||!connected;
 const consent=el<HTMLInputElement>('swap-probe-consent');consent.disabled=busy;
 el<HTMLButtonElement>('swap-probe').disabled=busy||!connected||!calendarId||!consent.checked||!!probePending;
 el('swap-cleanup').hidden=!probePending;el<HTMLButtonElement>('swap-cleanup').disabled=busy||!connected||probePending?.calendarId!==calendarId;
}
function renderChoices(){calendar.replaceChildren(new Option('Choose Roster calendar',''));for(const c of choices)calendar.add(new Option(c.label,c.id));}
function searchStatus(message:string,state='status'){const status=el('swap-search-status');status.textContent=message;status.dataset.state=state;status.hidden=!message;}
function resetShifts(){searchStatus('');from.removeAttribute('aria-invalid');to.removeAttribute('aria-invalid');shifts=[];old.replaceChildren(new Option('Find and choose a shift',''));el('swap-old-detail').textContent='';invalidate();}
function clearToken(){epoch++;token=undefined;deadline=0;clearTimeout(timer);calendarId=undefined;choices=[];recovery=undefined;renderChoices();resetShifts();progress.stop();refresh();}
function requireToken(){if(!token||Date.now()>=deadline){clearToken();throw Error('Google connection expired. Reconnect, then review the change again.');}return token;}
function apiFor(connection:number):CalendarReadApi{return async<T>(path:string,t:string,method='GET',body?:unknown,etag?:string):Promise<T>=>{
 if(connection!==epoch||requireToken()!==t)throw Error('Google connection changed. Start again.');
 try{const result=await calendarApi<T>(path,t,method,body,etag);if(connection!==epoch)throw Error('Connection changed while the request was running.');return result;}
 catch(error){if(isStatus(error,401))clearToken();throw error;}
};}
async function selectCalendar(id:string){
 if(!id){calendarId=undefined;resetShifts();return;}const connection=epoch;
 await verifyRosterCalendar(apiFor(connection),id,requireToken());if(connection!==epoch)throw Error('Connection changed.');
 calendarId=id;recovery=undefined;resetShifts();
 try{await saveCalendarId(id);savedId=id;}catch{say('Calendar selected for this session; the choice could not be remembered.');}
}
auth.addEventListener('click',async()=>{
 if(busy)return;if(preparation.state!=='ready'){try{await preparation.prepare();say('Sign-in ready. Tap Connect Google.');}catch(e){say(errorText(e));}return;}if(!clientId)return;
 clearToken();const connection=epoch;busy=true;refresh();say('Opening Google…');
 try{tokenClient(clientId,async(response:TokenResponse)=>{
  if(connection!==epoch)return;
  try{
   const seconds=Number(response.expires_in??3600);if(response.error||!response.access_token||!scopeGranted(response)||!Number.isFinite(seconds)||seconds<=60)throw Error('Google permission was not granted.');
   token=response.access_token;deadline=Date.now()+seconds*1000-60000;timer=setTimeout(()=>{clearToken();say('Google connection expired. Reconnect to continue.');},deadline-Date.now());
   say('');await withCalendarNamesProgress(progress,async()=>{
    if(savedId)try{await verifyRosterCalendar(apiFor(connection),savedId,requireToken());calendarId=savedId;}catch(e){if(![403,404,410].some(s=>isStatus(e,s)))throw e;}
    if(calendarListGranted(response))choices=await readUsableRosterChoices(apiFor(connection),requireToken());
    if(calendarId)choices=includeVerifiedChoice(choices,{id:calendarId,summary:'Roster'});
    renderChoices();if(!calendarId&&choices.length===1){calendarId=choices[0].id;try{await saveCalendarId(calendarId);savedId=calendarId;}catch{}}
   },()=>refresh());
   say(calendarId?'Choose a period and tap Find shifts.':choices.length?'Choose your Roster calendar.':'No Roster calendar found. Add a roster from the landing page first, or reconnect and allow calendar-list access.');
  }catch(e){say(errorText(e));}finally{busy=false;progress.stop();refresh();}
 },message=>{if(connection!==epoch)return;busy=false;say('Google sign-in: '+message);refresh();},CALENDAR_AUTH_SCOPES).requestAccessToken({prompt:'select_account'});}
 catch(e){busy=false;say(errorText(e));refresh();}
});
disconnect.addEventListener('click',()=>{clearToken();say('Disconnected.');});
calendar.addEventListener('change',async()=>{if(busy||probePending)return;busy=true;refresh();try{await selectCalendar(calendar.value);say('Calendar selected. Find shifts to continue.');}catch(e){say(errorText(e));}finally{busy=false;refresh();}});
load.addEventListener('click',async()=>{
 if(busy||!calendarId)return;
 resetShifts();say('');
 const error=swapRangeError(from.value,to.value);
 if(error){searchStatus(error,'error');from.setAttribute('aria-invalid','true');to.setAttribute('aria-invalid','true');refresh();el('swap-search-status').scrollIntoView({block:'center'});return;}
 busy=true;refresh();const connection=epoch,start=from.value,end=to.value;
 searchStatus('Finding shifts…','loading');
 try{
  progress.start({phase:'listing',completed:0});shifts=await listSwapShifts(apiFor(connection),calendarId,requireToken(),start,end,p=>progress.update(p));
  const result=shiftSearchResult(shifts.length,start,end);old.replaceChildren(new Option(result.placeholder,''));
  for(const shift of shifts){const when=calendarTime(shift);old.add(new Option(when.date+' · '+when.hours+' · '+shift.summary,shift.id));}
  searchStatus(result.message,shifts.length?'success':'empty');
 }catch(e){
  if(connection!==epoch||!calendarId)say(errorText(e));
  else searchStatus('The search could not be completed. '+errorText(e)+' Try again.','error');
 }finally{busy=false;progress.stop();refresh();if(calendarId)el('swap-search-status').scrollIntoView({block:'center'});}
});
old.addEventListener('change',()=>{
 invalidate();const selected=shifts.find(e=>e.id===old.value);
 if(selected){const when=calendarTime(selected);el('swap-old-detail').textContent=when.date+' · '+when.hours+' · '+selected.summary;
  el<HTMLInputElement>('swap-date').value=selected.extendedProperties!.private!.rosterDate;el<HTMLSelectElement>('swap-type').value=selected.extendedProperties!.private!.rosterType;
  el<HTMLSelectElement>('swap-role').value=selected.summary?.startsWith('Educator')?'Educator':selected.summary?.startsWith('Floor staff')?'Floor staff':'';
  el<HTMLInputElement>('swap-start').value='';el<HTMLInputElement>('swap-end').value='';el<HTMLInputElement>('swap-next').checked=false;
 }refresh();
});
for(const field of [from,to])field.addEventListener('change',()=>{resetShifts();refresh();});
for(const id of fields)el(id).addEventListener('input',()=>{invalidate();refresh();});
replace.addEventListener('change',()=>{invalidate();refresh();});
function line(root:HTMLElement,label:string,event:RemoteEvent){root.replaceChildren();const heading=document.createElement('h3'),copy=document.createElement('p'),when=calendarTime(event);heading.textContent=label;copy.textContent=when.date+' · '+when.hours+' · '+event.summary;root.append(heading,copy);}
review.addEventListener('click',async()=>{
 const selected=shifts.find(e=>e.id===old.value);if(busy||!selected||!calendarId)return;invalidate();busy=true;refresh();const connection=epoch,version=revision;
 const assertCurrent=()=>{if(connection!==epoch||version!==revision)throw Error('The selected shift or account changed. Review again.');requireToken();};
 try{
  progress.start({phase:'checking',completed:0,total:2});const value=(id:string)=>(el<HTMLInputElement|HTMLSelectElement>(id)).value;
  const draft=replace.checked?{cardId:1,date:value('swap-date'),label:value('swap-type'),role:value('swap-role'),start:value('swap-start'),end:value('swap-end'),nextDay:el<HTMLInputElement>('swap-next').checked,reviewed:true,order:0}:undefined;
  plan=await prepareSwap(apiFor(connection),calendarId,requireToken(),selected,draft,value('swap-reminder')===''?null:Number(value('swap-reminder')),recovery,assertCurrent);assertCurrent();
  line(el('swap-before'),plan.kind==='update'?'Current shift':'Remove this shift',plan.old);
  el('swap-after').hidden=!plan.after;if(plan.after)line(el('swap-after'),plan.kind==='update'?'Updated shift':'Replacement shift',plan.after);
  el('swap-plan-note').textContent=plan.kind==='update'?'This updates the same event, keeping one copy.':plan.after?'The replacement is saved and verified before the original is removed.':'Only this selected shift will be removed.';
  confirm.textContent=plan.kind==='remove'?'Confirm removal':plan.kind==='update'?'Confirm update':'Confirm swap';el('swap-preview').hidden=false;say('Review the change below before confirming.');el('swap-preview').scrollIntoView({block:'start'});el('swap-preview').querySelector<HTMLElement>('h2')?.focus({preventScroll:true});
 }catch(e){if(e instanceof SwapRecoveryRequired){el<HTMLDetailsElement>('swap-recovery').hidden=false;el<HTMLDetailsElement>('swap-recovery').open=true;}say(errorText(e));}finally{busy=false;progress.stop();refresh();}
});
async function save(){
 if(busy||!plan||!calendarId||probePending)return;const reviewed=structuredClone(plan),connection=epoch,version=revision;busy=true;refresh();
 const assertCurrent=()=>{if(connection!==epoch||version!==revision||calendarId!==reviewed.calendarId)throw Error('The reviewed change or account changed.');requireToken();};
 try{
  if(!navigator.locks)throw Error('Use a current Safari or Chrome browser to confirm this change.');
  progress.start({phase:'validating',completed:0,total:2});
  const result=await navigator.locks.request('roster-swap:'+reviewed.calendarId+':'+reviewed.old.id,async()=>{assertCurrent();return applySwap(apiFor(connection),requireToken(),reviewed,assertCurrent,p=>progress.update(p),recovery);});
  say(result.detail);el('swap-result').textContent=result.detail;if(result.complete){resetShifts();el('swap-preview').hidden=true;}else{retry.hidden=false;confirm.disabled=true;confirm.hidden=true;}
  if(result.complete)el('swap-status').scrollIntoView({block:'center'});else el('swap-result').scrollIntoView({block:'center'});
 }catch(e){say(errorText(e));el('swap-result').textContent=errorText(e);retry.hidden=false;el('swap-result').scrollIntoView({block:'center'});}finally{busy=false;progress.stop();refresh();}
}
confirm.addEventListener('click',()=>void save());retry.addEventListener('click',()=>void save());
const consent=el<HTMLInputElement>('swap-probe-consent');consent.addEventListener('change',refresh);
el('swap-probe').addEventListener('click',async()=>{
 if(busy||!calendarId||!consent.checked||probePending)return;busy=true;invalidate();recovery=undefined;refresh();const connection=epoch,destination=calendarId,id=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');probePending={calendarId:destination,id};
 try{progress.start({phase:'validating',completed:0});const result=await recoveryProbe(apiFor(connection),destination,requireToken(),id);if(!result.cleanupRequired)probePending=undefined;
  if(result.passed&&!result.cleanupRequired&&result.strategy&&connection===epoch)recovery={calendarId:destination,strategy:result.strategy};
  el('swap-probe-status').textContent=(result.passed?'PASS: ':'Not passed: ')+result.detail;say(recovery?'Recovery check passed. Review your swap again.':'Recovery check did not pass. Your roster shifts were not changed.');
 }catch(e){el('swap-probe-status').textContent=errorText(e)+' Test ID: '+id;}finally{consent.checked=false;busy=false;progress.stop();refresh();}
});
el('swap-cleanup').addEventListener('click',async()=>{if(busy||!probePending||calendarId!==probePending.calendarId)return;busy=true;refresh();try{await cleanupProbe(apiFor(epoch),probePending.calendarId,requireToken(),probePending.id);probePending=undefined;el('swap-probe-status').textContent='Synthetic test cleanup completed.';}catch(e){say(errorText(e));}finally{busy=false;refresh();}});
const today=DateTime.now().setZone('Australia/Sydney').toISODate()!;from.value=today;to.value=addDays(today,42);
readCalendarId().then(id=>{savedId=id;}).catch(()=>{});
void preparation.prepare().catch(e=>say(errorText(e)));
window.addEventListener('pagehide',clearToken);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token&&Date.now()>=deadline){clearToken();say('Reconnect Google to continue.');}});
if('serviceWorker'in navigator&&import.meta.env.PROD)void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL}).catch(()=>{});
if(!clientId)say('Google sign-in is not configured in this build.');refresh();
