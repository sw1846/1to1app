// data.js - Google Drive APIを使用した分散ファイル構造データ管理

// Google OAuth 2.0設定（config.jsから参照）
const CLIENT_ID = (typeof GOOGLE_DRIVE_CONFIG !== 'undefined' && GOOGLE_DRIVE_CONFIG.CLIENT_ID) ? GOOGLE_DRIVE_CONFIG.CLIENT_ID : '';
const SCOPES = (typeof GOOGLE_DRIVE_CONFIG !== 'undefined' && GOOGLE_DRIVE_CONFIG.SCOPES) ? GOOGLE_DRIVE_CONFIG.SCOPES : 'https://www.googleapis.com/auth/drive.file';

// Google API初期化（APIキーなし）

// 認証状態フラグとクライアント
let gapiInited = false;
let gisInited = false;
let tokenClient = null;

// --- OAuth2 token utilities (auto-refresh & auth wrappers) ---
let accessToken = null;
let tokenObtainedAt = 0;
let refreshTimerId = null;

function getAccessToken() {
    try {
        const t = (gapi && gapi.client && gapi.client.getToken) ? gapi.client.getToken() : null;
        return (t && t.access_token) ? t.access_token : accessToken;
    } catch (e) {
        return accessToken;
    }
}

function setAccessTokenFromResponse(resp) {
    if (resp && resp.access_token) {
        accessToken = resp.access_token;
        tokenObtainedAt = Date.now();
        try {
            if (gapi && gapi.client && gapi.client.setToken) {
                gapi.client.setToken({ access_token: accessToken });
            }
        } catch (e) {
            console.warn('setToken で警告:', e);
        }
        scheduleProactiveRefresh();
    }
}

function scheduleProactiveRefresh() {
    try {
        if (refreshTimerId) clearInterval(refreshTimerId);
        refreshTimerId = setInterval(() => {
            const elapsed = Date.now() - tokenObtainedAt;
            // 45分経過でサイレント再取得（有効期限内に更新）
            if (elapsed > 45 * 60 * 1000) {
                refreshAccessToken().catch(err => console.warn('トークン自動更新失敗:', err));
            }
        }, 60 * 1000);
    } catch (e) {
        console.warn('scheduleProactiveRefresh 警告:', e);
    }
}

function is401(err) {
    try {
        if (!err) return false;
        if (typeof err === 'number' && err === 401) return true;
        if (err.status === 401) return true;
        if (err.result && err.result.error && err.result.error.code === 401) return true;
        if (err.body && typeof err.body === 'string' && err.body.includes('401')) return true;
        if (typeof err === 'string' && err.includes('401')) return true;
    } catch (e) {}
    return false;
}

function refreshAccessToken() {
    return new Promise((resolve, reject) => {
        if (!tokenClient) return reject(new Error('tokenClient が初期化されていません'));
        try {
            tokenClient.callback = (resp) => {
                if (resp && !resp.error && resp.access_token) {
                    setAccessTokenFromResponse(resp);
                    resolve();
                } else {
                    reject(resp || new Error('トークン再取得に失敗'));
                }
            };
            tokenClient.requestAccessToken({ prompt: '' }); // silent refresh
        } catch (e) {
            reject(e);
        }
    });
}

async function withGapiAuthRetry(requestFn, retries = 1) {
    try {
        return await requestFn();
    } catch (e) {
        if (is401(e) && retries > 0) {
            await refreshAccessToken();
            return await withGapiAuthRetry(requestFn, retries - 1);
        }
        throw e;
    }
}

async function authorizedFetch(url, options = {}, retries = 1) {
    const opts = Object.assign({}, options);
    const headers = Object.assign({}, opts.headers || {});
    headers['Authorization'] = `Bearer ${getAccessToken()}`;
    opts.headers = headers;

    let res = await fetch(url, opts);
    if (res.status === 401 && retries > 0) {
        await refreshAccessToken();
        const headers2 = Object.assign({}, opts.headers || {});
        headers2['Authorization'] = `Bearer ${getAccessToken()}`;
        const opts2 = Object.assign({}, opts, { headers: headers2 });
        res = await fetch(url, opts2);
    }
    return res;
}

// getFileIdInFolder リトライ版（401 検出でトークン再取得→再試行）
async function getFileIdInFolderWithRetry(filename, folderId) {
    if (!folderId) return null;
    try {
        const response = await withGapiAuthRetry(() => gapi.client.drive.files.list({
            q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive'
        }), 1);
        if (response.result && response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        }
        return null;
    } catch (error) {
        console.error('ファイルID取得エラー(リトライ後):', error);
        return null;
    }
}



