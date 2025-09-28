/* ===== main.js - メイン処理（最小修正版） ===== */

// グローバル変数
let currentContactId = null;
let currentMeetingId = null;
let currentView = 'contacts';

// [CLAUDE FIX ALL-IN-ONE][darkmode] ダークモード管理
function initializeTheme() {
    try {
        // OS設定またはローカルストレージから初期テーマを決定
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        
        // HTMLにテーマ属性を設定
        document.documentElement.setAttribute('data-theme', initialTheme);
        
        // テーマトグルボタンの初期化
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        if (themeToggle && themeIcon) {
            themeIcon.textContent = initialTheme === 'dark' ? '☀️' : '🌙';
            themeToggle.addEventListener('click', toggleTheme);
        }
        
        console.log('[fix][darkmode] initialized theme=' + initialTheme);
    } catch (e) {
        console.error('[fix][darkmode] initialization failed:', e);
    }
}

// [CLAUDE FIX ALL-IN-ONE][darkmode] テーマ切り替え
function toggleTheme() {
    try {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // HTMLのテーマ属性を更新
        document.documentElement.setAttribute('data-theme', newTheme);
        
        // ローカルストレージに保存
        localStorage.setItem('theme', newTheme);
        
        // アイコンを更新
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }
        
        console.log('[fix][darkmode] toggled to theme=' + newTheme);
    } catch (e) {
        console.error('[fix][darkmode] toggle failed:', e);
    }
}

// Google認証処理
function handleAuthClick() {
    try {
        console.log('handleAuthClick called');
        if (window.requestToken) {
            window.requestToken();
        } else {
            console.error('requestToken function not available');
        }
    } catch (e) {
        console.error('handleAuthClick error:', e);
    }
}

function handleSignoutClick() {
    try {
        console.log('handleSignoutClick called');
        if (window.revokeToken) {
            window.revokeToken();
        } else {
            console.error('revokeToken function not available');
        }
        
        // UIをリセット
        clearUI();
        showAuthUI();
    } catch (e) {
        console.error('handleSignoutClick error:', e);
    }
}

// UI表示制御
function showAuthUI() {
    const signInBtn = document.getElementById('googleSignInBtn');
    const signOutBtn = document.getElementById('signoutBtn');
    
    if (signInBtn) signInBtn.style.display = 'inline-block';
    if (signOutBtn) signOutBtn.style.display = 'none';
}

function hideAuthUI() {
    const signInBtn = document.getElementById('googleSignInBtn');
    const signOutBtn = document.getElementById('signoutBtn');
    
    if (signInBtn) signInBtn.style.display = 'none';
    if (signOutBtn) signOutBtn.style.display = 'inline-block';
}

function clearUI() {
    try {
        const contactsContainer = document.getElementById('contactsContainer');
        const meetingsContainer = document.getElementById('meetingsContainer');
        
        if (contactsContainer) contactsContainer.innerHTML = '';
        if (meetingsContainer) meetingsContainer.innerHTML = '';
        
        // グローバル変数をクリア
        window.contacts = [];
        window.meetings = [];
        window.options = {};
        
    } catch (e) {
        console.error('clearUI error:', e);
    }
}

// データ読み込み処理
function onDataLoaded(data) {
    try {
        console.log('データ読み込み完了:', {
            contacts: data.contacts ? data.contacts.length : 0,
            meetings: data.meetings ? data.meetings.length : 0
        });
        
        // グローバル変数に設定
        window.contacts = data.contacts || [];
        window.meetings = data.meetings || [];
        window.options = data.metadata?.options || {};
        
        // UIを隠す
        hideAuthUI();
        
        // [CLAUDE FIX ALL-IN-ONE][options] フィルターオプション再構築
        if (window.refreshFiltersUI) {
            window.refreshFiltersUI();
        }
        
        // 連絡先一覧を描画
        renderContacts();
        
        showNotification('データを読み込みました', 'success');
        
    } catch (e) {
        console.error('onDataLoaded error:', e);
        showNotification('データ読み込みエラー: ' + e.message, 'error');
    }
}

