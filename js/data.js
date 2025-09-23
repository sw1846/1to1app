// data.js - Google Drive APIを使用したデータ管理（フォルダ選択機能付き）

// Google OAuth 2.0設定
const CLIENT_ID = '938239904261-vt7rego8tmo4vhhcjp3fadca25asuh73.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let currentFolderId = null;
let accessToken = null;

// Google API初期化（APIキーなし）
async function initializeGoogleAPI() {
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
        showNotification('Google APIの初期化に失敗しました', 'error');
    }
}

// Google Identity Services初期化
function initializeGIS() {
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
        showNotification('認証システムの初期化に失敗しました', 'error');
    }
}

// ボタンの有効化チェック
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('authorizeBtn').style.display = 'inline-block';
        document.getElementById('authMessage').style.display = 'block';
    }
}

// 認証処理
async function handleAuthClick() {
    showLoading(true);
    
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            showNotification('認証に失敗しました', 'error');
            showLoading(false);
            throw resp;
        }
        
        // アクセストークンを保存
        accessToken = resp.access_token;
        
        // トークンを設定
        gapi.client.setToken(resp);
        
        // 認証後にDiscovery Documentを読み込む
        try {
            console.log('Drive API Discovery Document読み込み中...');
            await gapi.client.load('drive', 'v3');
            console.log('Drive API準備完了');
            
            document.getElementById('authorizeBtn').style.display = 'none';
            document.getElementById('signoutBtn').style.display = 'inline-block';
            document.getElementById('authMessage').style.display = 'none';
            
            // データフォルダ選択モーダルを表示
            await showDataFolderSelector();
            
        } catch (error) {
            console.error('Drive API読み込みエラー:', error);
            showNotification('Drive APIの読み込みに失敗しました', 'error');
        }
        
        showLoading(false);
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

    // 既存のMeetingSystemDataフォルダを検索
    const existingFolders = await searchMeetingSystemFolders();

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>データフォルダを選択</h2>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <h3>既存のMeetingSystemDataフォルダ</h3>
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
                        <p style="color: var(--text-secondary);">既存のMeetingSystemDataフォルダが見つかりません</p>
                    `}
                </div>

                <div class="form-group">
                    <h3>新しいフォルダを作成</h3>
                    <button class="btn btn-primary" onclick="createNewDataFolder()">
                        ➕ 新しいMeetingSystemDataフォルダを作成
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
                    <h3>データインポート</h3>
                    <input type="file" id="jsonFileInput" accept=".json" style="display: none;" multiple onchange="handleJsonImport(event)">
                    <button class="btn" onclick="document.getElementById('jsonFileInput').click()">
                        📥 JSONファイルからインポート
                    </button>
                    <small>contacts.json, meetings.json, options.jsonファイルを選択</small>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// 既存のMeetingSystemDataフォルダを検索
async function searchMeetingSystemFolders() {
    try {
        const response = await gapi.client.drive.files.list({
            q: "name='MeetingSystemData' and mimeType='application/vnd.google-apps.folder' and trashed=false",
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
    await loadAllData();
    showNotification(`フォルダ「${folderName}」からデータを読み込みました`, 'success');
}

// 新しいフォルダを作成
async function createNewDataFolder() {
    try {
        const createResponse = await gapi.client.drive.files.create({
            resource: {
                name: 'MeetingSystemData',
                mimeType: 'application/vnd.google-apps.folder'
            },
            fields: 'id'
        });
        
        currentFolderId = createResponse.result.id;
        console.log('新しいデータフォルダを作成:', currentFolderId);
        
        closeDataFolderModal();
        await loadAllData();
        showNotification('新しいデータフォルダを作成しました', 'success');
    } catch (error) {
        console.error('フォルダ作成エラー:', error);
        showNotification('フォルダの作成に失敗しました', 'error');
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
    } catch (error) {
        console.error('フォルダ参照エラー:', error);
        showNotification('フォルダの参照に失敗しました', 'error');
    }
}

// カスタムフォルダを選択
async function selectCustomFolder(folderId, folderName) {
    currentFolderId = folderId;
    console.log(`カスタムフォルダ「${folderName}」を選択:`, folderId);
    
    closeDataFolderModal();
    await loadAllData();
    showNotification(`フォルダ「${folderName}」を使用します`, 'success');
}

// JSONファイルインポート
function handleJsonImport(event) {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (file.name === 'contacts.json') {
                    contacts = Array.isArray(data) ? data : [];
                    console.log(`${contacts.length}件の連絡先をインポート`);
                } else if (file.name === 'meetings.json') {
                    meetings = Array.isArray(data) ? data : [];
                    console.log(`${meetings.length}件のミーティングをインポート`);
                } else if (file.name === 'options.json') {
                    options = {...options, ...data};
                    console.log('オプションをインポート');
                }
                
                // すべてのファイルが読み込まれたかチェック
                checkImportComplete(files.length);
                
            } catch (error) {
                console.error(`${file.name}のインポートエラー:`, error);
                showNotification(`${file.name}の読み込みに失敗しました`, 'error');
            }
        };
        reader.readAsText(file);
    });
}

let importedFileCount = 0;
function checkImportComplete(totalFiles) {
    importedFileCount++;
    if (importedFileCount >= totalFiles) {
        closeDataFolderModal();
        
        // 新しいフォルダを作成してデータを保存
        createNewDataFolder().then(() => {
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
            showNotification('データのインポートが完了しました', 'success');
        });
        
        importedFileCount = 0;
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
        
        document.getElementById('authorizeBtn').style.display = 'inline-block';
        document.getElementById('signoutBtn').style.display = 'none';
        document.getElementById('authMessage').style.display = 'block';
        
        // データをクリア
        contacts = [];
        meetings = [];
        renderContacts();
        renderTodos();
        
        showNotification('ログアウトしました', 'success');
    }
}

// データ読み込み
async function loadAllData() {
    if (!currentFolderId) return;

    showLoading(true);
    try {
        await loadContacts();
        await loadMeetings();
        await loadOptions();
        
        // 紹介売上を計算
        if (typeof calculateReferrerRevenues === 'function') {
            calculateReferrerRevenues();
        }
        
        // UI更新 - 関数の存在チェックを追加
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
        
        console.log('データ読み込み完了');
    } catch (err) {
        console.error('データ読み込みエラー:', err);
        showNotification('データの読み込みに失敗しました', 'error');
    } finally {
        showLoading(false);
    }
}

// 連絡先データ読み込み
async function loadContacts() {
    try {
        const fileId = await getFileId('contacts.json');
        if (!fileId) {
            contacts = [];
            return;
        }

        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        contacts = JSON.parse(response.body);
        
        // データ変換
        contacts = contacts.map(contact => {
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
            
            if (!Array.isArray(contact.industryInterests)) {
                contact.industryInterests = [];
            }
            if (!Array.isArray(contact.businesses)) {
                contact.businesses = [];
            }
            
            contact.types = contact.types || [];
            contact.affiliations = contact.affiliations || [];
            contact.priorInfo = contact.priorInfo || '';
            
            if (!contact.status) {
                contact.status = '新規';
            }
            
            return contact;
        });
        
        console.log(`${contacts.length}件の連絡先を読み込みました`);
    } catch (err) {
        console.error('連絡先読み込みエラー:', err);
        contacts = [];
    }
}

// ミーティングデータ読み込み
async function loadMeetings() {
    try {
        const fileId = await getFileId('meetings.json');
        if (!fileId) {
            meetings = [];
            return;
        }

        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        meetings = JSON.parse(response.body);
        console.log(`${meetings.length}件のミーティングを読み込みました`);
    } catch (err) {
        console.error('ミーティング読み込みエラー:', err);
        meetings = [];
    }
}

// オプションデータ読み込み
async function loadOptions() {
    try {
        const fileId = await getFileId('options.json');
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
        // デフォルト値を使用
    }
}

// データ保存
async function saveAllData() {
    if (!currentFolderId || !gapi.client.getToken()) {
        showNotification('Googleドライブに接続されていません', 'error');
        return;
    }

    showLoading(true);
    try {
        await saveContacts();
        await saveMeetings();
        await saveOptions();
        showNotification('データを保存しました', 'success');
    } catch (err) {
        console.error('保存エラー:', err);
        showNotification('データの保存に失敗しました', 'error');
    } finally {
        showLoading(false);
    }
}

// 連絡先データ保存
async function saveContacts() {
    await saveJsonFile('contacts.json', contacts);
}

// ミーティングデータ保存
async function saveMeetings() {
    await saveJsonFile('meetings.json', meetings);
}

// オプションデータ保存
async function saveOptions() {
    await saveJsonFile('options.json', options);
}

// JSONファイル保存のヘルパー関数
async function saveJsonFile(filename, data) {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const fileId = await getFileId(filename);
    
    const metadata = {
        'name': filename,
        'mimeType': 'application/json'
    };
    
    // 新規作成の場合のみparentsを指定
    if (!fileId) {
        metadata.parents = [currentFolderId];
    }

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(data, null, 2) +
        close_delim;

    const request = gapi.client.request({
        'path': fileId ? `/drive/v3/files/${fileId}` : '/drive/v3/files',
        'method': fileId ? 'PATCH' : 'POST',
        'params': {'uploadType': 'multipart'},
        'headers': {
            'Content-Type': 'multipart/related; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody
    });

    await request.execute();
}

// ファイルIDを取得
async function getFileId(filename) {
    if (!currentFolderId) return null;

    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${filename}' and '${currentFolderId}' in parents and trashed=false`,
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