// Driveページネーション対応：指定フォルダ内ファイルを全件取得
async function listAllFilesInFolder(folderId, namePrefix) {
    let files = [];
    let pageToken = null;
    do {
        const resp = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and name contains '${namePrefix}' and name contains '.json' and trashed=false`,
            fields: 'nextPageToken, files(id, name, modifiedTime)',
            spaces: 'drive',
            pageSize: 1000,
            pageToken: pageToken || undefined,
            orderBy: 'name_natural'
        });
        files = files.concat(resp.result.files || []);
        pageToken = resp.result.nextPageToken;
    } while (pageToken);
    return files;
}
async function initializeGoogleAPI() {
    try {
        console.log('Google API初期化開始（APIキーなし）...');
        
        await new Promise((resolve) => {
            gapi.load('client', resolve);
        });

        await gapi.client.init({});

        gapiInited = true;
        maybeEnableButtons();
        console.log('Google API初期化完了（認証待機中）');
    } catch (error) {
        console.error('Google API初期化エラー:', error);
        if (typeof showNotification === 'function') {
            showNotification('Google APIの初期化に失敗しました', 'error');
        }
    }
}

// Google Identity Services初期化
function initializeGIS() {
    try {
        console.log('Google Identity Services初期化開始...');
        
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '',
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
}

// ボタンの有効化チェック
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        const authorizeBtn = document.getElementById('authorizeBtn');
        const authMessage = document.getElementById('authMessage');
        
        if (authorizeBtn) authorizeBtn.style.display = 'inline-block';
        if (authMessage) authMessage.style.display = 'block';
    }
}

// 認証処理
async function handleAuthClick() {
    if (!gisInited || !tokenClient) {
        try { await initializeGIS(); } catch (e) { console.error('GIS再初期化エラー:', e); }
    }

    if (typeof showLoading === 'function') {
        showLoading(true);
    }
    
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            if (typeof showNotification === 'function') {
                showNotification('認証に失敗しました', 'error');
            }
            if (typeof showLoading === 'function') {
                showLoading(false);
            }
            throw resp;
        }
        
        setAccessTokenFromResponse(resp);
        
        try {
            console.log('Drive API Discovery Document読み込み中...');
            await gapi.client.load('drive', 'v3');
            console.log('Drive API準備完了');
            
            const authorizeBtn = document.getElementById('authorizeBtn');
            const signoutBtn = document.getElementById('signoutBtn');
            const authMessage = document.getElementById('authMessage');
            
            if (authorizeBtn) authorizeBtn.style.display = 'none';
            if (signoutBtn) signoutBtn.style.display = 'inline-block';
            if (authMessage) authMessage.style.display = 'none';
            
            await showDataFolderSelector();
            
        } catch (error) {
            console.error('Drive API読み込みエラー:', error);
            if (typeof showNotification === 'function') {
                showNotification('Drive APIの読み込みに失敗しました', 'error');
            }
        }
        
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

// データフォルダ選択モーダル表示
async function showDataFolderSelector() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'dataFolderModal';

    const existingFolders = await searchMeetingSystemFolders();

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>データフォルダを選択</h2>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <h3>既存の1to1meetingフォルダ</h3>
                    ${existingFolders.length > 0 ? `
                        <div class="folder-list">
                            ${existingFolders.map(folder => `
                                <div class="folder-item" onclick="selectExistingFolder('${folder.id}', '${escapeHtml(folder.name)}')">
                                    📁 ${escapeHtml(folder.name)} 
                                    <small>(作成日: ${new Date(folder.createdTime).toLocaleDateString('ja-JP')})</small>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <p style="color: var(--text-secondary);">既存の1to1meetingフォルダが見つかりません</p>
                    `}
                </div>

                <div class="form-group">
                    <h3>新しいフォルダを作成</h3>
                    <button class="btn btn-primary" onclick="createNewDataFolder()">
                        ➕ 新しい1to1meetingフォルダを作成
                    </button>
                </div>

                <div class="form-group">
                    <h3>手動でフォルダを選択</h3>
                    <div id="folderBrowser"></div>
                    <button class="btn" onclick="browseFolders()">
                        📂 フォルダを参照
                    </button>
                </div>

                <div class="form-group">
                    <h3>レガシーデータインポート</h3>
                    <input type="file" id="jsonFileInput" accept=".json" style="display: none;" multiple onchange="handleLegacyJsonImport(event)">
                    <button class="btn" onclick="document.getElementById('jsonFileInput').click()">
                        📥 旧形式JSONからインポート
                    </button>
                    <small>contacts.json, meetings.json, options.jsonファイルを選択</small>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// 既存フォルダを検索
async function searchMeetingSystemFolders() {
    try {
        const response = await gapi.client.drive.files.list({
            q: "name='1to1meeting' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id, name, createdTime, parents)',
            spaces: 'drive'
        });

        return response.result.files || [];
    } catch (error) {
        console.error('フォルダ検索エラー:', error);
        return [];
    }
}

// 既存フォルダを選択
async function selectExistingFolder(folderId, folderName) {
    currentFolderId = folderId;
    console.log(`既存フォルダ「${folderName}」を選択:`, folderId);
    
    closeDataFolderModal();
    
    try {
        await initializeFolderStructure();
        await loadAllData();
        
        console.log(`読み込み完了: 連絡先${contacts.length}件, ミーティング${meetings.length}件`);
        
        // 認証状態変更のコールバックを呼び出し
        if (typeof onAuthStateChanged === 'function') {
            onAuthStateChanged(true);
        }
        
        if (typeof showNotification === 'function') {
            showNotification(`フォルダ「${folderName}」からデータを読み込みました (連絡先: ${contacts.length}件)`, 'success');
        }
    } catch (error) {
        console.error('フォルダ選択エラー:', error);
        if (typeof showNotification === 'function') {
            showNotification('データの読み込みに失敗しました', 'error');
        }
    }
}

// 新しいフォルダ構造を作成
async function createNewDataFolder() {
    try {
        // ルートフォルダ作成
        const createResponse = await gapi.client.drive.files.create({
            resource: {
                name: '1to1meeting',
                mimeType: 'application/vnd.google-apps.folder'
            },
            fields: 'id'
        });
        
        currentFolderId = createResponse.result.id;
        console.log('新しいデータフォルダを作成:', currentFolderId);
        
        // フォルダ構造を初期化
        await initializeFolderStructure();
        
        // 初期メタデータを保存
        await saveMetadata();
        
        closeDataFolderModal();
        await loadAllData();
        
        if (typeof showNotification === 'function') {
            showNotification('新しいデータフォルダを作成しました', 'success');
        }
    } catch (error) {
        console.error('フォルダ作成エラー:', error);
        if (typeof showNotification === 'function') {
            showNotification('フォルダの作成に失敗しました', 'error');
        }
    }
}

// フォルダ構造の初期化
async function initializeFolderStructure() {
    if (!currentFolderId) return;

    try {
        folderStructure.root = currentFolderId;
        
        // 必要なフォルダを作成または取得
        folderStructure.index = await getOrCreateFolder('index', currentFolderId);
        folderStructure.contacts = await getOrCreateFolder('contacts', currentFolderId);
        folderStructure.meetings = await getOrCreateFolder('meetings', currentFolderId);
        folderStructure.attachments = await getOrCreateFolder('attachments', currentFolderId);
        
        // attachmentsのサブフォルダ
        folderStructure.attachmentsContacts = await getOrCreateFolder('contacts', folderStructure.attachments);
        folderStructure.attachmentsMeetings = await getOrCreateFolder('meetings', folderStructure.attachments);
        
        console.log('フォルダ構造初期化完了:', folderStructure);
    } catch (error) {
        console.error('フォルダ構造初期化エラー:', error);
        throw error;
    }
}

// フォルダブラウザ
async function browseFolders(parentId = 'root') {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const folderBrowser = document.getElementById('folderBrowser');
        if (folderBrowser) {
            folderBrowser.innerHTML = `
                <div class="folder-browser">
                    ${parentId !== 'root' ? '<button class="btn btn-sm" onclick="browseFolders(\'root\')">📁 ルートに戻る</button>' : ''}
                    <div class="folder-list">
                        ${response.result.files.map(folder => `
                            <div class="folder-item">
                                <span onclick="browseFolders('${folder.id}')" style="cursor: pointer;">
                                    📁 ${escapeHtml(folder.name)}
                                </span>
                                <button class="btn btn-sm btn-primary" onclick="selectCustomFolder('${folder.id}', '${escapeHtml(folder.name)}')">
                                    選択
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('フォルダ参照エラー:', error);
        if (typeof showNotification === 'function') {
            showNotification('フォルダの参照に失敗しました', 'error');
        }
    }
}

// カスタムフォルダを選択
async function selectCustomFolder(folderId, folderName) {
    currentFolderId = folderId;
    console.log(`カスタムフォルダ「${folderName}」を選択:`, folderId);
    
    closeDataFolderModal();
    await initializeFolderStructure();
    await loadAllData();
    
    if (typeof showNotification === 'function') {
        showNotification(`フォルダ「${folderName}」を使用します`, 'success');
    }
}

// レガシーJSONファイルインポート
function handleLegacyJsonImport(event) {
    const files = Array.from(event.target.files);
    let importData = {};
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (file.name === 'contacts.json') {
                    importData.contacts = Array.isArray(data) ? data : [];
                    console.log(`${importData.contacts.length}件の連絡先をインポート`);
                } else if (file.name === 'meetings.json') {
                    importData.meetings = Array.isArray(data) ? data : [];
                    console.log(`${importData.meetings.length}件のミーティングをインポート`);
                } else if (file.name === 'options.json') {
                    importData.options = {...options, ...data};
                    console.log('オプションをインポート');
                }
                
                checkLegacyImportComplete(files.length, importData);
                
            } catch (error) {
                console.error(`${file.name}のインポートエラー:`, error);
                if (typeof showNotification === 'function') {
                    showNotification(`${file.name}の読み込みに失敗しました`, 'error');
                }
            }
        };
        reader.readAsText(file);
    });
}

