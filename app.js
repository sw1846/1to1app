// app.js - メインアプリケーション

class App {
    constructor() {
        this.authManager = null;
        this.storageManager = null;
        this.contactsManager = null;
        this.meetingsManager = null;
        this.uiManager = null;
        
        this.isInitialized = false;
    }

    // アプリケーションの初期化
    async initialize() {
        try {
            console.log('Initializing application...');
            
            // マネージャーのインスタンス化
            this.authManager = new AuthManager();
            this.storageManager = new StorageManager();
            this.contactsManager = new ContactsManager(this.storageManager);
            this.meetingsManager = new MeetingsManager(this.storageManager, this.contactsManager);
            this.uiManager = new UIManager(
                this.authManager,
                this.storageManager,
                this.contactsManager,
                this.meetingsManager
            );

            // グローバル参照の設定（レガシー対応）
            window.uiManager = this.uiManager;

            // 認証マネージャーの初期化
            await this.authManager.initialize();
            
            // 認証成功時の処理
            this.authManager.setAuthSuccessHandler(async (response) => {
                await this.onAuthSuccess(response);
            });
            
            // 認証エラー時の処理
            this.authManager.setAuthErrorHandler((error) => {
                this.onAuthError(error);
            });

            // セッションの復元試行
            if (this.authManager.restoreSession()) {
                // セッションが有効な場合
                const isTokenValid = await this.authManager.validateToken();
                if (isTokenValid) {
                    await this.onAuthSuccess();
                } else {
                    // トークンが無効な場合は再ログイン
                    this.authManager.clearSession();
                    this.showLoginScreen();
                }
            } else {
                // セッションがない場合
                this.showLoginScreen();
            }

            // UIマネージャーの初期化
            this.uiManager.initialize();

            // オートセーブの設定
            this.setupAutoSave();

            // ウィンドウイベントの設定
            this.setupWindowEvents();

            this.isInitialized = true;
            console.log('Application initialized successfully');
            
        } catch (error) {
            console.error('Application initialization error:', error);
            this.showError('アプリケーションの初期化に失敗しました。ページをリロードしてください。');
        }
    }

    // 認証成功時の処理
    async onAuthSuccess(response = null) {
        try {
            this.uiManager.showLoading();
            
            // ユーザー情報の取得
            const user = await this.authManager.getCurrentUser();
            if (user) {
                console.log('Logged in as:', user.displayName);
            }

            // ストレージの初期化
            await this.storageManager.initialize();
            
            // データの読み込み
            await this.contactsManager.initialize();
            await this.meetingsManager.initialize();
            
            // UIの更新
            this.uiManager.updateAuthUI();
            this.uiManager.renderContacts();
            this.uiManager.updateFilterOptions();
            
            // アプリケーション画面を表示
            this.showAppScreen();
            
            this.uiManager.showNotification('ログインしました', 'success');
            
        } catch (error) {
            console.error('Post-auth initialization error:', error);
            this.uiManager.showNotification('データの読み込みに失敗しました', 'error');
        } finally {
            this.uiManager.hideLoading();
        }
    }

    // 認証エラー時の処理
    onAuthError(error) {
        console.error('Authentication error:', error);
        this.uiManager.showNotification('ログインに失敗しました', 'error');
        this.showLoginScreen();
    }

