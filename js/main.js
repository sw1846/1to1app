/* main.js — アプリ初期化とイベント配線 + GAPI/GIS 初期化 */
(function (global) {

  async function boot() {
    console.log('[main] DOM読み込み完了 - 初期化開始...');

    UI.init();

    AppData.on('token', () => {
      console.log('[main] token イベントをキャッチしました');
      onSignedIn();
    });

    // 以前保存した rootFolderId を復元
    const savedRoot = localStorage.getItem('mm_rootFolderId');
    if (savedRoot) {
      await AppData.initRootFolder(savedRoot);
    }

    // ルート選択直後の再ロード
    document.addEventListener('mm:rootSelected', async () => {
      const tk = gapi.client.getToken();
      if (tk && tk.access_token) {
        await onSignedIn();
      }
    });

    console.log('[main] メインアプリ初期化完了');
  }

  async function onSignedIn() {
    try {
      if (!AppData.state.rootFolderId) {
        // 未選択ならフォルダ選択を促す
        UI.renderContacts([]);
        const detail = document.getElementById('contact-detail');
        detail.innerHTML = '<div class="empty">まず「保存先を選択」からデータフォルダを指定してください。</div>';
        return;
      }
      console.log('[main] 認証完了 - UIを更新中...');
      const { contactsIdx } = await AppData.loadIndexes();
      const contacts = AppData.getContactsFromIndex();
      console.log('[main] contacts in payload:', contacts.length);
      UI.renderContacts(contacts);
      if (contacts.length) setTimeout(() => UI.onSelectContact(contacts[0].id), 0);
    } catch (e) {
      console.error(e);
    }
  }

  // 認証ボタン（グローバル公開）
  global.handleAuthClick = async function () {
    await AppData.signin();
  };

  // ===== gapi / GIS 初期化 =====
  global.initializeGoogleAPI = async function () {
    try {
      console.log('[main] [progress] gapi:init:start');
      await new Promise((resolve) => gapi.load('client', resolve));
      await gapi.client.load('drive', 'v3');
      console.log('[main] [progress] gapi:init:ok');
      console.log('[data] Google API初期化完了');
    } catch (e) {
      console.error('[gapi] init failed', e);
    }
  };

  global.initializeGIS = function () {
    console.log('[data] GIS スクリプト読込完了');
    console.log('[data] GIS 初期化完了');
  };

  document.addEventListener('DOMContentLoaded', boot);
})(window);
