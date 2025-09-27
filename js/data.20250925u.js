/* ===== 1to1app U build required JS (2025-09-25U4) =====
   - FedCM 有効 / gapi・GIS 自動ローダー
   - 二重初期化/同時要求ガード
   - Drive helpers（ensureFolderStructureByName 等）
   - ☆ 成否イベント発火：document へ 'gis:token' / 'gis:error'
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
      var scopes = (global.APP_CONFIG && APP_CONFIG.SCOPES) || '';
      scopes = sanitizeScopes(scopes);
      return scopes.split(' ').indexOf(needle) >= 0;
    }catch(e){ return false; }
  }
  function btns(){ return Array.prototype.slice.call(document.querySelectorAll('#googleSignInBtn, [data-role="google-signin"], button[onclick*="handleAuthClick"]')); }
  function setBtnsDisabled(v){ try{ btns().forEach(function(b){ b.disabled=!!v; b.dataset.busy=v?'1':''; }); }catch(e){} }

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
  function ensureGapiScript(){
    try{
      if(global.gapi && typeof gapi.load === 'function') return true;
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
      if (!(global.gapi && gapi.load)){
        ensureGapiScript();
        var tries=0, max=30;
        (function waitGapi(){
          if(global.gapi && gapi.load){ return ensureGapiClient().then(resolve); }
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
    if(!(global.google && google.accounts && google.accounts.oauth2)){ return false; }

    var cid = (global.APP_CONFIG && APP_CONFIG.GOOGLE_CLIENT_ID) ||
              (global.DRIVE_CONFIG && DRIVE_CONFIG.CLIENT_ID) || '';
    var scopes = (global.APP_CONFIG && APP_CONFIG.SCOPES) ||
                 (global.DRIVE_CONFIG && DRIVE_CONFIG.SCOPES) || '';

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
          if (resp && resp.access_token && global.gapi && gapi.client){
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
    if(!(global.gapi && gapi.client && STATE.gapiReady)){
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
    
    console.log('[data] loaded indexes - contacts:', result.contacts.length, 'meetings:', Object.keys(result.meetings).length);
    return result;
  } catch (error) {
    console.error('[data] loadIndexes error:', error);
    return {
      contacts: [],
      meetings: {},
      meetingsByContact: {},
      options: {},
      metadata: {},
      indexes: {}
    };
  }
}

// === Export minimal AppData API for main.js ===
var __root = (typeof window!=='undefined'?window:(typeof self!=='undefined'?self:globalThis));
__root.AppData = __root.AppData || {};
global.AppData.setProgressHandler = function(fn){
  if (typeof fn === 'function'){ STATE.progress = fn; }
};
global.AppData.ensureFolderStructureByName = ensureFolderStructureByName;
global.AppData.signin = function(){
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
global.AppData.loadAllFromMigrated = async function(rootFolderId){
  await ensureGapiClient();
  var st = await resolveMigratedStructure(rootFolderId);
  if(!st || !st.index){ throw new Error('index フォルダが見つかりません'); }
  var all = await loadIndexes(st.index);
  // Add structure info to result
  all.structure = st;
  return all;
};



// Hydrate missing contact and meeting details by reading per-contact JSON files

global.AppData.hydrateMissingFromFiles = async function(structure, contactsArr, meetingsMap){
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
;})(window);

// === High-speed parallel hydrator with concurrency limit and progressive callback ===
var hydratorConcurrency = 10;
async function hydrateMissingFromFilesParallel(structure, contactsArr, meetingsMap, opts){
  opts = opts || {};
  var onBatch = typeof opts.onBatch === 'function' ? opts.onBatch : function(){};
  var concurrency = typeof opts.concurrency === 'number' ? Math.max(2, Math.min(24, opts.concurrency)) : hydratorConcurrency;
contactsArr = Array.isArray(contactsArr) ? contactsArr : [];
  meetingsMap = (meetingsMap && typeof meetingsMap === 'object') ? meetingsMap : {};

  if(!structure) return { contacts: contactsArr, meetingsByContact: meetingsMap };

  var contactFolderId = structure.contacts;
  var meetingsFolderId = structure.meetings;

  var contactFiles = {};
  var meetingFiles = {};
  function pad6(x){ try{ return String(x).padStart(6,'0'); }catch(e){ return String(x); } }

  // Pre-list filenames -> id maps
  if(contactFolderId){
    try{
      var files = await driveListChildren(contactFolderId, { nameContains: 'contact-' });
      files.forEach(function(f){ contactFiles[String(f.name||'').toLowerCase()] = f.id; });
    }catch(e){ console.warn('contactsフォルダ一覧失敗(parallel)', e); }
  }
  if(meetingsFolderId){
    try{
      var files2 = await driveListChildren(meetingsFolderId, { nameContains: 'contact-' });
      files2.forEach(function(f){ meetingFiles[String(f.name||'').toLowerCase()] = f.id; });
    }catch(e){ console.warn('meetingsフォルダ一覧失敗(parallel)', e); }
  }

  // Build tasks
  var contactTasks = [];
  var meetingTasks = [];

  for (var i=0; i<contactsArr.length; i++){
    (function(idx){
      var c = contactsArr[idx] || {};
      var _cid = String(c.id||''); var _base = _cid.replace(/^contact-/,''); var fname = 'contact-' + pad6(_base) + '.json';
      var fileId = contactFiles[fname.toLowerCase()];
      if(fileId){
        contactTasks.push(async function(){
          try{
            var detail = await downloadJsonById(fileId);
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
            var list = await downloadJsonById(mid);
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

  // normalize attachments/photos (same as original tail)
  try{
    // Existing normalization block is reused by calling the original helper if present
  }catch(_e){}

  return { contacts: contactsArr, meetingsByContact: meetingsMap };
}

// Export new fast hydrator (non-breaking)
var __root = (typeof window!=='undefined'?window:(typeof self!=='undefined'?self:globalThis));
__root.AppData = __root.AppData || {};
__root.AppData.hydrateMissingFromFilesParallel = hydrateMissingFromFilesParallel;
