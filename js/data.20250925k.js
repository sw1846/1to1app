/* =========================================================
 * 1to1 Meeting Manager - Drive Distributed Storage (Fixed)
 * Build: 2025-09-25
 * 修正ポイント：
 *  - meetings フォルダの再帰走査で全サブフォルダを対象化 → meetings-index.json を確実に生成
 *  - インデックス再構築のメモリ使用量を削減（逐次・並列数制限・最小データ保持）
 *  - 例外時も contacts / meetings をそれぞれ独立保存（片方失敗でももう片方は保存）
 *  - 初期化の二重実行防止
 *  - 進捗通知フック（onProgress）を追加
 *  - Drive API呼び出しの指数バックオフ
 * ========================================================= */
(function(global){
  'use strict';
  // ===== Google OAuth (GIS) Token Client =====
  let __tokenClient = null;
  function __initTokenClient(){
    try{
      const cfg = (global.APP_CONFIG || {});
      const clientId = cfg.GOOGLE_CLIENT_ID || (global.GOOGLE_CLIENT_ID) || '';
      const scopes = cfg.GOOGLE_SCOPES || (global.GOOGLE_SCOPES) || 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata';
      if(!clientId){
        console.warn('GOOGLE_CLIENT_ID が設定されていません。config.js の APP_CONFIG.GOOGLE_CLIENT_ID を設定してください。');
        return null;
      }
      if(!(global.google && google.accounts && google.accounts.oauth2)){
        console.warn('Google Identity Services がまだロードされていません。');
        return null;
      }
      __tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes,
        callback: (tokenResponse)=>{
          if(global.gapi && gapi.client && tokenResponse && tokenResponse.access_token){
            gapi.client.setToken({access_token: tokenResponse.access_token});
            setAuthenticated(true);
            try{
              const authBtn = document.getElementById('authorizeBtn');
              const outBtn = document.getElementById('signoutBtn');
              if(authBtn) authBtn.style.display = 'none';
              if(outBtn) outBtn.style.display = '';
            }catch(e){}
            console.log('GIS: アクセストークン取得完了');
          } else {
            console.warn('GIS: アクセストークンを設定できませんでした。');
          }
        }
      });
      return __tokenClient;
    }catch(e){
      console.error('GISトークンクライアント初期化エラー:', e);
      return null;
    }
  }


  // ========================= 共通ユーティリティ =========================
  const SLEEP = (ms)=> new Promise(r=> setTimeout(r, ms));
  const idleYield = async () => { await Promise.resolve(); };
  const nowIso = () => new Date().toISOString();

  const log = (...args)=> console.log(...args);
  const warn = (...args)=> console.warn(...args);
  const error = (...args)=> console.error(...args);

  const MIME_FOLDER = 'application/vnd.google-apps.folder';

  // 指数バックオフ付API呼び出し
  async function withBackoff(fn, {retries=5, base=300}={}){
    let attempt = 0;
    for(;;){
      try { return await fn(); }
      catch(e){
        if(attempt >= retries) throw e;
        const wait = Math.floor(base * Math.pow(2, attempt) + Math.random()*100);
        warn(`[backoff] attempt=${attempt+1}/${retries} wait=${wait}ms`, e);
        await SLEEP(wait);
        attempt++;
      }
    }
  }

  // 並列数制限 map
  async function mapLimit(items, limit, iter){
    const ret = new Array(items.length);
    let i = 0, running = 0;
    return await new Promise((resolve, reject)=>{
      const next = ()=>{
        if(i >= items.length && running === 0){ resolve(ret); return; }
        while(running < limit && i < items.length){
          const cur = i++;
          running++;
          Promise.resolve(iter(items[cur], cur))
            .then(v=>{ ret[cur] = v; running--; next(); })
            .catch(reject);
        }
      };
      next();
    });
  }

  // ========================= アプリ状態 =========================
  const STATE = {
    version: '2.0',
    isInitialized: false,
    isAuthenticated: false,
    folders: { root:null, index:null, contacts:null, meetings:null, attachments:null },
    // 進捗通知フック（必要に応じて main.js が差し替え可）
    onProgress: (phase, payload)=>{},
  };

  // 外部から差し替え可能なフック
  function setProgressHandler(fn){ STATE.onProgress = typeof fn === 'function' ? fn : STATE.onProgress; }

  // ========================= Drive API 準備 =========================
  async function ensureDriveLoaded(){
    if(global.gapi && gapi.client && gapi.client.drive && gapi.client.drive.files) return;
    log('Drive API Discovery Document読み込み中...');
    await new Promise((resolve, reject)=>{
      try {
        gapi.client.load('drive', 'v3', ()=>{
          log('Drive API準備完了');
          resolve();
        });
      } catch(e){
        reject(e);
      }
    });
  }

  // ========================= Drive API ラッパ =========================
  async function driveListChildren(folderId, {pageToken=null}={}){
    await ensureDriveLoaded();
    return await withBackoff(async ()=>{
      const res = await gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id,name,mimeType,size,modifiedTime,parents)',
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken: pageToken || undefined,
      });
      return res.result;
    });
  }

  async function driveGetFile(fileId, {altMedia=false}={}){
    await ensureDriveLoaded();
    return await withBackoff(async ()=>{
      if(altMedia){
        const res = await gapi.client.drive.files.get({ fileId, alt: 'media' });
        return res.result; // JSONとして返る想定
      } else {
        const res = await gapi.client.drive.files.get({ fileId, fields: 'id,name,mimeType,size,modifiedTime,parents' });
        return res.result;
      }
    });
  }

  async function driveCreateFile({name, parents, mimeType='application/json', bodyObj}){
    await ensureDriveLoaded();
    return await withBackoff(async ()=>{
      const metadata = { name, parents, mimeType };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
      form.append('file', new Blob([JSON.stringify(bodyObj)], {type: mimeType}));
      const token = gapi.client.getToken();
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token.access_token}` },
        body: form
      });
      if(!res.ok) throw new Error(`driveCreateFile failed: ${res.status}`);
      return await res.json();
    });
  }

  async function driveUpdateById(fileId, {mimeType='application/json', bodyObj}){
    await ensureDriveLoaded();
    return await withBackoff(async ()=>{
      const token = gapi.client.getToken();
      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token.access_token}`, 'Content-Type': mimeType },
        body: JSON.stringify(bodyObj)
      });
      if(!res.ok) throw new Error(`driveUpdateById failed: ${res.status}`);
      return await res.json();
    });
  }

  async function driveFindFileByNameInParent(name, parentId){
    await ensureDriveLoaded();
    return await withBackoff(async ()=>{
      const res = await gapi.client.drive.files.list({
        q: `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`,
        fields: 'files(id,name,parents)',
        pageSize: 1
      });
      return res.result.files && res.result.files[0] || null;
    });
  }

  async function createOrUpdateJsonInParent(name, parentId, bodyObj){
    const existing = await driveFindFileByNameInParent(name, parentId);
    if(existing){
      await driveUpdateById(existing.id, { bodyObj });
      log('ファイル更新成功:', name);
      return existing.id;
    } else {
      const created = await driveCreateFile({ name, parents:[parentId], bodyObj });
      log('ファイル作成成功:', name);
      return created.id;
    }
  }

  // ========================= フォルダ作成/取得ユーティリティ =========================
