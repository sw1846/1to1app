// app.js - メインアプリケーション

// グローバル変数初期化
window._contacts = [];
window._meetings = [];
window.contacts = [];
window.meetings = [];
window.options = {
    types: [],
    affiliations: [],
    wantToConnect: [],
    goldenEgg: []
};

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('1対1ミーティング管理システム 初期化中...');
    
    // エラーハンドリング設定
    setupGlobalErrorHandling();
    
    // オフライン検出
    setupOfflineDetection();
    
    // 自動保存設定
    setupAutoSave();
    
    // パフォーマンス監視
    setupPerformanceMonitoring();
});

// グローバルエラーハンドリング
function setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        
        // ユーザーに通知
        if (event.error.message.includes('Failed to fetch')) {
            utils.showNotification('ネットワークエラーが発生しました', 'error');
        } else if (event.error.message.includes('quota')) {
            utils.showNotification('ストレージ容量が不足しています', 'error');
        }
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        
        // 認証エラーの場合は再ログインを促す
        if (event.reason && event.reason.message && event.reason.message.includes('401')) {
            utils.showNotification('認証の有効期限が切れました。再度ログインしてください。', 'error');
            setTimeout(() => {
                auth.refreshToken();
            }, 2000);
        }
    });
}

// オフライン検出
function setupOfflineDetection() {
    let isOnline = navigator.onLine;
    
    window.addEventListener('online', () => {
        if (!isOnline) {
            isOnline = true;
            utils.showNotification('オンラインに復帰しました', 'success');
            
            // 保留中の変更を同期
            syncPendingChanges();
        }
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        utils.showNotification('オフラインです。変更は後で同期されます。', 'warning');
    });
    
    // 定期的な接続チェック
    setInterval(() => {
        if (navigator.onLine && !isOnline) {
            window.dispatchEvent(new Event('online'));
        } else if (!navigator.onLine && isOnline) {
            window.dispatchEvent(new Event('offline'));
        }
    }, 5000);
}

// 自動保存設定
function setupAutoSave() {
    let pendingChanges = false;
    let autoSaveTimer = null;
    
    // データ変更を検知
    const originalPush = Array.prototype.push;
    const originalSplice = Array.prototype.splice;
    
    ['contacts', 'meetings'].forEach(dataType => {
        Object.defineProperty(window, dataType, {
            get() {
                return this[`_${dataType}`] || [];
            },
            set(value) {
                this[`_${dataType}`] = value;
                markAsChanged();
            }
        });
    });
    
    function markAsChanged() {
        pendingChanges = true;
        
        // 既存のタイマーをクリア
        if (autoSaveTimer) {
            clearTimeout(autoSaveTimer);
        }
        
        // 3秒後に自動保存
        autoSaveTimer = setTimeout(() => {
            if (pendingChanges && navigator.onLine) {
                autoSave();
            }
        }, 3000);
    }
    
    async function autoSave() {
        try {
            await drive.saveData();
            pendingChanges = false;
            console.log('Auto-saved at', new Date().toLocaleTimeString());
        } catch (error) {
            console.error('Auto-save failed:', error);
            // 次回オンライン時に再試行するためフラグは残す
        }
    }
    
    // ページ離脱時の保存
    window.addEventListener('beforeunload', (e) => {
        if (pendingChanges) {
            e.preventDefault();
            e.returnValue = '保存されていない変更があります。本当にページを離れますか？';
        }
    });
}

// 保留中の変更を同期
async function syncPendingChanges() {
    try {
        utils.showLoading();
        
        // ローカルストレージから保留中の変更を取得
        const pendingData = sessionStorage.getItem('pendingChanges');
        if (pendingData) {
            const changes = JSON.parse(pendingData);
            
            // 変更を適用
            if (changes.contacts) window.contacts = changes.contacts;
            if (changes.meetings) window.meetings = changes.meetings;
            if (changes.options) window.options = changes.options;
            
            // Drive に保存
            await drive.saveData();
            
            // 保留データをクリア
            sessionStorage.removeItem('pendingChanges');
            
            utils.showNotification('保留中の変更を同期しました', 'success');
        }
    } catch (error) {
        console.error('Sync failed:', error);
        utils.showNotification('同期に失敗しました', 'error');
    } finally {
        utils.hideLoading();
    }
}

