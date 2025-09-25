
/* ===== Clean data module (N build) ===== */
(function(global){
  'use strict';
  if(global.__APP_DATA_INITED__) return;
  global.__APP_DATA_INITED__ = true;

  function log(){ try{ console.log.apply(console, ['[data]'].concat([].slice.call(arguments))); }catch(e){} }
  function setStatus(t){ try{ var el = document.getElementById('statusText'); if(el) el.textContent = t; }catch(e){} }

  var STATE = {
    isInitialized: false,
    isGISReady: false,
    isAuthed: false,
    onProgress: function(){}
  };

  var AppData = {
    setProgressHandler: function(fn){ STATE.onProgress = (typeof fn==='function' ? fn : function(){}); },
    setAuthenticated: function(v){ STATE.isAuthed = !!v; },
    initializeGoogleAPI: function(){
      // load gapi client then drive discovery
      return new Promise(function(resolve){
        function done(){ STATE.isInitialized = true; log('Google API初期化完了'); resolve(); }
        if(global.gapi && gapi.load){
          try{
            gapi.load('client', {
              callback: function(){
                try{
                  gapi.client.init({
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
                  }).then(done).catch(function(){ done(); });
                }catch(e){ done(); }
              },
              onerror: function(){ done(); }
            });
          }catch(e){ done(); }
        }else{
          // fallback: dynamic script (should already be loaded via index.html)
          done();
        }
      });
    },
    initializeGIS: function(){
      // Prepare token client; do not request token here.
      try{
        var cid = (global.APP_CONFIG && APP_CONFIG.GOOGLE_CLIENT_ID) || (global.DRIVE_CONFIG && DRIVE_CONFIG.CLIENT_ID) || '';
        var scopes = (global.APP_CONFIG && APP_CONFIG.SCOPES) || (global.DRIVE_CONFIG && DRIVE_CONFIG.SCOPES) || (global.APP_CONFIG && APP_CONFIG.GOOGLE_SCOPES) || '';
        if(!scopes) scopes = 'https://www.googleapis.com/auth/drive.metadata.readonly';
        // scope sanitize
        scopes = scopes.replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();

        if(!(global.google && google.accounts && google.accounts.oauth2)){
          console.warn('GIS ライブラリ未ロード');
          STATE.isGISReady = false;
          return;
        }
        global.__tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: (cid||'').trim(),
          scope: scopes,
          use_fedcm_for_prompt: true,
          callback: function(resp){
            log('token resp', resp);
            try{
              if(resp && resp.access_token && global.gapi && gapi.client){ gapi.client.setToken({access_token: resp.access_token}); }
              AppData.setAuthenticated(true);
              setStatus('サインイン済み');
            }catch(e){}
          },
          error_callback: function(err){
            console.error('[GIS] error:', err);
            try{ alert('[GIS ERROR] ' + JSON.stringify(err)); }catch(e){}
          },
          prompt: 'consent'
        });
        STATE.isGISReady = true;
        log('GIS 初期化完了');
      }catch(e){
        console.error('initializeGIS 例外:', e);
      }
    },
    ensureFolderStructureByName: function(rootName){
      // Minimal implementation: find or create /rootName/{index,contacts,meetings}
      return new Promise(function(resolve, reject){
        if(!(global.gapi && gapi.client && gapi.client.drive)){ 
          // attempt to load drive discovery if not loaded
          try{
            gapi.client.load('drive', 'v3').then(function(){ AppData.ensureFolderStructureByName(rootName).then(resolve).catch(reject); }).catch(function(e){ reject(e); });
          }catch(e){ return reject(new Error('Drive API 未初期化')); }
          return;
        }
        function listFolders(q, pageToken){
          return gapi.client.drive.files.list({
            q: q,
            spaces: 'drive',
            fields: 'files(id,name,mimeType,parents),nextPageToken',
            pageSize: 1000,
            pageToken: pageToken || undefined,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
          });
        }
        function createFolder(name, parentId){
          return gapi.client.drive.files.create({
            resource: { name: name, mimeType: 'application/vnd.google-apps.folder', parents: parentId?[parentId]:undefined },
            fields: 'id,name,parents'
          });
        }

        var rootId = null;
        var sub = { index:null, contacts:null, meetings:null };
        // 1) find or create root
        var qRoot = "mimeType='application/vnd.google-apps.folder' and name='"+ rootName.replace(/'/g,"\\'") +"' and trashed=false";
        listFolders(qRoot).then(function(res){
          var files = (res.result && res.result.files) || [];
          if(files.length>0){ rootId = files[0].id; return null; }
          return createFolder(rootName, null).then(function(r){ rootId = r.result.id; });
        }).then(function(){
          // 2) subfolders
          var need = ['index','contacts','meetings'];
          var qSub = "mimeType='application/vnd.google-apps.folder' and '"+ rootId +"' in parents and trashed=false";
          return listFolders(qSub).then(function(res){
            var files = (res.result && res.result.files) || [];
            files.forEach(function(f){ if(need.indexOf(f.name)>=0) sub[f.name]=f.id; });
            var chain = Promise.resolve();
            need.forEach(function(nm){
              if(!sub[nm]){
                chain = chain.then(function(){ return createFolder(nm, rootId).then(function(r){ sub[nm]=r.result.id; }); });
              }
            });
            return chain;
          });
        }).then(function(){
          resolve({ root: rootId, index: sub.index, contacts: sub.contacts, meetings: sub.meetings });
        }).catch(function(e){
          console.error('ensureFolderStructureByName error', e);
          reject(e);
        });
      });
    }
  };

  // Expose helpers used by main.js
  global.AppData = AppData;
  global.initializeGoogleAPI = function(){ return AppData.initializeGoogleAPI(); };
  global.initializeGIS = function(){ return AppData.initializeGIS(); };
  
function __showPopupHelpOverlay(msg){
  try{
    var id='popupHelpOverlay';
    if(document.getElementById(id)){ return; }
    var el=document.createElement('div');
    el.id=id;
    el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
    el.innerHTML = '<div style="max-width:720px;width:100%;background:#fff;border-radius:12px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.3);font-family:sans-serif;">'
      + '<h2 style="margin:0 0 8px 0;font-size:20px;">Google認証ポップアップが閉じられました</h2>'
      + '<p style="margin:6px 0 12px 0;color:#444;">' + (msg||'ブラウザ設定や拡張の影響でポップアップが閉じられた可能性があります。') + '</p>'
      + '<ol style="margin:0 0 12px 20px;line-height:1.6;color:#333;">'
      + '<li>このサイト <code>https://sw1846.github.io</code> でポップアップを許可</li>'
      + '<li><code>accounts.google.com</code> のサードパーティCookieを一時的に許可</li>'
      + '<li>広告ブロッカー/トラッキング防止（Brave/拡張）をオフにして再試行</li>'
      + '</ol>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">'
      + '  <button id="popupHelpRetry" style="padding:8px 14px;border-radius:8px;border:1px solid #0a66c2;background:#0a66c2;color:#fff;cursor:pointer;">再試行</button>'
      + '  <button id="popupHelpClose" style="padding:8px 14px;border-radius:8px;border:1px solid #999;background:#fff;color:#333;cursor:pointer;">閉じる</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(el);
    document.getElementById('popupHelpClose').onclick=function(){ el.remove(); };
    document.getElementById('popupHelpRetry').onclick=function(){
      el.remove();
      try{ if(window.__tokenClient){ window.__tokenClient.requestAccessToken({ prompt: 'consent' }); } }catch(e){ console.error(e); }
    };
  }catch(e){ console.warn('overlay failed', e); }
}
global.handleAuthClick = function(){
  try{
    if(global.__tokenClient){
      var done=false;
      var timer=setTimeout(function(){ if(!done){ console.warn('[GIS] slow popup response'); } }, 5000);
      global.__tokenClient.requestAccessToken({
        prompt: 'consent',
        callback: function(resp){ done=true; clearTimeout(timer); console.log('[GIS] token resp(cb):', resp); if(resp && resp.access_token){ setStatus('サインイン済み'); } }
      });
    } else {
      console.warn('tokenClient 未初期化');
      __showPopupHelpOverlay('認証モジュールが初期化されていません。ページを再読み込みしてください。');
    }
  }catch(e){
    console.error(e);
    if(e && (e.type==='popup_closed' || /Popup window closed/i.test(e.message||''))){
      __showPopupHelpOverlay('ポップアップが閉じられました。ブラウザ設定をご確認の上、再試行してください。');
    } else {
      __showPopupHelpOverlay('想定外のエラー: ' + (e && e.message ? e.message : e));
    }
  }
};

  // Build marker
  (function(g){ g.__BUILD_ID__='2025-09-25P'; })(global);
})(window);


