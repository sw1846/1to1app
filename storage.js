// storage.js - Google Drive操作モジュール

class StorageManager {
    constructor() {
        this.APP_FOLDER_NAME = 'PlaceOn_1to1_App';
        this.ATTACHMENTS_FOLDER_NAME = 'attachments';
        this.appFolderId = null;
        this.attachmentsFolderId = null;
        this.contactFolderIds = new Map(); // 連絡先名 -> フォルダIDのマップ
    }

    // 初期化（フォルダ構造の作成）
    async initialize() {
        try {
            // アプリフォルダの作成・取得
            this.appFolderId = await this.getOrCreateFolder(this.APP_FOLDER_NAME);
            
            // 添付ファイルフォルダの作成・取得
            this.attachmentsFolderId = await this.getOrCreateFolder(
                this.ATTACHMENTS_FOLDER_NAME, 
                this.appFolderId
            );
            
            console.log('Storage initialized:', {
                appFolder: this.appFolderId,
                attachmentsFolder: this.attachmentsFolderId
            });
            
            return true;
        } catch (error) {
            console.error('Storage initialization error:', error);
            throw error;
        }
    }

    // フォルダの取得または作成
    async getOrCreateFolder(folderName, parentId = null) {
        try {
            // 既存フォルダを検索
            let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
            if (parentId) {
                query += ` and '${parentId}' in parents`;
            }

            const response = await gapi.client.drive.files.list({
                q: query,
                fields: 'files(id, name)',
                spaces: 'drive'
            });

            if (response.result.files && response.result.files.length > 0) {
                return response.result.files[0].id;
            }

            // フォルダを新規作成
            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder'
            };

            if (parentId) {
                fileMetadata.parents = [parentId];
            }

            const createResponse = await gapi.client.drive.files.create({
                resource: fileMetadata,
                fields: 'id'
            });

            return createResponse.result.id;
        } catch (error) {
            console.error('Folder creation error:', error);
            throw error;
        }
    }

    // 連絡先用フォルダの取得または作成
    async getOrCreateContactFolder(contactName) {
        // キャッシュをチェック
        if (this.contactFolderIds.has(contactName)) {
            return this.contactFolderIds.get(contactName);
        }

        // サニタイズされたフォルダ名
        const sanitizedName = this.sanitizeFileName(contactName);
        const folderId = await this.getOrCreateFolder(sanitizedName, this.attachmentsFolderId);
        
        // キャッシュに保存
        this.contactFolderIds.set(contactName, folderId);
        
        return folderId;
    }

    // JSONファイルの読み込み
    async loadJsonFile(fileName) {
        try {
            // ファイルを検索
            const response = await gapi.client.drive.files.list({
                q: `name='${fileName}' and '${this.appFolderId}' in parents and trashed=false`,
                fields: 'files(id)',
                spaces: 'drive'
            });

            if (!response.result.files || response.result.files.length === 0) {
                return null;
            }

            const fileId = response.result.files[0].id;
            
            // ファイルの内容を取得
            const fileResponse = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            return fileResponse.result;
        } catch (error) {
            console.error(`Error loading ${fileName}:`, error);
            return null;
        }
    }

    // JSONファイルの保存
    async saveJsonFile(fileName, data) {
        try {
            const fileContent = JSON.stringify(data, null, 2);
            const blob = new Blob([fileContent], { type: 'application/json' });

            // 既存ファイルを検索
            const searchResponse = await gapi.client.drive.files.list({
                q: `name='${fileName}' and '${this.appFolderId}' in parents and trashed=false`,
                fields: 'files(id)',
                spaces: 'drive'
            });

            const metadata = {
                name: fileName,
                mimeType: 'application/json'
            };

            let fileId;
            if (searchResponse.result.files && searchResponse.result.files.length > 0) {
                // 既存ファイルを更新
                fileId = searchResponse.result.files[0].id;
                await this.updateFile(fileId, metadata, blob);
            } else {
                // 新規ファイルを作成
                metadata.parents = [this.appFolderId];
                const result = await this.createFile(metadata, blob);
                fileId = result.id;
            }

            return fileId;
        } catch (error) {
            console.error(`Error saving ${fileName}:`, error);
            throw error;
        }
    }

    // ファイルのアップロード
    async uploadFile(file, contactName, isPhoto = false, isBusinessCard = false) {
        try {
            // 連絡先フォルダを取得・作成
            const contactFolderId = await this.getOrCreateContactFolder(contactName);
            
            // ファイル名の生成
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sanitizedFileName = this.sanitizeFileName(file.name);
            let fileName = `${timestamp}_${sanitizedFileName}`;
            
            if (isPhoto) {
                fileName = `photo_${timestamp}${this.getFileExtension(file.name)}`;
            } else if (isBusinessCard) {
                fileName = `businesscard_${timestamp}${this.getFileExtension(file.name)}`;
            }

            const metadata = {
                name: fileName,
                parents: [contactFolderId]
            };

            // ファイルをアップロード
            const result = await this.createFile(metadata, file);
            
            // 公開URLを生成（必要に応じて）
            const shareUrl = await this.createShareableLink(result.id);

            return {
                id: result.id,
                name: fileName,
                url: shareUrl,
                webViewLink: result.webViewLink,
                mimeType: file.type,
                size: file.size
            };
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    }

    // ファイルの作成
    async createFile(metadata, blob) {
        const form = new FormData();
        
        form.append('metadata', new Blob([JSON.stringify(metadata)], {
            type: 'application/json'
        }));
        
        form.append('file', blob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`
            },
            body: form
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        return await response.json();
    }

    // ファイルの更新
    async updateFile(fileId, metadata, blob) {
        const form = new FormData();
        
        form.append('metadata', new Blob([JSON.stringify(metadata)], {
            type: 'application/json'
        }));
        
        form.append('file', blob);

        const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,webViewLink`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${gapi.client.getToken().access_token}`
            },
            body: form
        });

        if (!response.ok) {
            throw new Error(`Update failed: ${response.statusText}`);
        }

        return await response.json();
    }

    // ファイルの削除
    async deleteFile(fileId) {
        try {
            await gapi.client.drive.files.delete({
                fileId: fileId
            });
            return true;
        } catch (error) {
            console.error('File deletion error:', error);
            return false;
        }
    }

    // 共有可能なリンクの作成
    async createShareableLink(fileId) {
        try {
            // ファイルを「リンクを知っている人」に公開
            await gapi.client.drive.permissions.create({
                fileId: fileId,
                resource: {
                    type: 'anyone',
                    role: 'reader'
                }
            });

            // 直接アクセス可能なURLを生成
            return `https://drive.google.com/uc?id=${fileId}&export=view`;
        } catch (error) {
            console.error('Share link creation error:', error);
            return null;
        }
    }

    // ファイルのダウンロード
    async downloadFile(fileId) {
        try {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            return response.body;
        } catch (error) {
            console.error('File download error:', error);
            throw error;
        }
    }

    // ファイル名のサニタイズ
    sanitizeFileName(fileName) {
        // 特殊文字を置換
        return fileName
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 100); // 長さ制限
    }

    // ファイル拡張子の取得
    getFileExtension(fileName) {
        const lastDot = fileName.lastIndexOf('.');
        return lastDot > -1 ? fileName.substring(lastDot) : '';
    }

    // バックアップの作成
    async createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFolderName = `backup_${timestamp}`;
            
            // バックアップフォルダを作成
            const backupFolderId = await this.getOrCreateFolder(backupFolderName, this.appFolderId);
            
            // 全JSONファイルをバックアップ
            const files = ['contacts.json', 'meetings.json', 'options.json'];
            
            for (const fileName of files) {
                const data = await this.loadJsonFile(fileName);
                if (data) {
                    const metadata = {
                        name: fileName,
                        parents: [backupFolderId]
                    };
                    
                    const blob = new Blob([JSON.stringify(data, null, 2)], {
                        type: 'application/json'
                    });
                    
                    await this.createFile(metadata, blob);
                }
            }
            
            return backupFolderId;
        } catch (error) {
            console.error('Backup creation error:', error);
            throw error;
        }
    }

    // ストレージ使用量の取得
    async getStorageQuota() {
        try {
            const response = await gapi.client.drive.about.get({
                fields: 'storageQuota'
            });
            
            const quota = response.result.storageQuota;
            return {
                limit: parseInt(quota.limit),
                usage: parseInt(quota.usage),
                usageInDrive: parseInt(quota.usageInDrive),
                usageInDriveTrash: parseInt(quota.usageInDriveTrash)
            };
        } catch (error) {
            console.error('Storage quota error:', error);
            return null;
        }
    }
}

// エクスポート用のグローバル変数
window.StorageManager = StorageManager;