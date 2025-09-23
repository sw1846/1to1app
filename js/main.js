// main.js - 分散ファイル構造対応の初期化とイベントハンドラ

// グローバル初期化フラグ
let systemInitialized = false;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM読み込み完了 - 分散ファイル構造システム初期化開始...');
    
    try {
        // 設定を読み込み
        loadSystemConfig();
        
        // 既存の初期化関数を実行
        initializeEventListeners();
        initializeTheme();
        initializeGoogleDriveUI();
        
        // システム起動時の処理
        systemInitialized = true;
        console.log('分散ファイル構造システム初期化完了');
        
        // デバッグ情報をコンソールに出力
        console.log('システム状態:', getSystemStatus());
        
    } catch (error) {
        console.error('初期化エラー:', error);
        logError(error, 'システム初期化');
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
    
    // 分散ファイル構造用のUI要素を初期化
    initializeDistributedFileSystemUI();
}

// 分散ファイル構造用UI初期化
function initializeDistributedFileSystemUI() {
    // フォルダ構造状態表示（デバッグ用）
    if (window.location.search.includes('debug=true')) {
        addDebugPanel();
    }
}

// デバッグパネルを追加
function addDebugPanel() {
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debugPanel';
    debugPanel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 300px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 0.5rem;
        padding: 1rem;
        font-size: 0.75rem;
        z-index: 9999;
        max-height: 300px;
        overflow-y: auto;
    `;
    debugPanel.innerHTML = `
        <h4>デバッグ情報</h4>
        <div id="debugContent">初期化中...</div>
        <button class="btn btn-sm" onclick="updateDebugPanel()">更新</button>
        <button class="btn btn-sm" onclick="document.getElementById('debugPanel').remove()">閉じる</button>
    `;
    document.body.appendChild(debugPanel);
}

// デバッグパネルを更新
function updateDebugPanel() {
    const content = document.getElementById('debugContent');
    if (content) {
        const status = getSystemStatus();
        const debug = getDebugInfo();
        content.innerHTML = `
            <p><strong>認証:</strong> ${status.isAuthenticated ? '✓' : '✗'}</p>
            <p><strong>フォルダ:</strong> ${status.folderSelected ? '✓' : '✗'}</p>
            <p><strong>構造:</strong> ${status.folderStructureInitialized ? '✓' : '✗'}</p>
            <p><strong>データ:</strong> ${status.dataLoaded ? '✓' : '✗'}</p>
            <p><strong>連絡先:</strong> ${status.totalContacts}</p>
            <p><strong>ミーティング:</strong> ${status.totalMeetings}</p>
            <p><strong>エラー:</strong> ${debug.errorLog.length}</p>
            <p><strong>メモリ:</strong> ${(debug.performanceMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</p>
        `;
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
                if (isSystemReady()) {
                    openContactModal();
                } else {
                    showNotification('システムの準備ができていません', 'warning');
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
            searchInput.addEventListener('input', debounce(() => {
                if (typeof filterContacts === 'function') {
                    filterContacts();
                }
            }, 300));
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
        
        // ウィンドウイベント
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);
        
        console.log('イベントリスナー初期化完了');
    } catch (error) {
        console.error('イベントリスナー初期化エラー:', error);
        logError(error, 'イベントリスナー初期化');
        handleError(error, 'イベントリスナー初期化');
    }
}

// システム準備状態の確認
function isSystemReady() {
    const status = getSystemStatus();
    return status.isAuthenticated && status.folderSelected && status.folderStructureInitialized;
}

// デバウンス関数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// フィルター入力欄の設定
function setupFilterInputs() {
    const affiliationFilter = document.getElementById('affiliationFilter');
    if (affiliationFilter) {
        affiliationFilter.addEventListener('input', debounce((e) => {
            filterValues.affiliation = e.target.value;
            if (typeof filterContacts === 'function') {
                filterContacts();
            }
        }, 300));
    }
    
    const businessFilter = document.getElementById('businessFilter');
    if (businessFilter) {
        businessFilter.addEventListener('input', debounce((e) => {
            filterValues.business = e.target.value;
            if (typeof filterContacts === 'function') {
                filterContacts();
            }
        }, 300));
    }
    
    const industryInterestsFilter = document.getElementById('industryInterestsFilter');
    if (industryInterestsFilter) {
        industryInterestsFilter.addEventListener('input', debounce((e) => {
            filterValues.industryInterests = e.target.value;
            if (typeof filterContacts === 'function') {
                filterContacts();
            }
        }, 300));
    }
    
    const residenceFilter = document.getElementById('residenceFilter');
    if (residenceFilter) {
        residenceFilter.addEventListener('input', debounce((e) => {
            filterValues.residence = e.target.value;
            if (typeof filterContacts === 'function') {
                filterContacts();
            }
        }, 300));
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
        if (isSystemReady() && typeof saveAllData === 'function') {
            saveAllData();
        }
    }
    
    // Ctrl+N: 新規連絡先追加
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        if (isSystemReady() && typeof openContactModal === 'function') {
            openContactModal();
        } else {
            showNotification('システムの準備ができていません', 'warning');
        }
    }
    
    // Ctrl+R: データリロード
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        if (isSystemReady() && typeof loadAllData === 'function') {
            loadAllData();
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

// ページ離脱前の処理
function handleBeforeUnload(e) {
    // 未保存の変更がある場合は警告
    const status = getSystemStatus();
    if (status.dataLoaded && performanceMetrics.lastSaveTime) {
        const timeSinceLastSave = Date.now() - new Date(performanceMetrics.lastSaveTime).getTime();
        if (timeSinceLastSave > 60000) { // 1分以上経過
            e.preventDefault();
            e.returnValue = '未保存の変更があります。ページを離れますか？';
            return e.returnValue;
        }
    }
}

// オンライン状態の処理
function handleOnlineStatus() {
    console.log('オンラインになりました');
    showNotification('オンラインになりました', 'success');
    
    // 自動で再接続を試行
    if (systemInitialized && !getSystemStatus().isAuthenticated) {
        setTimeout(() => {
            if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
                console.log('再接続を試行中...');
            }
        }, 2000);
    }
}

// オフライン状態の処理
function handleOfflineStatus() {
    console.log('オフラインになりました');
    showNotification('オフラインです。一部機能が制限されます', 'warning');
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
    console.log('分散ファイル構造データ読み込み完了');
    
    try {
        // メタデータを更新
        metadata.lastUpdated = new Date().toISOString();
        metadata.totalContacts = contacts.length;
        metadata.totalMeetings = meetings.length;
        
        // パフォーマンス指標を更新
        updatePerformanceMetrics();
        performanceMetrics.loadTime = new Date().toISOString();
        
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
        
        // インデックスを構築（必要な場合）
        if (Object.keys(searchIndex).length === 0 && contacts.length > 0) {
            console.log('検索インデックスを構築中...');
            if (typeof rebuildIndexes === 'function') {
                rebuildIndexes();
            }
        }
        
        // デバッグパネルを更新
        if (document.getElementById('debugPanel')) {
            updateDebugPanel();
        }
        
        showNotification(`データを読み込みました (連絡先: ${contacts.length}件, ミーティング: ${meetings.length}件)`, 'success');
        
    } catch (error) {
        console.error('データ読み込み後処理エラー:', error);
        logError(error, 'データ読み込み後処理');
        handleError(error, 'データ読み込み後処理');
    }
}

// 認証状態変更時の処理
function onAuthStateChanged(isAuthenticated) {
    const authorizeBtn = document.getElementById('authorizeBtn');
    const signoutBtn = document.getElementById('signoutBtn');
    const authMessage = document.getElementById('authMessage');
    
    console.log('認証状態変更:', isAuthenticated);
    
    if (isAuthenticated) {
        if (authorizeBtn) authorizeBtn.style.display = 'none';
        if (signoutBtn) signoutBtn.style.display = 'inline-block';
        if (authMessage) authMessage.style.display = 'none';
        
        // フォルダ選択状態をチェック
        if (!currentFolderId) {
            console.log('フォルダが選択されていません - フォルダ選択モーダルを表示');
            if (typeof showDataFolderSelector === 'function') {
                showDataFolderSelector();
            }
        } else {
            // 既にフォルダが選択済みの場合はデータを読み込む
            console.log('既存フォルダでデータ読み込み開始:', currentFolderId);
            initializeSystemWithFolder();
        }
    } else {
        if (authorizeBtn) authorizeBtn.style.display = 'inline-block';
        if (signoutBtn) signoutBtn.style.display = 'none';
        if (authMessage) authMessage.style.display = 'block';
        
        // データをクリア
        clearSystemData();
    }
}

// フォルダ選択後のシステム初期化
async function initializeSystemWithFolder() {
    try {
        if (typeof initializeFolderStructure === 'function') {
            await initializeFolderStructure();
        }
        
        if (typeof loadAllData === 'function') {
            await loadAllData();
            onDataLoaded();
        }
    } catch (error) {
        console.error('フォルダ初期化エラー:', error);
        logError(error, 'フォルダ初期化');
        handleError(error, 'フォルダ初期化');
    }
}

// システムデータのクリア
function clearSystemData() {
    contacts = [];
    meetings = [];
    contactsIndex = {};
    meetingsIndex = {};
    searchIndex = {};
    
    if (typeof renderContacts === 'function') {
        renderContacts();
    }
    if (typeof renderTodos === 'function') {
        renderTodos();
    }
    
    // パフォーマンス指標をリセット
    performanceMetrics.contactCount = 0;
    performanceMetrics.meetingCount = 0;
    performanceMetrics.lastSaveTime = null;
}

// エラーハンドリング
function handleError(error, context = '') {
    console.error(`エラー (${context}):`, error);
    logError(error, context);
    
    let message = 'エラーが発生しました';
    if (context) {
        message = `${context}でエラーが発生しました`;
    }
    
    if (error && error.message) {
        // Google API関連のエラーの場合は詳細を表示
        if (error.message.includes('403') || error.message.includes('401')) {
            message += '（認証エラー：再度ログインしてください）';
        } else if (error.message.includes('404')) {
            message += '（ファイルが見つかりません）';
        } else if (error.message.includes('network')) {
            message += '（ネットワークエラー）';
        }
    }
    
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
    }
}

// パフォーマンス監視
function monitorPerformance() {
    updatePerformanceMetrics();
    
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
    
    // エラーログのチェック
    if (errorLog.length > 50) {
        console.warn(`エラーログが蓄積されています: ${errorLog.length}件`);
    }
}

// 定期的なデータ保存
function setupAutoSave() {
    // 設定された間隔で自動保存（ログイン時のみ）
    setInterval(async () => {
        if (isSystemReady()) {
            try {
                if (typeof saveAllData === 'function') {
                    await saveAllData();
                    console.log('自動保存完了');
                    performanceMetrics.lastSaveTime = new Date().toISOString();
                    performanceMetrics.saveCount++;
                }
            } catch (error) {
                console.error('自動保存エラー:', error);
                logError(error, '自動保存');
            }
        }
    }, systemConfig.autoSaveInterval);
}

// 定期的なパフォーマンス監視
function setupPerformanceMonitoring() {
    setInterval(() => {
        monitorPerformance();
        
        // デバッグパネルを更新
        if (document.getElementById('debugPanel')) {
            updateDebugPanel();
        }
    }, 30000); // 30秒ごと
}

// システム情報の表示
function showSystemInfo() {
    const status = getSystemStatus();
    const debug = getDebugInfo();
    
    const info = {
        バージョン: status.version,
        認証状態: status.isAuthenticated ? '認証済み' : '未認証',
        フォルダ状態: status.folderSelected ? '選択済み' : '未選択',
        データ状態: status.dataLoaded ? '読み込み済み' : '未読み込み',
        連絡先数: status.totalContacts,
        ミーティング数: status.totalMeetings,
        インデックスサイズ: debug.indexSizes,
        最終保存: status.lastSave || '未保存',
        メモリ使用量: `${(debug.performanceMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB`,
        エラー数: debug.errorLog.length
    };
    
    console.table(info);
    return info;
}

// 初期化完了後の処理
window.addEventListener('load', () => {
    console.log('ページ読み込み完了 - 追加初期化開始');
    
    // パフォーマンス監視開始
    setTimeout(monitorPerformance, 2000);
    
    // 自動保存設定
    setupAutoSave();
    
    // パフォーマンス監視設定
    setupPerformanceMonitoring();
    
    // システム情報をコンソールに出力
    setTimeout(showSystemInfo, 1000);
    
    console.log('分散ファイル構造システム完全初期化完了');
});

// エラーの全体キャッチ
window.addEventListener('error', (e) => {
    logError(e.error || e, 'グローバルエラー');
    handleError(e.error || e, 'グローバルエラー');
});

window.addEventListener('unhandledrejection', (e) => {
    logError(e.reason, 'Promise拒否');
    handleError(e.reason, 'Promise拒否');
    e.preventDefault();
});

// デバッグ用の関数をグローバルに露出（開発時のみ）
if (typeof window !== 'undefined') {
    window.debugSystem = {
        showSystemInfo,
        getSystemStatus,
        getDebugInfo,
        contacts: () => contacts,
        meetings: () => meetings,
        options: () => options,
        metadata: () => metadata,
        folderStructure: () => folderStructure,
        contactsIndex: () => contactsIndex,
        meetingsIndex: () => meetingsIndex,
        searchIndex: () => searchIndex,
        performanceMetrics: () => performanceMetrics,
        errorLog: () => errorLog,
        getCurrentContactId: () => currentContactId,
        getCurrentMeetingId: () => currentMeetingId,
        getCurrentView: () => currentView,
        getCurrentTab: () => currentTab,
        getCurrentSort: () => currentSort,
        getFilterValues: () => filterValues,
        getReferrerFilter: () => referrerFilter,
        getSelectedOptions: () => selectedOptions,
        systemInitialized: () => systemInitialized,
        isSystemReady,
        clearSystemData,
        forceRebuildIndexes: () => typeof rebuildIndexes === 'function' ? rebuildIndexes() : 'not available',
        forceSave: () => typeof saveAllData === 'function' ? saveAllData() : 'not available'
    };
}