// パフォーマンス監視
function setupPerformanceMonitoring() {
    // メモリ使用量の監視（Chrome限定）
    if (performance.memory) {
        setInterval(() => {
            const usedMemory = performance.memory.usedJSHeapSize;
            const totalMemory = performance.memory.totalJSHeapSize;
            const percentage = (usedMemory / totalMemory) * 100;
            
            if (percentage > 90) {
                console.warn('High memory usage:', percentage.toFixed(2) + '%');
                
                // メモリ最適化
                optimizeMemory();
            }
        }, 30000); // 30秒ごと
    }
    
    // レンダリングパフォーマンス
    let renderCount = 0;
    const originalRender = ui.renderContacts;
    ui.renderContacts = function() {
        const startTime = performance.now();
        originalRender.apply(this, arguments);
        const endTime = performance.now();
        
        renderCount++;
        console.debug(`Render #${renderCount} took ${(endTime - startTime).toFixed(2)}ms`);
        
        if (endTime - startTime > 100) {
            console.warn('Slow render detected');
        }
    };
}

// メモリ最適化
function optimizeMemory() {
    // 画像キャッシュのクリア
    const images = document.querySelectorAll('img[src^="data:"]');
    images.forEach(img => {
        if (!img.closest('.modal')) {
            img.src = '';
        }
    });
    
    // 未使用のドラフトをクリア
    const draftKeys = Object.keys(sessionStorage).filter(key => key.startsWith('draft_'));
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    draftKeys.forEach(key => {
        try {
            const draft = JSON.parse(sessionStorage.getItem(key));
            if (draft.timestamp && draft.timestamp < oneHourAgo) {
                sessionStorage.removeItem(key);
            }
        } catch (e) {
            sessionStorage.removeItem(key);
        }
    });
}

// デバッグモード
const DEBUG_MODE = localStorage.getItem('debug') === 'true';

if (DEBUG_MODE) {
    console.log('Debug mode enabled');
    
    // デバッグ用のグローバル関数
    window.debug = {
        // データ確認
        showData: () => {
            console.log('Contacts:', window.contacts);
            console.log('Meetings:', window.meetings);
            console.log('Options:', window.options);
        },
        
        // ストレージ使用量
        checkStorage: async () => {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                console.log('Storage usage:', {
                    usage: utils.formatFileSize(estimate.usage),
                    quota: utils.formatFileSize(estimate.quota),
                    percentage: ((estimate.usage / estimate.quota) * 100).toFixed(2) + '%'
                });
            }
        },
        
        // キャッシュクリア
        clearCache: () => {
            sessionStorage.clear();
            if (confirm('ローカルストレージもクリアしますか？')) {
                localStorage.clear();
            }
            location.reload();
        },
        
        // テストデータ生成
        generateTestData: (count = 10) => {
            const firstNames = ['田中', '鈴木', '佐藤', '山田', '伊藤', '渡辺', '中村', '小林', '加藤', '吉田'];
            const lastNames = ['太郎', '花子', '一郎', '美咲', '健太', '優子', '翔太', '愛', '大輝', '結衣'];
            const companies = ['株式会社ABC', 'XYZ商事', 'テクノロジー株式会社', 'グローバル企業', 'スタートアップ社'];
            const types = ['顧客', 'パートナー', '仕入先', '協力会社', 'その他'];
            
            for (let i = 0; i < count; i++) {
                const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
                const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
                
                window.contacts.push({
                    id: utils.generateUUID(),
                    name: `${firstName} ${lastName}`,
                    yomi: `てすと ${i}`,
                    company: companies[Math.floor(Math.random() * companies.length)],
                    email: `test${i}@example.com`,
                    phone: `090-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
                    types: [types[Math.floor(Math.random() * types.length)]],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
            
            drive.saveData();
            ui.renderContacts();
            console.log(`Generated ${count} test contacts`);
        }
    };
}

// ショートカットキー設定
document.addEventListener('keydown', (e) => {
    // Ctrl+S で保存
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        drive.saveData();
    }
    
    // Ctrl+N で新規連絡先
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        showNewContactModal();
    }
    
    // Ctrl+E でエクスポート
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        ui.exportData();
    }
    
    // Ctrl+Shift+D でデバッグモード切替
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        localStorage.setItem('debug', localStorage.getItem('debug') !== 'true' ? 'true' : 'false');
        location.reload();
    }
});

// サービスワーカー登録（PWA対応の準備）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 将来的にservice-worker.jsを追加してPWA化可能
        // navigator.serviceWorker.register('/service-worker.js');
    });
}

// アプリケーション情報
const APP_VERSION = '1.0.0';
const APP_BUILD_DATE = '2024-01-01';

console.log(`1対1ミーティング管理システム v${APP_VERSION}`);
console.log(`Build: ${APP_BUILD_DATE}`);
console.log('© 2024 - All rights reserved');

// 初期化完了メッセージ
window.addEventListener('load', () => {
    console.log('Application initialized successfully');
});