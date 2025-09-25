// == 1to1app OAuth 設定（U版 必須・Drive作成対応）==
// このファイルを 1to1app/js/config.js に配置してください。
window.APP_CONFIG = {
  GOOGLE_CLIENT_ID: "938239904261-vt7rego8tmo4vhhcjp3fadca25asuh73.apps.googleusercontent.com",
  // フォルダ作成が必要なため drive.file を追加（同意画面のスコープにも追加してください）
  SCOPES: "https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/drive.file"
};
