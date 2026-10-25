export type PreparationState='idle'|'loading'|'ready'|'failed';
export function createSignInPreparation(load:()=>Promise<void>,changed:(state:PreparationState)=>void=()=>{}){
 let state:PreparationState='idle',pending:Promise<void>|undefined;
 return{get state(){return state;},prepare():Promise<void>{
  if(state==='ready')return Promise.resolve();
  if(pending)return pending;
  state='loading';changed(state);
  pending=Promise.resolve().then(load).then(()=>{state='ready';changed(state);},error=>{state='failed';changed(state);throw error;}).finally(()=>{pending=undefined;});
  return pending;
 }};
}
