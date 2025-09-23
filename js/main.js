// main.js - Google Drive版用の初期化とイベントハンドラ（完全版）

// グローバル初期化フラグ
let systemInitialized = false;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM読み込み完了 - システム初期化開始...');
    
    try {
        // 既存の初期化関数を実行
        initializeEventListeners();
        initializeTheme();
        initializeGoogleDriveUI();
        
        // システム起動時の処理
        systemInitialized = true;
        console.log('システム初期化完了');
    } catch (error) {
        console.error('初期化エラー:', error);
        handleError(error, 'システム初期化');
    }
});

// Google Drive用UI初期化
function initializeGoogleDriveUI() {
    // ローカル保存ボタンを非表示（存在する場合）
    const selectFolderBtn = document.getElementById('selectFolderBtn');
    if (selectFolderBtn) {
        selectFolderBtn.style.display = 'none';
    }
    
    // 認証メッセージの初期表示設定
    const authMessage = document.getElementById('authMessage');
    if (authMessage) {
        authMessage.style.display = 'block';
    }
    
    // データマージボタンの初期化
    const mergeBtn = document.getElementById('mergeDataBtn');
    if (mergeBtn) {
        mergeBtn.style.display = 'none';
    }
}

// イベントリスナーの初期化
function initializeEventListeners() {
    console.log('イベントリスナー初期化開始...');
    
    try {
        // テーマ切替
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }

        // 連絡先追加
        const addContactBtn = document.getElementById('addContactBtn');
        if (addContactBtn) {
            addContactBtn.addEventListener('click', () => {
                if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken()) {
                    openContactModal();
                } else {
                    showNotification('ログインが必要です', 'warning');
                }
            });
        }

        // エクスポート・インポート
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportToCSV);
        }
        
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.addEventListener('click', importFromCSV);
        }

        // データマージボタン
        const mergeBtn = document.getElementById('mergeDataBtn');
        if (mergeBtn) {
            mergeBtn.addEventListener('click', () => {
                if (typeof mergeOldData === 'function') {
                    mergeOldData();
                } else {
                    showNotification('マージ機能は利用できません', 'warning');
                }
            });
        }

        // タブ切替
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                switchTab(e.target.dataset.tab);
            });
        });

        // 表示切替
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                switchView(e.target.dataset.view);
            });
        });

        // 検索・ソート
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                if (typeof filterContacts === 'function') {
                    filterContacts();
                }
            });
        }
        
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentSort = e.target.value;
                if (typeof renderContacts === 'function') {
                    renderContacts();
                }
            });
        }

        // フィルター
        const typeFilter = document.getElementById('typeFilter');
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                if (typeof filterContacts === 'function') {
                    filterContacts();
                }
            });
        }
        
        // フィルター入力欄
        setupFilterInputs();
        
        // ドロップゾーン設定
        setupAllDropZones();

        // 複数選択の設定
        if (typeof setupMultiSelect === 'function') {
            setupMultiSelect();
        }
        if (typeof setupReferrerAutocomplete === 'function') {
            setupReferrerAutocomplete();
        }

        // Markdownエディタの設定
        if (typeof setupMarkdownEditors === 'function') {
            setupMarkdownEditors();
        }

        // モーダル外クリックで閉じる
        if (typeof setupModalClose === 'function') {
            setupModalClose();
        }

        // 接触方法の切り替え
        const contactMethodDirect = document.getElementById('contactMethodDirect');
        const contactMethodReferral = document.getElementById('contactMethodReferral');
        if (contactMethodDirect) {
            contactMethodDirect.addEventListener('change', handleContactMethodChange);
        }
        if (contactMethodReferral) {
            contactMethodReferral.addEventListener('change', handleContactMethodChange);
        }

        // キーボードショートカット
        document.addEventListener('keydown', handleKeyboardShortcuts);

        // 複数選択の外側クリックで閉じる
        document.addEventListener('click', handleOutsideClick);
        
        console.log('イベントリスナー初期化完了');
    } catch (error) {
        console.error('イベントリスナー初期化エラー:', error);
        handleError(error, 'イベントリスナー初期化');
    }
}

