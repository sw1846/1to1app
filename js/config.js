/* ===== config.js - アプリケーション設定 ===== */

// Google API設定
window.APP_CONFIG = {
    // Google Cloud Console で取得したAPIキー
    API_KEY: 'YOUR_API_KEY_HERE',
    
    // Google Cloud Console で取得したクライアントID
    CLIENT_ID: 'YOUR_CLIENT_ID_HERE',
    
    // [CLAUDE FIX ALL-IN-ONE][upsert] 書き込み権限を含むスコープ
    SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
    
    // デフォルトフォルダ名
    DEFAULT_FOLDER_NAME: '1to1meeting_migrated',
    
    // アプリケーション情報
    APP_NAME: '1対1ミーティング管理システム',
    VERSION: '2025-09-25U-FIXED',
    
    // UI設定
    UI_SETTINGS: {
        DEFAULT_THEME: 'dark',
        ITEMS_PER_PAGE: 50,
        AUTO_SAVE_INTERVAL: 30000, // 30秒
        IMAGE_MAX_SIZE: 800, // 画像の最大サイズ（px）
        IMAGE_QUALITY: 0.8,   // 画像圧縮品質（0-1）
        DEBOUNCE_DELAY: 200   // フィルター・検索のデバウンス時間（ms）
    },
    
    // [CLAUDE FIX ALL-IN-ONE][options] フィルター初期設定
    DEFAULT_FILTERS: {
        types: ['顧客候補', '顧客', '取次店・販売店', 'パートナー', 'その他'],
        affiliations: [],
        businesses: [],
        residences: [],
        sortOptions: [
            {value: 'name', label: '名前順'},
            {value: 'furigana', label: 'ふりがな順'},
            {value: 'company', label: '会社順'},
            {value: 'lastMeeting', label: '最新ミーティング順'}
        ]
    },
    
    // [CLAUDE FIX ALL-IN-ONE][avatar] 画像関連設定
    IMAGE_SETTINGS: {
        AVATAR_SIZE: '100x100',
        BUSINESS_CARD_SIZE: '400x300',
        LAZY_LOADING: true,
        FALLBACK_INITIALS: true,
        CACHE_DURATION: 3600000 // 1時間（ms）
    },
    
    // デバッグ設定
    DEBUG: {
        ENABLE_CONSOLE_LOG: true,
        ENABLE_ERROR_TRACKING: true,
        LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
        PERFORMANCE_MONITORING: false
    }
};

// 環境別設定の適用
(function() {
    try {
        // 本番環境の場合の設定調整
        if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            window.APP_CONFIG.DEBUG.ENABLE_CONSOLE_LOG = false;
            window.APP_CONFIG.DEBUG.LOG_LEVEL = 'error';
            window.APP_CONFIG.DEBUG.PERFORMANCE_MONITORING = false;
        }
        
        // ローカルストレージから設定を読み込み
        const savedConfig = localStorage.getItem('app_config');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                
                // 安全な設定のみマージ
                if (config.DEFAULT_FOLDER_NAME) {
                    window.APP_CONFIG.DEFAULT_FOLDER_NAME = config.DEFAULT_FOLDER_NAME;
                }
                if (config.UI_SETTINGS) {
                    Object.assign(window.APP_CONFIG.UI_SETTINGS, config.UI_SETTINGS);
                }
                if (config.DEFAULT_FILTERS && config.DEFAULT_FILTERS.types) {
                    window.APP_CONFIG.DEFAULT_FILTERS.types = config.DEFAULT_FILTERS.types;
                }
                
            } catch (e) {
                console.warn('[config] 保存された設定の読み込みに失敗:', e);
            }
        }
        
    } catch (e) {
        console.error('[config] 設定の初期化に失敗:', e);
    }
})();