let legacyImportedFileCount = 0;
async function checkLegacyImportComplete(totalFiles, importData) {
    legacyImportedFileCount++;
    if (legacyImportedFileCount >= totalFiles) {
        closeDataFolderModal();
        
        // 新しいフォルダを作成
        await createNewDataFolder();
        
        // レガシーデータを分散形式で保存
        if (importData.contacts) {
            contacts = importData.contacts;
            await convertAndSaveContacts();
        }
        if (importData.meetings) {
            meetings = importData.meetings;
            await convertAndSaveMeetings();
        }
        if (importData.options) {
            options = importData.options;
            await saveOptions();
        }
        
        // インデックスを再構築
        if (typeof rebuildIndexes === 'function') {
            await rebuildIndexes();
        }
        
        // UI更新
        if (typeof calculateReferrerRevenues === 'function') {
            calculateReferrerRevenues();
        }
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
        
        if (typeof showNotification === 'function') {
            showNotification('レガシーデータのインポートが完了しました', 'success');
        }
        legacyImportedFileCount = 0;
    }
}

// データフォルダモーダルを閉じる
function closeDataFolderModal() {
    const modal = document.getElementById('dataFolderModal');
    if (modal) {
        modal.remove();
    }
}

// サインアウト
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        accessToken = null;
        currentFolderId = null;
        
        // インデックスをクリア
        contactsIndex = {};
        meetingsIndex = {};
        searchIndex = {};
        
        const authorizeBtn = document.getElementById('authorizeBtn');
        const signoutBtn = document.getElementById('signoutBtn');
        const authMessage = document.getElementById('authMessage');
        
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
        
        if (typeof showNotification === 'function') {
            showNotification('ログアウトしました', 'success');
        }
    }
}

