// ===== セットアップウィザード機能 =====

// セットアップウィザード表示
function showSetupWizard() {
    if (document.getElementById('settingsModal')) {
        closeModal('settingsModal');
    }
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'none';
    document.getElementById('setupWizard').style.display = 'block';
    document.getElementById('backToMainBtn').style.display = 'none';
    
    // 現在のURLを表示
    let origin = window.location.origin;
    if (!origin || origin === 'null' || origin === 'file://') {
        origin = 'http://localhost:8000';
        document.getElementById('origin-url').textContent = origin;
        const codeBlock = document.getElementById('origin-url').parentElement;
        if (!codeBlock.querySelector('.local-notice')) {
            const notice = document.createElement('p');
            notice.className = 'local-notice';
            notice.style.cssText = 'color: #ff9800; margin-top: 10px; font-size: 14px;';
            notice.innerHTML = '⚠️ ローカルファイルから実行しています。<br>Google認証を行うには、Webサーバーから実行する必要があります。<br>例: python -m http.server 8000';
            codeBlock.parentElement.insertBefore(notice, codeBlock.nextSibling);
        }
    } else {
        document.getElementById('origin-url').textContent = origin;
    }
}

// 設定画面からのセットアップウィザード表示
function showSetupWizardFromSettings() {
    closeModal('settingsModal');
    document.getElementById('mainContainer').style.display = 'none';
    document.getElementById('setupWizard').style.display = 'block';
    document.getElementById('backToMainBtn').style.display = 'block';
    
    let origin = window.location.origin;
    if (!origin || origin === 'null' || origin === 'file://') {
        origin = 'http://localhost:8000';
    }
    document.getElementById('origin-url').textContent = origin;
}

// セットアップを閉じて戻る
function closeSetupAndReturn() {
    document.getElementById('setupWizard').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'block';
    currentStep = 1;
    document.querySelectorAll('.setup-step').forEach(step => step.classList.remove('active'));
    document.getElementById('step1').classList.add('active');
    document.querySelectorAll('.step-dot').forEach(dot => {
        dot.classList.remove('active', 'completed');
    });
    document.getElementById('step1Dot').classList.add('active');
}

// 次のステップへ
function nextStep() {
    if (currentStep < 4) {
        document.getElementById(`step${currentStep}`).classList.remove('active');
        document.getElementById(`step${currentStep}Dot`).classList.remove('active');
        document.getElementById(`step${currentStep}Dot`).classList.add('completed');
        
        currentStep++;
        
        document.getElementById(`step${currentStep}`).classList.add('active');
        document.getElementById(`step${currentStep}Dot`).classList.add('active');
    }
}

// 前のステップへ
function previousStep() {
    if (currentStep > 1) {
        document.getElementById(`step${currentStep}`).classList.remove('active');
        document.getElementById(`step${currentStep}Dot`).classList.remove('active');
        
        currentStep--;
        
        document.getElementById(`step${currentStep}Dot`).classList.remove('completed');
        document.getElementById(`step${currentStep}Dot`).classList.add('active');
        document.getElementById(`step${currentStep}`).classList.add('active');
    }
}

// 検証して次へ
function validateAndProceed() {
    const clientId = document.getElementById('clientIdInput').value.trim();
    
    if (!clientId) {
        showNotification('クライアントIDを入力してください', 'error');
        return;
    }
    
    if (!clientId.includes('.apps.googleusercontent.com')) {
        showNotification('正しいクライアントIDを入力してください', 'error');
        return;
    }
    
    CLIENT_ID = clientId;
    localStorage.setItem('google_client_id', CLIENT_ID);
    
    const config = `クライアントID: ${CLIENT_ID}
アプリ名: 1to1 Meeting Manager
データ保存先: Google Drive/${APP_FOLDER_NAME}/

このアプリケーションは、あなたのGoogle Driveに専用フォルダを作成し、
そこにすべてのデータを安全に保存します。`;
    
    document.getElementById('final-config').textContent = config;
    
    nextStep();
}

