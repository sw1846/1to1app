/* ===== 1to1app U build required JS (2025-09-25U5 FIXED) =====
   - FedCM 有効 / gapi・GIS 自動ローダー
   - 二重初期化/同時要求ガード
   - Drive helpers（ensureFolderStructureByName 等）
   - ★ 成否イベント発火：document へ 'gis:token' / 'gis:error'
   - 🔧 修正: upsertJsonInFolder 実装、画像URL解決、オプション初期化修正
*/
(function(global){
  'use strict';
  var STATE = {
    gapiReady: false,
    gisReady: false,
    tokenInFlight: false,
    tokenClient: null,
    progress: function(){},
    gisScriptRequested: false,
    gapiScriptRequested: false
  };

  function log(){ try{ console.log.apply(console, ['[data]'].concat([].slice.call(arguments))); }catch(e){} }
  function setStatus(t){ try{ var el=document.getElementById('statusText'); if(el) el.textContent = t; }catch(e){} }
  function sanitizeScopes(s){
    s = (s || '').replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();
    return s || 'https://www.googleapis.com/auth/drive.metadata.readonly';
  }
  function hasScope(needle){
    try{
      var scopes = (__root.APP_CONFIG && APP_CONFIG.SCOPES) || '';
      scopes = sanitizeScopes(scopes);
      return scopes.split(' ').indexOf(needle) >= 0;
    }catch(e){ return false; }
  }
  function btns(){ return Array.prototype.slice.call(document.querySelectorAll('#googleSignInBtn, [data-role="google-signin"], button[onclick*="handleAuthClick"]')); }
  function setBtnsDisabled(v){ try{ btns().forEach(function(b){ b.disabled=!!v; b.dataset.busy=v?'1':''; }); }catch(e){} }

  function ensureGisScript(){
    try{
      if(__root.google && __root.google.accounts && __root.google.accounts.oauth2) return true;
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
  function ensureGapiScript(){
    try{
      if(__root.gapi && typeof gapi.load === 'function') return true;
      if(STATE.gapiScriptRequested) return false;
      var exists = false;
      var scripts = document.getElementsByTagName('script');
      for(var i=0;i<scripts.length;i++){
        var src = scripts[i].getAttribute('src') || '';
        if(src.indexOf('https://apis.google.com/js/api.js') === 0){ exists = true; break; }
      }
      if(!exists){
        var s = document.createElement('script');
        s.src = 'https://apis.google.com/js/api.js';
        s.async = true;
        s.defer = true;
        s.onload = function(){ log('gapi スクリプト読込完了'); };
        document.head.appendChild(s);
      }
      STATE.gapiScriptRequested = true;
      return false;
    }catch(e){ return false; }
  }

  function ensureGapiClient(){
    return new Promise(function(resolve){
      STATE.progress('gapi:init:start');
      if (STATE.gapiReady){ STATE.progress('gapi:init:cached'); return resolve(); }
      if (!(__root.gapi && gapi.load)){
        ensureGapiScript();
        var tries=0, max=30;
        (function waitGapi(){
          if(__root.gapi && gapi.load){ return ensureGapiClient().then(resolve); }
          if(++tries>=max){ STATE.progress('gapi:init:skip'); return resolve(); }
          setTimeout(waitGapi, 100);
        })();
        return;
      }
      try{
        gapi.load('client', {
          callback: function(){
            try{
              gapi.client.init({ discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] })
              .then(function(){
                STATE.gapiReady = true;
                STATE.progress('gapi:init:ok');
                log('Google API初期化完了');
                resolve();
              })
              .catch(function(){ STATE.gapiReady = true; STATE.progress('gapi:init:ok'); resolve(); });
            }catch(e){ STATE.gapiReady = true; STATE.progress('gapi:init:ok'); resolve(); }
          },
          onerror: function(){ STATE.gapiReady = true; STATE.progress('gapi:init:err'); resolve(); }
        });
      }catch(e){ STATE.gapiReady = true; STATE.progress('gapi:init:err'); resolve(); }
    });
  }

  function __initTokenClientInternal(){
    if(STATE.tokenClient){ return true; }
    if(!(__root.google && google.accounts && google.accounts.oauth2)){ return false; }

    var cid = (__root.APP_CONFIG && APP_CONFIG.GOOGLE_CLIENT_ID) ||
              (__root.DRIVE_CONFIG && DRIVE_CONFIG.CLIENT_ID) || '';
    var scopes = (__root.APP_CONFIG && APP_CONFIG.SCOPES) ||
                 (__root.DRIVE_CONFIG && DRIVE_CONFIG.SCOPES) || '';

    scopes = sanitizeScopes(scopes);
    if (!cid){ console.error('GOOGLE_CLIENT_ID 未設定'); return false; }

    STATE.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: cid.trim(),
      scope: scopes,
      use_fedcm_for_prompt: true,
      callback: function(resp){
        STATE.tokenInFlight = false;
        log('token resp', resp);
        try{
          if (resp && resp.access_token && __root.gapi && gapi.client){
            gapi.client.setToken({ access_token: resp.access_token });
          }
          setStatus('サインイン済み');
          document.dispatchEvent(new CustomEvent('gis:token', {detail: resp}));
        }catch(e){}
        setBtnsDisabled(false);
      },
      error_callback: function(err){
        STATE.tokenInFlight = false;
        console.error('[GIS] error:', err);
        document.dispatchEvent(new CustomEvent('gis:error', {detail: err}));
        alert('[GIS ERROR] ' + (err && (err.error || err.type || err.message) || 'unknown'));
        setBtnsDisabled(false);
      },
      prompt: 'consent'
    });
    STATE.gisReady = true;
    log('GIS 初期化完了');
    return true;
  }
  function __initTokenClientWithRetry(cb){
    if(__initTokenClientInternal()){ cb && cb(true); return; }
    ensureGisScript();
    var tries = 0, max = 30;
    (function tick(){
      if(__initTokenClientInternal()){ cb && cb(true); return; }
      if(++tries >= max){ console.warn('GIS ライブラリ未ロード（timeout）'); cb && cb(false); return; }
      setTimeout(tick, 100);
    })();
  }

  function _ensureReady(){
    if(!(__root.gapi && gapi.client && STATE.gapiReady)){
      throw new Error('gapi client not ready');
    }
  }
  function _queryFolders(name, parentId){
    var q = "mimeType='application/vnd.google-apps.folder' and trashed=false and name='" + name.replace(/'/g,"\\'") + "'";
    if(parentId){ q += " and '" + parentId + "' in parents"; }
    return gapi.client.drive.files.list({
      q: q,
      fields: 'files(id,name,parents)',
      pageSize: 10,
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    }).then(function(r){ return r.result.files || []; });
  }
  function _createFolder(name, parentId){
    var body = { name: name, mimeType: 'application/vnd.google-apps.folder' };
    if(parentId){ body.parents = [parentId]; }
    return gapi.client.drive.files.create({
      resource: body,
      fields: 'id,name,parents',
      supportsAllDrives: true
    }).then(function(r){ return r.result; });
  }
  function getOrCreateFolderId(name, parentId){
    _ensureReady();
    if(!hasScope('https://www.googleapis.com/auth/drive.file')){
      console.warn('drive.file スコープがありません（作成は不可・検索のみ実施）');
    }
    return _queryFolders(name, parentId).then(function(list){
      if(list.length>0){ return list[0].id; }
      if(!hasScope('https://www.googleapis.com/auth/drive.file')){
        var e = new Error('insufficient_scope: drive.file required to create "' + name + '"');
        e.code = 'insufficient_scope';
        throw e;
      }
      return _createFolder(name, parentId).then(function(obj){ return obj.id; });
    });
  }
  function ensureFolderStructureByName(path, options){
    _ensureReady();
    options = options || {};
    var parts = Array.isArray(path) ? path.slice() : String(path||'').split('/').filter(Boolean);
    if(parts.length===0){ return Promise.reject(new Error('path is empty')); }
    var currentParent = options.rootId || 'root';
    var ids = [];
    function step(){
      if(parts.length===0){ return Promise.resolve({id: currentParent, pathIds: ids}); }
      var name = parts.shift();
      return getOrCreateFolderId(name, currentParent).then(function(id){
        ids.push(id);
        currentParent = id;
        return step();
      });
    }
    return step();
  }

  
  // ======== Drive JSON helpers (migrated data loader) ========
  async function driveListChildren(parentId, opts){
    _ensureReady();
    opts = opts || {};
    var q = ["'" + parentId + "' in parents", "trashed=false"];
    if(opts.nameContains){ q.push("name contains '" + opts.nameContains.replace(/'/g,"\\'") + "'"); }
    if(opts.mimeType){ q.push("mimeType='" + opts.mimeType + "'"); }
    var params = {
      q: q.join(' and '),
      fields: 'files(id,name,mimeType,modifiedTime,parents)',
      pageSize: opts.pageSize || 1000,
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    };
    var resp = await gapi.client.drive.files.list(params);
    return (resp.result && resp.result.files) || [];
  }

  
async function driveFindChildByName(parentId, name, mimeType){
  const files = await driveListChildren(parentId, { });
  const lower = String(name||'').toLowerCase().trim();
  function accepts(f){
    if (!mimeType) return true;
    if (mimeType === 'application/json'){
      // sometimes JSONs are uploaded as text/plain or application/octet-stream
      return (f.mimeType === 'application/json' || f.mimeType === 'text/plain' || f.mimeType === 'application/octet-stream');
    }
    // Folders or other types -> strict match
    return f.mimeType === mimeType;
  }
  let exact = files.filter(f => accepts(f) && String(f.name||'').toLowerCase().trim() === lower);
  if (exact.length){
    exact.sort((a,b)=> new Date(b.modifiedTime||0) - new Date(a.modifiedTime||0));
    return exact[0].id;
  }
  let partial = files.filter(f => accepts(f) && String(f.name||'').toLowerCase().includes(lower));
  if (partial.length){
    partial.sort((a,b)=> new Date(b.modifiedTime||0) - new Date(a.modifiedTime||0));
    return partial[0].id;
  }
  return null;
}

// ======== Missing functions implementation ========

/* [fix][attachments-upload] contacts用アップロード関数（avatar/名刺/添付に対応） */
async function saveAttachmentToFileSystem(fileName, dataUrl, contactNameOrId){
  _ensureReady();
  try{
    if(!global.folderStructure || !global.folderStructure.attachmentsContacts){
      throw new Error('attachmentsContacts folder is not resolved');
    }
    const attachmentsRoot = global.folderStructure.attachmentsContacts;
    
    // contactId を優先的に決定
    let contactId = null;
    try{
      if (typeof global.currentContactId !== 'undefined' && global.currentContactId) {
        contactId = String(global.currentContactId);
      }
    }catch(_e){}
    if(!contactId){
      // 引数からID推定（数値 or 既存のcontactsから名前一致）
      const s = String(contactNameOrId||'').trim();
      if(/^\d+$/.test(s)){ contactId = s; }
      else if (Array.isArray(global.contacts)){
        const hit = global.contacts.find(c => (c && (c.id===s || c.name===s)));
        if(hit && hit.id){ contactId = String(hit.id); }
      }
    }
    // フォルダ名決定（IDがなければ名前スラグ）
    function slugify(x){ return String(x||'').toLowerCase().replace(/[^\w\-ぁ-んァ-ン一-龥]/g,'-').replace(/-+/g,'-').replace(/^-|-$|/g,''); }
    const folderName = contactId ? ('contact-' + String(contactId).padStart(6,'0'))
                                 : ('contact-' + slugify(contactNameOrId||'unknown'));
    
    // 連絡先用サブフォルダを作成/取得
    let contactFolderId = await driveFindChildByName(attachmentsRoot, folderName, 'application/vnd.google-apps.folder');
    if(!contactFolderId){
      contactFolderId = await getOrCreateFolderId(folderName, attachmentsRoot);
    }
    
    // dataURL -> Blob 化
    function dataUrlToBytes(url){
      const m = String(url||'').match(/^data:([^;,]+)?;(base64)?,(.*)$/);
      if(!m){ throw new Error('Invalid data URL'); }
      const mime = m[1] || 'application/octet-stream';
      const isB64 = m[2] === 'base64';
      const data = m[3] || '';
      const bin = isB64 ? atob(data) : decodeURIComponent(data);
      const len = bin.length;
      const bytes = new Uint8Array(len);
      for(let i=0;i<len;i++){ bytes[i] = bin.charCodeAt(i); }
      return { bytes, mime };
    }
    const { bytes, mime } = dataUrlToBytes(dataUrl);
    
    // ファイル名の正規化（photo/business-cardを優先）
    const lower = String(fileName||'').toLowerCase();
    let normalizedName = lower.includes('photo') || lower.includes('avatar') ? 'photo'
                         : lower.includes('business') || lower.includes('meishi') || lower.includes('card') ? 'business-card'
                         : (lower.replace(/[^a-z0-9\.\-_]/g,'') || 'file');
    // 既に拡張子が無ければ推定
    if(!/\.(jpg|jpeg|png|webp|pdf)$/i.test(normalizedName)){
      if(mime === 'application/pdf'){ normalizedName += '.pdf'; }
      else if(mime.indexOf('png')>=0){ normalizedName += '.png'; }
      else if(mime.indexOf('webp')>=0){ normalizedName += '.webp'; }
      else { normalizedName += '.jpg'; }
    }
    
    // multipart アップロード
    const boundary = '-------1to1appBoundary' + Math.random().toString(16).slice(2);
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";
    
    const metadata = {
      name: normalizedName,
      parents: [contactFolderId]
    };
    
    // Convert bytes to base64 for multipart
    let binary = '';
    for(let i=0;i<bytes.length;i++){ binary += String.fromCharCode(bytes[i]); }
    const b64 = btoa(binary);
    
    const multipartBody = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) + delimiter +
      'Content-Type: ' + mime + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n' +
      '\r\n' + b64 + closeDelim;
    
    const resp = await gapi.client.request({
      path: '/upload/drive/v3/files',
      method: 'POST',
      params: { uploadType: 'multipart', supportsAllDrives: true },
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body: multipartBody
    });
    
    const fileId = resp && resp.result && resp.result.id;
    if(!fileId){ throw new Error('upload failed'); }
    
    // 'drive:' 形式で返却（既存の画像ローダーが対応）
    return 'drive:' + fileId;
  }catch(e){
    console.warn('saveAttachmentToFileSystem failed', e);
    throw e;
  }
}
__root.AppData = __root.AppData || {};
__root.AppData.saveAttachmentToFileSystem = saveAttachmentToFileSystem;


async function downloadJsonById(fileId){
  _ensureReady();
  try {
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media'
    });
    return JSON.parse(response.body);
  } catch (error) {
    console.warn('downloadJsonById failed for', fileId, error);
    return null;
  }
}

// 🔧 FIX: upsertJsonInFolder implementation (was missing)
async function upsertJsonInFolder(folderId, fileName, jsonData){
  _ensureReady();
  try {
    const existingFileId = await driveFindChildByName(folderId, fileName, 'application/json');
    const jsonContent = JSON.stringify(jsonData, null, 2);
    
    if (existingFileId) {
      // Update existing file
      const response = await gapi.client.request({
        path: '/upload/drive/v3/files/' + existingFileId,
        method: 'PATCH',
        params: { uploadType: 'media', supportsAllDrives: true },
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: jsonContent
      });
      log('Updated JSON file:', fileName, 'in folder:', folderId);
      return response.result.id;
    } else {
      // Create new file
      const metadata = {
        name: fileName,
        mimeType: 'application/json',
        parents: [folderId]
      };
      
      const boundary = '-------1to1app' + Date.now();
      const delimiter = "\r\n--" + boundary + "\r\n";
      const closeDelim = "\r\n--" + boundary + "--";
      
      const multipartBody = delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) + delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        jsonContent + closeDelim;
      
      const response = await gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart', supportsAllDrives: true },
        headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
        body: multipartBody
      });
      
      log('Created JSON file:', fileName, 'in folder:', folderId);
      return response.result.id;
    }
  } catch (error) {
    console.error('upsertJsonInFolder failed:', error);
    throw error;
  }
}

