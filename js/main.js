// ===== メイン処理 =====

// アプリケーション初期化
function initializeApp() {
    console.log('=== アプリケーション初期化開始 ===');
    console.log('CLIENT_ID:', CLIENT_ID ? '設定済み' : '未設定');
    
    isSetupCompleted = localStorage.getItem('setup_completed') === 'true';
    
    initializeViewMode();
    initializeFilterVisibility();
    
    if (!CLIENT_ID) {
        console.log('CLIENT_IDが未設定のため、セットアップウィザードを表示します');
        showSetupWizard();
        return;
    }
    
    console.log('Google APIを初期化します');
    
    try {
        // OAuth 2.0フローを使用しているため、Google IDサービスの初期化は不要
        initializeGisClient();
        gapi.load('client', initializeGapiClient);
    } catch (error) {
        console.error('Google API初期化エラー:', error);
        showSetupWizard();
    }
}

// イベントリスナー設定
document.addEventListener('DOMContentLoaded', () => {
    setupFileDragDrop();
    
    // モーダルのクリック処理を改善
    let modalMouseDownTarget = null;
    
    document.querySelectorAll('.modal').forEach(modal => {
        // マウスダウン時のターゲットを記録
        modal.addEventListener('mousedown', (e) => {
            modalMouseDownTarget = e.target;
        });
        
        // マウスアップ時に両方がモーダル背景なら閉じる
        modal.addEventListener('mouseup', (e) => {
            if (e.target === modal && modalMouseDownTarget === modal) {
                closeModal(modal.id);
            }
            modalMouseDownTarget = null;
        });
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multi-select')) {
            document.querySelectorAll('.multi-select-dropdown').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        }
    });
    
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
    });
    
    window.addEventListener('online', () => {
        showNotification('インターネット接続が復旧しました', 'success');
    });
    
    window.addEventListener('offline', () => {
        showNotification('インターネット接続が切断されました', 'error');
    });
});

// ページ離脱前の確認
window.onbeforeunload = function(e) {
    if (hasUnsavedDraft) {
        const message = '編集中の内容があります。保存しますか？';
        e.returnValue = message;
        return message;
    }
};

// ページ読み込み時の初期化
window.onload = function() {
    initializeApp();
};

// ===== ファイル移行機能 =====

