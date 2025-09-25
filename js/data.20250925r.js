/* ===== Minimal GIS + Drive bootstrap (R build) ===== */
(function(global){
  'use strict';
  var STATE = {
    gapiReady: false,
    gisReady: false,
    tokenInFlight: false,
    tokenClient: null
  };

  function log(){ try{ console.log.apply(console, ['[data]'].concat([].slice.call(arguments))); }catch(e){} }
  function setStatus(t){ try{ var el=document.getElementById('statusText'); if(el) el.textContent = t; }catch(e){} }
  function sanitizeScopes(s){
    s = (s || '').replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();
    return s || 'https://www.googleapis.com/auth/drive.metadata.readonly';
  }

  function ensureGapiClient(){
    return new Promise(function(resolve){
      if (STATE.gapiReady) return resolve();
      if (!(global.gapi && gapi.load)) return resolve(); // api.js は index の defer で読み込み済み前提
      try{
        gapi.load('client', {
          callback: function(){
            try{
              gapi.client.init({
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
              }).then(function(){
                STATE.gapiReady = true;
                log('Google API初期化完了');
                resolve();
              }).catch(function(){
                STATE.gapiReady = true; resolve();
              });
            }catch(e){
              STATE.gapiReady = true; resolve();
            }
          },
          onerror: function(){
            STATE.gapiReady = true; resolve();
          }
        });
      }catch(e){
        STATE.gapiReady = true; resolve();
      }
    });
  }

  function __initTokenClient(){
    if (STATE.tokenClient) return;
    if (!(global.google && google.accounts && google.accounts.oauth2)){
      console.warn('GIS ライブラリ未ロード'); return;
    }
    var cid = (global.APP_CONFIG && APP_CONFIG.GOOGLE_CLIENT_ID) ||
              (global.DRIVE_CONFIG && DRIVE_CONFIG.CLIENT_ID) || '';
    var scopes = (global.APP_CONFIG && APP_CONFIG.SCOPES) ||
                 (global.DRIVE_CONFIG && DRIVE_CONFIG.SCOPES) || '';
    scopes = sanitizeScopes(scopes);
    if (!cid){ console.error('GOOGLE_CLIENT_ID 未設定'); return; }

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
  }

  var AppData = {
    initializeGoogleAPI: function(){ return ensureGapiClient(); },
    initializeGIS: function(){ __initTokenClient(); },
    setAuthenticated: function(v){ /* compatibility no-op */ }
  };

  global.AppData = AppData;
  global.initializeGoogleAPI = function(){ return AppData.initializeGoogleAPI(); };
  global.initializeGIS = function(){ return AppData.initializeGIS(); };
  global.handleAuthClick = function(){
    try{
      if (!STATE.tokenClient){ __initTokenClient(); }
      if (!STATE.tokenClient){ console.warn('tokenClient 未初期化'); return; }
      if (STATE.tokenInFlight){ console.warn('token 要求中'); return; }
      STATE.tokenInFlight = true;
      STATE.tokenClient.requestAccessToken({ prompt: 'consent' });
    }catch(e){
      STATE.tokenInFlight = false;
      console.error(e);
    }
  };

  // Build marker
  (function(g){ g.__BUILD_ID__='2025-09-25R'; })(global);
})(window);
