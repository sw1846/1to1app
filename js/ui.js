// ui.js - UI制御

// 表示設定
let viewMode = 'card'; // 'card' or 'list'
let searchQuery = '';
let filters = {
    type: '',
    affiliation: ''
};

// UI初期化
function initialize() {
    // イベントリスナー設定
    setupEventListeners();
    
    // マルチセレクト初期化
    contacts.initializeMultiSelects();
    
    // ファイルアップロード初期化
    contacts.initializeFileUploads();
    
    // フィルター初期化
    updateFilterOptions();
    
    // 初期表示
    renderContacts();
}

// イベントリスナー設定
function setupEventListeners() {
    // 検索
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', utils.debounce((e) => {
        searchQuery = e.target.value;
        renderContacts();
    }, 300));
    
    // フィルター
    document.getElementById('typeFilter').addEventListener('change', (e) => {
        filters.type = e.target.value;
        renderContacts();
    });
    
    document.getElementById('affiliationFilter').addEventListener('change', (e) => {
        filters.affiliation = e.target.value;
        renderContacts();
    });
    
    // ビュー切替
    document.getElementById('cardViewBtn').addEventListener('click', () => {
        setViewMode('card');
    });
    
    document.getElementById('listViewBtn').addEventListener('click', () => {
        setViewMode('list');
    });
    
    // 新規連絡先
    document.getElementById('addContactBtn').addEventListener('click', () => {
        showNewContactModal();
    });
    
    // インポート/エクスポート
    document.getElementById('importBtn').addEventListener('click', importData);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    
    // インポート用input
    const importInput = document.getElementById('importInput');
    importInput.addEventListener('change', handleImport);
    
    // モーダル外クリックで閉じる
    window.addEventListener('click', (e) => {
        if (e.target.className === 'modal') {
            e.target.style.display = 'none';
        }
    });
    
    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
        // Escでモーダルを閉じる
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
            });
        }
        
        // Ctrl+F で検索フォーカス
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

// 表示モード切替
function setViewMode(mode) {
    viewMode = mode;
    
    // ボタンのアクティブ状態更新
    document.getElementById('cardViewBtn').classList.toggle('active', mode === 'card');
    document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
    
    renderContacts();
}