// データ読み込み
async function loadAllData() {
    if (!currentFolderId) return;

    if (typeof showLoading === 'function') {
        showLoading(true);
    }
    
    try {
        console.log('データ読み込み開始...');
        
        await loadMetadata();if (!contactsIndex || Object.keys(contactsIndex).length === 0) { console.warn('インデックスが空です。Driveから再構築します...'); await rebuildContactsIndexFromDrive(); } await loadContactsFromIndex();
        await loadMeetingsFromIndex();
        await loadOptions();
        
        console.log(`読み込み完了: 連絡先${contacts.length}件, ミーティング${meetings.length}件`);
        
        // 紹介売上を計算
        if (typeof calculateReferrerRevenues === 'function') {
            calculateReferrerRevenues();
        }
        
        // UI更新関数を確実に呼び出し
        setTimeout(() => {
            try {
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
                
                // onDataLoaded を呼び出し
                if (typeof onDataLoaded === 'function') {
                    onDataLoaded();
                }
                
                console.log('UI更新完了');
            } catch (uiError) {
                console.error('UI更新エラー:', uiError);
            }
        }, 100);
        
    } catch (err) {
        console.error('データ読み込みエラー:', err);
        if (typeof showNotification === 'function') {
            showNotification('データの読み込みに失敗しました', 'error');
        }
    } finally {
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    }
}

