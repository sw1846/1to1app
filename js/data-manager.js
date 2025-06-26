// ===== データ管理機能 =====

// データ読み込み
async function loadData() {
    try {
        await loadOptions();
        
        const contactsData = await loadJsonFile('contacts.json');
        contacts = contactsData || [];
        
        // データ読み込み時のログ
        console.log('=== 読み込んだ連絡先データ ===');
        console.log('連絡先数:', contacts.length);
        if (contacts.length > 0) {
            console.log('サンプルデータ:', contacts[0]);
        }
        
        const meetingsData = await loadJsonFile('meetings.json');
        meetings = meetingsData || [];
        
        migrateMeetingsData();
        migrateContactsData();
        
        if (Object.keys(dropdownOptions).every(key => dropdownOptions[key].length === 0)) {
            const optionsData = await loadJsonFile('options.json');
            if (optionsData && optionsData.dropdownOptions) {
                dropdownOptions = optionsData.dropdownOptions;
            }
        }
        
        updateAllReferrerLinks();
        
        // 画像URLの修正を実行
        await fixImageUrls();
    } catch (error) {
        console.error('Error loading data:', error);
        showNotification('データの読み込みに失敗しました', 'error');
    }
}

// データ保存
async function saveData() {
    try {
        console.log('=== データ保存 ===');
        console.log('保存する連絡先数:', contacts.length);
        if (contacts.length > 0) {
            console.log('サンプル連絡先データ:', contacts[0]);
        }
        
        const savePromises = [];
        
        savePromises.push(saveJsonFile('contacts.json', contacts));
        savePromises.push(saveJsonFile('meetings.json', meetings));
        
        const optionsData = {
            dropdownOptions: dropdownOptions,
            userSettings: userSettings
        };
        savePromises.push(saveJsonFile('options.json', optionsData));
        
        await Promise.all(savePromises);
        
        showNotification('データを保存しました');
    } catch (error) {
        console.error('Error saving data:', error);
        showNotification('データの保存に失敗しました', 'error');
        throw error;
    }
}

// データ同期
async function syncData() {
    try {
        closeModal('settingsModal');
        showNotification('同期中...', 'info');
        await loadData();
        
        renderContactList();
        updateDropdownOptions();
        renderOutstandingActions();
        updateContactCount();
        
        showNotification('同期が完了しました');
    } catch (error) {
        console.error('Sync error:', error);
        showNotification('同期に失敗しました', 'error');
    }
}

// 設定読み込み
async function loadOptions() {
    try {
        const optionsData = await loadJsonFile('options.json');
        if (optionsData) {
            if (optionsData.dropdownOptions) {
                dropdownOptions = optionsData.dropdownOptions;
            }
            if (optionsData.userSettings) {
                userSettings = optionsData.userSettings;
                viewMode = userSettings.viewMode || 'card';
                filterVisible = userSettings.filterVisible || false;
                if (userSettings.meetingTemplate) {
                    localStorage.setItem('meetingTemplate', userSettings.meetingTemplate);
                }
            }
        }
    } catch (error) {
        console.error('設定読み込みエラー:', error);
    }
}

// 設定保存
async function saveOptions() {
    try {
        userSettings.viewMode = viewMode;
        userSettings.filterVisible = filterVisible;
        userSettings.meetingTemplate = localStorage.getItem('meetingTemplate') || '';
        
        const optionsData = {
            dropdownOptions: dropdownOptions,
            userSettings: userSettings
        };
        
        await saveJsonFile('options.json', optionsData);
    } catch (error) {
        console.error('設定保存エラー:', error);
    }
}

// データエクスポート
async function exportData() {
    closeModal('settingsModal');
    
    try {
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            contacts: contacts,
            meetings: meetings,
            dropdownOptions: dropdownOptions
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting_data_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('データをエクスポートしました');
    } catch (error) {
        console.error('Export error:', error);
        showNotification('データのエクスポートに失敗しました', 'error');
    }
}