// 🔧 FIX: Image URL resolution with proper token handling
async function resolveAttachmentUrl(contactId, kind, prefer){
  _ensureReady();
  prefer = prefer || 'webContent';
  
  try {
    if (!global.folderStructure || !global.folderStructure.attachmentsContacts) {
      console.warn('Attachments folder structure not available');
      return null;
    }
    
    const attachmentsFolder = global.folderStructure.attachmentsContacts;
    const contactFolder = await driveFindChildByName(attachmentsFolder, 'contact-' + String(contactId).padStart(6, '0'));
    
    if (!contactFolder) {
      console.warn('Contact folder not found for ID:', contactId);
      return null;
    }
    
    // Look for image files based on kind
    /* [fix][image-resolve] accept 'photo'/'avatar' and 'businessCard' synonyms */
const _k = (String(kind||'').toLowerCase());
const isAvatar = (_k === 'avatar' || _k === 'photo' || _k === 'face' || _k === 'profile');
const isBiz = (_k === 'businesscard' || _k === 'business-card' || _k === 'card' || _k === 'namecard');
const extensions = isAvatar ? ['jpg','jpeg','png','webp'] : ['jpg','jpeg','png','pdf','webp'];
const prefixes = isAvatar ? ['photo','avatar','profile','face'] : ['business-card','businessCard','card','namecard','meishi'];
    
    const files = await driveListChildren(contactFolder);
    
    for (const prefix of prefixes) {
      for (const ext of extensions) {
        const fileName = prefix + '.' + ext;
        const file = files.find(f => f.name.toLowerCase() === fileName.toLowerCase());
        if (file) {
          // Return Drive file URL with media access
          const token = gapi.client.getToken();
          if (token && token.access_token) {
            return `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&access_token=${encodeURIComponent(token.access_token)}`;
          }
          // Fallback to webContentLink if available
          return file.webContentLink || null;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn('resolveAttachmentUrl failed:', error);
    return null;
  }
}

// 🔧 FIX: Sanitize URL to prevent HTML injection
function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  // Remove any HTML tags or encoded HTML
  url = url.replace(/%3C[^%]*%3E/gi, ''); // Remove encoded HTML tags
  url = url.replace(/<[^>]*>/g, ''); // Remove any actual HTML tags
  
  // Ensure it's a valid URL
  if (url.startsWith('data:') || url.startsWith('https://') || url.startsWith('http://')) {
    return url;
  }
  
  return '';
}

async function resolveMigratedStructure(rootFolderId){
  _ensureReady();
  console.log('[data] resolving migrated structure from folder:', rootFolderId);
  
  try {
    // Look for required folders: index, contacts, meetings, attachments
    const children = await driveListChildren(rootFolderId);
    const folders = children.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    
    const structure = {};
    
    // Find index folder
    const indexFolder = folders.find(f => f.name.toLowerCase() === 'index');
    if (indexFolder) {
      structure.index = indexFolder.id;
    }
    
    // Find contacts folder
    const contactsFolder = folders.find(f => f.name.toLowerCase() === 'contacts');
    if (contactsFolder) {
      structure.contacts = contactsFolder.id;
    }
    
    // Find meetings folder
    const meetingsFolder = folders.find(f => f.name.toLowerCase() === 'meetings');
    if (meetingsFolder) {
      structure.meetings = meetingsFolder.id;
    }
    
    // Find attachments folder
    const attachmentsFolder = folders.find(f => f.name.toLowerCase() === 'attachments');
    if (attachmentsFolder) {
      structure.attachments = attachmentsFolder.id;
      
      // Look for attachments subfolders
      const attachmentChildren = await driveListChildren(attachmentsFolder.id);
      const attachmentSubfolders = attachmentChildren.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
      
      const contactsAttachFolder = attachmentSubfolders.find(f => f.name.toLowerCase() === 'contacts');
      if (contactsAttachFolder) {
        structure.attachmentsContacts = contactsAttachFolder.id;
      }
      
      const meetingsAttachFolder = attachmentSubfolders.find(f => f.name.toLowerCase() === 'meetings');
      if (meetingsAttachFolder) {
        structure.attachmentsMeetings = meetingsAttachFolder.id;
      }
    }
    
    console.log('[data] resolved structure:', structure);
    return structure;
  } catch (error) {
    console.error('[data] resolveMigratedStructure error:', error);
    return null;
  }
}

async function loadIndexes(indexFolderId){
  _ensureReady();
  console.log('[data] loading indexes from folder:', indexFolderId);
  
  try {
    const result = {
      contacts: [],
      meetings: {},
      meetingsByContact: {},
      options: {},
      metadata: {},
      indexes: {},
      structure: null
    };
    
    // Get all files in index folder
    const indexFiles = await driveListChildren(indexFolderId);
    console.log('[data] found index files:', indexFiles.map(f => f.name));
    
    // Load contacts-index.json
    const contactsIndexFile = indexFiles.find(f => f.name.toLowerCase().includes('contacts-index'));
    if (contactsIndexFile) {
      const contactsIndex = await downloadJsonById(contactsIndexFile.id);
      if (contactsIndex && Array.isArray(contactsIndex)) {
        result.contacts = contactsIndex;
        result.indexes.contacts = contactsIndex;
      }
    }
    
    // Load meetings-index.json
    const meetingsIndexFile = indexFiles.find(f => f.name.toLowerCase().includes('meetings-index'));
    if (meetingsIndexFile) {
      const meetingsIndex = await downloadJsonById(meetingsIndexFile.id);
      if (meetingsIndex) {
        result.meetings = meetingsIndex;
        result.indexes.meetings = meetingsIndex;
      }
    }
    
    // Load search-index.json
    const searchIndexFile = indexFiles.find(f => f.name.toLowerCase().includes('search-index'));
    if (searchIndexFile) {
      const searchIndex = await downloadJsonById(searchIndexFile.id);
      if (searchIndex) {
        result.indexes.search = searchIndex;
      }
    }
    
    // Load metadata.json
    const metadataFile = indexFiles.find(f => f.name.toLowerCase().includes('metadata'));
    if (metadataFile) {
      const metadata = await downloadJsonById(metadataFile.id);
      if (metadata) {
        result.metadata = metadata;
        // Extract options from metadata if available
        if (metadata.options) {
          result.options = metadata.options;
        }
      }
    }
    
    // 🔧 FIX: Initialize options with safe defaults to prevent undefined errors
    if (!result.options || typeof result.options !== 'object') {
      result.options = {};
    }
    
    // Ensure all option arrays exist and are arrays
    result.options.types = Array.isArray(result.options.types) ? result.options.types : 
      ['顧客候補', '顧客', '取次店・販売店', 'パートナー', 'その他'];
    result.options.affiliations = Array.isArray(result.options.affiliations) ? result.options.affiliations : 
      ['商工会議所', '青年会議所', 'BNI', 'その他団体'];
    result.options.industryInterests = Array.isArray(result.options.industryInterests) ? result.options.industryInterests : 
      ['IT・技術', 'コンサルティング', '製造業', '小売業', 'サービス業', 'その他'];
    result.options.statuses = Array.isArray(result.options.statuses) ? result.options.statuses : 
      ['新規', '商談中', '成約', '保留', '終了'];
    
    console.log('[data] loaded indexes - contacts:', result.contacts.length, 'meetings:', Object.keys(result.meetings).length);
    return result;
  } catch (error) {
    console.error('[data] loadIndexes error:', error);
    return {
      contacts: [],
      meetings: {},
      meetingsByContact: {},
      options: {
        types: ['顧客候補', '顧客', '取次店・販売店', 'パートナー', 'その他'],
        affiliations: ['商工会議所', '青年会議所', 'BNI', 'その他団体'],
        industryInterests: ['IT・技術', 'コンサルティング', '製造業', '小売業', 'サービス業', 'その他'],
        statuses: ['新規', '商談中', '成約', '保留', '終了']
      },
      metadata: {},
      indexes: {}
    };
  }
}

// === Export minimal AppData API for main.js ===
var __root = (typeof window!=='undefined'?window:(typeof self!=='undefined'?self:globalThis));
__root.AppData = __root.AppData || {};
__root.AppData.setProgressHandler = function(fn){
  if (typeof fn === 'function'){ STATE.progress = fn; }
};
__root.AppData.ensureFolderStructureByName = ensureFolderStructureByName;
__root.AppData.signin = function(){
  try{
    setBtnsDisabled(true);
  }catch(e){}
  // Ensure gapi client first, then init GIS token client and request token
  ensureGapiClient().then(function(){
    __initTokenClientWithRetry(function(ok){
      if(!ok){
        console.error('GIS init failed');
        try{ setBtnsDisabled(false); }catch(e){}
        alert('Googleサインインの準備に失敗しました。数秒後にもう一度お試しください。');
        return;
      }
      try{
        STATE.tokenInFlight = true;
        if(STATE.tokenClient && STATE.tokenClient.requestAccessToken){
          STATE.tokenClient.requestAccessToken({prompt: 'consent'});
        }else{
          console.error('tokenClient missing');
          try{ setBtnsDisabled(false); }catch(e){}
        }
      }catch(err){
        console.error('signin error', err);
        try{ setBtnsDisabled(false); }catch(e){}
      }
    });
  });
};


// Load all indexes from migrated folder structure root
__root.AppData.loadAllFromMigrated = async function(rootFolderId){
  await ensureGapiClient();
  var st = await resolveMigratedStructure(rootFolderId);
  if(!st || !st.index){ throw new Error('index フォルダが見つかりません'); }
  var all = await loadIndexes(st.index);
  // Add structure info to result
  all.structure = st;
  return all;
};



// Hydrate missing contact and meeting details by reading per-contact JSON files

__root.AppData.hydrateMissingFromFiles = async function(structure, contactsArr, meetingsMap){
  await ensureGapiClient();
  if(!structure) return { contacts: contactsArr||[], meetingsByContact: meetingsMap||{} };
  var contactFolderId = structure.contacts;
  var meetingsFolderId = structure.meetings;

  var contactFiles = {};
  var meetingFiles = {};
  function pad6(x){ try{ return String(x).padStart(6,'0'); }catch(e){ return String(x); } }

  if(contactFolderId){
    try{
      var files = await driveListChildren(contactFolderId, { nameContains: 'contact-' });
      files.forEach(function(f){ contactFiles[String(f.name||'').toLowerCase()] = f.id; });
    }catch(e){ console.warn('contactsフォルダ一覧失敗', e); }
  }
  if(meetingsFolderId){
    try{
      var files2 = await driveListChildren(meetingsFolderId, { nameContains: 'contact-' });
      files2.forEach(function(f){ meetingFiles[String(f.name||'').toLowerCase()] = f.id; });
    }catch(e){ console.warn('meetingsフォルダ一覧失敗', e); }
  }

  // ALWAYS merge per-contact detail if file exists
  if(Array.isArray(contactsArr) && contactFolderId){
    for(var i=0;i<contactsArr.length;i++){
      var c = contactsArr[i] || {};
      var _cid2 = String(c.id||''); var _base2 = _cid2.replace(/^contact-/,''); var fname = 'contact-' + pad6(_base2) + '.json';
      var fileId = contactFiles[fname.toLowerCase()];
      if(fileId){
        try{
          var detail = await downloadJsonById(fileId);
          // Shallow merge (detail wins)
          for(var k in detail){ if(Object.prototype.hasOwnProperty.call(detail,k)) c[k] = detail[k]; }
        }catch(e){ console.warn('contact hydrate失敗', c.id, e); }
      }
    }
  }

  // Build or augment meetings map from per-contact meeting files
  if(!meetingsMap || typeof meetingsMap !== 'object') meetingsMap = {};
  if(meetingsFolderId){
    for(var j=0;j<(contactsArr||[]).length;j++){
      var cid = contactsArr[j] && contactsArr[j].id;
      if(!cid) continue;
      var _cid = String(cid||''); var _base = _cid.replace(/^contact-/,''); var fname2 = 'contact-' + pad6(_base) + '-meetings.json';
      var mid = meetingFiles[fname2.toLowerCase()];
      if(mid){
        try{
          var list = await downloadJsonById(mid);
          meetingsMap[cid] = Array.isArray(list) ? list : (Array.isArray(list && list.items) ? list.items : []);
        }catch(e){ console.warn('meetings hydrate失敗', cid, e); }
      }
    }
  }


  // === Injected: normalize model for photoRef/businessCardRef and attachment refs ===
  try{
    // Helper to map file ref {name, path, driveFileId, mimeType} -> {name, data, type, path}
    function mapAttachmentRef(a){
      if(!a) return null;
      var data = (a.driveFileId ? ('drive:' + a.driveFileId) : (a.path || ''));
      return { name: a.name || '', data: data, type: a.mimeType || '', path: a.path || '' };
    }
    // Contacts
    if (Array.isArray(contactsArr)){
      contactsArr.forEach(function(c){
        if (c && c.photoRef){
          c.photo = c.photoRef.driveFileId ? ('drive:' + c.photoRef.driveFileId) : (c.photoRef.path || c.photo || '');
        }
        if (c && c.businessCardRef){
          c.businessCard = c.businessCardRef.driveFileId ? ('drive:' + c.businessCardRef.driveFileId) : (c.businessCardRef.path || c.businessCard || '');
        }
        if (Array.isArray(c && c.attachments)){
          c.attachments = c.attachments.map(mapAttachmentRef).filter(Boolean);
        }
      });
    }
    // Meetings
    if (meetingsMap && typeof meetingsMap === 'object'){
      Object.keys(meetingsMap).forEach(function(cid){
        var arr = meetingsMap[cid];
        if(Array.isArray(arr)){
          arr.forEach(function(m){
            if (Array.isArray(m && m.attachments)){
              m.attachments = m.attachments.map(mapAttachmentRef).filter(Boolean);
            }
          });
        }
      });
    }
  }catch(e){ console.warn('normalize model error', e); }

  console.log('[data] BP7: meetings loaded per contact:', Object.keys(meetingsMap||{}).length);
  return { contacts: contactsArr||[], meetingsByContact: meetingsMap };
};


// === High-speed parallel hydrator with concurrency limit and progressive callback (self-contained) ===
var hydratorConcurrency = 10;
async function hydrateMissingFromFilesParallel(structure, contactsArr, meetingsMap, opts){
  opts = opts || {};
  var onBatch = typeof opts.onBatch === 'function' ? opts.onBatch : function(){};
  var concurrency = typeof opts.concurrency === 'number' ? Math.max(2, Math.min(24, opts.concurrency)) : hydratorConcurrency;

  // Local helpers (avoid relying on IIFE-scoped functions)
  async function localDriveListChildren(parentId, opt){
    opt = opt || {};
    var q = ["'" + parentId + "' in parents", "trashed=false"];
    if(opt.nameContains){ q.push("name contains '" + String(opt.nameContains).replace(/'/g,"\\'") + "'"); }
    if(opt.mimeType){ q.push("mimeType='" + opt.mimeType + "'"); }
    var params = {
      q: q.join(" and "),
      fields: "files(id,name,mimeType,modifiedTime)",
      pageSize: typeof opt.pageSize==='number' ? opt.pageSize : 1000,
      orderBy: "name",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    };
    try{
      var resp = await gapi.client.drive.files.list(params);
      return (resp.result && resp.result.files) || [];
    }catch(e){
      console.warn('[parallel] localDriveListChildren 失敗', e);
      return [];
    }
  }
  async function localDownloadJsonById(fileId){
    try{
      var response = await gapi.client.drive.files.get({ fileId: fileId, alt: 'media' });
      return JSON.parse(response.body);
    }catch(e){
      console.warn('[parallel] localDownloadJsonById 失敗', fileId, e);
      return null;
    }
  }

  contactsArr = Array.isArray(contactsArr) ? contactsArr : [];
  meetingsMap = (meetingsMap && typeof meetingsMap === 'object') ? meetingsMap : {};

  if(!structure) return { contacts: contactsArr, meetingsByContact: meetingsMap };

  var contactFolderId = structure.contacts;
  var meetingsFolderId = structure.meetings;
  var attachmentsContactsFolderId = structure.attachmentsContacts;

  var contactFiles = {};
  var meetingFiles = {};
  function pad6(x){ try{ return String(x).padStart(6,'0'); }catch(e){ return String(x); } }

  // Pre-list filenames -> id maps
  if(contactFolderId){
    try{
      var files = await localDriveListChildren(contactFolderId, { nameContains: 'contact-' });
      files.forEach(function(f){ contactFiles[String(f.name||'').toLowerCase()] = f.id; });
    }catch(e){ console.warn('contactsフォルダ一覧失敗(parallel)', e); }
  }
  if(meetingsFolderId){
    try{
      var files2 = await localDriveListChildren(meetingsFolderId, { nameContains: 'contact-' });
      files2.forEach(function(f){ meetingFiles[String(f.name||'').toLowerCase()] = f.id; });
    }catch(e){ console.warn('meetingsフォルダ一覧失敗(parallel)', e); }
  }

  
  
  
  // Pre-list candidate photo files
  var photoFiles = {};
  if(attachmentsContactsFolderId){
    try{
      var imgs = await localDriveListChildren(attachmentsContactsFolderId, { nameContains: 'contact-' });
      imgs.forEach(function(f){
        if(String(f.mimeType||'').indexOf('image/')===0){
          photoFiles[String(f.name||'').toLowerCase()] = f.id;
        }
      });
    }catch(e){ console.warn('attachmentsContacts一覧失敗(parallel)', e); }
  }

  // --- If index is empty, create lightweight stubs from filenames (no JSON download yet) ---
  try{
    if(!(Array.isArray(contactsArr) && contactsArr.length)){
      var keys = Object.keys(contactFiles);
      if(keys.length){
        var stubs = keys.map(function(_name){
          var m = _name.match(/contact-(\d+)\.json/i);
          var id = m ? m[1] : _name;
          return { id: id, name: 'ID ' + id, company: '', _stub: true };
        });
        // mutate the original array to reflect changes to window.contacts
        Array.prototype.push.apply(contactsArr, stubs);
        try{ onBatch({phase:'stubs', count: contactsArr.length}); }catch(_e){}
      }
    }
  }catch(_e){}
  // --- Bootstrap contacts when index is empty ---

  try{
    if(!(Array.isArray(contactsArr) && contactsArr.length)){
      var keys = Object.keys(contactFiles);
      var bootContacts = [];
      for(var ki=0; ki<keys.length; ki++){
        var _name = keys[ki];
        var fid = contactFiles[_name];
        if(!fid) continue;
        try{
          var minimal = await localDownloadJsonById(fid);
          if(minimal && typeof minimal==='object'){
            if(!minimal.id){
              var m = _name.match(/contact-(\d+)\.json/i);
              minimal.id = m ? m[1] : _name;
            }
            bootContacts.push(minimal);
          }
        }catch(_e){}
      }
      if(bootContacts.length){ contactsArr = bootContacts; }
    }
  }catch(_e){}

  // Build tasks
  var contactTasks = [];
  var meetingTasks = [];

  for (var i=0; i<contactsArr.length; i++){
    (function(idx){
      var c = contactsArr[idx] || {};
      var _cid = String(c.id||''); var _base = _cid.replace(/^contact-/,''); var fname = 'contact-' + pad6(_base) + '.json';
      var fileId = contactFiles[fname.toLowerCase()];

      // photo per contact (best-effort)
      if(!c.photo && attachmentsContactsFolderId){
        var cand = [
          'contact-' + pad6(_base) + '-photo.jpg',
          'contact-' + pad6(_base) + '-photo.png',
          'contact-' + pad6(_base) + '.jpg',
          'contact-' + pad6(_base) + '.png'
        ];
        for(var ci=0; ci<cand.length; ci++){
          var pid = photoFiles[cand[ci].toLowerCase()];
          if(pid){ c.photo = 'drive:' + pid; break; }
        }
      }

      if(fileId){
        contactTasks.push(async function(){
          try{
            var detail = await localDownloadJsonById(fileId);
            if(detail && typeof detail === 'object'){
              Object.keys(detail).forEach(function(k){ c[k] = detail[k]; });
            }
            return {type:'contact', id:c.id};
          }catch(e){
            console.warn('contact hydrate失敗(parallel)', c.id, e);
            return {type:'contact', id:c.id, error:String(e)};
          }
        });
      }
      // meetings per contact
      var fname2 = 'contact-' + pad6(_base) + '-meetings.json';
      var mid = meetingFiles[fname2.toLowerCase()];
      if(mid){
        meetingTasks.push(async function(){
          try{
            var list = await localDownloadJsonById(mid);
            meetingsMap[_cid] = Array.isArray(list) ? list : (Array.isArray(list && list.items) ? list.items : []);
            return {type:'meetings', id:_cid, count:(meetingsMap[_cid]||[]).length};
          }catch(e){
            console.warn('meetings hydrate失敗(parallel)', _cid, e);
            return {type:'meetings', id:_cid, error:String(e)};
          }
        });
      }
    })(i);
  }

  // Simple concurrency runner
  async function runPool(tasks){
    var i = 0, active = 0, results = [];
    return await new Promise(function(resolve){
      function next(){
        if(i >= tasks.length && active === 0){ resolve(results); return; }
        while(active < concurrency && i < tasks.length){
          var t = tasks[i++];
          active++;
          t().then(function(r){ results.push(r); })
              .catch(function(e){ results.push({error:String(e)}); })
              .finally(function(){
                active--;
                if(results.length % Math.max(5, Math.floor(concurrency/2)) === 0){
                  try{ onBatch({progress: results.length, total: tasks.length}); }catch(_e){}
                }
                next();
              });
        }
      }
      next();
    });
  }

  await runPool(contactTasks);
  try{ onBatch({phase:'contacts', done:true}); }catch(_e){}

  await runPool(meetingTasks);
  try{ onBatch({phase:'meetings', done:true}); }catch(_e){}

  return { contacts: contactsArr, meetingsByContact: meetingsMap };
}

// Export new fast hydrator (non-breaking)
var __root = (typeof window!=='undefined'?window:(typeof self!=='undefined'?self:globalThis));
__root.AppData = __root.AppData || {};
__root.AppData.hydrateMissingFromFilesParallel = hydrateMissingFromFilesParallel;

function buildContactsIndex(contacts){
  contacts = Array.isArray(contacts) ? contacts : [];
  return contacts.map(function(c){
    return {
      id: c.id || "",
      name: c.name || "",
      company: c.company || "",
      furigana: c.furigana || "",
      status: c.status || c.currentStatus || "",
      tags: c.tags || c.labels || [],
      updatedAt: c.updatedAt || c.modifiedTime || ""
    };
  });
}

function buildSearchIndex(contacts){
  contacts = Array.isArray(contacts) ? contacts : [];
  return contacts.map(function(c){
    var t = [c.name, c.company, c.furigana].filter(Boolean).join(" ").toLowerCase();
    return { id: c.id||"", t: t };
  });
}

__root.AppData.rebuildIndexes = async function(structure, contacts, meetingsByContact){
  
  // local scope checker to avoid ReferenceError
  function _hasScope(scope){
    try{
      if (typeof hasScope === 'function') return hasScope(scope);
      var token = (typeof gapi!=='undefined' && gapi.client && gapi.client.getToken && gapi.client.getToken()) || null;
      var scopeStr = token && token.scope ? token.scope : ((window.APP_CONFIG && APP_CONFIG.SCOPES) || '');
      return typeof scopeStr === 'string' && scopeStr.indexOf(scope) >= 0;
    }catch(e){ return false; }
  }
try{
    if(!structure || !structure.index){ console.warn('rebuildIndexes: index folder missing'); return false; }
    if(!_hasScope("https://www.googleapis.com/auth/drive.file")){
      console.warn('rebuildIndexes: insufficient scope (drive.file required)'); 
      return false;
    }
    var idxFolder = structure.index;
    var cidx = buildContactsIndex(contacts);
    var sidx = buildSearchIndex(contacts);
    await upsertJsonInFolder(idxFolder, "contacts-index.json", cidx);
    await upsertJsonInFolder(idxFolder, "search-index.json", sidx);
    // meetings-index は既存を尊重（必要であれば同様に upsert 可能）
    return true;
  }catch(e){
    console.error('rebuildIndexes error', e);
    return false;
  }
};

// 🔧 FIX: Export additional utility functions
__root.AppData.resolveAttachmentUrl = resolveAttachmentUrl;
__root.AppData.sanitizeImageUrl = sanitizeImageUrl;
__root.AppData.upsertJsonInFolder = upsertJsonInFolder;

// 🔧 FIX: Collect all option values from existing contacts data
__root.AppData.collectOptionValuesFromContacts = function(contacts) {
  contacts = Array.isArray(contacts) ? contacts : [];
  
  const collected = {
    types: new Set(),
    affiliations: new Set(),
    industryInterests: new Set(),
    businesses: new Set(),
    residences: new Set()
  };
  
  contacts.forEach(function(contact) {
    if (!contact) return;
    
    // Collect types
    if (Array.isArray(contact.types)) {
      contact.types.forEach(function(type) {
        if (type && typeof type === 'string' && type.trim()) {
          collected.types.add(type.trim());
        }
      });
    }
    
    // Collect affiliations
    if (Array.isArray(contact.affiliations)) {
      contact.affiliations.forEach(function(aff) {
        if (aff && typeof aff === 'string' && aff.trim()) {
          collected.affiliations.add(aff.trim());
        }
      });
    }
    
    // Collect industry interests
    if (Array.isArray(contact.industryInterests)) {
      contact.industryInterests.forEach(function(interest) {
        if (interest && typeof interest === 'string' && interest.trim()) {
          collected.industryInterests.add(interest.trim());
        }
      });
    }
    
    // Collect businesses
    if (Array.isArray(contact.businesses)) {
      contact.businesses.forEach(function(business) {
        if (business && typeof business === 'string' && business.trim()) {
          collected.businesses.add(business.trim());
        }
      });
    }
    
    // Collect residences
    if (contact.residence && typeof contact.residence === 'string' && contact.residence.trim()) {
      collected.residences.add(contact.residence.trim());
    }
  });
  
  // Convert Sets to sorted arrays
  return {
    types: Array.from(collected.types).sort(function(a, b) { return a.localeCompare(b, 'ja'); }),
    affiliations: Array.from(collected.affiliations).sort(function(a, b) { return a.localeCompare(b, 'ja'); }),
    industryInterests: Array.from(collected.industryInterests).sort(function(a, b) { return a.localeCompare(b, 'ja'); }),
    businesses: Array.from(collected.businesses).sort(function(a, b) { return a.localeCompare(b, 'ja'); }),
    residences: Array.from(collected.residences).sort(function(a, b) { return a.localeCompare(b, 'ja'); })
  };
};



// === Save options back to index/metadata.json (upsert) ===
async function saveOptionsToMetadata(structure, options){
  _ensureReady();
  try{
    if(!structure || !structure.index){ throw new Error('index フォルダが未解決'); }
    await ensureGapiClient();
    // Try to find existing metadata.json in index folder
    var list = await driveListChildren(structure.index, { nameContains: 'metadata' });
    var fileId = null;
    var current = {};
    if(Array.isArray(list)){
      // pick metadata.json if present
      var meta = list.find(f => String(f.name||'').toLowerCase() === 'metadata.json') || list[0];
      if(meta){
        fileId = meta.id;
        try{ current = await downloadJsonById(fileId) || {}; }catch(e){ current = {}; }
      }
    }
    current = current && typeof current === 'object' ? current : {};
    current.options = current.options && typeof current.options === 'object' ? current.options : {};
    // Merge known keys only (types, affiliations, industryInterests, statuses)
    var keys = ['types','affiliations','industryInterests','statuses'];
    keys.forEach(function(k){
      if(options && Array.isArray(options[k])){
        current.options[k] = Array.from(new Set(options[k])).sort();
      }
    });
    // Upsert to index folder
    var jsonStr = JSON.stringify(current, null, 2);
    var id = await upsertJsonInFolder(structure.index, 'metadata.json', jsonStr);
    return id;
  }catch(e){
    console.warn('[data] saveOptionsToMetadata failed', e);
    throw e;
  }
}
__root.AppData.saveOptionsToMetadata = saveOptionsToMetadata;

})(window);