// フィルター入力欄の設定
function setupFilterInputs() {
    const affiliationFilter = document.getElementById('affiliationFilter');
    if (affiliationFilter) {
        affiliationFilter.addEventListener('input', (e) => {
            filterValues.affiliation = e.target.value;
            if (typeof filterContacts === 'function') {
                filterContacts();
            }
        });
    }
    
    const businessFilter = document.getElementById('businessFilter');
    if (businessFilter) {
        businessFilter.addEventListener('input', (e) => {
            filterValues.business = e.target.value;
            if (typeof filterContacts === 'function') {
                filterContacts();
            }
        });
    }
    
    const industryInterestsFilter = document.getElementById('industryInterestsFilter');
    if (industryInterestsFilter) {
        industryInterestsFilter.addEventListener('input', (e) => {
            filterValues.industryInterests = e.target.value;
            if (typeof filterContacts === 'function') {
                filterContacts();
            }
        });
    }
    
    const residenceFilter = document.getElementById('residenceFilter');
    if (residenceFilter) {
        residenceFilter.addEventListener('input', (e) => {
            filterValues.residence = e.target.value;
            if (typeof filterContacts === 'function') {
                filterContacts();
            }
        });
    }
}

// 全ドロップゾーンの設定
function setupAllDropZones() {
    if (typeof setupDropZone === 'function') {
        setupDropZone('photoDropZone', 'photo', true);
        setupDropZone('businessCardDropZone', 'businessCard', true);
        setupDropZone('attachmentDropZone', 'attachmentList', false);
        setupDropZone('meetingAttachmentDropZone', 'meetingAttachmentList', false);
    }
}

// キーボードショートカット処理
function handleKeyboardShortcuts(e) {
    // Ctrl+S: データ保存
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (typeof saveAllData === 'function') {
            saveAllData();
        }
    }
    
    // Ctrl+N: 新規連絡先追加
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken()) {
            if (typeof openContactModal === 'function') {
                openContactModal();
            }
        } else {
            showNotification('ログインが必要です', 'warning');
        }
    }
    
    // Escape: モーダルを閉じる
    if (e.key === 'Escape') {
        const activeModals = document.querySelectorAll('.modal.active');
        activeModals.forEach(modal => {
            if (typeof closeModal === 'function') {
                closeModal(modal.id);
            }
        });
    }
}

// 外側クリック処理
function handleOutsideClick(e) {
    if (!e.target.closest('.multi-select-container')) {
        document.querySelectorAll('.multi-select-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
    
    if (!e.target.closest('.autocomplete-container')) {
        document.querySelectorAll('.autocomplete-dropdown').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
}

// テーマ管理
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    showNotification(`${newTheme === 'light' ? 'ライト' : 'ダーク'}テーマに変更しました`, 'success');
}

function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}

// データ読み込み完了時の処理
function onDataLoaded() {
    console.log('データ読み込み完了');
    
    try {
        // 紹介売上を計算
        if (typeof calculateReferrerRevenues === 'function') {
            calculateReferrerRevenues();
        }
        
        // UI更新
        if (typeof renderContacts === 'function') {
            renderContacts();
        }
        if (typeof renderTodos === 'function') {
            renderTodos();
        }
        if (typeof updateFilters === 'function') {
            updateFilters();
        }
        if (typeof updateMultiSelectOptions === 'function') {
            updateMultiSelectOptions();
        }
        if (typeof updateTodoTabBadge === 'function') {
            updateTodoTabBadge();
        }
        
        showNotification('データを読み込みました', 'success');
    } catch (error) {
        console.error('データ読み込み後処理エラー:', error);
        handleError(error, 'データ読み込み後処理');
    }
}

// 認証状態変更時の処理
function onAuthStateChanged(isAuthenticated) {
    const authorizeBtn = document.getElementById('authorizeBtn');
    const signoutBtn = document.getElementById('signoutBtn');
    const authMessage = document.getElementById('authMessage');
    
    if (isAuthenticated) {
        if (authorizeBtn) authorizeBtn.style.display = 'none';
        if (signoutBtn) signoutBtn.style.display = 'inline-block';
        if (authMessage) authMessage.style.display = 'none';
        
        // データを読み込む
        if (typeof loadAllData === 'function') {
            loadAllData().then(() => {
                onDataLoaded();
            }).catch(err => {
                console.error('データ読み込みエラー:', err);
                showNotification('データの読み込みに失敗しました', 'error');
            });
        }
    } else {
        if (authorizeBtn) authorizeBtn.style.display = 'inline-block';
        if (signoutBtn) signoutBtn.style.display = 'none';
        if (authMessage) authMessage.style.display = 'block';
        
        // データをクリア
        contacts = [];
        meetings = [];
        if (typeof renderContacts === 'function') {
            renderContacts();
        }
        if (typeof renderTodos === 'function') {
            renderTodos();
        }
    }
}

// エラーハンドリング
function handleError(error, context = '') {
    console.error(`エラー (${context}):`, error);
    
    let message = 'エラーが発生しました';
    if (context) {
        message = `${context}でエラーが発生しました`;
    }
    
    if (error && error.message) {
        message += `: ${error.message}`;
    }
    
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
    }
}

