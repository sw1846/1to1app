// config.example.js - 設定ファイルの例
// このファイルをconfig.jsにコピーして、実際の値を設定してください

const CONFIG = {
    // Google OAuth クライアントID
    GOOGLE_CLIENT_ID: 'YOUR-CLIENT-ID.apps.googleusercontent.com',
    
    // アプリケーション設定
    APP_NAME: '1対1ミーティング管理システム',
    APP_VERSION: '1.0.0',
    
    // Google Drive設定
    APP_FOLDER_NAME: 'PlaceOn_1to1_App',
    ATTACHMENTS_FOLDER_NAME: 'attachments',
    
    // デフォルト値
    DEFAULT_OPTIONS: {
        types: [
            'ビジネスパートナー',
            '顧客',
            '仕入先',
            '協力会社',
            'メンター',
            '友人',
            'その他'
        ],
        affiliations: [
            '東京支部',
            '大阪支部',
            '名古屋支部',
            '福岡支部',
            '札幌支部',
            'オンライン',
            'その他'
        ],
        wantToConnect: [
            'IT・テクノロジー',
            '製造業',
            'サービス業',
            '小売・流通',
            '金融・保険',
            '不動産',
            '医療・福祉',
            '教育',
            'コンサルティング',
            'その他'
        ],
        goldenEgg: [
            '紹介多数',
            'キーパーソン',
            '意思決定者',
            'インフルエンサー',
            '専門知識豊富',
            'ネットワーク広い'
        ]
    },
    
    // UI設定
    UI_CONFIG: {
        // 1ページあたりの表示件数
        ITEMS_PER_PAGE: 20,
        
        // 自動保存の間隔（ミリ秒）
        AUTO_SAVE_INTERVAL: 3000,
        
        // 通知の表示時間（ミリ秒）
        NOTIFICATION_DURATION: 3000,
        
        // ファイルサイズ制限（バイト）
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        
        // 画像の最大幅（ピクセル）
        MAX_IMAGE_WIDTH: 1920,
        
        // デバウンス時間（ミリ秒）
        DEBOUNCE_DELAY: 300
    },
    
    // ミーティングテンプレート
    DEFAULT_MEETING_TEMPLATE: `## 本日の議題

1. 近況報告
   - 

2. 相談事項
   - 

3. 情報共有
   - 

4. 次回までのアクション
   - 

## メモ
`,
    
    // 開発設定
    DEBUG: false,
    LOG_LEVEL: 'info' // 'debug', 'info', 'warn', 'error'
};

// 設定の検証
function validateConfig() {
    if (!CONFIG.GOOGLE_CLIENT_ID || CONFIG.GOOGLE_CLIENT_ID === 'YOUR-CLIENT-ID.apps.googleusercontent.com') {
        console.error('Error: Google Client IDが設定されていません。config.jsを編集してください。');
        return false;
    }
    return true;
}

// エクスポート（グローバル変数として）
window.APP_CONFIG = CONFIG;
window.validateConfig = validateConfig;