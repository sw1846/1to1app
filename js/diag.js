(function(){
  function exists(name, v){ return (typeof v) + ' ' + name; }
  const info = {
    location: location.href,
    timestamp: new Date().toISOString(),
    buildId: window.__BUILD_ID__ || '(none)',
    has_gapi: !!window.gapi,
    has_google: !!(window.google && google.accounts),
    typeof_initializeGoogleAPI: typeof window.initializeGoogleAPI,
    typeof_initializeGIS: typeof window.initializeGIS,
    typeof_AppData: typeof window.AppData,
    scripts: Array.from(document.scripts).map(s=>s.src || '(inline)'),
  };
  console.log('[diag]', info);
  const pre = document.getElementById('diag');
  pre.textContent = JSON.stringify(info, null, 2);
})();
