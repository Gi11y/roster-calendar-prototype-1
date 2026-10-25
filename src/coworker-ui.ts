import{isDebugUrl,cleanSharedUrl,shouldSuggestInstall}from'./coworker-settings';
export const DEBUG=isDebugUrl(location.href);
if(DEBUG){document.documentElement.dataset.debug='true';document.querySelectorAll<HTMLElement>('[data-debug-only]').forEach(node=>node.hidden=false);}
try{const clean=cleanSharedUrl(location.href);if(clean!==location.pathname+location.search+location.hash)history.replaceState(null,'',clean);}catch{}
export function mountInstallHint(){
 const root=document.getElementById('install-hint');if(!root)return;
 const standalone=matchMedia('(display-mode: standalone)').matches||!!(navigator as Navigator&{standalone?:boolean}).standalone;
 let seen=false;try{seen=localStorage.getItem('roster-install-hint')==='shown';}catch{}
 if(shouldSuggestInstall(navigator.userAgent,standalone,seen)){root.hidden=false;try{localStorage.setItem('roster-install-hint','shown');}catch{}}
 document.getElementById('dismiss-install-hint')?.addEventListener('click',()=>{root.hidden=true;});
}