// 画像ファイルのアップロード
async function uploadImageToGoogleDrive(fileName, base64Data, contactName) {
    if (!currentFolderId || !gapi.client.getToken()) return base64Data;

    try {
        // attachmentsフォルダを作成または取得
        let attachmentsFolderId = await getOrCreateFolder('attachments', currentFolderId);
        
        // 連絡先名のフォルダを作成または取得
        const safeName = contactName.replace(/[<>:"/\\|?*]/g, '_');
        let contactFolderId = await getOrCreateFolder(safeName, attachmentsFolderId);

        // Base64をBlobに変換
        const byteCharacters = atob(base64Data.split(',')[1]);
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

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
            {
                method: 'POST',
                headers: new Headers({'Authorization': 'Bearer ' + gapi.client.getToken().access_token}),
                body: form
            }
        );

        const file = await response.json();
        return `drive:${file.id}`;
    } catch (error) {
        console.error('画像アップロードエラー:', error);
        return base64Data;
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

// Googleドライブから画像を読み込み
async function loadImageFromGoogleDrive(driveId) {
    if (!driveId || !driveId.startsWith('drive:')) return driveId;

    try {
        const fileId = driveId.replace('drive:', '');
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        // バイナリデータをBase64に変換
        return 'data:image/jpeg;base64,' + btoa(response.body);
    } catch (error) {
        console.error('画像読み込みエラー:', error);
        return '';
    }
}

// 添付ファイル管理
async function saveAttachmentToFileSystem(fileName, dataUrl, contactName) {
    return await uploadImageToGoogleDrive(fileName, dataUrl, contactName);
}

async function loadAttachmentFromFileSystem(filePath) {
    return await loadImageFromGoogleDrive(filePath);
}

// 旧データのチェック（オプション）
function checkForOldData() {
    // 必要に応じて旧データの存在チェック
    console.log('データチェック完了');
}