// メタデータ読み込み
async function loadMetadata() {
    try {
        const fileId = await getFileIdInFolderWithRetry('metadata.json', folderStructure.index);
        if (!fileId) {
            metadata = {
                version: '2.0',
                lastUpdated: new Date().toISOString(),
                totalContacts: 0,
                totalMeetings: 0,
                nextContactId: 1,
                nextMeetingId: 1
            };
            return;
        }

        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        metadata = JSON.parse(response.body);
        console.log('メタデータを読み込みました:', metadata);
    } catch (err) {
        console.error('メタデータ読み込みエラー:', err);
    }
}

// インデックス読み込み
async function loadIndexes() {
    try {
        // 連絡先インデックス
        const contactsIndexId = await getFileIdInFolderWithRetry('contacts-index.json', folderStructure.index);
        if (contactsIndexId) {
            const response = await gapi.client.drive.files.get({
                fileId: contactsIndexId,
                alt: 'media'
            });
            contactsIndex = JSON.parse(response.body);
        }

        // ミーティングインデックス
        const meetingsIndexId = await getFileIdInFolderWithRetry('meetings-index.json', folderStructure.index);
        if (meetingsIndexId) {
            const response = await gapi.client.drive.files.get({
                fileId: meetingsIndexId,
                alt: 'media'
            });
            meetingsIndex = JSON.parse(response.body);
        }

        // 検索インデックス
        const searchIndexId = await getFileIdInFolderWithRetry('search-index.json', folderStructure.index);
        if (searchIndexId) {
            const response = await gapi.client.drive.files.get({
                fileId: searchIndexId,
                alt: 'media'
            });
            searchIndex = JSON.parse(response.body);
        }

        console.log('インデックスを読み込みました');
    } catch (err) {
        console.error('インデックス読み込みエラー:', err);
        contactsIndex = {};
        meetingsIndex = {};
        searchIndex = {};
    }
}

// 連絡先データをインデックスから読み込み
async function loadContactsFromIndex() {
    contacts = [];
    
    console.log('連絡先インデックス:', contactsIndex);
    console.log('インデックスエントリ数:', Object.keys(contactsIndex).length);
    
    for (const contactId in contactsIndex) {
        try {
            const contact = await loadSingleContact(contactId);
            if (contact) {
                contacts.push(contact);
                console.log(`連絡先読み込み成功: ${contact.name}`);
            }
        } catch (err) {
            console.error(`連絡先${contactId}の読み込みエラー:`, err);
        }
    }
    
    console.log(`${contacts.length}件の連絡先を読み込みました`);
    
    // データが0件の場合、直接ファイル検索を試行
    if (contacts.length === 0 && folderStructure.contacts) {
        console.log('インデックスが空のため、直接ファイル検索を実行...');
        await loadContactsDirectly();
    }
}

// 単一連絡先の読み込み
async function loadSingleContact(contactId) {
    const indexEntry = contactsIndex[contactId];
    if (!indexEntry) return null;

    try {
        const fileId = await getFileIdInFolderWithRetry(contactFileNameFromId(contactId), folderStructure.contacts);
        if (!fileId) return null;

        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        const contact = JSON.parse(response.body);
        
        // データ変換（レガシー対応）
        return normalizeContactData(contact);
    } catch (err) {
        console.error(`連絡先ファイル読み込みエラー:`, err);
        return null;
    }
}

// 連絡先データの正規化
function normalizeContactData(contact) {
    if (contact.referrer && !contact.contactMethod) {
        contact.contactMethod = 'referral';
    } else if (!contact.contactMethod) {
        contact.contactMethod = 'direct';
        contact.directContact = '所属が同じ';
    }
    
    if (typeof contact.type === 'string') {
        contact.types = contact.type ? [contact.type] : [];
        delete contact.type;
    }
    if (typeof contact.affiliation === 'string') {
        contact.affiliations = contact.affiliation ? [contact.affiliation] : [];
        delete contact.affiliation;
    }
    
    contact.types = contact.types || [];
    contact.affiliations = contact.affiliations || [];
    contact.industryInterests = contact.industryInterests || [];
    contact.businesses = contact.businesses || [];
    contact.priorInfo = contact.priorInfo || '';
    contact.status = contact.status || '新規';
    
    return contact;
}

