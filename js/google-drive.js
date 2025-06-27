// ===== Google Drive API操作 =====

// アプリフォルダーの確保
async function ensureAppFolder() {
    try {
        await ensureValidToken();
        
        // 既存のフォルダーを検索
        const response = await gapi.client.drive.files.list({
            q: "name='1to1MeetingData' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            APP_FOLDER_ID = response.result.files[0].id;
            console.log('既存のフォルダーを使用:', APP_FOLDER_ID);
        } else {
            // フォルダーを作成
            const folderMetadata = {
                name: '1to1MeetingData',
                mimeType: 'application/vnd.google-apps.folder'
            };
            
            const folder = await gapi.client.drive.files.create({
                resource: folderMetadata,
                fields: 'id'
            });
            
            APP_FOLDER_ID = folder.result.id;
            console.log('新しいフォルダーを作成:', APP_FOLDER_ID);
        }
    } catch (error) {
        console.error('フォルダー確保エラー:', error);
        throw error;
    }
}

// JSONファイルの読み込み
async function loadJsonFile(filename) {
    try {
        await ensureValidToken();
        
        if (!APP_FOLDER_ID) {
            await ensureAppFolder();
        }
        
        // ファイルを検索
        const response = await gapi.client.drive.files.list({
            q: `name='${filename}' and '${APP_FOLDER_ID}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
        
        if (response.result.files && response.result.files.length > 0) {
            const fileId = response.result.files[0].id;
            
            // ファイル内容を取得
            const file = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });
            
            return file.result;
        }
        
        return null;
    } catch (error) {
        console.error(`${filename}読み込みエラー:`, error);
        return null;
    }
}

// JSONファイルの保存
async function saveJsonFile(filename, data) {
    try {
        await ensureValidToken();
        
        if (!APP_FOLDER_ID) {
            await ensureAppFolder();
        }
        
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";
        
        // ファイルが既に存在するか確認
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${filename}' and '${APP_FOLDER_ID}' in parents and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive'
        });
        
        const metadata = {
            name: filename,
            mimeType: 'application/json'
        };
        
        if (!searchResponse.result.files || searchResponse.result.files.length === 0) {
            metadata.parents = [APP_FOLDER_ID];
        }
        
        const base64Data = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n' +
            'Content-Transfer-Encoding: base64\r\n' +
            '\r\n' +
            base64Data +
            close_delim;
        
        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            // 既存ファイルを更新
            const fileId = searchResponse.result.files[0].id;
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
            // 新規ファイルを作成
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
    } catch (error) {
        console.error(`${filename}保存エラー:`, error);
        throw error;
    }
}

// ファイルアップロード
async function uploadFile(file, filename, contactName) {
    try {
        await ensureValidToken();
        
        if (!APP_FOLDER_ID) {
            await ensureAppFolder();
        }
        
        // メタデータ
        const metadata = {
            name: filename || file.name,
            parents: [APP_FOLDER_ID]
        };
        
        // ファイルをアップロード
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`
            },
            body: form
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // ダイレクトURLを生成
        const directUrl = `https://lh3.googleusercontent.com/d/${result.id}`;
        
        return {
            id: result.id,
            url: directUrl
        };
    } catch (error) {
        console.error('ファイルアップロードエラー:', error);
        throw error;
    }
}

// 認証付きファイルURLの取得
async function getAuthenticatedFileUrl(fileId) {
    try {
        await ensureValidToken();
        
        // ファイルのメタデータを取得
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'webContentLink,webViewLink,mimeType'
        });
        
        if (response.result.webContentLink) {
            return response.result.webContentLink;
        } else if (response.result.webViewLink) {
            return response.result.webViewLink;
        }
        
        // 直接アクセスURLを返す
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    } catch (error) {
        console.error('ファイルURL取得エラー:', error);
        // エラー時はダイレクトURLを返す
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
}