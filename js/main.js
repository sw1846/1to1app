/* ===== 1to1app main.js (U5 - 修正版) =====
   - data.js(U4) のイベント 'gis:token' を受けて UI をログイン後状態へ切替
   - 「保存先フォルダ選択」モーダルを表示（初回 or 変更時）
   - 指定パス（例: PlaceOn/1to1）を ensureFolderStructureByName で作成/取得し localStorage に保存
   - フォルダ内の最新ファイルを一覧表示（初期データ読み込みの代替）
*/
(function(){
  'use strict';

  // URL parameter helper
  function getUrlParam(key){
    try{
      var s = new URLSearchParams(window.location.search);
      return s.get(key) || null;
    }catch(e){ return null; }
  }

  
  function log(){ console.log.apply(console, ['[main]'].concat([].slice.call(arguments))); }
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function setStatus(t){ var el=qs('#statusText'); if(el) el.textContent=t; }

  var LS_KEY_ID   = 'app.driveFolderId';
  var LS_KEY_PATH = 'app.driveFolderPath';

  // UI状態管理
  function hideSignin(){
    qsa('#googleSignInBtn, [data-role="google-signin"], button[onclick*="handleAuthClick"]').forEach(function(b){
      b.style.display='none';
    });
  }
  
  function showSignin(){
    qsa('#googleSignInBtn, [data-role="google-signin"], button[onclick*="handleAuthClick"]').forEach(function(b){
      b.style.display='';
    });
  }

  function hideAuthMessage(){
    var authMsg = qs('#authMessage');
    if(authMsg) authMsg.style.display = 'none';
  }

  function showAuthMessage(){
    var authMsg = qs('#authMessage');
    if(authMsg) authMsg.style.display = 'block';
  }

  function showAppInterface(){
    // ログイン後のボタンを表示
    var signoutBtn = qs('#signoutBtn');
    var selectFolderBtn = qs('#selectFolderBtn'); 
    var mergeDataBtn = qs('#mergeDataBtn');
    
    if(signoutBtn) signoutBtn.style.display = '';
    if(selectFolderBtn) selectFolderBtn.style.display = '';
    if(mergeDataBtn) mergeDataBtn.style.display = '';
    
    // ログインボタンを隠す
    hideSignin();
    
    // 認証メッセージを隠す
    hideAuthMessage();
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

  // ========== UI: 保存先フォルダ選択（既存デザイン準拠 .modal 構造） ==========
  function showFolderSelectModal(defaultPath){
    // 既存があれば一旦削除して作り直し
    var old = document.getElementById('folderModal');
    if(old) { old.remove(); }
    
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'folderModal';
    modal.innerHTML = ''
      + '<div class="modal-content">'
      +   '<div class="modal-header">'
      +     '<h2>保存先フォルダを選択</h2>'
      +     '<button class="btn btn-icon" onclick="closeFolderModal()">✕</button>'
      +   '</div>'
      +   '<div class="modal-body">'
      +     '<p>Googleドライブ上の保存先フォルダの <b>パス</b> を「/」区切りで指定してください。存在しない場合は作成します。</p>'
      +     '<input type="text" id="folderPathInput" class="input" placeholder="例: PlaceOn/1to1" />'
      +     '<p style="font-size:12px;color:var(--text-muted)">例: <code>PlaceOn/1to1</code>（先頭/末尾のスラッシュは不要）</p>'
      +   '</div>'
      +   '<div class="modal-footer">'
      +     '<button class="btn" onclick="closeFolderModal()">キャンセル</button>'
      +     '<button class="btn btn-primary" id="folderOkBtn">決定</button>'
      +   '</div>'
      + '</div>';
    
    document.body.appendChild(modal);
    
    // 初期値
    var inp = modal.querySelector('#folderPathInput');
    inp.value = (defaultPath || localStorage.getItem(LS_KEY_PATH) || 'PlaceOn/1to1');
    
    // 表示
    modal.classList.add('active');
    
    // 決定ボタンイベント
    modal.querySelector('#folderOkBtn').addEventListener('click', function(){
      var path = (inp.value||'').trim().replace(/^\/+|\/+$/g,'');
      if(!path){ inp.focus(); return; }
      chooseFolderAndLoad(path, true).then(function(){ 
        closeFolderModal(); 
      }).catch(function(err){
        console.error('フォルダ選択エラー:', err);
        alert('フォルダの選択に失敗しました: ' + err.message);
      });
    });
    
    // Enter で決定
    inp.addEventListener('keydown', function(ev){ 
      if(ev.key==='Enter'){ 
        modal.querySelector('#folderOkBtn').click(); 
      } 
    });
  }

  // フォルダモーダルを閉じる
  window.closeFolderModal = function(){
    var modal = document.getElementById('folderModal');
    if(modal) modal.remove();
  };

  // ========== Drive 読み込み（簡易） ==========
  function listFilesInFolder(folderId, limit){
  // 既存データ読み込みパイプライン
  async function loadFromFolderId(folderId){
    // 上部に簡易一覧も表示（デバッグ/確認用）
    try{
      var files = await listFilesInFolder(folderId, 20);
      renderDataPanel(files, localStorage.getItem(LS_KEY_PATH)||'(指定ID)');
    }catch(e){ console.warn('フォルダ一覧取得に失敗', e); }

    if(!(window.AppData && typeof AppData.loadAllFromMigrated === 'function')){
      throw new Error('AppData.loadAllFromMigrated not available');
    }
    setStatus('インデックスを読み込み中...');
    var payload = await AppData.loadAllFromMigrated(folderId);
    // フォルダ構造を公開（保存/削除時に利用）
    window.folderStructure = payload.structure || {};
    if(window.folderStructure){
      // 後方互換のためのエイリアス
      if(!window.folderStructure.attachmentsContacts && window.folderStructure.attachmentsContacts == null && payload.structure.attachmentsContacts){
        window.folderStructure.attachmentsContacts = payload.structure.attachmentsContacts;
      }
      if(!window.folderStructure.attachmentsMeetings && payload.structure.attachmentsMeetings){
        window.folderStructure.attachmentsMeetings = payload.structure.attachmentsMeetings;
      }
    }
    // データをグローバルに反映
    window.contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
    // meetingsは配列で保持（UIでの集計が楽）
    window.meetings = [];
    Object.keys(payload.meetingsByContact||{}).forEach(function(cid){
      (payload.meetingsByContact[cid]||[]).forEach(function(m){ window.meetings.push(m); });
    });
    if(payload.options){ window.options = payload.options; }
    window.metadata = payload.metadata || {};
    window.indexes = payload.indexes || {};

    // UI反映
    initializeMainApp();
    setStatus('データ読み込み完了 (' + window.contacts.length + '名 / ' + window.meetings.length + '件)');

    // 初期描画
    if(typeof window.renderContacts === 'function'){ window.renderContacts(); }
    if(typeof window.updateFilters === 'function'){ window.updateFilters(); }
    if(typeof window.setupMultiSelect === 'function'){ window.setupMultiSelect(); }
  }

    if(!(window.gapi && gapi.client)){ return Promise.resolve([]); }
    return gapi.client.drive.files.list({
      q: "'" + folderId + "' in parents and trashed=false",
      fields: 'files(id,name,modifiedTime,owners(displayName))',
      pageSize: limit||20,
      orderBy: 'modifiedTime desc',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    }).then(function(resp){
      return (resp.result && resp.result.files) || [];
    });
  }

  function renderDataPanel(files, folderPath){
    injectStyles();
    var host = qs('#dataPanel');
    if(!host){
      host = document.createElement('div');
      host.id = 'dataPanel';
      host.style.cssText = 'background: var(--bg-secondary); padding: 1rem; margin: 1rem; border-radius: 0.5rem; border: 1px solid var(--border-color);';
      var anchor = qs('#contactsList') || qs('.scrollable-content');
      if(anchor) anchor.insertBefore(host, anchor.firstChild);
    }
    
    var html = '<h3>保存先: <span id="driveBadge" style="color: var(--accent-color);">'+ (folderPath||'') +'</span></h3>';
    if(!files.length){
      html += '<p>このフォルダにはまだファイルがありません。</p>';
    }else{
      html += '<table style="width: 100%; border-collapse: collapse;"><thead><tr><th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">名前</th><th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">更新日時</th><th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">所有者</th></tr></thead><tbody>';
      files.forEach(function(f){
        var dt = new Date(f.modifiedTime||'').toLocaleString();
        var owner = (f.owners && f.owners[0] && f.owners[0].displayName) || '';
        html += '<tr><td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">'+escapeHtml(f.name)+'</td><td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">'+escapeHtml(dt)+'</td><td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">'+escapeHtml(owner)+'</td></tr>';
      });
      html += '</tbody></table>';
    }
    host.innerHTML = html;
    
    // 変更ボタン
    var btn = qs('#btnChangeFolder');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'btnChangeFolder';
      btn.textContent = '保存先を変更';
      btn.className = 'btn';
      btn.style.marginTop = '1rem';
      host.appendChild(btn);
      btn.addEventListener('click', function(){ 
        showFolderSelectModal(localStorage.getItem(LS_KEY_PATH)||'PlaceOn/1to1'); 
      });
    }
  }

  function injectStyles(){
    if(document.querySelector('#dataPanel-styles')) return;
    var style = document.createElement('style');
    style.id = 'dataPanel-styles';
    style.textContent = '#dataPanel table th, #dataPanel table td { border-bottom: 1px solid var(--border-color); }';
    document.head.appendChild(style);
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
  }

  
  function chooseFolderAndLoad(pathOrFalse, forceModal){
    var urlFolderId = getUrlParam('folderId');
    if(urlFolderId){
      // URL優先: 直接フォルダID指定
      localStorage.setItem(LS_KEY_ID, urlFolderId);
      localStorage.setItem(LS_KEY_PATH, '(指定ID)');
      setStatus('指定フォルダからデータを読み込み中...');
      return loadFromFolderId(urlFolderId).catch(function(err){
        console.error('URL指定フォルダの読み込みに失敗:', err);
        throw err;
      });
    }

    var savedId = localStorage.getItem(LS_KEY_ID);
    var savedPath = localStorage.getItem(LS_KEY_PATH) || 'PlaceOn/1to1';
    var p;
    if(typeof pathOrFalse === 'string' && pathOrFalse){
      p = Promise.resolve(pathOrFalse);
    }else if(forceModal || !savedId){
      return new Promise(function(resolve){
        showFolderSelectModal(savedPath);
        resolve();
      });
    }else{
      p = Promise.resolve(savedPath);
    }

    return p.then(function(path){
      if(!(window.AppData && typeof AppData.ensureFolderStructureByName === 'function')){
        throw new Error('AppData.ensureFolderStructureByName not available');
      }
      setStatus('フォルダを確認中...');
      return AppData.ensureFolderStructureByName(path).then(function(info){
        var folderId = info && (info.id || info.folderId || info.pathIds && info.pathIds[info.pathIds.length-1]);
        if(!folderId) throw new Error('フォルダIDの解決に失敗しました');
        localStorage.setItem(LS_KEY_ID, folderId);
        localStorage.setItem(LS_KEY_PATH, path);
        setStatus('サインイン済み');
        return loadFromFolderId(folderId);
      });
    }).catch(function(err){
      if(err && err.message === 'cancel'){ return; }
      console.error('フォルダ選択エラー:', err);
      setStatus('エラー: ' + (err.message||err));
      throw err;
    });
  }


  function initializeMainApp(){
    // グローバル変数の初期化
    if(typeof window.contacts === 'undefined') window.contacts = [];
    if(typeof window.meetings === 'undefined') window.meetings = [];
    if(typeof window.options === 'undefined') {
      window.options = {
        types: ['顧客候補', '顧客', '取次店・販売店', 'パートナー', 'その他'],
        affiliations: ['商工会議所', '青年会議所', 'BNI', 'その他団体'],
        industryInterests: ['IT・技術', 'コンサルティング', '製造業', '小売業', 'サービス業', 'その他'],
        statuses: ['新規', '商談中', '成約', '保留', '終了']
      };
    }
    
    // 必要な変数を初期化
    if(typeof window.currentTab === 'undefined') window.currentTab = 'contacts';
    if(typeof window.currentView === 'undefined') window.currentView = 'card';
    if(typeof window.currentSort === 'undefined') window.currentSort = 'meeting-desc';
    if(typeof window.filterValues === 'undefined') {
      window.filterValues = {
        affiliation: '',
        business: '',
        industryInterests: '',
        residence: ''
      };
    }
    if(typeof window.selectedOptions === 'undefined') {
      window.selectedOptions = {
        type: [],
        affiliation: [],
        industryInterests: []
      };
    }
    if(typeof window.multiSelectSearchQueries === 'undefined') {
      window.multiSelectSearchQueries = {
        type: '',
        affiliation: '',
        industryInterests: ''
      };
    }
    if(typeof window.referrerFilter === 'undefined') window.referrerFilter = null;
    if(typeof window.currentContactId === 'undefined') window.currentContactId = null;
    if(typeof window.currentMeetingId === 'undefined') window.currentMeetingId = null;

    // イベントリスナーの設定
    setupEventListeners();
    
    // UIの初期化
    if(typeof window.renderContacts === 'function') {
      window.renderContacts();
    }
    if(typeof window.updateFilters === 'function') {
      window.updateFilters();
    }
    if(typeof window.setupMultiSelect === 'function') {
      window.setupMultiSelect();
    }
    
    log('メインアプリ初期化完了');
  }

  function setupEventListeners(){
    // タブ切替
    qsa('.tab-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        if(typeof window.switchTab === 'function'){
          window.switchTab(this.dataset.tab);
        }
      });
    });
    
    // ビュー切替
    qsa('.view-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        if(typeof window.switchView === 'function'){
          window.switchView(this.dataset.view);
        }
      });
    });
    
    // 検索・フィルター
    var searchInput = qs('#searchInput');
    if(searchInput){
      searchInput.addEventListener('input', function(){
        if(typeof window.filterContacts === 'function'){
          window.filterContacts();
        }
      });
    }
    
    var sortSelect = qs('#sortSelect');
    if(sortSelect){
      sortSelect.addEventListener('change', function(){
        window.currentSort = this.value;
        if(typeof window.renderContacts === 'function'){
          window.renderContacts();
        }
      });
    }
    
    var typeFilter = qs('#typeFilter');
    if(typeFilter){
      typeFilter.addEventListener('change', function(){
        if(typeof window.filterContacts === 'function'){
          window.filterContacts();
        }
      });
    }
    
    // フィルター入力
    qsa('.filter-search-input').forEach(function(input){
      input.addEventListener('input', function(){
        var id = this.id;
        var value = this.value.toLowerCase();
        if(id === 'affiliationFilter'){
          window.filterValues.affiliation = value;
        } else if(id === 'businessFilter'){
          window.filterValues.business = value;
        } else if(id === 'industryInterestsFilter'){
          window.filterValues.industryInterests = value;
        } else if(id === 'residenceFilter'){
          window.filterValues.residence = value;
        }
        if(typeof window.filterContacts === 'function'){
          window.filterContacts();
        }
      });
    });
    
    // 連絡先追加ボタン
    var addContactBtn = qs('#addContactBtn');
    if(addContactBtn){
      addContactBtn.addEventListener('click', function(){
        if(typeof window.openContactModal === 'function'){
          window.openContactModal();
        }
      });
    }
    
    // エクスポート・インポート
    var exportBtn = qs('#exportBtn');
    if(exportBtn){
      exportBtn.addEventListener('click', function(){
        if(typeof window.exportToCSV === 'function'){
          window.exportToCSV();
        }
      });
    }
    
    var importBtn = qs('#importBtn');
    if(importBtn){
      importBtn.addEventListener('click', function(){
        if(typeof window.importFromCSV === 'function'){
          window.importFromCSV();
        }
      });
    }
    
    // フォルダ選択ボタン
    var selectFolderBtn = qs('#selectFolderBtn');
    if(selectFolderBtn){
      selectFolderBtn.addEventListener('click', function(){
        showFolderSelectModal();
      });
    }
  }

  function afterSignedIn(tokenResp){
    log('認証完了 - UIを更新中...');
    
    // UIの状態を更新
    showAppInterface();
    setStatus('認証済み - フォルダを設定中...');
    
    // 保存先フォルダの設定または読み込み
    chooseFolderAndLoad(false).catch(function(err){
      console.error('初期化エラー:', err);
      setStatus('初期化に失敗しました');
      // エラーが発生してもログイン状態は維持
    });
  }

  // イベントリスナー
  document.addEventListener('gis:token', function(ev){
    log('token イベントをキャッチしました');
    afterSignedIn(ev.detail);
  });
  
  document.addEventListener('gis:error', function(ev){
    console.error('認証エラー:', ev.detail);
    showSignin();
    showAuthMessage();
    setStatus('認証に失敗しました');
  });

  document.addEventListener('DOMContentLoaded', function boot(){
    log('DOM読み込み完了 - 初期化開始...');
    try{
      ensureAppData();
    }catch(e){ 
      console.error('AppData初期化エラー:', e); 
      setStatus('システム初期化エラー');
      return; 
    }
    
    if(typeof window.initializeGoogleAPI === 'function'){
      window.initializeGoogleAPI();
    }
    
    // 初期状態の設定
    setStatus('Googleでログインしてください');
    showSignin();
    showAuthMessage();
  });

  // グローバル関数のエクスポート
  window.showFolderSelectModal = showFolderSelectModal;
  
})();