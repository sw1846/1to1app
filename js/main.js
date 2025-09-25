/* ===== 1to1app main.js (U5) =====
   - data.js(U4) のイベント 'gis:token' を受けて UI をログイン後状態へ切替
   - 「保存先フォルダ選択」モーダルを表示（初回 or 変更時）
   - 指定パス（例: PlaceOn/1to1）を ensureFolderStructureByName で作成/取得し localStorage に保存
   - フォルダ内の最新ファイルを一覧表示（初期データ読み込みの代替）
*/
(function(){
  'use strict';
  function log(){ console.log.apply(console, ['[main]'].concat([].slice.call(arguments))); }
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function setStatus(t){ var el=qs('#statusText'); if(el) el.textContent=t; }

  var LS_KEY_ID   = 'app.driveFolderId';
  var LS_KEY_PATH = 'app.driveFolderPath';

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
      +     '<button class="btn btn-icon" onclick="closeModal(\\'folderModal\\')">✕</button>'
      +   '</div>'
      +   '<div class="modal-body">'
      +     '<p>Googleドライブ上の保存先フォルダの <b>パス</b> を「/」区切りで指定してください。存在しない場合は作成します。</p>'
      +     '<input type="text" id="folderPathInput" class="input" placeholder="例: PlaceOn/1to1" />'
      +     '<p style="font-size:12px;color:var(--text-muted)">例: <code>PlaceOn/1to1</code>（先頭/末尾のスラッシュは不要）</p>'
      +   '</div>'
      +   '<div class="modal-footer">'
      +     '<button class="btn" onclick="closeModal(\\'folderModal\\')">キャンセル</button>'
      +     '<button class="btn btn-primary" id="folderOkBtn">決定</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(modal);
    // 初期値
    var inp = modal.querySelector('#folderPathInput');
    inp.value = (defaultPath || localStorage.getItem(LS_KEY_PATH) || 'PlaceOn/1to1');
    // 表示（デザイン側の .modal は display:none; -> active で表示）
    if(typeof window.showModal === 'function'){ try{ window.showModal('folderModal'); }catch(e){} }
    modal.classList.add('active');
    // 決定
    modal.querySelector('#folderOkBtn').addEventListener('click', function(){
      var path = (inp.value||'').trim().replace(/^\\/+|\\/+$/g,'');
      if(!path){ inp.focus(); return; }
      chooseFolderAndLoad(path, /*forceModalUsed*/true).then(function(){ closeModal('folderModal'); });
    });
    // Enter で決定
    inp.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ modal.querySelector('#folderOkBtn').click(); } });
  }

  // ========== Drive 読み込み（簡易） ==========
  function listFilesInFolder(folderId, limit){
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
      var anchor = qs('#appRoot') || qs('main') || qs('body');
      anchor.insertBefore(host, anchor.firstChild);
    }
    var html = '<h3>保存先: <span id="driveBadge">'+ (folderPath||'') +'</span></h3>';
    if(!files.length){
      html += '<p>このフォルダにはまだファイルがありません。</p>';
    }else{
      html += '<table><thead><tr><th>名前</th><th>更新日時</th><th>所有者</th></tr></thead><tbody>';
      files.forEach(function(f){
        var dt = new Date(f.modifiedTime||'').toLocaleString();
        var owner = (f.owners && f.owners[0] && f.owners[0].displayName) || '';
        html += '<tr><td>'+escapeHtml(f.name)+'</td><td>'+escapeHtml(dt)+'</td><td>'+escapeHtml(owner)+'</td></tr>';
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
      btn.className = 'secondary';
      host.appendChild(btn);
      btn.addEventListener('click', function(){ showFolderSelectModal(localStorage.getItem(LS_KEY_PATH)||'PlaceOn/1to1'); });
    }
  }


  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
  }

  
  function chooseFolderAndLoad(pathOrFalse, forceModal){
    var savedId = localStorage.getItem(LS_KEY_ID);
    var savedPath = localStorage.getItem(LS_KEY_PATH) || 'PlaceOn/1to1';
    var p;
    if(typeof pathOrFalse === 'string' && pathOrFalse){
      p = Promise.resolve(pathOrFalse);
    }else if(forceModal || !savedId){
      return new Promise(function(resolve){ showFolderSelectModal(savedPath); resolve(); });
    }else{
      p = Promise.resolve(savedPath);
    }
    return p.then(function(path){
      if(!(window.AppData && typeof AppData.ensureFolderStructureByName === 'function')){
        throw new Error('AppData.ensureFolderStructureByName not available');
      }
      return AppData.ensureFolderStructureByName(path).then(function(info){
        var folderId = info && (info.id || info.folderId || info.pathIds && info.pathIds[info.pathIds.length-1]);
        if(!folderId) throw new Error('フォルダIDの解決に失敗しました');
        localStorage.setItem(LS_KEY_ID, folderId);
        localStorage.setItem(LS_KEY_PATH, path);
        setStatus('サインイン済み');
        return listFilesInFolder(folderId, 20).then(function(files){
          renderDataPanel(files, path);
        });
      });
    }).catch(function(err){
      if(err && err.message === 'cancel'){ return; }
      console.error(err);
      alert('保存先の設定または読み込みに失敗しました: ' + (err.message||err));
    });
  }


  function afterSignedIn(tokenResp){
    hideSignin();
    setStatus('サインイン済み');
    // 初回は保存先を決める（既に決まっていればそのまま読み込み）
    chooseFolderAndLoad(false);
  }

  document.addEventListener('gis:token', function(ev){
    log('token captured');
    afterSignedIn(ev.detail);
  });
  document.addEventListener('gis:error', function(ev){
    console.error(ev.detail);
    showSignin();
  });

  document.addEventListener('DOMContentLoaded', function boot(){
    log('DOM読み込み完了 - 初期化開始...');
    try{
      ensureAppData();
    }catch(e){ console.error(e); return; }
    if(typeof window.initializeGoogleAPI === 'function'){
      window.initializeGoogleAPI();
    }
  });
})();