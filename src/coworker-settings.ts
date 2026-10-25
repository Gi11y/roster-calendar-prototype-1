export function isDebugUrl(url:string):boolean{return new URL(url).searchParams.get('debug')==='1';}
export function cleanSharedUrl(url:string):string{const value=new URL(url);value.searchParams.delete('v');value.searchParams.delete('refresh');return value.pathname+value.search+value.hash;}
export function shouldSuggestInstall(userAgent:string,standalone:boolean,seen:boolean):boolean{return /iPhone|iPad|iPod/i.test(userAgent)&&!standalone&&!seen;}