// ミーティングデータをインデックスから読み込み
async function loadMeetingsFromIndex() {
    meetings = [];
    
    console.log('ミーティングインデックス:', meetingsIndex);
    
    for (const contactId in meetingsIndex) {
        try {
            const contactMeetings = await loadContactMeetings(contactId);
            if (contactMeetings && contactMeetings.length > 0) {
                meetings.push(...contactMeetings);
            }
        } catch (err) {
            console.error(`連絡先${contactId}のミーティング読み込みエラー:`, err);
        }
    }
    
    console.log(`${meetings.length}件のミーティングを読み込みました`);
    
    // データが0件の場合、直接ファイル検索を試行
    if (meetings.length === 0 && folderStructure.meetings) {
        console.log('ミーティングインデックスが空のため、直接ファイル検索を実行...');
        await loadMeetingsDirectly();
    }
}

// 特定連絡先のミーティング読み込み
async function loadContactMeetings(contactId) {
    try {
        const fileId = await getFileIdInFolderWithRetry(`contact-${String(contactId).padStart(6, '0')}-meetings.json`, folderStructure.meetings);
        if (!fileId) return [];

        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        return JSON.parse(response.body);
    } catch (err) {
        console.error(`ミーティングファイル読み込みエラー:`, err);
        return [];
    }
}

// 直接ファイル検索（インデックスが空の場合のフォールバック）

async function loadContactsDirectly() {
    try {
        const files = await listAllFilesInFolder(folderStructure.contacts, 'contact-');
        console.log(`直接検索で${files.length}個の連絡先ファイルを発見`);
        for (const file of files) {
            try {
                const fr = await gapi.client.drive.files.get({ fileId: file.id, alt: 'media' });
                const contact = JSON.parse(fr.body);
                if (contact) {
                    const normalized = normalizeContactData(contact);
                    contacts.push(normalized);
                    console.log(`直接読み込み成功: ${normalized.name}`);
                    if (normalized.id) {
                        contactsIndex[normalized.id] = {
                            id: normalized.id,
                            name: normalized.name || '',
                            company: normalized.company || '',
                            lastUpdated: file.modifiedTime || new Date().toISOString(),
                            status: normalized.status || '新規'
                        };
                    }
                }
            } catch (e) { console.error('直接読み込みファイルエラー:', e); }
        }
        if (typeof saveContactsIndex === 'function') await saveContactsIndex();
    } catch (e) { console.error('直接検索エラー:', e); }
}

// ミーティングデータの直接読み込み
async function loadMeetingsDirectly() {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${folderStructure.meetings}' in parents and name contains 'meetings.json' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        const files = response.result.files || [];
        console.log(`直接検索で${files.length}個のミーティングファイルを発見`);

        for (const file of files) {
            try {
                const fileResponse = await gapi.client.drive.files.get({
                    fileId: file.id,
                    alt: 'media'
                });

                const contactMeetings = JSON.parse(fileResponse.body);
                if (Array.isArray(contactMeetings)) {
                    meetings.push(...contactMeetings);
                    
                    // ミーティングインデックスも更新
                    if (contactMeetings.length > 0 && typeof updateMeetingIndex === 'function') {
                        updateMeetingIndex(contactMeetings[0].contactId);
                    }
                }
            } catch (err) {
                console.error(`ミーティングファイル${file.name}の読み込みエラー:`, err);
            }
        }
    } catch (error) {
        console.error('直接ミーティング検索エラー:', error);
    }
}

// オプションデータ読み込み
async function loadOptions() {
    try {
        const fileId = await getFileIdInFolderWithRetry('options.json', folderStructure.root);
        if (!fileId) {
            // デフォルト値を使用
            return;
        }

        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        const loadedOptions = JSON.parse(response.body);
        
        options = {
            types: loadedOptions.types && loadedOptions.types.length > 0 ? 
                   loadedOptions.types : ['顧客候補', '顧客', '取次店・販売店'],
            affiliations: loadedOptions.affiliations || [],
            industryInterests: loadedOptions.industryInterests || [],
            statuses: loadedOptions.statuses && loadedOptions.statuses.length > 0 ? 
                     loadedOptions.statuses : ['新規', '接触中', '提案中', '商談中', '成約', '失注', '保留']
        };
        
        console.log('オプションデータを読み込みました');
    } catch (err) {
        console.error('オプション読み込みエラー:', err);
    }
}