// パフォーマンス監視
function monitorPerformance() {
    // メモリ使用量のチェック（対応ブラウザのみ）
    if (performance.memory) {
        const memory = performance.memory;
        const memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        
        if (memoryUsage > 100) { // 100MB以上
            console.warn(`メモリ使用量が多いです: ${memoryUsage}MB`);
        }
    }
    
    // 連絡先数のチェック
    if (contacts && contacts.length > 1000) {
        console.warn(`連絡先数が多いです: ${contacts.length}件`);
        if (typeof showNotification === 'function') {
            showNotification('連絡先数が多いため、動作が重くなる可能性があります', 'warning');
        }
    }
}

// 定期的なデータ保存
function setupAutoSave() {
    // 5分ごとに自動保存（ログイン時のみ）
    setInterval(async () => {
        if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken()) {
            try {
                if (typeof saveAllData === 'function') {
                    await saveAllData();
                    console.log('自動保存完了');
                }
            } catch (error) {
                console.error('自動保存エラー:', error);
            }
        }
    }, 5 * 60 * 1000); // 5分
}

// システム情報の表示
function showSystemInfo() {
    const info = {
        連絡先数: contacts ? contacts.length : 0,
        ミーティング数: meetings ? meetings.length : 0,
        未完了ToDo数: meetings ? meetings.reduce((sum, m) => sum + (m.todos?.filter(t => !t.completed).length || 0), 0) : 0,
        ブラウザ: navigator.userAgent,
        画面サイズ: `${window.screen.width}×${window.screen.height}`,
        ビューポート: `${window.innerWidth}×${window.innerHeight}`
    };
    
    console.table(info);
    return info;
}

// Google API関連の関数をグローバルスコープで利用可能にする
window.initializeGoogleAPI = async function() {
    if (typeof gapi === 'undefined') {
        console.warn('Google API (gapi) が利用できません');
        return;
    }
    
    try {
        console.log('Google API初期化開始（APIキーなし）...');
        
        // GAPIのロードを待つ
        await new Promise((resolve) => {
            gapi.load('client', resolve);
        });

        // クライアントの初期化（APIキーなし）
        await gapi.client.init({
            // apiKeyは指定しない
            // discoveryDocsも指定しない（後でOAuth認証後に読み込む）
        });

        gapiInited = true;
        maybeEnableButtons();
        console.log('Google API初期化完了（認証待機中）');
    } catch (error) {
        console.error('Google API初期化エラー:', error);
        if (typeof showNotification === 'function') {
            showNotification('Google APIの初期化に失敗しました', 'error');
        }
    }
};

window.initializeGIS = function() {
    if (typeof google === 'undefined' || !google.accounts) {
        console.warn('Google Identity Services が利用できません');
        return;
    }
    
    try {
        console.log('Google Identity Services初期化開始...');
        
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // 後で設定
        });
        
        gisInited = true;
        maybeEnableButtons();
        console.log('Google Identity Services初期化完了');
    } catch (error) {
        console.error('GIS初期化エラー:', error);
        if (typeof showNotification === 'function') {
            showNotification('認証システムの初期化に失敗しました', 'error');
        }
    }
};

// 初期化完了後の処理
window.addEventListener('load', () => {
    console.log('ページ読み込み完了');
    
    // パフォーマンス監視開始
    setTimeout(monitorPerformance, 2000);
    
    // 自動保存設定
    setupAutoSave();
    
    // システム情報をコンソールに出力
    setTimeout(showSystemInfo, 1000);
});

// エラーの全体キャッチ
window.addEventListener('error', (e) => {
    handleError(e.error || e, 'グローバルエラー');
});

window.addEventListener('unhandledrejection', (e) => {
    handleError(e.reason, 'Promise拒否');
    e.preventDefault();
});

// デバッグ用の関数をグローバルに露出（開発時のみ）
if (typeof window !== 'undefined') {
    window.debugSystem = {
        showSystemInfo,
        contacts: () => contacts,
        meetings: () => meetings,
        options: () => options,
        getCurrentContactId: () => currentContactId,
        getCurrentMeetingId: () => currentMeetingId,
        getCurrentView: () => currentView,
        getCurrentTab: () => currentTab,
        getCurrentSort: () => currentSort,
        getFilterValues: () => filterValues,
        getReferrerFilter: () => referrerFilter,
        getSelectedOptions: () => selectedOptions,
        systemInitialized: () => systemInitialized
    };
}