// セットアップ完了
function completeSetup() {
    localStorage.setItem('setup_completed', 'true');
    isSetupCompleted = true;
    
    document.getElementById('setupWizard').style.display = 'none';
    
    try {
        // OAuth 2.0フローを使用しているため、Google IDサービスの初期化は不要
        initializeGisClient();
        gapi.load('client', initializeGapiClient);
    } catch (error) {
        console.error('Google API初期化エラー:', error);
        showNotification('初期化エラーが発生しました。ページを再読み込みしてください。', 'error');
    }
}

// フォルダ構造確認
async function checkFileStructure() {
    closeModal('settingsModal');
    showLoading();
    
    try {
        // レポート用のデータ
        const report = {
            totalFiles: 0,
            organized: 0,
            unorganized: 0,
            contactFolders: new Set(),
            unorganizedFiles: []
        };
        
        // attachmentsフォルダの存在確認
        let hasAttachmentsFolder = false;
        try {
            const response = await gapi.client.drive.files.list({
                q: `name='${ATTACHMENTS_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and '${appFolderId}' in parents and trashed=false`,
                fields: 'files(id, name)'
            });
            hasAttachmentsFolder = response.result.files && response.result.files.length > 0;
            if (hasAttachmentsFolder) {
                attachmentsFolderId = response.result.files[0].id;
            }
        } catch (error) {
            console.error('attachmentsフォルダの確認エラー:', error);
        }
        
        // 各連絡先のファイルをチェック
        for (const contact of contacts) {
            if (!contact.name) continue;
            
            const filesToCheck = [];
            
            // ファイルリストを収集
            if (contact.photo) filesToCheck.push({ id: contact.photo, type: '顔写真' });
            if (contact.cardImage) filesToCheck.push({ id: contact.cardImage, type: '名刺' });
            if (contact.attachments) {
                contact.attachments.forEach(att => {
                    if (att.id) filesToCheck.push({ id: att.id, type: att.name });
                });
            }
            
            // ミーティングファイルも確認
            const contactMeetings = meetings.filter(m => m.contactId === contact.id);
            for (const meeting of contactMeetings) {
                if (meeting.attachments) {
                    meeting.attachments.forEach(att => {
                        if (att.id) filesToCheck.push({ id: att.id, type: `ミーティング: ${att.name}` });
                    });
                }
            }
            
            // 各ファイルの場所を確認
            for (const file of filesToCheck) {
                try {
                    const fileInfo = await gapi.client.drive.files.get({
                        fileId: file.id,
                        fields: 'id,name,parents'
                    });
                    
                    if (fileInfo.result) {
                        report.totalFiles++;
                        
                        // 親フォルダ情報を取得
                        if (fileInfo.result.parents && fileInfo.result.parents.length > 0) {
                            const parentId = fileInfo.result.parents[0];
                            
                            // 親フォルダの情報を取得
                            const parentInfo = await gapi.client.drive.files.get({
                                fileId: parentId,
                                fields: 'id,name,parents'
                            });
                            
                            // attachmentsフォルダ内の連絡先フォルダにあるかチェック
                            if (parentInfo.result.parents && 
                                parentInfo.result.parents.includes(attachmentsFolderId) &&
                                parentInfo.result.name === sanitizeFileName(contact.name)) {
                                report.organized++;
                                report.contactFolders.add(contact.name);
                            } else {
                                report.unorganized++;
                                report.unorganizedFiles.push({
                                    contact: contact.name,
                                    fileType: file.type,
                                    currentLocation: parentInfo.result.name || 'ルート'
                                });
                            }
                        } else {
                            report.unorganized++;
                            report.unorganizedFiles.push({
                                contact: contact.name,
                                fileType: file.type,
                                currentLocation: 'ルート'
                            });
                        }
                    }
                } catch (error) {
                    console.error(`ファイル確認エラー (${file.id}):`, error);
                }
            }
        }
        
        hideLoading();
        
        // レポートを表示
        showFileStructureReport(report, hasAttachmentsFolder);
        
    } catch (error) {
        console.error('ファイル構造確認エラー:', error);
        hideLoading();
        showNotification('ファイル構造の確認中にエラーが発生しました', 'error');
    }
}

