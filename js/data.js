// data.js - Google Drive APIを使用したデータ管理（OAuth 2.0のみ・APIキー不要版）

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
            
            await initializeDataFolder();
            await loadAllData();
            showNotification('Googleドライブに接続しました', 'success');
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

// サインアウト
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        accessToken = null;
        
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

// データフォルダの初期化
async function initializeDataFolder() {
    try {
        // "MeetingSystemData"フォルダを検索
        const response = await gapi.client.drive.files.list({
            q: "name='MeetingSystemData' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.result.files && response.result.files.length > 0) {
            currentFolderId = response.result.files[0].id;
            console.log('既存のデータフォルダを使用:', currentFolderId);
        } else {
            // フォルダが存在しない場合は作成
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: 'MeetingSystemData',
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            currentFolderId = createResponse.result.id;
            console.log('新しいデータフォルダを作成:', currentFolderId);
        }
    } catch (error) {
        console.error('フォルダ初期化エラー:', error);
        showNotification('フォルダの初期化に失敗しました', 'error');
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
        
        calculateReferrerRevenues();
        renderContacts();
        renderTodos();
        updateFilters();
        updateMultiSelectOptions();
        updateTodoTabBadge();
        
        // 旧データのチェック（必要に応じて）
        if (typeof checkForOldData === 'function') {
            checkForOldData();
        }
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