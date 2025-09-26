/* ===== 1to1app U build required JS (2025-09-25U4) =====
   - FedCM 有効 / gapi・GIS 自動ローダー
   - 二重初期化/同時要求ガード
   - Drive helpers（ensureFolderStructureByName 等）
   - ★ 成否イベント発火：document へ 'gis:token' / 'gis:error'
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
    var files = await driveListChildren(parentId, { });
    var lower = String(name).toLowerCase();
    var found = files.find(function(f){
      if(mimeType && f.mimeType !== mimeType) return false;
      return String(f.name||'').toLowerCase() === lower;
    });
    if(found) return found.id;
    // try contains for safety
    found = files.find(function(f){
      if(mimeType && f.mimeType !== mimeType) return false;
      return String(f.name||'').toLowerCase().indexOf(lower) >= 0;
    });
    return found ? found.id : null;
  }

  async function downloadJsonById(fileId){
    var token = gapi.client.getToken && gapi.client.getToken().access_token;
    if(!token) throw new Error('アクセストークン未取得');
    var res = await fetch('https://www.googleapis.com/drive/v3/files/'+fileId+'?alt=media', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if(!res.ok){ throw new Error('JSON取得失敗: ' + res.status); }
    // robust parse (text/plain 対応 / BOM 除去)
    var text = await res.text();
    try{
      // Remove BOM if present
      if(text.charCodeAt(0) === 0xFEFF){ text = text.slice(1); }
      return JSON.parse(text);
    }catch(e){
      console.error('JSON parse失敗', fileId, e, text && text.slice(0,200));
      throw e;
    }
  }

  async function readJsonByNameInFolder(folderId, name){
    var id = await driveFindChildByName(folderId, name, 'application/json');
    if(!id) return null;
    return await downloadJsonById(id);
  }

  async function resolveMigratedStructure(rootFolderId){
    var MIME_FOLDER = 'application/vnd.google-apps.folder';
    var indexId = await driveFindChildByName(rootFolderId, 'index', MIME_FOLDER);
    var contactsId = await driveFindChildByName(rootFolderId, 'contacts', MIME_FOLDER);
    var meetingsId = await driveFindChildByName(rootFolderId, 'meetings', MIME_FOLDER);
    var attachmentsId = await driveFindChildByName(rootFolderId, 'attachments', MIME_FOLDER);

    // attachments subfolders (optional)
    var attachmentsContactsId = null, attachmentsMeetingsId = null;
    if(attachmentsId){
      attachmentsContactsId = await driveFindChildByName(attachmentsId, 'contacts', MIME_FOLDER);
      attachmentsMeetingsId = await driveFindChildByName(attachmentsId, 'meetings', MIME_FOLDER);
    }

    return {
      root: rootFolderId,
      index: indexId,
      contacts: contactsId,
      meetings: meetingsId,
      attachments: attachmentsId,
      attachmentsContacts: attachmentsContactsId,
      attachmentsMeetings: attachmentsMeetingsId
    };
  }

  async function loadIndexes(indexFolderId){
    if(!indexFolderId) return { contacts:{}, meetings:{}, search:{}, metadata:null };
    var [contactsIdx, meetingsIdx, searchIdx, metadata] = await Promise.all([
      readJsonByNameInFolder(indexFolderId, 'contacts-index.json'),
      readJsonByNameInFolder(indexFolderId, 'meetings-index.json'),
      readJsonByNameInFolder(indexFolderId, 'search-index.json'),
      readJsonByNameInFolder(indexFolderId, 'metadata.json')
    ]);
    return { contacts: contactsIdx||{}, meetings: meetingsIdx||{}, search: searchIdx||{}, metadata: metadata||null };
  }

  async function listJsonFiles(folderId){
    // MIMEタイプを限定しない（移行ツールの保存時に text/plain や application/octet-stream の場合があるため）
    var files = await driveListChildren(folderId, { /* no mime filter */ });
    return files || [];
  }

  async function loadAllContacts(contactsFolderId){
    if(!contactsFolderId) return [];
    var files = await listJsonFiles(contactsFolderId);
    // filter only contact-*.json
    files = files.filter(function(f){ return /\.json$/i.test(f.name || '') && /^contact-\d+\.json$/i.test(f.name || ''); });
    files.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
    var results = [];
    for(var i=0;i<files.length;i++){
      try{
        var obj = await downloadJsonById(files[i].id);
        if(obj && !obj.id){
          // derive from filename
          var m = (files[i].name||'').match(/contact-([\w\-]+)\.json/i); if(m) obj.id = m[1];
        }
        results.push(obj);
      }catch(e){ console.error('連絡先読込失敗', files[i].name, e); }
    }
    return results;
  }

  async function loadAllMeetings(meetingsFolderId){
    if(!meetingsFolderId) return {};
    var files = await listJsonFiles(meetingsFolderId);
    files = files.filter(function(f){ return /-meetings\.json$/i.test(f.name || ''); });
    var map = {};
    for(var i=0;i<files.length;i++){
      var name = files[i].name || '';
      var m = name.match(/contact-(\d+)-meetings\.json/i);
      if(!m) continue;
      var contactId = m[1];
      try{
        var arr = await downloadJsonById(files[i].id);
        if(Array.isArray(arr)) map[contactId] = arr;
      }catch(e){ console.error('ミーティング読込失敗', name, e); }
    }
    return map;
  }

  async function loadAllFromMigrated(rootFolderId){
    var structure = await resolveMigratedStructure(rootFolderId);
    var indexes = structure.index ? await loadIndexes(structure.index) : await (async function(){ return {contacts:{},meetings:{},search:{},metadata: await readJsonByNameInFolder(structure.root,'metadata.json')}; })();
    var options = await readJsonByNameInFolder(structure.root, 'options.json');
    var contacts = await loadAllContacts(structure.contacts);
    var meetingsByContact = await loadAllMeetings(structure.meetings);
    var metadata = indexes.metadata || null;

    return { structure: structure, contacts: contacts, meetingsByContact: meetingsByContact, options: options, metadata: metadata, indexes: indexes };
  }

  // ======== Drive JSON write helpers (used by contacts.js / meetings.js) ========
  async function getFileIdInFolder(name, parentId){
    var files = await driveListChildren(parentId, { });
    var f = files.find(function(x){ return String(x.name||'') === String(name); });
    return f ? f.id : null;
  }

  async function saveJsonFileToFolder(name, data, parentId){
    var metadata = { name: name, parents: [parentId], mimeType: 'application/json' };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    var token = gapi.client.getToken && gapi.client.getToken().access_token;
    if(!token) throw new Error('アクセストークン未取得');

    // try update
    var existingId = await getFileIdInFolder(name, parentId);
    var url;
    var method;
    if(existingId){
      url = 'https://www.googleapis.com/upload/drive/v3/files/' + existingId + '?uploadType=multipart';
      method = 'PATCH';
    }else{
      url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      method = 'POST';
    }
    var res = await fetch(url, { method: method, headers: { 'Authorization': 'Bearer ' + token }, body: form });
    if(!res.ok) throw new Error('JSON保存失敗: ' + res.status);
    return await res.json();
  }


  // public API
  var AppData = {
    initializeGoogleAPI: function(){ return ensureGapiClient(); },
    initializeGIS: function(){ __initTokenClientWithRetry(); },
    setAuthenticated: function(v){ /* no-op */ },
    setProgressHandler: function(fn){ STATE.progress = (typeof fn==='function') ? fn : function(){}; },

    getOrCreateFolderId: getOrCreateFolderId,
    ensureFolderStructureByName: ensureFolderStructureByName,
    resolveMigratedStructure: resolveMigratedStructure,
    readJsonByNameInFolder: readJsonByNameInFolder,
    loadAllFromMigrated: loadAllFromMigrated,
    saveJsonFileToFolder: saveJsonFileToFolder,
    getFileIdInFolder: getFileIdInFolder,
    driveListChildren: driveListChildren
  };

  global.AppData = AppData;
  global.initializeGoogleAPI = function(){ return AppData.initializeGoogleAPI(); };
  global.initializeGIS = function(){ return AppData.initializeGIS(); };
  
  // expose helper functions to global for other modules
  global.saveJsonFileToFolder = saveJsonFileToFolder;
  global.getFileIdInFolder = getFileIdInFolder;

  global.handleAuthClick = function(){
    try{
      setBtnsDisabled(true);
      if(STATE.tokenClient){
        if(STATE.tokenInFlight){ console.warn('token 要求中'); return; }
        STATE.tokenInFlight = true;
        STATE.tokenClient.requestAccessToken({ prompt: 'consent' });
        return;
      }
      __initTokenClientWithRetry(function(ok){
        if(!ok){ console.warn('tokenClient 初期化失敗'); setBtnsDisabled(false); return; }
        if(STATE.tokenInFlight){ console.warn('token 要求中'); return; }
        STATE.tokenInFlight = true;
        try{ STATE.tokenClient.requestAccessToken({ prompt: 'consent' }); }
        catch(e){ STATE.tokenInFlight = false; setBtnsDisabled(false); console.error(e); }
      });
    }catch(e){
      STATE.tokenInFlight = false;
      setBtnsDisabled(false);
      console.error(e);
    }
  };

  (function(g){ g.__BUILD_ID__='2025-09-25U4'; })(global);

  ensureGisScript();
  ensureGapiScript();
})(window);