// 既存ファイル移行
async function migrateExistingFiles() {
    if (!confirm('既存のファイルを新しいフォルダ構造（attachments/連絡先名/）に移動します。\n\nこの処理には時間がかかる場合があります。続行しますか？')) {
        return;
    }
    
    closeModal('settingsModal');
    
    // 進捗表示用のモーダルを作成
    const progressModal = document.createElement('div');
    progressModal.className = 'modal';
    progressModal.style.display = 'block';
    progressModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2>ファイル移行中...</h2>
            </div>
            <div class="modal-body">
                <div id="migrationProgress" style="margin-bottom: 20px;">
                    <div class="loading"></div>
                    <p style="margin-top: 20px;" id="migrationStatus">準備中...</p>
                </div>
                <div id="migrationLog" style="max-height: 300px; overflow-y: auto; background: #1a1a1a; padding: 10px; border-radius: 4px; font-size: 12px; font-family: monospace;">
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(progressModal);
    
    const statusEl = document.getElementById('migrationStatus');
    const logEl = document.getElementById('migrationLog');
    
    function addLog(message, isError = false) {
        const time = new Date().toLocaleTimeString();
        const color = isError ? '#d93025' : '#4c8bf5';
        logEl.innerHTML += `<div style="color: ${color};">[${time}] ${message}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    }
    
    try {
        addLog('移行処理を開始します...');
        
        // attachmentsフォルダが存在することを確認
        await ensureAttachmentsFolder();
        addLog('attachmentsフォルダを確認しました');
        
        let totalMoved = 0;
        let errors = 0;
        
        // 各連絡先のファイルを処理
        for (const contact of contacts) {
            if (!contact.name) continue;
            
            statusEl.textContent = `処理中: ${contact.name}`;
            
            // 連絡先のフォルダを作成
            const contactFolderId = await ensureContactFolder(contact.name);
            addLog(`📁 ${contact.name} のフォルダを作成/確認`);
            
            // 移動するファイルのリスト
            const filesToMove = [];
            
            // 顔写真
            if (contact.photo) {
                filesToMove.push({
                    fileId: contact.photo,
                    type: '顔写真',
                    contact: contact.name
                });
            }
            
            // 名刺画像
            if (contact.cardImage) {
                filesToMove.push({
                    fileId: contact.cardImage,
                    type: '名刺',
                    contact: contact.name
                });
            }
            
            // 添付ファイル
            if (contact.attachments && contact.attachments.length > 0) {
                for (const att of contact.attachments) {
                    if (att.id) {
                        filesToMove.push({
                            fileId: att.id,
                            type: att.name,
                            contact: contact.name
                        });
                    }
                }
            }
            
            // ミーティングの添付ファイル
            const contactMeetings = meetings.filter(m => m.contactId === contact.id);
            for (const meeting of contactMeetings) {
                if (meeting.attachments && meeting.attachments.length > 0) {
                    for (const att of meeting.attachments) {
                        if (att.id) {
                            filesToMove.push({
                                fileId: att.id,
                                type: `ミーティング: ${att.name}`,
                                contact: contact.name
                            });
                        }
                    }
                }
            }
            
            // ファイルを移動
            for (const file of filesToMove) {
                try {
                    // ファイルの現在の情報を取得
                    const fileInfo = await gapi.client.drive.files.get({
                        fileId: file.fileId,
                        fields: 'id,name,parents'
                    });
                    
                    if (fileInfo.result) {
                        // 既に正しいフォルダにある場合はスキップ
                        if (fileInfo.result.parents && fileInfo.result.parents.includes(contactFolderId)) {
                            addLog(`✓ ${file.type} は既に正しい場所にあります`);
                            continue;
                        }
                        
                        // ファイルを新しいフォルダに移動
                        const previousParents = fileInfo.result.parents ? fileInfo.result.parents.join(',') : '';
                        
                        await gapi.client.drive.files.update({
                            fileId: file.fileId,
                            addParents: contactFolderId,
                            removeParents: previousParents,
                            fields: 'id, parents'
                        });
                        
                        addLog(`✓ ${file.type} を移動しました`);
                        totalMoved++;
                    }
                } catch (error) {
                    addLog(`✗ ${file.type} の移動に失敗: ${error.message}`, true);
                    errors++;
                }
            }
        }
        
        statusEl.textContent = '移行完了！';
        addLog(`\n===== 移行完了 =====`);
        addLog(`移動したファイル: ${totalMoved}個`);
        if (errors > 0) {
            addLog(`エラー: ${errors}個`, true);
        }
        
        // 完了ボタンを追加
        const modalBody = progressModal.querySelector('.modal-body');
        modalBody.innerHTML += `
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn-primary" onclick="this.closest('.modal').remove()">閉じる</button>
            </div>
        `;
        
        showNotification('ファイルの移行が完了しました');
        
    } catch (error) {
        console.error('移行エラー:', error);
        addLog(`致命的エラー: ${error.message}`, true);
        statusEl.textContent = 'エラーが発生しました';
        
        // エラー時も閉じるボタンを追加
        const modalBody = progressModal.querySelector('.modal-body');
        modalBody.innerHTML += `
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn-primary" onclick="this.closest('.modal').remove()">閉じる</button>
            </div>
        `;
        
        showNotification('ファイル移行中にエラーが発生しました', 'error');
    }
}

// 特定フォルダ間のデータ移行
async function migrateFromSpecificFolder() {
    closeModal('settingsModal');
    
    // フォルダID入力用のモーダル
    const inputModal = document.createElement('div');
    inputModal.className = 'modal';
    inputModal.style.display = 'block';
    inputModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>フォルダ間データ移行設定</h2>
                <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 20px;">移動元と移動先のGoogle DriveフォルダIDを入力してください。</p>
                
                <div class="form-group">
                    <label>移動元フォルダID</label>
                    <input type="text" id="sourceFolderId" placeholder="例: 1As7VHK1IZ1EmWXZmtbEsIEQiK3jI76wP">
                    <small style="color: #aaa; display: block; margin-top: 5px;">
                        Google DriveでフォルダのURLから取得できます（folders/の後の文字列）
                    </small>
                </div>
                
                <div class="form-group">
                    <label>移動先フォルダID</label>
                    <input type="text" id="targetFolderId" placeholder="例: 1h-QG1jRtlGf7C3WemDKTRPWabysODsM-">
                    <small style="color: #aaa; display: block; margin-top: 5px;">
                        移動先では連絡先名でサブフォルダが作成されます
                    </small>
                </div>
                
                <div style="background: #333; border: 1px solid #444; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <p style="color: #ff9800; margin: 0;">
                        <strong>⚠️ 注意事項</strong><br>
                        • 移動元フォルダ内のすべてのファイルが対象となります<br>
                        • ファイルは連絡先と紐付けられ、連絡先名のサブフォルダに移動されます<br>
                        • 紐付けできないファイルは「未分類」フォルダに移動されます<br>
                        • この操作は取り消せません
                    </p>
                </div>
                
                <div style="background: #2d3748; border: 1px solid #4c8bf5; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                    <p style="color: #4c8bf5; margin: 0;">
                        <strong>💡 共有フォルダへのアクセスについて</strong><br>
                        • 共有フォルダを使用する場合は、そのフォルダへの編集権限が必要です<br>
                        • フォルダが「マイドライブ」に表示されていることを確認してください<br>
                        • 共有ドライブのファイルは、supportsAllDrivesパラメータが必要な場合があります<br>
                        • アクセスエラーが発生した場合は、フォルダの共有設定を確認してください
                    </p>
                </div>
                
                <div class="action-buttons">
                    <button class="btn-primary" onclick="executeFolderMigration()">移行を開始</button>
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">キャンセル</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(inputModal);
    
    // モーダルのクリック処理
    let modalMouseDownTarget = null;
    inputModal.addEventListener('mousedown', (e) => {
        modalMouseDownTarget = e.target;
    });
    inputModal.addEventListener('mouseup', (e) => {
        if (e.target === inputModal && modalMouseDownTarget === inputModal) {
            inputModal.remove();
        }
        modalMouseDownTarget = null;
    });
}

async function executeFolderMigration() {
    const sourceFolderId = document.getElementById('sourceFolderId').value.trim();
    const targetFolderId = document.getElementById('targetFolderId').value.trim();
    
    if (!sourceFolderId || !targetFolderId) {
        showNotification('フォルダIDを入力してください', 'error');
        return;
    }
    
    if (sourceFolderId === targetFolderId) {
        showNotification('移動元と移動先は異なるフォルダを指定してください', 'error');
        return;
    }
    
    // 入力モーダルを閉じる
    document.querySelector('.modal').remove();
    
    // 進捗表示用のモーダル
    const progressModal = document.createElement('div');
    progressModal.className = 'modal';
    progressModal.style.display = 'block';
    progressModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h2>フォルダ間データ移行</h2>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 20px;">
                    <p><strong>移動元:</strong> ${sourceFolderId}</p>
                    <p><strong>移動先:</strong> ${targetFolderId}</p>
                </div>
                <div id="migrationProgress" style="margin-bottom: 20px;">
                    <div class="loading"></div>
                    <p style="margin-top: 20px;" id="migrationStatus">フォルダを確認中...</p>
                </div>
                <div id="migrationLog" style="max-height: 300px; overflow-y: auto; background: #1a1a1a; padding: 10px; border-radius: 4px; font-size: 12px; font-family: monospace;">
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(progressModal);
    
    const statusEl = document.getElementById('migrationStatus');
    const logEl = document.getElementById('migrationLog');
    
    function addLog(message, isError = false) {
        const time = new Date().toLocaleTimeString();
        const color = isError ? '#d93025' : '#4c8bf5';
        logEl.innerHTML += `<div style="color: ${color};">[${time}] ${message}</div>`;
        logEl.scrollTop = logEl.scrollHeight;
    }
    
    try {
        // フォルダの存在確認
        addLog('フォルダの存在を確認中...');
        
        // 移動元フォルダ確認（共有ドライブ対応）
        try {
            const sourceFolder = await gapi.client.drive.files.get({
                fileId: sourceFolderId,
                fields: 'id, name, mimeType',
                supportsAllDrives: true
            });
            if (sourceFolder.result.mimeType !== 'application/vnd.google-apps.folder') {
                throw new Error('移動元は有効なフォルダではありません');
            }
            addLog(`移動元フォルダ確認: ${sourceFolder.result.name}`);
        } catch (error) {
            console.error('移動元フォルダエラー:', error);
            if (error.status === 404) {
                addLog('移動元フォルダが見つかりません。', true);
                addLog('共有フォルダの場合は、以下を確認してください：', true);
                addLog('1. フォルダが自分と共有されているか', true);
                addLog('2. 編集権限があるか', true);
                addLog('3. 「マイドライブ」に追加されているか', true);
                throw new Error('移動元フォルダへのアクセス権限がありません');
            } else {
                addLog(`移動元フォルダエラー: ${error.message}`, true);
                throw new Error('移動元フォルダの確認に失敗しました');
            }
        }
        
        // 移動先フォルダ確認（共有ドライブ対応）
        try {
            const targetFolder = await gapi.client.drive.files.get({
                fileId: targetFolderId,
                fields: 'id, name, mimeType',
                supportsAllDrives: true
            });
            if (targetFolder.result.mimeType !== 'application/vnd.google-apps.folder') {
                throw new Error('移動先は有効なフォルダではありません');
            }
            addLog(`移動先フォルダ確認: ${targetFolder.result.name}`);
        } catch (error) {
            console.error('移動先フォルダエラー:', error);
            if (error.status === 404) {
                addLog('移動先フォルダが見つかりません。', true);
                addLog('共有フォルダの場合は、編集権限と「マイドライブ」への追加を確認してください。', true);
                throw new Error('移動先フォルダへのアクセス権限がありません');
            } else {
                addLog(`移動先フォルダエラー: ${error.message}`, true);
                throw new Error('移動先フォルダの確認に失敗しました');
            }
        }
        
        // 移動元フォルダのファイルを取得（共有ドライブ対応）
        statusEl.textContent = 'ファイルを取得中...';
        addLog('移動元フォルダのファイルを取得中...');
        let allFiles = [];
        let pageToken = null;
        
        do {
            const response = await gapi.client.drive.files.list({
                q: `'${sourceFolderId}' in parents and trashed=false`,
                fields: 'nextPageToken, files(id, name, mimeType, size)',
                pageSize: 1000,
                pageToken: pageToken,
                supportsAllDrives: true,
                includeItemsFromAllDrives: true
            });
            
            if (response.result.files) {
                allFiles = allFiles.concat(response.result.files);
            }
            pageToken = response.result.nextPageToken;
        } while (pageToken);
        
        addLog(`${allFiles.length}個のファイルが見つかりました`);
        
        if (allFiles.length === 0) {
            statusEl.textContent = '移動するファイルがありません';
            addLog('移動対象のファイルが見つかりませんでした', true);
            const modalBody = progressModal.querySelector('.modal-body');
            modalBody.innerHTML += `
                <div class="action-buttons" style="margin-top: 20px;">
                    <button class="btn-primary" onclick="this.closest('.modal').remove()">閉じる</button>
                </div>
            `;
            return;
        }
        
        // ファイルと連絡先のマッチング
        statusEl.textContent = 'ファイルと連絡先を照合中...';
        const fileContactMap = new Map();
        const unmatchedFiles = [];
        
        for (const file of allFiles) {
            let matched = false;
            
            // ファイルIDで連絡先を検索
            for (const contact of contacts) {
                if (contact.photo === file.id || 
                    contact.cardImage === file.id ||
                    (contact.attachments && contact.attachments.some(att => att.id === file.id))) {
                    fileContactMap.set(file.id, contact);
                    matched = true;
                    break;
                }
            }
            
            // ミーティングの添付ファイルも確認
            if (!matched) {
                for (const meeting of meetings) {
                    if (meeting.attachments && meeting.attachments.some(att => att.id === file.id)) {
                        const contact = contacts.find(c => c.id === meeting.contactId);
                        if (contact) {
                            fileContactMap.set(file.id, contact);
                            matched = true;
                            break;
                        }
                    }
                }
            }
            
            // ファイル名から連絡先を推測
            if (!matched) {
                const fileName = file.name.toLowerCase();
                for (const contact of contacts) {
                    if (contact.name && fileName.includes(contact.name.toLowerCase())) {
                        fileContactMap.set(file.id, contact);
                        matched = true;
                        addLog(`ファイル名から連絡先を推測: ${file.name} → ${contact.name}`);
                        break;
                    }
                }
            }
            
            if (!matched) {
                unmatchedFiles.push(file);
            }
        }
        
        addLog(`${fileContactMap.size}個のファイルが連絡先と紐付けられました`);
        if (unmatchedFiles.length > 0) {
            addLog(`${unmatchedFiles.length}個のファイルは連絡先と紐付けできませんでした`, true);
        }
        
        // ファイルを移動
        let movedCount = 0;
        let errorCount = 0;
        
        // 連絡先ごとにグループ化
        const contactGroups = new Map();
        for (const [fileId, contact] of fileContactMap) {
            if (!contactGroups.has(contact.id)) {
                contactGroups.set(contact.id, []);
            }
            const file = allFiles.find(f => f.id === fileId);
            if (file) {
                contactGroups.get(contact.id).push(file);
            }
        }
        
        // 各連絡先のファイルを処理
        for (const [contactId, files] of contactGroups) {
            const contact = contacts.find(c => c.id === contactId);
            if (!contact || !contact.name) continue;
            
            statusEl.textContent = `処理中: ${contact.name} (${files.length}個のファイル)`;
            
            // 連絡先フォルダを作成
            const folderName = sanitizeFileName(contact.name);
            let contactFolderId;
            
            try {
                // 既存フォルダを確認
                const folderSearch = await gapi.client.drive.files.list({
                    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${targetFolderId}' in parents and trashed=false`,
                    fields: 'files(id)',
                    supportsAllDrives: true
                });
                
                if (folderSearch.result.files && folderSearch.result.files.length > 0) {
                    contactFolderId = folderSearch.result.files[0].id;
                    addLog(`📁 ${contact.name} のフォルダを使用`);
                } else {
                    // フォルダを作成
                    const folderResponse = await gapi.client.drive.files.create({
                        resource: {
                            name: folderName,
                            mimeType: 'application/vnd.google-apps.folder',
                            parents: [targetFolderId]
                        },
                        fields: 'id',
                        supportsAllDrives: true
                    });
                    contactFolderId = folderResponse.result.id;
                    addLog(`📁 ${contact.name} のフォルダを作成`);
                }
                
                // ファイルを移動
                for (const file of files) {
                    try {
                        await gapi.client.drive.files.update({
                            fileId: file.id,
                            addParents: contactFolderId,
                            removeParents: sourceFolderId,
                            fields: 'id, parents',
                            supportsAllDrives: true
                        });
                        
                        addLog(`✓ ${file.name} を移動`);
                        movedCount++;
                    } catch (error) {
                        addLog(`✗ ${file.name} の移動に失敗: ${error.message}`, true);
                        errorCount++;
                    }
                }
            } catch (error) {
                addLog(`✗ ${contact.name} のフォルダ作成/移動に失敗: ${error.message}`, true);
                errorCount += files.length;
            }
        }
        
        // 紐付けできなかったファイルの処理
        if (unmatchedFiles.length > 0) {
            statusEl.textContent = '未分類ファイルを処理中...';
            
            // 未分類フォルダを作成
            let unmatchedFolderId;
            try {
                const folderSearch = await gapi.client.drive.files.list({
                    q: `name='未分類' and mimeType='application/vnd.google-apps.folder' and '${targetFolderId}' in parents and trashed=false`,
                    fields: 'files(id)',
                    supportsAllDrives: true
                });
                
                if (folderSearch.result.files && folderSearch.result.files.length > 0) {
                    unmatchedFolderId = folderSearch.result.files[0].id;
                } else {
                    const folderResponse = await gapi.client.drive.files.create({
                        resource: {
                            name: '未分類',
                            mimeType: 'application/vnd.google-apps.folder',
                            parents: [targetFolderId]
                        },
                        fields: 'id',
                        supportsAllDrives: true
                    });
                    unmatchedFolderId = folderResponse.result.id;
                }
                
                addLog('📁 未分類フォルダを作成/確認');
                
                // 未分類ファイルを移動
                for (const file of unmatchedFiles) {
                    try {
                        await gapi.client.drive.files.update({
                            fileId: file.id,
                            addParents: unmatchedFolderId,
                            removeParents: sourceFolderId,
                            fields: 'id, parents',
                            supportsAllDrives: true
                        });
                        
                        addLog(`✓ ${file.name} を未分類フォルダへ移動`);
                        movedCount++;
                    } catch (error) {
                        addLog(`✗ ${file.name} の移動に失敗: ${error.message}`, true);
                        errorCount++;
                    }
                }
            } catch (error) {
                addLog('未分類フォルダの作成/移動に失敗', true);
                errorCount += unmatchedFiles.length;
            }
        }
        
        // 完了
        statusEl.textContent = '移行完了！';
        addLog(`\n===== 移行完了 =====`);
        addLog(`成功: ${movedCount}個のファイル`);
        if (errorCount > 0) {
            addLog(`失敗: ${errorCount}個のファイル`, true);
        }
        
        // 移動先がattachmentsFolderの場合は更新
        if (targetFolderId === attachmentsFolderId) {
            addLog('attachmentフォルダへの移動を検知しました');
        }
        
        // 完了ボタンを追加
        const modalBody = progressModal.querySelector('.modal-body');
        modalBody.innerHTML += `
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn-primary" onclick="this.closest('.modal').remove();">閉じる</button>
            </div>
        `;
        
        showNotification('フォルダ間のデータ移行が完了しました');
        
    } catch (error) {
        console.error('移行エラー:', error);
        addLog(`致命的エラー: ${error.message}`, true);
        statusEl.textContent = 'エラーが発生しました';
        
        const modalBody = progressModal.querySelector('.modal-body');
        modalBody.innerHTML += `
            <div class="action-buttons" style="margin-top: 20px;">
                <button class="btn-primary" onclick="this.closest('.modal').remove()">閉じる</button>
            </div>
        `;
        
        showNotification('データ移行中にエラーが発生しました', 'error');
    }
}