// ファイル構造レポート表示
function showFileStructureReport(report, hasAttachmentsFolder) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    const unorganizedList = report.unorganizedFiles.map(file => 
        `<tr>
            <td style="padding: 4px 8px;">${escapeHtml(file.contact)}</td>
            <td style="padding: 4px 8px;">${escapeHtml(file.fileType)}</td>
            <td style="padding: 4px 8px;">${escapeHtml(file.currentLocation)}</td>
        </tr>`
    ).join('');
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">
                <h2>ファイル構造レポート</h2>
                <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <h3>概要</h3>
                <table style="width: 100%; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 8px 0;">総ファイル数:</td>
                        <td style="padding: 8px 0; text-align: right;"><strong>${report.totalFiles}</strong> 個</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;">整理済み:</td>
                        <td style="padding: 8px 0; text-align: right; color: #34a853;"><strong>${report.organized}</strong> 個</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;">未整理:</td>
                        <td style="padding: 8px 0; text-align: right; color: ${report.unorganized > 0 ? '#d93025' : '#34a853'};"><strong>${report.unorganized}</strong> 個</td>
                    </tr>
                </table>
                
                ${!hasAttachmentsFolder ? `
                    <div style="background: #333; border: 1px solid #d93025; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                        <p style="color: #d93025; margin: 0;">
                            <strong>⚠️ attachmentsフォルダが存在しません</strong><br>
                            「ファイル整理」を実行して、新しいフォルダ構造を作成してください。
                        </p>
                    </div>
                ` : ''}
                
                ${report.unorganized > 0 ? `
                    <h3>未整理のファイル</h3>
                    <div style="max-height: 300px; overflow-y: auto; background: #1a1a1a; border-radius: 6px; padding: 10px;">
                        <table style="width: 100%; font-size: 13px;">
                            <thead>
                                <tr style="border-bottom: 1px solid #444;">
                                    <th style="text-align: left; padding: 4px 8px;">連絡先</th>
                                    <th style="text-align: left; padding: 4px 8px;">ファイル種別</th>
                                    <th style="text-align: left; padding: 4px 8px;">現在の場所</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${unorganizedList}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="background: #333; border: 1px solid #4c8bf5; padding: 15px; border-radius: 6px; margin-top: 20px;">
                        <p style="margin: 0;">
                            💡 <strong>ヒント:</strong> 「ファイル整理」機能を使用すると、<br>
                            これらのファイルを自動的に正しいフォルダに移動できます。
                        </p>
                    </div>
                ` : `
                    <div style="background: #333; border: 1px solid #34a853; padding: 15px; border-radius: 6px;">
                        <p style="color: #34a853; margin: 0;">
                            ✅ すべてのファイルが正しく整理されています！
                        </p>
                    </div>
                `}
                
                <div class="action-buttons" style="margin-top: 20px;">
                    ${report.unorganized > 0 ? `
                        <button class="btn-primary" onclick="this.closest('.modal').remove(); migrateExistingFiles();">ファイル整理を実行</button>
                    ` : ''}
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">閉じる</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // モーダルのクリック処理
    let modalMouseDownTarget = null;
    modal.addEventListener('mousedown', (e) => {
        modalMouseDownTarget = e.target;
    });
    modal.addEventListener('mouseup', (e) => {
        if (e.target === modal && modalMouseDownTarget === modal) {
            modal.remove();
        }
        modalMouseDownTarget = null;
    });
}