// データインポート
async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        showLoading();
        const text = await file.text();
        const importedData = JSON.parse(text);
        
        if (!importedData.version || !importedData.contacts || !importedData.meetings) {
            throw new Error('無効なデータ形式です');
        }
        
        const existingContactIds = new Set(contacts.map(c => c.id));
        const existingMeetingIds = new Set(meetings.map(m => m.id));
        
        let addedContacts = 0;
        let addedMeetings = 0;
        
        for (const contact of importedData.contacts) {
            if (!existingContactIds.has(contact.id)) {
                if (!contact.hasOwnProperty('yomi')) contact.yomi = '';
                if (!contact.hasOwnProperty('cutout')) contact.cutout = '';
                if (!contact.hasOwnProperty('cardImage')) contact.cardImage = '';
                if (!contact.hasOwnProperty('cardImageUrl')) contact.cardImageUrl = '';
                
                // 画像URLを修正
                contact = fixContactImageUrls(contact);
                
                contacts.push(contact);
                addedContacts++;
            }
        }
        
        for (const meeting of importedData.meetings) {
            if (!existingMeetingIds.has(meeting.id)) {
                if (contacts.some(c => c.id === meeting.contactId)) {
                    meetings.push(meeting);
                    addedMeetings++;
                }
            }
        }
        
        migrateMeetingsData();
        migrateContactsData();
        
        if (importedData.dropdownOptions) {
            for (const key in importedData.dropdownOptions) {
                if (dropdownOptions[key]) {
                    dropdownOptions[key] = [...new Set([...dropdownOptions[key], ...importedData.dropdownOptions[key]])];
                }
            }
        }
        
        await saveData();
        
        updateDropdownOptions();
        updateAllReferrerLinks();
        renderContactList();
        updateContactCount();
        
        hideLoading();
        showNotification(`インポート完了: ${addedContacts}件の連絡先と${addedMeetings}件のミーティングを追加しました`);
        
        event.target.value = '';
    } catch (error) {
        console.error('Import error:', error);
        showNotification('データのインポートに失敗しました', 'error');
        hideLoading();
        event.target.value = '';
    }
}

// データマイグレーション
function migrateContactsData() {
    let needsSave = false;
    
    contacts.forEach(contact => {
        if (!contact.hasOwnProperty('yomi')) {
            contact.yomi = '';
            needsSave = true;
        }
        if (!contact.hasOwnProperty('cutout')) {
            contact.cutout = '';
            needsSave = true;
        }
        if (!contact.hasOwnProperty('cardImage')) {
            contact.cardImage = '';
            needsSave = true;
        }
        if (!contact.hasOwnProperty('cardImageUrl')) {
            contact.cardImageUrl = '';
            needsSave = true;
        }
        
        // ファイルパス形式のphotoフィールドをクリーンアップ
        if (contact.photo && contact.photo.startsWith('/')) {
            console.log(`ファイルパス形式のphotoフィールドを削除: ${contact.name} - ${contact.photo}`);
            delete contact.photo;
            needsSave = true;
        }
        
        // ファイルパス形式のcardImageフィールドをクリーンアップ
        if (contact.cardImage && contact.cardImage.startsWith('/')) {
            console.log(`ファイルパス形式のcardImageフィールドを削除: ${contact.name} - ${contact.cardImage}`);
            delete contact.cardImage;
            needsSave = true;
        }
    });
    
    if (needsSave) {
        console.log('連絡先データに新しいフィールドを追加しました');
    }
}

function migrateMeetingsData() {
    let needsSave = false;
    
    meetings.forEach(meeting => {
        if (!meeting.hasOwnProperty('tasks')) {
            meeting.tasks = [];
            if (meeting.nextAction) {
                const taskLines = meeting.nextAction.split('\n').filter(line => line.trim());
                taskLines.forEach((taskText, index) => {
                    meeting.tasks.push({
                        text: taskText.trim(),
                        due: index === 0 ? meeting.nextActionDue : null,
                        done: meeting.nextActionDoneTasks && meeting.nextActionDoneTasks[index] || false
                    });
                });
            }
            needsSave = true;
        }
    });
    
    if (needsSave) {
        console.log('ミーティングデータを新形式に移行しました');
    }
}

