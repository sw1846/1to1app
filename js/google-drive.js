// ===== Google Drive操作関数 =====

// アプリフォルダ確認・作成
async function ensureAppFolder() {
    try {
        await ensureValidToken(); // トークンチェック
        
        // アプリフォルダを確認・作成
        const response = await gapi.client.drive.files.list({
            q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            appFolderId = response.result.files[0].id;
        } else {
            const folderResponse = await gapi.client.drive.files.create({
                resource: {
                    name: APP_FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            appFolderId = folderResponse.result.id;
        }
        
        console.log('App folder ID:', appFolderId);
        
        // attachmentsフォルダを確認・作成
        await ensureAttachmentsFolder();
    } catch (error) {
        console.error('Error creating app folder:', error);
        throw error;
    }
}

// 添付ファイル用フォルダ確認・作成
async function ensureAttachmentsFolder() {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${ATTACHMENTS_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and '${appFolderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            attachmentsFolderId = response.result.files[0].id;
        } else {
            const folderResponse = await gapi.client.drive.files.create({
                resource: {
                    name: ATTACHMENTS_FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [appFolderId]
                },
                fields: 'id'
            });
            attachmentsFolderId = folderResponse.result.id;
        }
        
        console.log('Attachments folder ID:', attachmentsFolderId);
    } catch (error) {
        console.error('Error creating attachments folder:', error);
        throw error;
    }
}

// 連絡先用フォルダ確認・作成
async function ensureContactFolder(contactName) {
    try {
        // 連絡先名をそのままフォルダ名として使用（既存の実装を維持）
        const folderName = contactName;
        
        const response = await gapi.client.drive.files.list({
            q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${attachmentsFolderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        } else {
            const folderResponse = await gapi.client.drive.files.create({
                resource: {
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [attachmentsFolderId]
                },
                fields: 'id'
            });
            return folderResponse.result.id;
        }
    } catch (error) {
        console.error('Error creating contact folder:', error);
        throw error;
    }
}

// JSONファイル保存
async function saveJsonFile(fileName, data) {
    await ensureValidToken(); // トークンチェック
    
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    
    try {
        console.log(`saveJsonFile(${fileName}): データサイズ=${JSON.stringify(data).length}文字`);
        
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${appFolderId}' in parents and trashed=false`,
            fields: 'files(id)'
        });
        
        let fileId;
        let metadata;
        let multipartRequestBody;
        
        // JSONデータを文字列化（エンコーディングを明示）
        const jsonContent = JSON.stringify(data, null, 2);
        
        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            fileId = searchResponse.result.files[0].id;
            
            metadata = {
                name: fileName
            };
            
            multipartRequestBody =
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                jsonContent +
                close_delim;
            
            await gapi.client.request({
                path: `/upload/drive/v3/files/${fileId}`,
                method: 'PATCH',
                params: { uploadType: 'multipart' },
                headers: {
                    'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                },
                body: multipartRequestBody
            });
        } else {
            metadata = {
                name: fileName,
                mimeType: 'application/json',
                parents: [appFolderId]
            };
            
            multipartRequestBody =
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                jsonContent +
                close_delim;
            
            await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                headers: {
                    'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                },
                body: multipartRequestBody
            });
        }
        
        console.log(`${fileName} を保存しました`);
    } catch (error) {
        console.error('Error saving file:', error);
        throw error;
    }
}

// JSONファイル読み込み
async function loadJsonFile(fileName) {
    try {
        await ensureValidToken(); // トークンチェック
        
        console.log(`loadJsonFile(${fileName}): 読み込み開始`);
        
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${appFolderId}' in parents and trashed=false`,
            fields: 'files(id)'
        });
        
        if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
            console.log(`${fileName} が見つかりません`);
            return null;
        }
        
        const fileId = searchResponse.result.files[0].id;
        
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        console.log(`${fileName} を読み込みました`);
        return response.result;
    } catch (error) {
        console.error('Error loading file:', error);
        return null;
    }
}

// ファイルアップロード（画像URL修正版）
async function uploadFile(file, customName = null, contactName = null) {
    await ensureValidToken(); // トークンチェック
    
    let parentFolderId = appFolderId;
    if (contactName) {
        parentFolderId = await ensureContactFolder(contactName);
    }
    
    const fileName = customName || file.name;
    const metadata = {
        name: fileName,
        parents: [parentFolderId]
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    
    try {
        // まずファイルをアップロード
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form
        });
        
        if (!response.ok) {
            throw new Error('Upload failed');
        }
        
        const result = await response.json();
        
        // アップロード後、画像ファイルの場合は適切なURLを取得
        let imageUrl = '';
        if (file.type.startsWith('image/')) {
            // 画像ファイルの場合、直接アクセス可能なURLを生成
            imageUrl = `https://lh3.googleusercontent.com/d/${result.id}`;
        }
        
        return {
            id: result.id,
            url: imageUrl || `https://drive.google.com/file/d/${result.id}/view`
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

// ファイルアクセスURL生成（認証付き）
async function getAuthenticatedFileUrl(fileIdOrPath) {
    try {
        await ensureValidToken();
        
        // ファイルパスの場合はそのまま返す（旧データ形式対応）
        if (fileIdOrPath && fileIdOrPath.startsWith('/')) {
            console.warn('ファイルパス形式のデータが検出されました:', fileIdOrPath);
            return null;
        }
        
        // Google Drive IDの妥当性チェック
        if (!fileIdOrPath || fileIdOrPath.length < 10) {
            console.warn('無効なファイルID:', fileIdOrPath);
            return null;
        }
        
        // 画像ファイルの場合は直接アクセス可能なURLを返す
        return `https://lh3.googleusercontent.com/d/${fileIdOrPath}`;
    } catch (error) {
        console.error('Error getting authenticated URL:', error);
        return null;
    }
}