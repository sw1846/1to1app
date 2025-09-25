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

  // ========== UI: 保存先フォルダ選択モーダル ==========
  function injectStyles(){
    if (qs('#app-modal-style')) return;
    var css = `#appModalOverlay{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999}
#appModal{background:#fff;min-width:320px;max-width:520px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);overflow:hidden}
#appModal header{padding:14px 16px;font-weight:700;border-bottom:1px solid #eee}
#appModal main{padding:16px}
#appModal footer{padding:12px 16px;border-top:1px solid #eee;display:flex;gap:10px;justify-content:flex-end}
#appModal input[type=text]{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font:14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
#appModal button{padding:10px 14px;border-radius:8px;border:1px solid #0a66c2;background:#0a66c2;color:#fff;cursor:pointer}
#appModal button.secondary{background:#fff;color:#333;border-color:#ccc}
#dataPanel{margin:12px 0;padding:8px 12px;border:1px solid #eee;border-radius:10px;background:#fafafa}
#dataPanel h3{margin:4px 0 8px;font-size:15px}
#dataPanel table{width:100%;border-collapse:collapse}
#dataPanel th,#dataPanel td{border-bottom:1px solid #eee;padding:6px 8px;text-align:left;font-size:13px}
#driveBadge{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#eef4ff;color:#0a55aa;font-size:12px}`;
    var s = document.createElement('style');
    s.id = 'app-modal-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function createModal(defaultPath){
    injectStyles();
    var overlay = document.createElement('div');
    overlay.id = 'appModalOverlay';
    overlay.innerHTML = '<div id="appModal">\
<header>保存先フォルダを選択</header>\
<main>\
  <p>ドライブ上のフォルダパスを指定してください。存在しない場合は作成します。</p>\
  <label>フォルダパス</label>\
  <input id="folderPathInput" type="text" value="'+ (defaultPath||'PlaceOn/1to1').replace(/"/g,'&quot;') +'" />\
</main>\
<footer>\
  <button class="secondary" id="btnCancel">キャンセル</button>\
  <button id="btnOk">決定</button>\
</footer>\
</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function openFolderModal(defaultPath){
    return new Promise(function(resolve, reject){
      var overlay = createModal(defaultPath);
      var inp = overlay.querySelector('#folderPathInput');
      overlay.querySelector('#btnCancel').addEventListener('click', function(){ close(); reject(new Error('cancel')); });
      overlay.querySelector('#btnOk').addEventListener('click', function(){
        var path = (inp.value||'').trim().replace(/^\/*|\/*$/g,'');
        if(!path){ inp.focus(); return; }
        close(); resolve(path);
      });
      function close(){ overlay.remove(); }
    });
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
      btn.addEventListener('click', function(){
        chooseFolderAndLoad(true);
      });
    }
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; });
  }

  function chooseFolderAndLoad(forceModal){
    var savedId = localStorage.getItem(LS_KEY_ID);
    var savedPath = localStorage.getItem(LS_KEY_PATH) || 'PlaceOn/1to1';
    var p = Promise.resolve(savedPath);
    if(forceModal || !savedId){
      p = openFolderModal(savedPath);
    }
    return p.then(function(path){
      // 決定したパスでフォルダの存在確認/作成
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