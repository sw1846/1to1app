/* =========================================================
 * main.js（初期化＋進捗ログ＋メモリ監視＋フォルダ構成＋データ読込）
 * ========================================================= */
(function(global){
  'use strict';
  if(global.__APP_MAIN_INITED__) return;
  global.__APP_MAIN_INITED__ = true;

  function log(...a){ try{ console.log('[main]', ...a);}catch(e){} }
  function setStatus(t){ const el = document.getElementById('statusText'); if(el) el.textContent = t; }

  function wireAuthButtons(){
    const authBtn = document.getElementById('authorizeBtn');
    const outBtn  = document.getElementById('signoutBtn');
    if(authBtn){
      authBtn.addEventListener('click', async ()=>{
        try{
          await AppData.initializeGoogleAPI();
          await AppData.initializeGIS();
          // Interactive token
          await new Promise((resolve,reject)=>{
            google.accounts.oauth2.initTokenClient({
              client_id: (window.APP_CONFIG && APP_CONFIG.GOOGLE_CLIENT_ID) || (window.DRIVE_CONFIG && DRIVE_CONFIG.CLIENT_ID),
              scope: (window.APP_CONFIG && APP_CONFIG.GOOGLE_SCOPES) || (window.DRIVE_CONFIG && DRIVE_CONFIG.SCOPES),
              callback: ()=> resolve()
            }).requestAccessToken({prompt:'consent'});
          });
          AppData.setAuthenticated(true);
          document.getElementById('authorizeBtn')?.classList.add('hidden');
          document.getElementById('signoutBtn')?.classList.remove('hidden');
          setStatus('サインイン済み');
          await afterSignedIn();
        }catch(e){
          console.error(e);
          setStatus('サインイン失敗');
        }
      });
    }
    if(outBtn){
      outBtn.addEventListener('click', async ()=>{
        try{ google.accounts.oauth2.revoke(gapi.client.getToken()?.access_token || '', ()=>{}); }catch(e){}
        AppData.setAuthenticated(false);
        document.getElementById('authorizeBtn')?.classList.remove('hidden');
        document.getElementById('signoutBtn')?.classList.add('hidden');
        setStatus('サインアウトしました');
      });
    }
  }

  async function afterSignedIn(){
    try{
      setStatus('フォルダ構成を確認中...');
      const rootName = (window.DRIVE_CONFIG && DRIVE_CONFIG.ROOT_FOLDER_NAME) || '1to1meeting';
      const struct = await AppData.ensureFolderStructureByName(rootName);

      // 既存のグローバル folderStructure にも流し込む
      if (typeof window.folderStructure !== 'undefined'){
        window.folderStructure.root = struct.root;
        window.folderStructure.index = struct.index;
        window.folderStructure.contacts = struct.contacts;
        window.folderStructure.meetings = struct.meetings;
        window.folderStructure.attachments = struct.attachments;
        window.folderStructure.attachmentsContacts = struct.attachmentsContacts;
        window.folderStructure.attachmentsMeetings = struct.attachmentsMeetings;
      }
      await AppData.selectExistingFolder(struct);

      setStatus('データを読み込み中...');
      const result = await AppData.loadAllData();
      if(result){
        // グローバル配列に反映（既存UI互換）
        if(Array.isArray(result.contacts)) window.contacts = result.contacts;
        if(Array.isArray(result.meetings)) window.meetings = result.meetings;
        if(result.options && typeof result.options === 'object') window.options = Object.assign(window.options||{}, result.options);
      }
      // UI初期描画
      if (typeof renderContacts === 'function') renderContacts();
      setStatus('準備完了');
      log('初期化完了');
    }catch(e){
      console.error(e);
      setStatus('初期化エラー: ' + (e?.message||e));
    }
  }

  async function boot(){
    log('DOM読み込み完了 - 初期化開始...');
    wireAuthButtons();
    AppData.setProgressHandler((msg)=> log('[progress]', msg));

    // 事前初期化（自動ロード）
    if(global.gapi) await AppData.initializeGoogleAPI();
    if(global.google && global.google.accounts) AppData.initializeGIS();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