// 設定保存関数
window.saveAppConfig = function(updates) {
    try {
        const currentConfig = JSON.parse(localStorage.getItem('app_config') || '{}');
        const newConfig = Object.assign(currentConfig, updates);
        localStorage.setItem('app_config', JSON.stringify(newConfig));
        
        // UI設定の場合は即座に反映
        if (updates.UI_SETTINGS) {
            Object.assign(window.APP_CONFIG.UI_SETTINGS, updates.UI_SETTINGS);
        }
        if (updates.DEFAULT_FOLDER_NAME) {
            window.APP_CONFIG.DEFAULT_FOLDER_NAME = updates.DEFAULT_FOLDER_NAME;
        }
        if (updates.DEFAULT_FILTERS) {
            Object.assign(window.APP_CONFIG.DEFAULT_FILTERS, updates.DEFAULT_FILTERS);
        }
        
        console.log('[config] 設定を保存しました:', updates);
    } catch (e) {
        console.error('[config] 設定の保存に失敗:', e);
    }
};

// 設定リセット関数
window.resetAppConfig = function() {
    try {
        localStorage.removeItem('app_config');
        location.reload();
    } catch (e) {
        console.error('[config] 設定のリセットに失敗:', e);
    }
};

// ログ関数（設定に基づく）
window.configLog = function() {
    if (window.APP_CONFIG.DEBUG.ENABLE_CONSOLE_LOG) {
        try {
            console.log.apply(console, ['[config]'].concat([].slice.call(arguments)));
        } catch (e) {}
    }
};

// [CLAUDE FIX ALL-IN-ONE][options] 初期オプション設定
window.initializeDefaultOptions = function() {
    try {
        if (!window.options) {
            window.options = {};
        }
        
        // デフォルト値を設定（既存の値は保持）
        Object.keys(window.APP_CONFIG.DEFAULT_FILTERS).forEach(key => {
            if (key !== 'sortOptions' && !window.options[key]) {
                window.options[key] = [...(window.APP_CONFIG.DEFAULT_FILTERS[key] || [])];
            }
        });
        
        console.log('[config] 初期オプションを設定しました');
    } catch (e) {
        console.error('[config] 初期オプション設定エラー:', e);
    }
};

// 設定検証
(function validateConfig() {
    try {
        const required = ['API_KEY', 'CLIENT_ID'];
        const missing = required.filter(key => 
            !window.APP_CONFIG[key] || window.APP_CONFIG[key] === 'YOUR_' + key + '_HERE'
        );
        
        if (missing.length > 0) {
            console.warn('[config] 未設定の必須項目があります:', missing);
            console.warn('[config] Google Cloud Console で API キーとクライアント ID を取得し、config.js を更新してください');
            
            // 設定不備を通知
            setTimeout(() => {
                if (window.showNotification) {
                    window.showNotification('Google API設定が不完全です。config.jsファイルを確認してください。', 'warning');
                }
            }, 2000);
        }
        
        // [CLAUDE FIX ALL-IN-ONE][upsert] スコープの検証
        if (!window.APP_CONFIG.SCOPES.includes('drive.file')) {
            console.warn('[config] 書き込み権限 (drive.file) が設定されていません');
        }
        
        // フォルダ名の検証
        if (!window.APP_CONFIG.DEFAULT_FOLDER_NAME) {
            console.warn('[config] DEFAULT_FOLDER_NAME が設定されていません');
        }
        
    } catch (e) {
        console.error('[config] 設定検証エラー:', e);
    }
})();

// パフォーマンス監視（オプション）
if (window.APP_CONFIG.DEBUG.PERFORMANCE_MONITORING) {
    window.addEventListener('load', function() {
        setTimeout(() => {
            if (window.performance && window.performance.timing) {
                const timing = window.performance.timing;
                const loadTime = timing.loadEventEnd - timing.navigationStart;
                console.log('[config] ページ読み込み時間:', loadTime + 'ms');
            }
        }, 100);
    });
}

// エラートラッキング（オプション）
if (window.APP_CONFIG.DEBUG.ENABLE_ERROR_TRACKING) {
    window.addEventListener('error', function(event) {
        console.error('[config] グローバルエラー:', {
            message: event.message,
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            error: event.error
        });
    });
    
    window.addEventListener('unhandledrejection', function(event) {
        console.error('[config] 未処理のPromise拒否:', event.reason);
    });
}