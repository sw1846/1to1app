// == 1to1app OAuth 設定（U版 必須・Drive作成対応）==
window.APP_CONFIG = window.APP_CONFIG || {};
window.APP_CONFIG.GOOGLE_CLIENT_ID = window.APP_CONFIG.GOOGLE_CLIENT_ID || "938239904261-vt7rego8tmo4vhhcjp3fadca25asuh73.apps.googleusercontent.com";
// 既存の設定に追記（重複を避けて正規化）
(function(){
  var base = (window.APP_CONFIG.SCOPES || "https://www.googleapis.com/auth/drive.metadata.readonly").replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();
  var need = "https://www.googleapis.com/auth/drive.file";
  if(base.split(' ').indexOf(need) < 0){ base = (base + " " + need).trim(); }
  window.APP_CONFIG.SCOPES = base;
})();