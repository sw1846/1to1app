# 1対1ミーティング管理システム

Google Drive上にデータを保存する、ブラウザベースの1対1ミーティング管理システムです。

## 機能

- 📇 連絡先管理（顔写真、名刺画像、添付ファイル対応）
- 🗓️ ミーティング記録（ToDoリスト、テンプレート機能付き）
- 🔍 検索・フィルター機能
- 📊 カード/リスト表示切替
- 💾 Google Drive自動保存
- 📥 データインポート/エクスポート
- 🌙 ダークモードUI
- 📱 レスポンシブ対応

## セットアップ手順

### 1. Google Cloud Console設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. 「APIとサービス」→「有効なAPI」から以下を有効化：
   - Google Drive API
   - Google Identity Service

### 2. OAuth2.0クライアントID作成

1. 「APIとサービス」→「認証情報」を開く
2. 「認証情報を作成」→「OAuth クライアント ID」を選択
3. アプリケーションの種類：「ウェブアプリケーション」を選択
4. 承認済みのJavaScript生成元に以下を追加：
   ```
   http://localhost
   http://localhost:8000
   https://YOUR-GITHUB-USERNAME.github.io
   ```
5. クライアントIDをコピー

### 3. コード設定

1. `js/auth.js`の`CLIENT_ID`を取得したクライアントIDに置き換え：
   ```javascript
   const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // ここを変更
   ```

### 4. デプロイ

#### GitHub Pages の場合：
1. GitHubリポジトリを作成
2. すべてのファイルをアップロード：
   ```
   your-repository/
   ├── index.html
   ├── js/
   │   ├── app.js
   │   ├── auth.js
   │   ├── contacts.js
   │   ├── drive.js
   │   ├── meetings.js
   │   ├── ui.js
   │   └── utils.js
   └── README.md
   ```
3. Settings → Pages → Source を「Deploy from a branch」に設定
4. Branch を main、フォルダを / (root) に設定

#### ローカル開発の場合：
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server -p 8000

# ブラウザで http://localhost:8000 にアクセス
```

## 使い方

### 初回ログイン
1. 「Googleでログイン」ボタンをクリック
2. Googleアカウントを選択
3. 権限を承認（Google Drive のアプリデータへのアクセス）

### 連絡先管理
- **新規追加**：「新規連絡先」ボタンから登録
- **編集**：連絡先カードをクリック→「編集」
- **削除**：詳細画面から「削除」
- **検索**：上部の検索ボックスで名前・会社名検索
- **フィルター**：種別・所属でフィルタリング

### ミーティング記録
1. 連絡先詳細画面を開く
2. 「新規ミーティング」ボタンをクリック
3. 日時・内容・ToDoを入力
4. テンプレート活用で効率的に記録

### データ管理
- **エクスポート**：全データをJSON形式でダウンロード
- **インポート**：JSONファイルから一括登録
- **自動保存**：3秒後に自動でGoogle Driveに保存

## ショートカットキー

- `Ctrl + S`：手動保存
- `Ctrl + N`：新規連絡先
- `Ctrl + F`：検索フォーカス
- `Ctrl + E`：エクスポート
- `Esc`：モーダルを閉じる

## データ構造

### contacts.json
```json
{
  "id": "uuid",
  "name": "氏名",
  "yomi": "ふりがな",
  "company": "会社名",
  "email": "メールアドレス",
  "types": ["種別1", "種別2"],
  "photo": { "id": "fileId", "name": "filename" },
  "attachments": []
}
```

### meetings.json
```json
{
  "id": "uuid",
  "contactId": "連絡先ID",
  "datetime": "2024-01-01T10:00:00Z",
  "content": "ミーティング内容",
  "todos": [{
    "id": "uuid",
    "text": "ToDo内容",
    "completed": false,
    "due": "2024-01-10T00:00:00Z"
  }]
}
```

## トラブルシューティング

### ログインできない
- CLIENT_IDが正しく設定されているか確認
- 承認済みのJavaScript生成元にアクセス元URLが含まれているか確認

### データが保存されない
- Google Drive APIが有効になっているか確認
- ブラウザのコンソールでエラーを確認
- オフライン状態でないか確認

### 画像が表示されない
- ファイルサイズが大きすぎないか確認（推奨：2MB以下）
- 画像形式がサポートされているか確認（JPEG, PNG, GIF, WebP）

## セキュリティ

- データはユーザーのGoogle Drive appDataFolderに保存
- 他のユーザーからはアクセス不可
- OAuth2.0による安全な認証
- XSS対策済み（HTMLエスケープ処理）

## ブラウザ対応

- Chrome (推奨)
- Firefox
- Safari
- Edge

※ Internet Explorer は非対応

## ライセンス

MIT License

## 開発者向け

### デバッグモード
`Ctrl + Shift + D` でデバッグモード切替

デバッグモードでは以下のコマンドが使用可能：
```javascript
debug.showData()        // データ確認
debug.checkStorage()    // ストレージ使用量
debug.clearCache()      // キャッシュクリア
debug.generateTestData(20)  // テストデータ生成
```

### カスタマイズ
- スタイルは`index.html`内の`<style>`タグで調整
- 配色は CSS変数（`:root`）で一括変更可能