// データ保存
async function saveAllData() {
    if (!currentFolderId || !gapi.client.getToken()) {
        if (typeof showNotification === 'function') {
            showNotification('Googleドライブに接続されていません', 'error');
        }
        return;
    }

    if (typeof showLoading === 'function') {
        showLoading(true);
    }
    
    try {
        await saveContactsDistributed();
        await saveMeetingsDistributed();
        await saveOptions();
        if (typeof rebuildIndexes === 'function') {
            await rebuildIndexes();
        }
        await saveMetadata();
        
        if (typeof showNotification === 'function') {
            showNotification('データを保存しました', 'success');
        }
    } catch (err) {
        console.error('保存エラー:', err);
        if (typeof showNotification === 'function') {
            showNotification('データの保存に失敗しました', 'error');
        }
    } finally {
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    }
}

// 連絡先を分散形式で保存

if (typeof saveContactsIndex === 'function') { await saveContactsIndex(); }

// レガシーデータを分散形式に変換して保存

if (typeof saveContactsIndex === 'function') { await saveContactsIndex(); }

// 単一連絡先の保存
async function saveSingleContact(contact) {
    const contactId = contact.id;
    const fileName = contactFileNameFromId(contactId);
    
    await saveJsonFileToFolder(fileName, contact, folderStructure.contacts);
    
    // インデックスを更新
    contactsIndex[contactId] = {
        id: contactId,
        name: contact.name,
        company: contact.company || '',
        lastUpdated: new Date().toISOString(),
        status: contact.status || '新規'
    };
}

// ミーティングを分散形式で保存
async function saveMeetingsDistributed() {
    // 連絡先別にミーティングをグループ化
    const meetingsByContact = {};
    meetings.forEach(meeting => {
        const contactId = meeting.contactId;
        if (!meetingsByContact[contactId]) {
            meetingsByContact[contactId] = [];
        }
        meetingsByContact[contactId].push(meeting);
    });
    
    // 各連絡先のミーティングファイルを保存
    for (const contactId in meetingsByContact) {
        await saveContactMeetings(contactId, meetingsByContact[contactId]);
    }
}

// レガシーミーティングデータを分散形式に変換して保存
async function convertAndSaveMeetings() {
    await saveMeetingsDistributed();
}

// 特定連絡先のミーティング保存
async function saveContactMeetings(contactId, contactMeetings) {
    const fileName = `contact-${String(contactId).padStart(6, '0')}-meetings.json`;
    
    await saveJsonFileToFolder(fileName, contactMeetings, folderStructure.meetings);
    
    // インデックスを更新
    meetingsIndex[contactId] = {
        contactId: contactId,
        meetingCount: contactMeetings.length,
        lastMeetingDate: contactMeetings.length > 0 ? 
            Math.max(...contactMeetings.map(m => new Date(m.date || 0).getTime())) : null,
        lastUpdated: new Date().toISOString()
    };
}

// オプションデータ保存
async function saveOptions() {
    await saveJsonFileToFolder('options.json', options, folderStructure.root);
}

// メタデータ保存
async function saveMetadata() {
    await saveJsonFileToFolder('metadata.json', metadata, folderStructure.index);
}

