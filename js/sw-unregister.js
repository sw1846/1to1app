(function(){
  try{
    console.log('[sw] unregister attempt start');
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations().then(regs=>{
        regs.forEach(r=>r.unregister().then(()=>console.log('[sw] unregistered:', r.scope)));
      }).catch(e=>console.warn('[sw] getRegistrations error', e));
    }
    if('caches' in window){
      caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>console.log('[sw] caches cleared')).catch(()=>{});
    }
  }catch(e){ console.warn('[sw] unregister failed', e); }
})();