// フォルダからデータ読み込み
function loadFromFolderId(folderId) {
    try {
        console.log('loadFromFolderId:', folderId);
        
        if (!folderId) {
            console.error('フォルダIDが指定されていません');
            return;
        }
        
        showLoading();
        
        if (window.loadDataFromFolder) {
            window.loadDataFromFolder(folderId).then(data => {
                onDataLoaded(data);
                
                // [CLAUDE FIX ALL-IN-ONE][upsert] インデックス再構築（フォールバック付き）
                if (window.rebuildIndexes) {
                    window.rebuildIndexes().catch(e => {
                        console.warn('[warn][indexes] rebuild failed, fallback used:', e);
                    });
                }
                
            }).catch(e => {
                console.error('データ読み込みエラー:', e);
                showNotification('データ読み込みに失敗しました: ' + e.message, 'error');
            }).finally(() => {
                hideLoading();
            });
        } else {
            console.error('loadDataFromFolder function not available');
            hideLoading();
        }
        
    } catch (e) {
        console.error('loadFromFolderId error:', e);
        hideLoading();
    }
}

// 連絡先一覧描画
function renderContacts() {
    try {
        const container = document.getElementById('contactsContainer');
        if (!container) {
            console.error('contactsContainer not found');
            return;
        }
        
        const contacts = window.contacts || [];
        console.log(`[ui] renderContacts count: ${contacts.length}`);
        
        if (contacts.length === 0) {
            container.innerHTML = '<div class="no-data">連絡先がありません</div>';
            return;
        }
        
        // フィルター適用
        let filteredContacts = contacts;
        if (window.applyFilters && window.currentFilters) {
            filteredContacts = window.applyFilters(contacts, window.currentFilters);
        }
        
        // HTML生成
        const fragment = document.createDocumentFragment();
        filteredContacts.forEach(contact => {
            const contactCard = createContactCard(contact);
            fragment.appendChild(contactCard);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
        
        // 遅延画像読み込みを設定
        if (window.contactImageObserver) {
            container.querySelectorAll('img[data-contact-id]').forEach(img => {
                window.contactImageObserver.observe(img);
            });
        }
        
    } catch (e) {
        console.error('renderContacts error:', e);
    }
}

// 連絡先カード作成
function createContactCard(contact) {
    try {
        const card = document.createElement('div');
        card.className = 'contact-card';
        card.onclick = () => showContactDetail(contact.id);
        
        // [CLAUDE FIX ALL-IN-ONE][avatar] 画像表示（遅延読み込み）
        const avatarImg = `<img data-contact-id="${contact.id}" data-image-type="avatar" style="display:none;" alt="avatar">`;
        const initialsDiv = `<div class="contact-initials">${toInitials(contact.name)}</div>`;
        
        card.innerHTML = `
            <div class="contact-header">
                <div class="contact-avatar">
                    ${avatarImg}
                    ${initialsDiv}
                </div>
                <div class="contact-info">
                    <h3>${escapeHtml(contact.name || '')}</h3>
                    <p class="contact-company">${escapeHtml(contact.company || '')}</p>
                    <p class="contact-furigana">${escapeHtml(contact.furigana || '')}</p>
                </div>
            </div>
            <div class="contact-meta">
                ${(contact.types || []).map(type => `<span class="badge">${escapeHtml(type)}</span>`).join('')}
            </div>
        `;
        
        return card;
        
    } catch (e) {
        console.error('createContactCard error:', e);
        const errorCard = document.createElement('div');
        errorCard.className = 'contact-card error';
        errorCard.textContent = 'カード生成エラー';
        return errorCard;
    }
}

// ビュー切り替え
function showContactsView() {
    try {
        currentView = 'contacts';
        
        // タブの表示切り替え
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        const contactsTab = document.getElementById('contactsTab');
        if (contactsTab) contactsTab.classList.add('active');
        
        // ビューの表示切り替え
        const views = document.querySelectorAll('.view');
        views.forEach(view => view.style.display = 'none');
        
        const contactsView = document.getElementById('contactsView');
        if (contactsView) contactsView.style.display = 'block';
        
        // データを描画
        renderContacts();
        
    } catch (e) {
        console.error('showContactsView error:', e);
    }
}

function showMeetingsView() {
    try {
        currentView = 'meetings';
        
        // タブの表示切り替え
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        const meetingsTab = document.getElementById('meetingsTab');
        if (meetingsTab) meetingsTab.classList.add('active');
        
        // ビューの表示切り替え
        const views = document.querySelectorAll('.view');
        views.forEach(view => view.style.display = 'none');
        
        const meetingsView = document.getElementById('meetingsView');
        if (meetingsView) meetingsView.style.display = 'block';
        
        // ミーティングデータを描画
        renderMeetings();
        
    } catch (e) {
        console.error('showMeetingsView error:', e);
    }
}

// ミーティング一覧描画（簡易版）
function renderMeetings() {
    try {
        const container = document.getElementById('meetingsContainer');
        if (!container) return;
        
        const meetings = window.meetings || [];
        console.log(`[ui] renderMeetings count: ${meetings.length}`);
        
        if (meetings.length === 0) {
            container.innerHTML = '<div class="no-data">ミーティングがありません</div>';
            return;
        }
        
        const html = meetings.map(meeting => {
            const contactName = getContactName(meeting.contactId);
            const date = meeting.date ? new Date(meeting.date).toLocaleDateString('ja-JP') : '';
            
            return `
                <div class="meeting-card" onclick="showMeetingDetail('${meeting.id}')">
                    <h4>${escapeHtml(meeting.title || 'タイトルなし')}</h4>
                    <p class="meeting-contact">${escapeHtml(contactName)}</p>
                    <p class="meeting-date">${date}</p>
                    <p class="meeting-content">${escapeHtml((meeting.content || '').substring(0, 100))}</p>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        
    } catch (e) {
        console.error('renderMeetings error:', e);
    }
}

// 連絡先名取得
function getContactName(contactId) {
    try {
        if (!contactId) return '不明な連絡先';
        
        const contact = (window.contacts || []).find(c => c.id === contactId);
        return contact ? contact.name : '不明な連絡先';
    } catch (e) {
        return '不明な連絡先';
    }
}

// 検索処理
function onSearchInput(event) {
    try {
        const query = event.target.value.toLowerCase();
        
        if (!window.contacts) return;
        
        const filtered = window.contacts.filter(contact => {
            const searchFields = [
                contact.name,
                contact.furigana,
                contact.company,
                contact.business,
                ...(contact.types || []),
                ...(contact.affiliations || [])
            ];
            
            return searchFields.some(field => 
                field && field.toLowerCase().includes(query)
            );
        });
        
        renderFilteredContacts(filtered);
        
    } catch (e) {
        console.error('onSearchInput error:', e);
    }
}

function renderFilteredContacts(contacts) {
    try {
        const container = document.getElementById('contactsContainer');
        if (!container) return;
        
        if (contacts.length === 0) {
            container.innerHTML = '<div class="no-data">該当する連絡先が見つかりません</div>';
            return;
        }
        
        const fragment = document.createDocumentFragment();
        contacts.forEach(contact => {
            const contactCard = createContactCard(contact);
            fragment.appendChild(contactCard);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
        
        // 遅延画像読み込みを設定
        if (window.contactImageObserver) {
            container.querySelectorAll('img[data-contact-id]').forEach(img => {
                window.contactImageObserver.observe(img);
            });
        }
        
    } catch (e) {
        console.error('renderFilteredContacts error:', e);
    }
}

// 初期化処理
function initializeApp() {
    try {
        console.log('アプリケーション初期化開始');
        
        // [CLAUDE FIX ALL-IN-ONE][darkmode] テーマ初期化
        initializeTheme();
        
        // 認証イベントリスナー
        document.addEventListener('gis:token', function(event) {
            console.log('Google認証成功');
            hideAuthUI();
            
            // デフォルトフォルダからデータ読み込み
            loadFromFolderId('1to1meeting_migrated');
        });
        
        document.addEventListener('gis:error', function(event) {
            console.error('Google認証エラー:', event.detail);
            showAuthUI();
            showNotification('認証に失敗しました', 'error');
        });
        
        // 検索イベントリスナー
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce(onSearchInput, 300));
        }
        
        // タブイベントリスナー
        const contactsTab = document.getElementById('contactsTab');
        const meetingsTab = document.getElementById('meetingsTab');
        
        if (contactsTab) contactsTab.addEventListener('click', showContactsView);
        if (meetingsTab) meetingsTab.addEventListener('click', showMeetingsView);
        
        // 初期ビューを設定
        showContactsView();
        showAuthUI();
        
        console.log('アプリケーション初期化完了');
        
    } catch (e) {
        console.error('initializeApp error:', e);
    }
}

// DOMContentLoaded時の初期化
document.addEventListener('DOMContentLoaded', initializeApp);

// グローバル関数エクスポート
window.handleAuthClick = handleAuthClick;
window.handleSignoutClick = handleSignoutClick;
window.showContactsView = showContactsView;
window.showMeetingsView = showMeetingsView;
window.renderContacts = renderContacts;
window.renderMeetings = renderMeetings;
window.onDataLoaded = onDataLoaded;
window.loadFromFolderId = loadFromFolderId;
window.toggleTheme = toggleTheme;