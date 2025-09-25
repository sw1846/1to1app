
/* ===== Minimal GIS + Drive bootstrap (S build) ===== */
(function(global){
  'use strict';
  var STATE = {
    gapiReady: false,
    gisReady: false,
    tokenInFlight: false,
    tokenClient: null,
    progress: function(){}, // progress handler
    gisScriptRequested: false
  };

  function log(){ try{ console.log.apply(console, ['[data]'].concat([].slice.call(arguments))); }catch(e){} }
  function setStatus(t){ try{ var el=document.getElementById('statusText'); if(el) el.textContent = t; }catch(e){} }
  function sanitizeScopes(s){
    s = (s || '').replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();
    return s || 'https://www.googleapis.com/auth/drive.metadata.readonly';
  }

  function ensureGisScript(){
    try{
      if(global.google && global.google.accounts && global.google.accounts.oauth2) return true;
      if(STATE.gisScriptRequested) return false;
      var exists = false;
      var scripts = document.getElementsByTagName('script');
      for(var i=0;i<scripts.length;i++){
        var src = scripts[i].getAttribute('src') || '';
        if(src.indexOf('https://accounts.google.com/gsi/client') === 0){ exists = true; break; }
      }
      if(!exists){
        var s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.onload = function(){ log('GIS スクリプト読込完了'); };
        document.head.appendChild(s);
      }
      STATE.gisScriptRequested = true;
      return false;
    }catch(e){ return false; }
  }

  function ensureGapiClient(){
    return new Promise(function(resolve){
      STATE.progress('gapi:init:start');
      if (STATE.gapiReady){ STATE.progress('gapi:init:cached'); return resolve(); }
      if (!(global.gapi && gapi.load)){ STATE.progress('gapi:init:skip'); return resolve(); } // api.js は defer で読み込み済み前提
      try{
        gapi.load('client', {
          callback: function(){
            try{
              gapi.client.init({
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
              }).then(function(){
                STATE.gapiReady = true;
                STATE.progress('gapi:init:ok');
                log('Google API初期化完了');
                resolve();
              }).catch(function(){
                STATE.gapiReady = true; STATE.progress('gapi:init:ok'); resolve();
              });
            }catch(e){
              STATE.gapiReady = true; STATE.progress('gapi:init:ok'); resolve();
            }
          },
          onerror: function(){ STATE.gapiReady = true; STATE.progress('gapi:init:err'); resolve(); }
        });
      }catch(e){ STATE.gapiReady = true; STATE.progress('gapi:init:err'); resolve(); }
    });
  }

  function __initTokenClientInternal(){
    if(STATE.tokenClient){ return true; }
    if(!(global.google && google.accounts && google.accounts.oauth2)){
      return false;
    }
    var cid = (global.APP_CONFIG && APP_CONFIG.GOOGLE_CLIENT_ID) ||
              (global.DRIVE_CONFIG && DRIVE_CONFIG.CLIENT_ID) || '';
    var scopes = (global.APP_CONFIG && APP_CONFIG.SCOPES) ||
                 (global.DRIVE_CONFIG && DRIVE_CONFIG.SCOPES) || '';
    scopes = sanitizeScopes(scopes);
    if (!cid){ console.error('GOOGLE_CLIENT_ID 未設定'); return false; }

    STATE.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cid.trim(),
      scope: scopes,
      callback: function(resp){
        STATE.tokenInFlight = false;
        log('token resp', resp);
        try{
          if (resp && resp.access_token && global.gapi && gapi.client){
            gapi.client.setToken({ access_token: resp.access_token });
          }
          setStatus('サインイン済み');
        }catch(e){}
      },
      error_callback: function(err){
        STATE.tokenInFlight = false;
        console.error('[GIS] error:', err);
        alert('[GIS ERROR] ' + (err && (err.error || err.type || err.message) || 'unknown'));
      },
      prompt: 'consent'
    });
    STATE.gisReady = true;
    log('GIS 初期化完了');
    return true;
  }

  function __initTokenClientWithRetry(cb){
    // attempt immediately; if google not ready, ensure script and retry up to ~3s
    if(__initTokenClientInternal()){ cb && cb(true); return; }
    ensureGisScript();
    var tries = 0, max = 15;
    (function tick(){
      if(__initTokenClientInternal()){ cb && cb(true); return; }
      if(++tries >= max){ console.warn('GIS ライブラリ未ロード（timeout）'); cb && cb(false); return; }
      setTimeout(tick, 200);
    })();
  }

  var AppData = {
    initializeGoogleAPI: function(){ return ensureGapiClient(); },
    initializeGIS: function(){ __initTokenClientWithRetry(); },
    setAuthenticated: function(v){ /* compatibility no-op */ },
    setProgressHandler: function(fn){ STATE.progress = (typeof fn==='function') ? fn : function(){}; }
  };

  global.AppData = AppData;
  global.initializeGoogleAPI = function(){ return AppData.initializeGoogleAPI(); };
  global.initializeGIS = function(){ return AppData.initializeGIS(); };
  global.handleAuthClick = function(){
    try{
      if(STATE.tokenClient){
        if(STATE.tokenInFlight){ console.warn('token 要求中'); return; }
        STATE.tokenInFlight = true;
        STATE.tokenClient.requestAccessToken({ prompt: 'consent' });
        return;
      }
      // Not initialized yet → init then request
      __initTokenClientWithRetry(function(ok){
        if(!ok){ console.warn('tokenClient 初期化失敗'); return; }
        if(STATE.tokenInFlight){ console.warn('token 要求中'); return; }
        STATE.tokenInFlight = true;
        try{ STATE.tokenClient.requestAccessToken({ prompt: 'consent' }); }catch(e){ STATE.tokenInFlight = false; console.error(e); }
      });
    }catch(e){
      STATE.tokenInFlight = false;
      console.error(e);
    }
  };

  // Build marker
  (function(g){ g.__BUILD_ID__='2025-09-25S'; })(global);

  // Proactively load GIS script if missing
  ensureGisScript();
})(window);