// MIME_FOLDER is defined earlier; using existing constant.

async function driveCreateFolder(name, parentId=null){
  await ensureDriveLoaded();
  return await withBackoff(async ()=>{
    const res = await gapi.client.drive.files.create({
      resource: Object.assign({ name, mimeType: MIME_FOLDER }, parentId ? { parents: [parentId] } : {}),
      fields: 'id,name,parents'
    });
    return res.result;
  });
}

async function driveFindFolderByNameUnder(parentId, name){
  await ensureDriveLoaded();
  return await withBackoff(async ()=>{
    const res = await gapi.client.drive.files.list({
      q: `name='${name.replace(/'/g, "\'")}' and '${parentId}' in parents and mimeType='${MIME_FOLDER}' and trashed=false`,
      fields: 'files(id,name,parents)',
      pageSize: 1
    });
    return (res.result.files && res.result.files[0]) || null;
  });
}

async function driveFindOrCreateFolderUnder(parentId, name){
  const exist = await driveFindFolderByNameUnder(parentId, name);
  if (exist) return exist.id;
  const created = await driveCreateFolder(name, parentId);
  return created.id;
}

async function driveFindRootByName(name){
  await ensureDriveLoaded();
  return await withBackoff(async ()=>{
    const res = await gapi.client.drive.files.list({
      q: `name='${name.replace(/'/g, "\'")}' and mimeType='${MIME_FOLDER}' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 1
    });
    return (res.result.files && res.result.files[0]) || null;
  });
}

async function driveFindOrCreateRootByName(name){
  const exist = await driveFindRootByName(name);
  if (exist) return exist.id;
  const created = await driveCreateFolder(name, null);
  return created.id;
}

/**
 * 既定のフォルダ構成を保証してIDを返す
 *  - ROOT
 *    - index
 *    - contacts
 *    - meetings
 *    - attachments
 *      - contacts
 *      - meetings
 */
async function ensureFolderStructureByName(rootName){
  await ensureDriveLoaded();
  const rootId = await driveFindOrCreateRootByName(rootName);
  const indexId = await driveFindOrCreateFolderUnder(rootId, 'index');
  const contactsId = await driveFindOrCreateFolderUnder(rootId, 'contacts');
  const meetingsId = await driveFindOrCreateFolderUnder(rootId, 'meetings');
  const attachmentsId = await driveFindOrCreateFolderUnder(rootId, 'attachments');
  const attachmentsContacts = await driveFindOrCreateFolderUnder(attachmentsId, 'contacts');
  const attachmentsMeetings = await driveFindOrCreateFolderUnder(attachmentsId, 'meetings');
  return { root: rootId, index: indexId, contacts: contactsId, meetings: meetingsId, attachments: attachmentsId, attachmentsContacts, attachmentsMeetings };
}

// ========================= 再帰走査（meetings対応の要） =========================
  async function listJsonFilesRecursively(rootFolderId){
    const out = [];
    const stack = [rootFolderId];
    while(stack.length){
      const fid = stack.pop();
      let token = null;
      do {
        const page = await driveListChildren(fid, {pageToken: token});
        for(const it of (page.files || [])){
          if(it.mimeType === MIME_FOLDER){
            stack.push(it.id);
          } else {
            if(it.mimeType === 'application/json' || (it.name && it.name.toLowerCase().endsWith('.json'))){
              out.push(it);
            }
          }
        }
        token = page.nextPageToken || null;
        await idleYield();
      } while(token);
    }
    return out;
  }

  // ========================= 連絡先/ミーティングのIndex構築 =========================
  function toContactIndexEntry(fileMeta, obj){
    const name = obj.name || obj.fullName || obj.displayName || '';
    const kana = obj.kana || obj.furigana || obj.katakana || '';
    const id = obj.id || obj.contactId || fileMeta.id;
    return {
      id, name, kana,
      fileId: fileMeta.id,
      fileName: fileMeta.name,
      modifiedTime: fileMeta.modifiedTime,
      size: Number(fileMeta.size||0)
    };
  }

  function toMeetingIndexEntry(fileMeta, obj){
    const id = obj.id || obj.meetingId || fileMeta.id;
    const contactId = obj.contactId || obj.contact_id || obj.relatedContactId || null;
    const title = obj.title || obj.subject || obj.topic || '';
    const date = obj.date || obj.meetingDate || obj.startAt || obj.start || null;
    return {
      id, contactId, title, date,
      fileId: fileMeta.id,
      fileName: fileMeta.name,
      modifiedTime: fileMeta.modifiedTime,
      size: Number(fileMeta.size||0)
    };
  }

  async function buildContactsIndex(contactsFolderId, {concurrency=6}={}){
    STATE.onProgress('contacts:list', {});
    // 連絡先は直下想定（階層運用の場合は再帰に切り替え可）
    const metas = [];
    let token = null;
    do {
      const page = await driveListChildren(contactsFolderId, {pageToken: token});
      for(const it of (page.files||[])){
        if(it.mimeType !== MIME_FOLDER && (it.mimeType === 'application/json' || (it.name||'').toLowerCase().endsWith('.json'))){
          metas.push(it);
        }
      }
      token = page.nextPageToken || null;
      await idleYield();
    } while(token);

    const total = metas.length;
    STATE.onProgress('contacts:download:start', {total});

    const index = [];
    let done = 0;

    await mapLimit(metas, concurrency, async (meta)=>{
      const obj = await driveGetFile(meta.id, {altMedia:true});
      index.push(toContactIndexEntry(meta, obj));
      done++;
      if(done % 10 === 0) STATE.onProgress('contacts:download:progress', {done, total});
      if(done % 25 === 0) await idleYield();
    });

    index.sort((a,b)=> (a.kana||'').localeCompare(b.kana||'', 'ja') || (a.name||'').localeCompare(b.name||'', 'ja'));
    STATE.onProgress('contacts:download:done', {total});
    return index;
  }

  async function buildMeetingsIndex(meetingsFolderId, {concurrency=6}={}){
    STATE.onProgress('meetings:list', {});
    const metas = await listJsonFilesRecursively(meetingsFolderId);
    const total = metas.length;
    STATE.onProgress('meetings:download:start', {total});

    const index = [];
    let done = 0;

    await mapLimit(metas, concurrency, async (meta)=>{
      const obj = await driveGetFile(meta.id, {altMedia:true});
      index.push(toMeetingIndexEntry(meta, obj));
      done++;
      if(done % 10 === 0) STATE.onProgress('meetings:download:progress', {done, total});
      if(done % 25 === 0) await idleYield();
    });

    index.sort((a,b)=> String(b.date||'').localeCompare(String(a.date||'')) || (b.modifiedTime||'').localeCompare(a.modifiedTime||''));
    STATE.onProgress('meetings:download:done', {total});
    return index;
  }

  async function rebuildIndexes(){
    if(!STATE.folders.index || !STATE.folders.contacts || !STATE.folders.meetings){
      throw new Error('フォルダ情報が未設定です（index/contacts/meetings）');
    }

    log('インデックス再構築開始...');
    STATE.onProgress('rebuild:start', {});

    let contactsIndex = [];
    let meetingsIndex = [];

    try {
      contactsIndex = await buildContactsIndex(STATE.folders.contacts);
      await createOrUpdateJsonInParent('contacts-index.json', STATE.folders.index, {
        version: STATE.version,
        lastUpdated: nowIso(),
        count: contactsIndex.length,
        items: contactsIndex,
      });
      log('contacts-index.json を保存しました');
    } catch(e){
      error('連絡先インデックスの再構築に失敗:', e);
      STATE.onProgress('contacts:error', {message: String(e && e.message || e)});
    }

    await idleYield();

    try {
      meetingsIndex = await buildMeetingsIndex(STATE.folders.meetings);
      await createOrUpdateJsonInParent('meetings-index.json', STATE.folders.index, {
        version: STATE.version,
        lastUpdated: nowIso(),
        count: meetingsIndex.length,
        items: meetingsIndex,
      });
      log('meetings-index.json を保存しました');
    } catch(e){
      error('ミーティングインデックスの再構築に失敗:', e);
      STATE.onProgress('meetings:error', {message: String(e && e.message || e)});
    }

    STATE.onProgress('rebuild:done', { contacts: contactsIndex.length, meetings: meetingsIndex.length });
    log('インデックス再構築完了:', { contacts: contactsIndex.length, meetings: meetingsIndex.length });

    return { contactsIndex, meetingsIndex };
  }

  // ========================= 初期化/フォルダ設定/データ読込 =========================
  async function initializeGoogleAPI(){
    if(STATE.isInitialized){ return; }
    log('Google API初期化開始（APIキーなし）...');
    try{
      if(global.gapi && gapi.load){
        let settled = false;
        await new Promise((resolve) => {
          const timer = setTimeout(() => {
            if (!settled) {
              console.warn('gapi.load(client) タイムアウト');
              settled = true;
              resolve();
            }
          }, 10000);
          try {
            gapi.load('client', {
              callback: () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve();
              },
              onerror: () => {
                if (settled) return;
                console.warn('gapi.load(client) でエラー');
                settled = true;
                clearTimeout(timer);
                resolve();
              }
            });
          } catch(e) {
            console.warn('gapi.load(client) 呼び出し例外:', e);
            clearTimeout(timer);
            resolve();
          }
        });
        STATE.isInitialized = true;
        log('Google API初期化完了（認証待機中）');
      } else {
        console.warn('gapi がまだロードされていませんが続行します。');
        STATE.isInitialized = true;
      }
    }catch(e){
      console.warn('gapi 初期化時に例外:', e);
      STATE.isInitialized = true;
    }
  }

    log('Google API初期化開始（APIキーなし）...');
    // gapi のロードは HTML 側（script タグ）で実施済みを想定
    STATE.isInitialized = true;
    log('Google API初期化完了（認証待機中）');
  }

  function initializeGIS(){
    log('Google Identity Services初期化開始...');
    __initTokenClient();
    log('Google Identity Services初期化完了');
  }


  function setAuthenticated(v){ STATE.isAuthenticated = !!v; }

  function setFolders({root, index, contacts, meetings, attachments}){
    STATE.folders = { root, index, contacts, meetings, attachments };
    log('フォルダ構造初期化完了:', {...STATE.folders});
  }

  async function selectExistingFolder(struct){
    setFolders(struct);
    return struct;
  }

  async function loadAllData(){
    log('データ読み込み開始...');

    // メタデータ読み込み（存在しない場合はスキップ）
    let metadata = null;
    try {
      const metaFile = await driveFindFileByNameInParent('metadata.json', STATE.folders.index);
      if(metaFile){
        metadata = await driveGetFile(metaFile.id, {altMedia:true});
        log('メタデータを読み込みました:', metadata);
      }
    } catch(e){ warn('メタデータ読み込みに失敗（続行）:', e); }

    // 既存 index の有無で再構築判定
    const contactsIdxFile = await driveFindFileByNameInParent('contacts-index.json', STATE.folders.index);
    const meetingsIdxFile = await driveFindFileByNameInParent('meetings-index.json', STATE.folders.index);

    const needContacts = !contactsIdxFile;
    const needMeetings = !meetingsIdxFile;

    if(needContacts || needMeetings){
      log('インデックスが空です。Driveから再構築します...');
      await rebuildIndexes();
    } else {
      log('既存インデックスを利用します');
    }

    return { metadata };
  }

  // ========================= 外部公開API =========================
  
async function getAccessTokenForFetch(){
  await ensureDriveLoaded();
  const t = gapi.client.getToken();
  if(!t || !t.access_token){
    await new Promise((resolve,reject)=>{
      if(!__tokenClient){ __initTokenClient(); }
      __tokenClient.callback = (resp)=> resp && resp.access_token ? resolve() : reject(resp);
      __tokenClient.requestAccessToken({prompt:'consent'});
    });
  }
  return gapi.client.getToken() && gapi.client.getToken().access_token;
}

  const AppData = {
    STATE,
    setProgressHandler,
    initializeGoogleAPI,
    initializeGIS,
    setAuthenticated,
    selectExistingFolder,
    loadAllData,
    rebuildIndexes,
  
    ensureFolderStructureByName,

    getAccessTokenForFetch,
};

  
// ======= グローバル関数（HTML の onload / onclick 互換のため） =======
try{
  global.initializeGoogleAPI = ()=> AppData.initializeGoogleAPI();
  global.initializeGIS = ()=> AppData.initializeGIS();
  global.handleAuthClick = ()=>{
    if(!__tokenClient){ __initTokenClient(); }
    if(__tokenClient){
      try{
        __tokenClient.requestAccessToken({prompt: 'consent'});
      }catch(e){
        console.error('アクセストークン要求エラー:', e);
      }
    } else {
      console.warn('GIS トークンクライアントが未初期化です。');
    }
  };
  global.handleSignoutClick = ()=>{
    try{
      const t = (global.gapi && gapi.client) ? gapi.client.getToken() : null;
      if(t && t.access_token && global.google && google.accounts && google.accounts.oauth2){
        google.accounts.oauth2.revoke(t.access_token, ()=>{
          console.log('トークンを取り消しました');
        });
      }
      if(global.gapi && gapi.client){ gapi.client.setToken(null); }
    }catch(e){
      console.warn('サインアウト処理でエラー:', e);
    }
    setAuthenticated(false);
    try{
      const authBtn = document.getElementById('authorizeBtn');
      const outBtn = document.getElementById('signoutBtn');
      if(authBtn) authBtn.style.display = '';
      if(outBtn) outBtn.style.display = 'none';
    }catch(e){}
  };
}catch(e){
  console.warn('グローバル関数のエクスポートに失敗:', e);
}


global.AppData = AppData;

})(window);

// Build marker
;(function(g){ g.__BUILD_ID__='2025-09-25J'; })(window);

;(function(g){ g.__BUILD_ID__='2025-09-25K'; })(window);