    // ログイン画面の表示
    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }

    // アプリケーション画面の表示
    showAppScreen() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
    }

    // エラー表示
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--error);
            color: white;
            padding: 2rem;
            border-radius: 8px;
            z-index: 10000;
        `;
        document.body.appendChild(errorDiv);
    }

    // オートセーブの設定
    setupAutoSave() {
        let saveTimeout = null;
        
        // フォーム変更の監視
        document.addEventListener('input', (e) => {
            const form = e.target.closest('form');
            if (!form) return;
            
            // タイマーをリセット
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            
            // 3秒後にドラフト保存
            saveTimeout = setTimeout(() => {
                this.saveDraft(form);
            }, 3000);
        });
    }

    // ドラフトの保存
    saveDraft(form) {
        if (form.id === 'contactForm') {
            const formData = this.uiManager.collectContactFormData();
            this.contactsManager.saveDraft(formData);
            console.log('Contact draft saved');
        } else if (form.id === 'meetingForm') {
            const formData = this.uiManager.collectMeetingFormData();
            this.meetingsManager.saveDraft(formData);
            console.log('Meeting draft saved');
        }
    }

    // ウィンドウイベントの設定
    setupWindowEvents() {
        // ページ離脱時の警告
        window.addEventListener('beforeunload', (e) => {
            // 編集中のフォームがある場合
            const openModals = document.querySelectorAll('.modal[style*="block"]');
            if (openModals.length > 0) {
                const message = '編集中のデータがあります。ページを離れますか？';
                e.returnValue = message;
                return message;
            }
        });

        // オンライン/オフライン状態の監視
        window.addEventListener('online', () => {
            this.uiManager.showNotification('オンラインになりました', 'success');
            // 自動同期を試行
            if (this.authManager.isAuthenticated()) {
                this.uiManager.syncData();
            }
        });

        window.addEventListener('offline', () => {
            this.uiManager.showNotification('オフラインです。変更はローカルに保存されます。', 'warning');
        });

        // ストレージクォータの監視
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            this.checkStorageQuota();
        }
    }

    // ストレージクォータのチェック
    async checkStorageQuota() {
        try {
            const estimate = await navigator.storage.estimate();
            const percentUsed = (estimate.usage / estimate.quota) * 100;
            
            if (percentUsed > 90) {
                this.uiManager.showNotification(
                    'ローカルストレージの容量が不足しています。不要なデータを削除してください。',
                    'warning'
                );
            }
        } catch (error) {
            console.error('Storage quota check error:', error);
        }
    }

    // デバッグ情報の取得
    getDebugInfo() {
        return {
            version: '1.0.0',
            initialized: this.isInitialized,
            authenticated: this.authManager?.isAuthenticated() || false,
            contactsCount: this.contactsManager?.getAll().length || 0,
            meetingsCount: this.meetingsManager?.getAll().length || 0,
            storageQuota: navigator.storage?.estimate() || null,
            userAgent: navigator.userAgent
        };
    }

    // 統計ダッシュボードの表示
    showStatsDashboard() {
        const contactStats = this.contactsManager.getStatistics();
        const meetingStats = this.meetingsManager.getStatistics();
        
        const statsHtml = `
            <div class="stats-dashboard">
                <h2>統計情報</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>連絡先</h3>
                        <p class="stat-number">${contactStats.total}</p>
                        <p class="stat-label">総登録数</p>
                    </div>
                    <div class="stat-card">
                        <h3>ミーティング</h3>
                        <p class="stat-number">${meetingStats.total}</p>
                        <p class="stat-label">総記録数</p>
                    </div>
                    <div class="stat-card">
                        <h3>ToDo</h3>
                        <p class="stat-number">${meetingStats.completedTodos}/${meetingStats.totalTodos}</p>
                        <p class="stat-label">完了/総数</p>
                    </div>
                    <div class="stat-card">
                        <h3>今週の活動</h3>
                        <p class="stat-number">${contactStats.recentlyAdded + meetingStats.recentMeetings.length}</p>
                        <p class="stat-label">新規追加</p>
                    </div>
                </div>
            </div>
        `;
        
        // モーダルで表示するか、専用のタブに表示
        console.log('Stats:', { contactStats, meetingStats });
    }

    // バックアップの作成
    async createBackup() {
        if (!confirm('バックアップを作成しますか？')) {
            return;
        }
        
        this.uiManager.showLoading();
        
        try {
            const backupFolderId = await this.storageManager.createBackup();
            this.uiManager.showNotification('バックアップを作成しました', 'success');
            console.log('Backup created:', backupFolderId);
        } catch (error) {
            console.error('Backup error:', error);
            this.uiManager.showNotification('バックアップの作成に失敗しました', 'error');
        } finally {
            this.uiManager.hideLoading();
        }
    }

    // キーボードショートカットの設定
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S: 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                const activeForm = document.querySelector('.modal[style*="block"] form');
                if (activeForm) {
                    activeForm.dispatchEvent(new Event('submit'));
                }
            }
            
            // Ctrl/Cmd + N: 新規作成
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (this.uiManager.currentTab === 'contacts') {
                    this.uiManager.openContactModal();
                } else if (this.uiManager.currentTab === 'meetings') {
                    this.uiManager.openMeetingModal();
                }
            }
            
            // Ctrl/Cmd + F: 検索フォーカス
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.querySelector('.tab-content:not([style*="none"]) input[type="text"]');
                if (searchInput) {
                    searchInput.focus();
                }
            }
        });
    }

    // パフォーマンス最適化
    optimizePerformance() {
        // 画像の遅延読み込み
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        observer.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img.lazy').forEach(img => {
                imageObserver.observe(img);
            });
        }

        // 大量データの仮想スクロール実装（将来的な拡張）
        // ...
    }
}

// アプリケーションのエントリーポイント
document.addEventListener('DOMContentLoaded', async () => {
    // Google APIの読み込み待機
    let retryCount = 0;
    const maxRetries = 50; // 5秒待機
    
    const checkAndInitialize = async () => {
        if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
            // アプリケーションの初期化
            window.app = new App();
            await window.app.initialize();
        } else if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(checkAndInitialize, 100);
        } else {
            console.error('Failed to load Google APIs');
            alert('Google APIの読み込みに失敗しました。ページをリロードしてください。');
        }
    };
    
    checkAndInitialize();
});

// グローバルヘルパー関数（レガシー対応）
window.closeContactModal = () => {
    document.getElementById('contactModal').style.display = 'none';
};

window.closeMeetingModal = () => {
    document.getElementById('meetingModal').style.display = 'none';
};

window.closeImportExportModal = () => {
    document.getElementById('importExportModal').style.display = 'none';
};

window.addTodo = () => {
    if (window.uiManager) {
        window.uiManager.addTodoItem();
    }
};

window.removeTodo = (button) => {
    if (window.uiManager) {
        window.uiManager.removeTodoItem(button);
    }
};

window.exportData = () => {
    if (window.uiManager) {
        window.uiManager.exportData();
    }
};