// Google Drive画像URLを修正する関数
function fixDriveImageUrl(url) {
    if (!url) return '';
    
    // すでにlh3.googleusercontent.comの場合はそのまま
    if (url.includes('lh3.googleusercontent.com/d/')) {
        return url;
    }
    
    // drive.google.com/file/d/{id}/view 形式から ID を抽出
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (fileMatch && fileMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
    }
    
    // drive.google.com/open?id={id} 形式から ID を抽出
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (openMatch && openMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
    }
    
    // その他のGoogle DriveのURL形式
    const driveMatch = url.match(/drive\.google\.com.*[/?&]([a-zA-Z0-9-_]{20,})/);
    if (driveMatch && driveMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    
    return url;
}

// 連絡先の画像URLを修正
function fixContactImageUrls(contact) {
    if (contact.photoUrl) {
        contact.photoUrl = fixDriveImageUrl(contact.photoUrl);
    }
    if (contact.cardImageUrl) {
        contact.cardImageUrl = fixDriveImageUrl(contact.cardImageUrl);
    }
    return contact;
}

// Google Drive画像URLを修正する関数
function fixDriveImageUrl(url) {
    if (!url) return '';
    
    // すでにlh3.googleusercontent.comの場合はそのまま
    if (url.includes('lh3.googleusercontent.com/d/')) {
        return url;
    }
    
    // drive.google.com/file/d/{id}/view 形式から ID を抽出
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (fileMatch && fileMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
    }
    
    // drive.google.com/open?id={id} 形式から ID を抽出
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (openMatch && openMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
    }
    
    // その他のGoogle DriveのURL形式
    const driveMatch = url.match(/drive\.google\.com.*[/?&]([a-zA-Z0-9-_]{20,})/);
    if (driveMatch && driveMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }
    
    return url;
}

// 写真URLマイグレーション（既存の関数名を維持）
function migratePhotoUrls() {
    console.log('=== 顔写真URLのマイグレーション開始 ===');
    let migratedCount = 0;
    let dropboxCount = 0;
    let needsSave = false;
    
    contacts.forEach(contact => {
        let updated = false;
        
        // Dropbox URLをチェックして削除
        if (contact.photoUrl && contact.photoUrl.includes('dropbox')) {
            console.log(`🚫 Dropbox URLを検出（顔写真）: ${contact.name} - ${contact.photoUrl}`);
            delete contact.photoUrl;
            dropboxCount++;
            updated = true;
            needsSave = true;
        }
        
        if (contact.cardImageUrl && contact.cardImageUrl.includes('dropbox')) {
            console.log(`🚫 Dropbox URLを検出（名刺）: ${contact.name} - ${contact.cardImageUrl}`);
            delete contact.cardImageUrl;
            dropboxCount++;
            updated = true;
            needsSave = true;
        }
        
        // 添付ファイルのDropbox URLもチェック
        if (contact.attachments && contact.attachments.length > 0) {
            contact.attachments = contact.attachments.filter(att => {
                if (att.url && att.url.includes('dropbox')) {
                    console.log(`🚫 Dropbox URLを検出（添付ファイル）: ${contact.name} - ${att.name}`);
                    dropboxCount++;
                    needsSave = true;
                    return false;
                }
                return true;
            });
        }
        
        // Google Drive URLの変換（Dropbox以外）
        if (contact.photoUrl && !contact.photoUrl.includes('lh3.googleusercontent.com/d/') && !contact.photoUrl.includes('dropbox')) {
            const oldUrl = contact.photoUrl;
            const newUrl = fixDriveImageUrl(contact.photoUrl);
            if (oldUrl !== newUrl) {
                contact.photoUrl = newUrl;
                updated = true;
                console.log(`✅ 顔写真URLを変換: ${contact.name}`);
                console.log(`   旧: ${oldUrl}`);
                console.log(`   新: ${newUrl}`);
            }
        }
        
        if (contact.cardImageUrl && !contact.cardImageUrl.includes('lh3.googleusercontent.com/d/') && !contact.cardImageUrl.includes('dropbox')) {
            const oldUrl = contact.cardImageUrl;
            const newUrl = fixDriveImageUrl(contact.cardImageUrl);
            if (oldUrl !== newUrl) {
                contact.cardImageUrl = newUrl;
                updated = true;
                console.log(`✅ 名刺画像URLを変換: ${contact.name}`);
            }
        }
        
        // 添付ファイルのGoogle Drive URLも変換
        if (contact.attachments && contact.attachments.length > 0) {
            contact.attachments.forEach(att => {
                if (att.url && !att.url.includes('lh3.googleusercontent.com/d/') && !att.url.includes('dropbox')) {
                    const oldUrl = att.url;
                    const newUrl = fixDriveImageUrl(att.url);
                    if (oldUrl !== newUrl) {
                        att.url = newUrl;
                        updated = true;
                        console.log(`✅ 添付ファイルURLを変換: ${contact.name} - ${att.name}`);
                    }
                }
            });
        }
        
        if (updated) {
            needsSave = true;
            migratedCount++;
        }
    });
    
    // ミーティングの添付ファイルもチェック
    meetings.forEach(meeting => {
        let meetingUpdated = false;
        
        if (meeting.attachments && meeting.attachments.length > 0) {
            const originalLength = meeting.attachments.length;
            meeting.attachments = meeting.attachments.filter(att => {
                if (att.url && att.url.includes('dropbox')) {
                    console.log(`🚫 Dropbox URLを検出（ミーティング添付）: ${att.name}`);
                    dropboxCount++;
                    needsSave = true;
                    return false;
                }
                return true;
            });
            
            // Google Drive URLの変換
            meeting.attachments.forEach(att => {
                if (att.url && !att.url.includes('lh3.googleusercontent.com/d/') && !att.url.includes('dropbox')) {
                    const oldUrl = att.url;
                    const newUrl = fixDriveImageUrl(att.url);
                    if (oldUrl !== newUrl) {
                        att.url = newUrl;
                        meetingUpdated = true;
                        console.log(`✅ ミーティング添付ファイルURLを変換: ${att.name}`);
                    }
                }
            });
            
            if (meeting.attachments.length < originalLength || meetingUpdated) {
                meeting.updatedAt = new Date().toISOString();
                needsSave = true;
            }
        }
    });
    
    if (dropboxCount > 0) {
        console.log(`⚠️ ${dropboxCount}件のDropbox URLを削除しました`);
        showNotification(`${dropboxCount}件の古いDropboxリンクを削除しました`, 'info');
    }
    
    if (needsSave) {
        console.log(`📊 ${migratedCount}件の画像URLを変換しました`);
        saveData().catch(error => {
            console.error('マイグレーション後の保存エラー:', error);
        });
    }
}

// 既存の画像URLを修正（新規追加関数）
async function fixImageUrls() {
    console.log('=== 画像URLの修正開始 ===');
    let needsSave = false;
    
    contacts.forEach(contact => {
        const originalPhotoUrl = contact.photoUrl;
        const originalCardImageUrl = contact.cardImageUrl;
        
        contact = fixContactImageUrls(contact);
        
        if (originalPhotoUrl !== contact.photoUrl) {
            console.log(`✅ 顔写真URLを修正: ${contact.name}`);
            console.log(`   旧: ${originalPhotoUrl}`);
            console.log(`   新: ${contact.photoUrl}`);
            needsSave = true;
        }
        
        if (originalCardImageUrl !== contact.cardImageUrl) {
            console.log(`✅ 名刺画像URLを修正: ${contact.name}`);
            console.log(`   旧: ${originalCardImageUrl}`);
            console.log(`   新: ${contact.cardImageUrl}`);
            needsSave = true;
        }
    });
    
    if (needsSave) {
        console.log('画像URLを修正しました。保存します...');
        await saveData();
    } else {
        console.log('修正が必要な画像URLはありませんでした。');
    }
}

// 紹介元リンク更新
function updateAllReferrerLinks() {
    for (const contact of contacts) {
        if (contact.referredBy) {
            const referrers = contacts.filter(c => c.name === contact.referredBy && c.id !== contact.id);
            
            delete contact.referredById;
            delete contact.referredByIds;
            
            if (referrers.length === 1) {
                contact.referredById = referrers[0].id;
            } else if (referrers.length > 1) {
                contact.referredByIds = referrers.map(r => r.id);
            }
        }
    }
}

// 紹介元表示
function getReferrerDisplay(contact) {
    if (contact.referredById) {
        const referrer = contacts.find(c => c.id === contact.referredById);
        if (referrer) {
            return `<a href="#" onclick="showContactDetail('${referrer.id}'); return false;">${escapeHtml(referrer.name)}</a>`;
        }
    } else if (contact.referredByIds && contact.referredByIds.length > 0) {
        return `<span>${escapeHtml(contact.referredBy)} <small style="color: #d93025;">(紹介元が複数あります)</small></span>`;
    }
    return escapeHtml(contact.referredBy || '');
}