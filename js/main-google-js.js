// main-google.js - Google Drive版用の初期化とイベントハンドラ

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    // 既存の初期化関数を実行
    if (typeof initializeEventListeners === 'function') {
        initializeEventListeners();
    }
    if (typeof initializeTheme === 'function') {
        initializeTheme();
    }
    
    // Google Drive特有の初期化
    initializeGoogleDriveUI();
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
}

// イベントリスナーの初期化（既存のmain.jsから移植）
function initializeEventListeners() {
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
        exportBtn.addEventListener('click', () => {
            if (typeof exportToCSV === 'function') {
                exportToCSV();
            }
        });
    }
    
    const importBtn = document.getElementById('importBtn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            if (typeof importFromCSV === 'function') {
                importFromCSV();
            }
        });
    }

    // データマージボタン
    const mergeBtn = document.getElementById('mergeDataBtn');
    if (mergeBtn) {
        mergeBtn.addEventListener('click', () => {
            if (typeof mergeOldData === 'function') {
                mergeOldData();
            }
        });
    }

    // タブ切替
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (typeof switchTab === 'function') {
                switchTab(e.target.dataset.tab);
            }
        });
    });

    // 表示切替
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (typeof switchView === 'function') {
                switchView(e.target.dataset.view);
            }
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
    
    const affiliationFilter = document.getElementById('affiliationFilter');
    if (affiliationFilter) {
        affiliationFilter.addEventListener('input', (e) => {
            if (typeof filterValues !== 'undefined') {
                filterValues.affiliation = e.target.value;
                if (typeof filterContacts === 'function') {
                    filterContacts();
                }
            }
        });
    }
    
    const businessFilter = document.getElementById('businessFilter');
    if (businessFilter) {
        businessFilter.addEventListener('input', (e) => {
            if (typeof filterValues !== 'undefined') {
                filterValues.business = e.target.value;
                if (typeof filterContacts === 'function') {
                    filterContacts();
                }
            }
        });
    }
    
    const industryInterestsFilter = document.getElementById('industryInterestsFilter');
    if (industryInterestsFilter) {
        industryInterestsFilter.addEventListener('input', (e) => {
            if (typeof filterValues !== 'undefined') {
                filterValues.industryInterests = e.target.value;
                if (typeof filterContacts === 'function') {
                    filterContacts();
                }
            }
        });
    }
    
    const residenceFilter = document.getElementById('residenceFilter');
    if (residenceFilter) {
        residenceFilter.addEventListener('input', (e) => {
            if (typeof filterValues !== 'undefined') {
                filterValues.residence = e.target.value;
                if (typeof filterContacts === 'function') {
                    filterContacts();
                }
            }
        });
    }

    // ドロップゾーン
    if (typeof setupDropZone === 'function') {
        setupDropZone('photoDropZone', 'photo', true);
        setupDropZone('businessCardDropZone', 'businessCard', true);
        setupDropZone('attachmentDropZone', 'attachmentList', false);
        setupDropZone('meetingAttachmentDropZone', 'meetingAttachmentList', false);
    }

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
    if (contactMethodDirect && typeof handleContactMethodChange === 'function') {
        contactMethodDirect.addEventListener('change', handleContactMethodChange);
    }
    if (contactMethodReferral && typeof handleContactMethodChange === 'function') {
        contactMethodReferral.addEventListener('change', handleContactMethodChange);
    }

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (typeof saveAllData === 'function') {
                saveAllData();
            }
        }
    });

    // 複数選択の外側クリックで閉じる
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multi-select-container')) {
            document.querySelectorAll('.multi-select-dropdown').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        }
    });
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
}

function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
    }
}