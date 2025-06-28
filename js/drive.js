// drive.js - Google Drive API操作

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

// アプリフォルダID
let appFolderId = null;
let attachmentsFolderId = null;

// Drive API初期化
async function initialize() {
    try {
        // アプリフォルダの存在確認・作成
        appFolderId = await getOrCreateAppFolder();
        
        // attachmentsフォルダの存在確認・作成
        attachmentsFolderId = await getOrCreateFolder('attachments', appFolderId);
        
        // 初期ファイルの作成（存在しない場合）
        await createInitialFiles();
        
    } catch (error) {
        console.error('Drive initialization error:', error);
        throw error;
    }
}

// アプリフォルダ取得または作成
async function getOrCreateAppFolder() {
    // appDataFolder内のファイルを検索
    const response = await fetch(`${DRIVE_API_BASE}/files?q='appDataFolder' in parents and name='1to1meeting' and mimeType='application/vnd.google-apps.folder'&spaces=appDataFolder`, {
        headers: auth.getAuthHeaders()
    });
    
    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
        return data.files[0].id;
    }
    
    // フォルダが存在しない場合は作成
    return await createFolder('1to1meeting', 'appDataFolder');
}

// フォルダ取得または作成
async function getOrCreateFolder(name, parentId) {
    const query = `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder'`;
    
    const response = await fetch(`${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&spaces=appDataFolder`, {
        headers: auth.getAuthHeaders()
    });
    
    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
        return data.files[0].id;
    }
    
    return await createFolder(name, parentId);
}

// フォルダ作成
async function createFolder(name, parentId) {
    const metadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
    };
    
    const response = await fetch(`${DRIVE_API_BASE}/files`, {
        method: 'POST',
        headers: auth.getAuthHeaders(),
        body: JSON.stringify(metadata)
    });
    
    const folder = await response.json();
    return folder.id;
}

// 初期ファイル作成
async function createInitialFiles() {
    const files = ['contacts.json', 'meetings.json', 'options.json'];
    
    for (const fileName of files) {
        const exists = await fileExists(fileName);
        if (!exists) {
            await createFile(fileName, JSON.stringify(fileName === 'options.json' ? {
                types: [],
                affiliations: [],
                wantToConnect: [],
                goldenEgg: []
            } : []));
        }
    }
}

// ファイル存在確認
async function fileExists(fileName) {
    const query = `'${appFolderId}' in parents and name='${fileName}'`;
    
    const response = await fetch(`${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&spaces=appDataFolder`, {
        headers: auth.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.files && data.files.length > 0;
}

// ファイル作成
async function createFile(fileName, content, parentId = null) {
    const metadata = {
        name: fileName,
        parents: [parentId || appFolderId]
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'application/json' }));
    
    const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${auth.getAuthHeaders().Authorization.split(' ')[1]}`
        },
        body: form
    });
    
    return await response.json();
}

// ファイル読み込み
async function readFile(fileName) {
    try {
        // ファイルIDを取得
        const fileId = await getFileId(fileName);
        if (!fileId) {
            return null;
        }
        
        // ファイル内容を取得
        const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media&spaces=appDataFolder`, {
            headers: auth.getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to read file');
        }
        
        return await response.text();
    } catch (error) {
        console.error(`Error reading file ${fileName}:`, error);
        return null;
    }
}

// ファイル更新
async function updateFile(fileName, content) {
    try {
        const fileId = await getFileId(fileName);
        if (!fileId) {
            // ファイルが存在しない場合は作成
            return await createFile(fileName, content);
        }
        
        const response = await fetch(`${UPLOAD_API_BASE}/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${auth.getAuthHeaders().Authorization.split(' ')[1]}`,
                'Content-Type': 'application/json'
            },
            body: content
        });
        
        return await response.json();
    } catch (error) {
        console.error(`Error updating file ${fileName}:`, error);
        throw error;
    }
}

// ファイルID取得
async function getFileId(fileName, parentId = null) {
    const query = `'${parentId || appFolderId}' in parents and name='${fileName}'`;
    
    const response = await fetch(`${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&spaces=appDataFolder`, {
        headers: auth.getAuthHeaders()
    });
    
    const data = await response.json();
    
    if (data.files && data.files.length > 0) {
        return data.files[0].id;
    }
    
    return null;
}

// ファイルアップロード（添付ファイル用）
async function uploadFile(file, contactName) {
    try {
        // 連絡先フォルダの取得または作成
        const contactFolderId = await getOrCreateFolder(
            utils.sanitizeFileName(contactName),
            attachmentsFolderId
        );
        
        // ファイル名の生成
        const timestamp = utils.generateTimestamp();
        const sanitizedName = utils.sanitizeFileName(file.name);
        const fileName = `${contactName}_${timestamp}_${sanitizedName}`;
        
        // メタデータ
        const metadata = {
            name: fileName,
            parents: [contactFolderId]
        };
        
        // マルチパートアップロード
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);
        
        const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${auth.getAuthHeaders().Authorization.split(' ')[1]}`
            },
            body: form
        });
        
        const result = await response.json();
        
        return {
            id: result.id,
            name: result.name,
            size: file.size,
            mimeType: file.type,
            webViewLink: `https://drive.google.com/file/d/${result.id}/view`
        };
    } catch (error) {
        console.error('File upload error:', error);
        throw error;
    }
}

// ファイル削除
async function deleteFile(fileId) {
    try {
        const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
            method: 'DELETE',
            headers: auth.getAuthHeaders()
        });
        
        if (!response.ok && response.status !== 204) {
            throw new Error('Failed to delete file');
        }
        
        return true;
    } catch (error) {
        console.error('File deletion error:', error);
        throw error;
    }
}

// ファイルダウンロード
async function downloadFile(fileId) {
    try {
        const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media&spaces=appDataFolder`, {
            headers: auth.getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to download file');
        }
        
        return await response.blob();
    } catch (error) {
        console.error('File download error:', error);
        throw error;
    }
}

// 画像ファイル取得（Base64）
async function getImageAsBase64(fileId) {
    try {
        const blob = await downloadFile(fileId);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Image fetch error:', error);
        return null;
    }
}

// データ保存
async function saveData() {
    try {
        utils.showLoading();
        
        // 連絡先データ保存
        await updateFile('contacts.json', JSON.stringify(window.contacts || []));
        
        // ミーティングデータ保存
        await updateFile('meetings.json', JSON.stringify(window.meetings || []));
        
        // オプションデータ保存
        await updateFile('options.json', JSON.stringify(window.options || {}));
        
        utils.showNotification('データを保存しました');
    } catch (error) {
        console.error('Save error:', error);
        utils.showNotification('保存に失敗しました', 'error');
        throw error;
    } finally {
        utils.hideLoading();
    }
}

// エクスポート
window.drive = {
    initialize,
    readFile,
    updateFile,
    uploadFile,
    deleteFile,
    downloadFile,
    getImageAsBase64,
    saveData
};