// 連絡先表示
function renderContacts() {
    const container = document.getElementById('contactsContainer');
    const contactsList = contacts.searchContacts(searchQuery, filters);
    
    if (contactsList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <p>連絡先が見つかりません</p>
                <button class="btn" style="margin-top: 1rem;" onclick="showNewContactModal()">
                    新規連絡先を追加
                </button>
            </div>
        `;
        return;
    }
    
    if (viewMode === 'card') {
        renderCardView(container, contactsList);
    } else {
        renderListView(container, contactsList);
    }
}

// カードビュー表示
async function renderCardView(container, contactsList) {
    let html = '<div class="contacts-grid">';
    
    for (const contact of contactsList) {
        let avatarHtml = '';
        
        if (contact.photo) {
            try {
                const photoSrc = await drive.getImageAsBase64(contact.photo.id);
                if (photoSrc) {
                    avatarHtml = `<img src="${photoSrc}" alt="${contact.name}">`;
                }
            } catch (error) {
                console.error('Error loading photo:', error);
            }
        }
        
        if (!avatarHtml) {
            avatarHtml = utils.getInitials(contact.name);
        }
        
        html += `
            <div class="contact-card" onclick="showContactDetail('${contact.id}')">
                <div class="contact-header">
                    <div class="contact-avatar">
                        ${avatarHtml}
                    </div>
                    <div class="contact-info">
                        <h3>${utils.escapeHtml(contact.name)}</h3>
                        ${contact.company ? `<div class="company">${utils.escapeHtml(contact.company)}</div>` : ''}
                    </div>
                </div>
                ${renderContactTags(contact)}
                ${contact.cutout ? `<div style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">${utils.escapeHtml(contact.cutout)}</div>` : ''}
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// リストビュー表示
function renderListView(container, contactsList) {
    let html = `
        <div class="contacts-list">
            <div class="list-header">
                <div></div>
                <div>名前</div>
                <div>会社</div>
                <div>メール</div>
                <div>電話</div>
                <div>アクション</div>
            </div>
    `;
    
    contactsList.forEach(contact => {
        html += `
            <div class="list-item" onclick="showContactDetail('${contact.id}')">
                <div class="list-avatar">
                    ${utils.getInitials(contact.name)}
                </div>
                <div>${utils.escapeHtml(contact.name)}</div>
                <div>${contact.company ? utils.escapeHtml(contact.company) : '-'}</div>
                <div>${contact.email ? utils.escapeHtml(contact.email) : '-'}</div>
                <div>${contact.phone ? utils.escapeHtml(contact.phone) : '-'}</div>
                <div>
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); showEditContactModal('${contact.id}')">
                        編集
                    </button>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // リストビューの画像は後から非同期で読み込む
    loadListViewAvatars(contactsList);
}

// リストビューアバター読み込み
async function loadListViewAvatars(contactsList) {
    const avatarElements = document.querySelectorAll('.list-avatar');
    
    for (let i = 0; i < contactsList.length; i++) {
        const contact = contactsList[i];
        const avatarElement = avatarElements[i];
        
        if (contact.photo && avatarElement) {
            try {
                const photoSrc = await drive.getImageAsBase64(contact.photo.id);
                if (photoSrc) {
                    avatarElement.innerHTML = `<img src="${photoSrc}" alt="${contact.name}">`;
                }
            } catch (error) {
                console.error('Error loading avatar:', error);
            }
        }
    }
}

// タグ表示
function renderContactTags(contact) {
    const allTags = [];
    
    if (contact.types) allTags.push(...contact.types);
    if (contact.affiliations) allTags.push(...contact.affiliations);
    
    if (allTags.length === 0) return '';
    
    const displayTags = allTags.slice(0, 3);
    const remainingCount = allTags.length - displayTags.length;
    
    let html = '<div class="contact-tags">';
    displayTags.forEach(tag => {
        html += `<span class="tag">${utils.escapeHtml(tag)}</span>`;
    });
    
    if (remainingCount > 0) {
        html += `<span class="tag">+${remainingCount}</span>`;
    }
    
    html += '</div>';
    return html;
}

// フィルターオプション更新
function updateFilterOptions() {
    const typeFilter = document.getElementById('typeFilter');
    const affiliationFilter = document.getElementById('affiliationFilter');
    
    // 種別フィルター
    typeFilter.innerHTML = '<option value="">種別で絞り込み</option>';
    if (window.options.types) {
        window.options.types.forEach(type => {
            typeFilter.innerHTML += `<option value="${utils.escapeHtml(type)}">${utils.escapeHtml(type)}</option>`;
        });
    }
    
    // 所属フィルター
    affiliationFilter.innerHTML = '<option value="">所属で絞り込み</option>';
    if (window.options.affiliations) {
        window.options.affiliations.forEach(affiliation => {
            affiliationFilter.innerHTML += `<option value="${utils.escapeHtml(affiliation)}">${utils.escapeHtml(affiliation)}</option>`;
        });
    }
}

// データインポート
function importData() {
    document.getElementById('importInput').click();
}

// インポート処理
async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // データ検証
        if (!data.contacts || !Array.isArray(data.contacts)) {
            throw new Error('Invalid data format');
        }
        
        // 確認
        if (!confirm(`${data.contacts.length}件の連絡先をインポートします。既存のデータは上書きされます。続行しますか？`)) {
            return;
        }
        
        utils.showLoading();
        
        // データ設定
        window.contacts = data.contacts || [];
        window.meetings = data.meetings || [];
        window.options = data.options || {
            types: [],
            affiliations: [],
            wantToConnect: [],
            goldenEgg: []
        };
        
        // Drive に保存
        await drive.saveData();
        
        // UI更新
        updateFilterOptions();
        renderContacts();
        
        utils.showNotification('データをインポートしました');
        
    } catch (error) {
        console.error('Import error:', error);
        utils.showNotification('インポートに失敗しました', 'error');
    } finally {
        utils.hideLoading();
        e.target.value = ''; // inputをリセット
    }
}

// データエクスポート
function exportData() {
    try {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            contacts: window.contacts || [],
            meetings: window.meetings || [],
            options: window.options || {}
        };
        
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `1to1meeting_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        utils.showNotification('データをエクスポートしました');
        
    } catch (error) {
        console.error('Export error:', error);
        utils.showNotification('エクスポートに失敗しました', 'error');
    }
}

// プログレス表示（将来の拡張用）
function showProgress(message, progress) {
    // プログレスバー表示の実装
    console.log(`${message}: ${progress}%`);
}

// エラーハンドリング
function handleError(error, context) {
    console.error(`Error in ${context}:`, error);
    
    let message = 'エラーが発生しました';
    
    if (error.message.includes('quota')) {
        message = 'ストレージ容量が不足しています';
    } else if (error.message.includes('network')) {
        message = 'ネットワークエラーが発生しました';
    } else if (error.message.includes('permission')) {
        message = 'アクセス権限がありません';
    }
    
    utils.showNotification(message, 'error');
}

// エクスポート
window.ui = {
    initialize,
    renderContacts,
    updateFilterOptions,
    showProgress,
    handleError
};