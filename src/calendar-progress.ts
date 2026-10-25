export interface CalendarProgress {phase:'listing'|'checking'|'validating'|'saving';completed:number;total?:number}
export function calendarProgressText(progress:CalendarProgress):string{
 const names={listing:'Reading your calendar',checking:'Checking shifts',validating:'Checking changes before saving',saving:'Saving changes'};
 const done=Math.max(0,Math.floor(progress.completed));
 return names[progress.phase]+(progress.total&&progress.total>0?' · '+Math.min(done,progress.total)+' of '+progress.total:done?' · '+done+' '+(done===1?'page loaded':'pages loaded'):'…');
}
export function mountCalendarProgress(root:HTMLElement|null){
 let interval:ReturnType<typeof setInterval>|undefined,started=0;
 const bar=root?.querySelector<HTMLProgressElement>('progress'),label=root?.querySelector<HTMLElement>('[data-progress-label]'),elapsed=root?.querySelector<HTMLElement>('[data-progress-elapsed]'),hint=root?.querySelector<HTMLElement>('[data-progress-hint]');
 function tick(){
  const seconds=Math.max(0,Math.floor((Date.now()-started)/1000));
  if(elapsed)elapsed.textContent=seconds+'s elapsed';
  if(hint)hint.textContent=seconds>=15?'Still waiting for Google. Keep this page open; avoid tapping again.':'Keep this page open.';
 }
 function update(progress:CalendarProgress){
  if(!root||!bar||!label)return;
  label.textContent=calendarProgressText(progress);
  if(progress.total&&progress.total>0){bar.max=progress.total;bar.value=Math.max(0,Math.min(progress.completed,progress.total));}
  else bar.removeAttribute('value');
  bar.setAttribute('aria-label',label.textContent);
 }
 function stop(){clearInterval(interval);interval=undefined;if(root)root.hidden=true;root?.closest('[data-calendar-busy-root]')?.querySelector('#calendar-comparison')?.setAttribute('aria-busy','false');}
 return{
  start(progress:CalendarProgress){stop();if(!root)return;started=Date.now();root.hidden=false;root.closest('[data-calendar-busy-root]')?.querySelector('#calendar-comparison')?.setAttribute('aria-busy','true');update(progress);tick();interval=setInterval(tick,1000);},
  update,stop
 };
}