// フォルダ内のJSONファイル保存（修正版 - 400エラー対応）
async function saveJsonFileToFolder(filename, data, folderId) {
    try {
        const fileId = await getFileIdInFolderWithRetry(filename, folderId);
        const jsonData = JSON.stringify(data, null, 2);
        
        if (fileId) {
const jsonData = JSON.stringify(data, null, 2);
const res = await authorizedFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {method:'PATCH',headers:{'Authorization':`Bearer ${gapi.client.getToken().access_token}`,'Content-Type':'application/json; charset=UTF-8'},body:jsonData});
if(!res.ok){const errText=await res.text();throw new Error(`Drive update failed: ${res.status} ${errText}`);}console.log(`ファイル更新成功: ${filename}`);
} else {
            // 新規ファイル作成
            const metadata = {
                name: filename,
                parents: [folderId],
                mimeType: 'application/json'
            };
            
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
            form.append('file', new Blob([jsonData], {type: 'application/json'}));
            
            const response = await authorizedFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${gapi.client.getToken().access_token}`
                },
                body: form
            });
            
            if (!response.ok) {
                throw new Error(`ファイル作成失敗: ${response.status} ${response.statusText}`);
            }
            
            console.log(`ファイル作成成功: ${filename}`);
        }
    } catch (error) {
        console.error(`ファイル保存エラー (${filename}):`, error);
        throw error;
    }
}

// 特定フォルダ内のファイルIDを取得
async function getFileIdInFolderWithRetry(filename, folderId) {
    if (!folderId) return null;

    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive'
        });

        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        }
        return null;
    } catch (error) {
        console.error('ファイルID取得エラー:', error);
        return null;
    }
}

// フォルダを作成または取得
async function getOrCreateFolder(folderName, parentId) {
    const response = await gapi.client.drive.files.list({
        q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
    });

    if (response.result.files && response.result.files.length > 0) {
        return response.result.files[0].id;
    }

    const createResponse = await gapi.client.drive.files.create({
        resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        },
        fields: 'id'
    });

    return createResponse.result.id;
}

// 添付ファイル管理
async function saveAttachmentToFileSystem(fileName, dataUrl, contactName) {
    if (!folderStructure.attachmentsContacts || !gapi.client.getToken()) return dataUrl;

    try {
        // 連絡先名のフォルダを作成または取得
        const safeName = contactName.replace(/[<>:"/\\|?*]/g, '_');
        let contactFolderId = await getOrCreateFolder(safeName, folderStructure.attachmentsContacts);

        // Base64をBlobに変換
        const byteCharacters = atob(dataUrl.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'image/jpeg'});

        // ファイルをアップロード
        const metadata = {
            name: fileName,
            parents: [contactFolderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
        form.append('file', blob);

        const response = await authorizedFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
            {
                method: 'POST',
                headers: new Headers({'Authorization': 'Bearer ' + gapi.client.getToken().access_token}),
                body: form
            }
        );

        const file = await response.json();
        return `drive:${file.id}`;
    } catch (error) {
        console.error('添付ファイル保存エラー:', error);
        return dataUrl;
    }
}

async function loadAttachmentFromFileSystem(filePath) {
    if (!filePath || !filePath.startsWith('drive:')) return filePath;

    try {
        const fileId = filePath.replace('drive:', '');
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        return 'data:image/jpeg;base64,' + btoa(response.body);
    } catch (error) {
        console.error('添付ファイル読み込みエラー:', error);
        return '';
    }
}

// Google Driveから画像を読み込む関数
async function loadImageFromGoogleDrive(drivePath) {
    if (!drivePath || !drivePath.startsWith('drive:')) return null;
    
    try {
        const fileId = drivePath.replace('drive:', '');
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        // レスポンスがバイナリの場合の処理
        if (response.body) {
            return 'data:image/jpeg;base64,' + btoa(response.body);
        }
    } catch (error) {
        console.error('Google Drive画像読み込みエラー:', error);
        return null;
    }
    
    return null;
}

// 旧データのチェック（オプション）
function checkForOldData() {
    console.log('分散ファイル構造でのデータチェック完了');
}

// グローバルスコープに関数を公開
if (typeof window !== 'undefined') {
    window.initializeGoogleAPI = initializeGoogleAPI;
    window.initializeGIS = initializeGIS;
    window.handleAuthClick = handleAuthClick;
    window.handleSignoutClick = handleSignoutClick;
    window.selectExistingFolder = selectExistingFolder;
    window.createNewDataFolder = createNewDataFolder;
    window.selectCustomFolder = selectCustomFolder;
    window.browseFolders = browseFolders;
    window.handleLegacyJsonImport = handleLegacyJsonImport;
    window.loadImageFromGoogleDrive = loadImageFromGoogleDrive;
}
// インデックス保存
async function saveContactsIndex() {
    try {
        if (!folderStructure.index) {
            folderStructure.index = await getOrCreateFolder('index', folderStructure.root);
        }
        await saveJsonFileToFolder('contacts-index.json', contactsIndex || {}, folderStructure.index);
        console.log('contacts-index.json を保存しました');
    } catch (e) { console.error('contacts-index 保存エラー:', e); }
}
// 連絡先インデックス再構築
async function rebuildContactsIndexFromDrive() {
    try {
        if (!folderStructure.contacts) return;
        const files = await listAllFilesInFolder(folderStructure.contacts, 'contact-');
        contactsIndex = {};
        for (const f of files) {
            const m = f.name && f.name.match(/contact-(.+)\.json$/);
            if (m) {
                const id = m[1];
                contactsIndex[id] = { id, lastUpdated: f.modifiedTime || new Date().toISOString() };
            }
        }
        console.log(`インデックス再構築: ${Object.keys(contactsIndex).length}件`);
        await saveContactsIndex();
    } catch (e) { console.error('インデックス再構築エラー:', e); }
}

function contactFileNameFromId(cid) {
    const s = String(cid || '').trim();
    if (/^\d+$/.test(s)) return `contact-${s.padStart(6, '0')}.json`;
    return `contact-${s}.json`;
}