;(function(w){
  // Ensure overlay exists
  if(typeof w.__showPopupHelpOverlay!=='function'){
    w.__showPopupHelpOverlay = function(msg){
      try{
        var id='popupHelpOverlay'; if(document.getElementById(id)) return;
        var el=document.createElement('div');
        el.id=id;
        el.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
        el.innerHTML = '<div style="max-width:720px;width:100%;background:#fff;border-radius:12px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.3);font-family:sans-serif;">'
        + '<h2 style="margin:0 0 8px 0;font-size:20px;">Google認証ポップアップが閉じられました</h2>'
        + '<p style="margin:6px 0 12px 0;color:#444;">'+(msg||'ブラウザ設定/拡張の影響で閉じられた可能性があります。')+'</p>'
        + '<ol style="margin:0 0 12px 20px;line-height:1.6;color:#333;">'
        + '<li>このサイト <code>'+location.origin+'</code> でポップアップを許可</li>'
        + '<li><code>accounts.google.com</code> のサードパーティCookieを許可</li>'
        + '<li>広告ブロッカー/追跡防止（Brave等）を一時OFF</li>'
        + '</ol>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">'
        + '  <button id="popupHelpRetry" style="padding:8px 14px;border-radius:8px;border:1px solid #0a66c2;background:#0a66c2;color:#fff;cursor:pointer;">再試行</button>'
        + '  <button id="popupHelpRedirect" style="padding:8px 14px;border-radius:8px;border:1px solid #0a66c2;background:#fff;color:#0a66c2;cursor:pointer;">リダイレクト方式でログイン</button>'
        + '  <button id="popupHelpClose" style="padding:8px 14px;border-radius:8px;border:1px solid #999;background:#fff;color:#333;cursor:pointer;">閉じる</button>'
        + '</div></div>';
        document.body.appendChild(el);
        document.getElementById('popupHelpClose').onclick=function(){ el.remove(); };
        document.getElementById('popupHelpRetry').onclick=function(){ el.remove(); try{ if(w.__tokenClient){ w.__tokenClient.requestAccessToken({ prompt: 'consent' }); } }catch(e){ console.error(e); } };
        document.getElementById('popupHelpRedirect').onclick=function(){ el.remove(); try{ if(typeof w.initializeCodeClient==='function'){ w.initializeCodeClient(); } if(typeof w.handleAuthRedirectClick==='function'){ w.handleAuthRedirectClick(); } }catch(e){ console.error(e); } };
      }catch(e){ console.warn('overlay failed', e); }
    };
  }

  // Ensure Code Client (redirect) is available globally
  function ensureCodeClient(){
    try{
      var cid = (w.APP_CONFIG && APP_CONFIG.GOOGLE_CLIENT_ID) || '';
      var scopes = (w.APP_CONFIG && APP_CONFIG.SCOPES) || 'https://www.googleapis.com/auth/drive.metadata.readonly';
      scopes = scopes.replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();
      var redirectUri = (w.APP_CONFIG && APP_CONFIG.REDIRECT_URI) || (location.origin + location.pathname.replace(/\/[^\/]*$/,'/redirect.html'));
      if(!(w.google && google.accounts && google.accounts.oauth2)){
        console.warn('GIS ライブラリ未ロード(code client)'); return null;
      }
      if(!w.__codeClient){
        w.__codeClient = google.accounts.oauth2.initCodeClient({
          client_id: (cid||'').trim(),
          scope: scopes,
          ux_mode: 'redirect',
          redirect_uri: redirectUri,
          state: (Math.random().toString(36).slice(2)),
        });
        console.log('[GIS] code client ready', {redirectUri});
      }
      return w.__codeClient;
    }catch(e){ console.error('ensureCodeClient error', e); return null; }
  }

  w.initializeCodeClient = function(){ return ensureCodeClient(); };
  w.handleAuthRedirectClick = function(){
    var cc = ensureCodeClient();
    if(cc){ try{ cc.requestCode(); }catch(e){ console.error(e); } }
  };

  // Auto-fallback: wrap handleAuthClick to switch to redirect after repeated popup_closed
  try{
    var originalHandle = w.handleAuthClick;
    var failCount = 0;
    w.handleAuthClick = function(){
      try{
        originalHandle && originalHandle();
      }catch(e){
        if(e && (e.type==='popup_closed' || /Popup window closed/i.test(e.message||''))){
          failCount++;
          w.__showPopupHelpOverlay('ポップアップが閉じられました。設定を確認するか、リダイレクト方式をご利用ください。');
          if(failCount >= 2){
            console.warn('[GIS] fallback to redirect after repeated popup_closed');
            var cc = ensureCodeClient(); if(cc){ try{ cc.requestCode(); return; }catch(ex){ console.error(ex); } }
          }
        }else{
          console.error(e);
        }
      }
    };
  }catch(e){ console.warn('wrap handleAuthClick failed', e); }

  // Update build marker
  try{ w.__BUILD_ID__='2025-09-25Q'; console.log('[marker] BUILD', w.__BUILD_ID__); }catch(e){}
})(window);
