/* ===== 1to1app main.js (U5 - 修正版) =====
   - data.js(U4) のイベント 'gis:token' を受けて UI をログイン後状態へ切替
   - 「保存先フォルダ選択」モーダルを表示（初回 or 変更時）
   - 指定パス（例: PlaceOn/1to1）を ensureFolderStructureByName で作成/取得し localStorage に保存
   - フォルダ内の最新ファイルを一覧表示（初期データ読み込みの代替）
*/
(function(){
  'use strict';

  // [CLAUDE FIX ALL-IN-ONE][darkmode] ダークモード適用/永続化
  function getInitialTheme(){
    try{
      var saved = localStorage.getItem('theme');
      if(saved === 'dark' || saved === 'light') return saved;
    }catch(e){}
    try{
      if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }catch(e){}
    return 'light';
  }
  function applyTheme(theme){
    var t = (theme === 'dark') ? 'dark' : 'light';
    try{
      document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
      var iconEl = document.getElementById('themeIcon');
      if(iconEl) iconEl.textContent = (t === 'dark') ? '☀️' : '🌙';
      try{ localStorage.setItem('theme', t); }catch(e){}
      console.log('[fix][darkmode] applied theme=' + t);
    }catch(e){ console.warn('[fix][darkmode] failed to apply', e); }
  }


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
    if(mergeDataBtn){ mergeDataBtn.remove(); console.log('[fix][merge-button] removed'); }
    
    // ログインボタンを隠す
    hideSignin();
    
    // 認証メッセージを隠す
    var authMsg = qs('#authMessage'); if(authMsg) authMsg.style.display = 'none'; // fixed stray token
    // [CLAUDE FIX ALL-IN-ONE][darkmode] トグル配線
    (function(){
      var btn = document.getElementById('themeToggle');
      if(btn){
        btn.addEventListener('click', function(){
          var cur = (document.documentElement.getAttribute('data-theme')==='dark')?'dark':'light';
          applyTheme(cur==='dark'?'light':'dark');
        });
      }
    })();


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
  // 指定フォルダ直下のファイルをいくつか一覧表示（確認用）
  async function listFilesInFolder(folderId, limit){
    if(!(window.gapi && gapi.client && gapi.client.drive && gapi.client.drive.files)){
      // gapi が未初期化の場合は空配列
      return [];
    }
    var params = {
      q: "'" + folderId + "' in parents and trashed = false",
      fields: "files(id,name,mimeType,modifiedTime,owners(displayName))",
      pageSize: typeof limit === 'number' ? limit : 50,
      orderBy: "modifiedTime desc",
      spaces: "drive",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    };
    try{
      var resp = await gapi.client.drive.files.list(params);
      return (resp.result && resp.result.files) || [];
    }catch(e){
      console.warn('listFilesInFolder 失敗', e);
      return [];
    }
  }

  // 既存データ読み込みパイプライン

async function loadFromFolderId(folderId){
    // フォルダ内の最近のファイル一覧（デバッグ用）
    try{
      var files = await listFilesInFolder(folderId, 20);
      renderDataPanel(files, localStorage.getItem(LS_KEY_PATH)||'(指定ID)');
    }catch(e){ console.warn('フォルダ一覧取得に失敗', e); }

    if(!(window.AppData && typeof AppData.loadAllFromMigrated === 'function')){
      throw new Error('AppData.loadAllFromMigrated not available');
    }

    // 1) インデックスのみ先に取得して即時表示
    setStatus('インデックスを読み込み中...');
    var payload = await AppData.loadAllFromMigrated(folderId);
    var idxContacts = Array.isArray(payload && payload.contacts) ? payload.contacts : [];
    window.contacts = idxContacts;                 // まずはインデックスの素データ
    window.meetingsByContact = payload && payload.meetingsByContact ? payload.meetingsByContact : {};
    window.options = payload && payload.options ? payload.options : (window.options||{});
    window.folderStructure = payload && payload.structure ? payload.structure : null;

    // 即時描画（プログレッシブ）
    if(typeof window.renderContacts === 'function'){ window.renderContacts(); }
    setStatus('詳細データを並列で読込中...');

    // 2) 詳細データの並列・遅延読み込み（プログレッシブ更新）
    var useFast = AppData && typeof AppData.hydrateMissingFromFilesParallel === 'function';
    var hydrator = useFast ? AppData.hydrateMissingFromFilesParallel : AppData.hydrateMissingFromFiles;

    // バッチ更新（UIスレッシング抑制）
    var lastRender = 0;
    function onBatch(info){
      var now = performance.now();
      if(now - lastRender > 200){ // 200ms以上経過したら再描画
        try{ if(typeof window.renderContacts === 'function') window.renderContacts(); }catch(e){}
        lastRender = now;
      }
      try{ setStatus('詳細データ読み込み中...'); }catch(_e){}
    }

    var hydrated = await hydrator(window.folderStructure, window.contacts, window.meetingsByContact, {concurrency: 12, onBatch});
    // 最終描画
    if(typeof window.renderContacts === 'function'){ window.renderContacts(); }
    try{
      if(AppData && typeof AppData.rebuildIndexes==='function'){
        AppData.rebuildIndexes(window.folderStructure, window.contacts, window.meetingsByContact);
      }
    }catch(_e){}
    setStatus('読み込み完了');
    return hydrated;
}


  // 念のためグローバルにも公開（他モジュールから直接呼びたい場合に備える）
  window.loadFromFolderId = loadFromFolderId;

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
    
    
  // [CLAUDE FIX ALL-IN-ONE][options] 既存データからプルダウン値を再構築
  function normalizeLabel(v){
    if(!v) return '';
    var s = (''+v).trim();
    s = s.replace(/\s+/g,' ');
    try{ s = s.normalize('NFKC'); }catch(e){}
    return s;
  }
  function rebuildSelectOptions(){
    try{
      var setAff = new Set(), setBiz = new Set(), setInd = new Set(), setRes = new Set(), setType = new Set();
      var idx = (window.contacts||[]);
      idx.forEach(function(c){
        if(c.affiliation) setAff.add(normalizeLabel(c.affiliation));
        if(Array.isArray(c.businesses)) c.businesses.forEach(function(b){ setBiz.add(normalizeLabel(b)); });
        if(Array.isArray(c.industryInterests)) c.industryInterests.forEach(function(i){ setInd.add(normalizeLabel(i)); });
        if(c.residence) setRes.add(normalizeLabel(c.residence));
        if(Array.isArray(c.types)) c.types.forEach(function(t){ setType.add(normalizeLabel(t)); });
      });
      function setOptions(selectId, values){
        var el = document.getElementById(selectId);
        if(!el) return;
        var arr = Array.from(values).filter(Boolean).sort(function(a,b){ return a.localeCompare(b, 'ja'); });
        el.innerHTML = '<option value="">(すべて)</option>' + arr.map(function(v){ return '<option value="'+v+'">'+v+'</option>'; }).join('');
        console.log('[fix][options] rebuilt '+selectId+': '+arr.length);
      }
      setOptions('typeFilter', setType);
      setOptions('affiliationFilter', setAff);
      setOptions('businessFilter', setBiz);
      setOptions('industryInterestsFilter', setInd);
      setOptions('residenceFilter', setRes);
    }catch(e){ console.warn('[fix][options] rebuild failed', e); }
  }
  if(typeof rebuildSelectOptions==='function') rebuildSelectOptions();
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
    try{ initializeMainApp(); }catch(e){}
    
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

    try{ applyTheme(getInitialTheme()); }catch(e){}

      ensureAppData();
    }catch(e){ 
      console.error('AppData初期化エラー:', e); 
      setStatus('システム初期化エラー');
      return; 
    }
    
    // UIとグローバル状態の初期化（ビュー/フィルタ等）
    try{ initializeMainApp(); }catch(e){ console.warn('initializeMainApp で警告:', e); }
    
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
  
  // サインイン（GIS起動）
  window.handleAuthClick = function(){
    try{
      if(window.AppData && typeof AppData.signin === 'function'){
        return AppData.signin();
      }
    }catch(e){}
    console.error('AppData.signin が見つかりません。data.jsの読み込みをご確認ください。');
    alert('サインインの初期化に失敗しました。ページを再読み込みしてお試しください。');
  };

})();

  // サインアウト（簡易） - トークン無効化してリロード
  window.handleSignoutClick = function(){
    try{
      if(window.google && google.accounts && google.accounts.oauth2){
        var t = gapi && gapi.client && gapi.client.getToken && gapi.client.getToken();
        var at = t && t.access_token;
        if(at){ google.accounts.oauth2.revoke(at, function(){ /* noop */ }); }
      }
      if(gapi && gapi.client){ gapi.client.setToken(''); }
    }catch(e){ console.warn('signout cleanup warn', e); }
    try{ localStorage.clear(); sessionStorage.clear(); }catch(_){}
    location.reload();
  };

