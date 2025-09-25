/* ===== 1to1app main.js (U4) ===== */
(function(){
  'use strict';
  function log(){ console.log.apply(console, ['[main]'].concat([].slice.call(arguments))); }
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function setStatus(t){ var el=qs('#statusText'); if(el) el.textContent=t; }

  function hideSignin(){
    qsa('#googleSignInBtn, [data-role="google-signin"], button[onclick*="handleAuthClick"]').forEach(function(b){
      b.style.display='none';
    });
  }

  function ensureAppData(){
    if(typeof window.AppData !== 'object'){
      log('AppData 未定義: data.js の読み込みや構文を確認してください');
      throw new Error('AppData missing');
    }
    if(typeof AppData.setProgressHandler === 'function'){
      AppData.setProgressHandler(function(tag){ log('[progress]', tag); });
    }
  }

  function listMyDriveSample(){
    if(!(window.gapi && gapi.client)){ return Promise.resolve(); }
    return gapi.client.drive.files.list({
      pageSize: 5,
      fields: 'files(id,name,modifiedTime)',
      orderBy: 'modifiedTime desc',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    }).then(function(resp){
      var files = (resp.result && resp.result.files) || [];
      log('Drive sample files:', files);
    }).catch(function(e){
      console.error(e);
    });
  }

  function afterSignedIn(tokenResp){
    hideSignin();
    setStatus('サインイン済み');
    // 必要な初期化を順次呼ぶ（存在する場合のみ）
    if(window.AppData && typeof AppData.ensureFolderStructureByName === 'function'){
      AppData.ensureFolderStructureByName(['PlaceOn','1to1']).catch(function(e){ console.warn('ensureFolderStructureByName:', e.message||e); });
    }
    listMyDriveSample();
  }

  document.addEventListener('gis:token', function(ev){
    log('token captured');
    afterSignedIn(ev.detail);
  });
  document.addEventListener('gis:error', function(ev){
    console.error(ev.detail);
  });

  document.addEventListener('DOMContentLoaded', function boot(){
    log('DOM読み込み完了 - 初期化開始...');
    try{
      ensureAppData();
    }catch(e){ console.error(e); return; }
    // gapi の discovery をロード（重複は AppData 側で保護）
    if(typeof window.initializeGoogleAPI === 'function'){
      window.initializeGoogleAPI();
    }
    // 旧UIから残る「ログイン」ボタンがあれば、クリック時は data.js の handleAuthClick が呼ばれます。
    // ここでは追加の onClick は付与しません（重複防止）。
  });
})();