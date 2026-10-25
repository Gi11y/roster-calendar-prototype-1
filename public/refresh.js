const button=document.getElementById('refresh'),status=document.getElementById('status');
button.addEventListener('click',async()=>{
 button.disabled=true;status.textContent='Replacing old app files…';
 const root=new URL('./',location.href),prefix='roster-prototype1:'+root.pathname+':';
 try{
  if('serviceWorker'in navigator){
   const registrations=await navigator.serviceWorker.getRegistrations();
   for(const registration of registrations)if(registration.scope===root.href)await registration.unregister();
  }
  if('caches'in window){const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith(prefix)).map(key=>caches.delete(key)));}
  const target=new URL('cards.html',root);target.searchParams.set('v','0.19');target.searchParams.set('refresh',String(Date.now()));
  location.replace(target.href);
 }catch(error){status.textContent='Could not refresh completely. Close other Roster tabs and try again while online. '+(error instanceof Error?error.message:'');button.disabled=false;}
});