// ====== DnD inputs for photo, business card, attachments ======
function initDnDInputs(){
  function wire(zoneId, accept, multiple, onFiles){
    var zone = document.getElementById(zoneId);
    if(!zone) return;
    var input = document.createElement('input');
    input.type = 'file'; input.accept = accept || ''; input.multiple = !!multiple; input.style.display = 'none';
    zone.tabIndex = 0;
    zone.addEventListener('click', function(){ input.click(); });
    zone.addEventListener('dragover', function(e){ e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', function(e){ zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', function(e){
      e.preventDefault(); zone.classList.remove('drag-over');
      var files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
      onFiles(files);
    });
    input.addEventListener('change', function(e){
      var files = Array.from(input.files || []);
      onFiles(files);
      input.value = '';
    });
    zone.parentElement && zone.parentElement.appendChild(input);
  }

  function readAsDataURL(file){ return new Promise(function(res, rej){ var r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }

  wire('photoDropZone', 'image/*', false, async function(files){
    if(!files.length) return;
    var url = await readAsDataURL(files[0]);
    var prev = document.getElementById('photoPreview');
    var cont = document.getElementById('photoPreviewContainer');
    if(prev){ prev.src = url; }
    if(cont){ cont.style.display = 'block'; }
  });

  wire('businessCardDropZone', 'image/*,application/pdf', false, async function(files){
    if(!files.length) return;
    var url = await readAsDataURL(files[0]);
    var prev = document.getElementById('businessCardPreview');
    var cont = document.getElementById('businessCardPreviewContainer');
    if(prev){ prev.src = url; }
    if(cont){ cont.style.display = 'block'; }
  });

  wire('attachmentDropZone', '', true, async function(files){
    var list = document.getElementById('attachmentList');
    if(!list) return;
    for(const f of files){
      var url = await readAsDataURL(f);
      var div = document.createElement('div');
      div.className = 'file-item';
      div.dataset.fileName = f.name;
      div.dataset.fileData = url;
      div.dataset.fileType = f.type || '';
      div.innerHTML = '📎 <span>' + (f.name || 'file') + '</span> <button class="btn btn-icon" onclick="this.parentElement.remove()">✕</button>';
      list.appendChild(div);
    }
  });
}
document.addEventListener('DOMContentLoaded', function(){
  try{ initDnDInputs(); }catch(e){ console.warn('initDnDInputs error', e); }
});