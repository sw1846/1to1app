// ===== 連絡先管理機能 =====

// 連絡先フォーム表示
function showContactForm(contactId = null) {
    closeModal('contactDetailModal');
    
    currentEditingContactId = contactId;
    resetContactForm();
    
    if (contactId) {
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
            document.getElementById('contactFormTitle').textContent = '連絡先編集';
            const form = document.getElementById('contactForm');
            form.name.value = contact.name || '';
            form.yomi.value = contact.yomi || '';
            form.company.value = contact.company || '';
            form.referredBy.value = contact.referredBy || '';
            form.strengths.value = contact.strengths || '';
            form.careerHistory.value = contact.careerHistory || '';
            form.cutout.value = contact.cutout || '';
            form.area.value = contact.area || '';
            form.residence.value = contact.residence || '';
            
            // 複数メールアドレスの設定
            if (contact.emails && contact.emails.length > 0) {
                contact.emails.forEach(email => addEmailInput(email));
            } else if (contact.email) {
                // 旧形式からの移行
                addEmailInput(contact.email);
            } else {
                addEmailInput();
            }
            
            // 複数電話番号の設定
            if (contact.phones && contact.phones.length > 0) {
                contact.phones.forEach(phone => addPhoneInput(phone));
            } else if (contact.phone) {
                // 旧形式からの移行
                addPhoneInput(contact.phone);
            } else {
                addPhoneInput();
            }
            
            // 関係者の設定
            if (contact.relatedContacts && contact.relatedContacts.length > 0) {
                contact.relatedContacts.forEach(relatedId => addRelatedContact(relatedId));
            }
            
            if (contact.photoUrl && !contact.photoUrl.includes('dropbox')) {
                document.getElementById('photoPreview').innerHTML = 
                    `<img src="${contact.photoUrl}" style="max-width: 200px; margin-top: 10px; border-radius: 8px;" onerror="handleImageError(this, '${escapeHtml(contact.name)}')">`;
            }
            
            if (contact.cardImageUrl && !contact.cardImageUrl.includes('dropbox')) {
                document.getElementById('cardImagePreview').innerHTML = 
                    `<img src="${contact.cardImageUrl}" style="max-width: 100%; margin-top: 10px; border-radius: 8px;" onerror="handleImageError(this, '名刺')">`;
            }
            
            ensureMultiSelectOptions(contact);
            setSelectedValues('types', contact.types || []);
            setSelectedValues('affiliations', contact.affiliations || []);
            setSelectedValues('wantToConnect', contact.wantToConnect || []);
            setSelectedValues('goldenEgg', contact.goldenEgg || []);
            
            displayExistingAttachments(contact.attachments || []);
            
            const contactMeetings = meetings.filter(m => m.contactId === contactId);
            hasFirstMeeting[contactId] = contactMeetings.length > 0;
            
            if (contactMeetings.length === 0) {
                document.getElementById('firstMeetingSection').style.display = 'block';
                const now = new Date();
                now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                form.firstMeetingDatetime.value = now.toISOString().slice(0, 16);
                
                const template = localStorage.getItem('meetingTemplate') || '';
                form.firstMeetingContent.value = template;
            }
        }
    } else {
        document.getElementById('contactFormTitle').textContent = '新規連絡先登録';
        
        // デフォルトで1つずつ入力欄を追加
        addEmailInput();
        addPhoneInput();
        
        document.getElementById('firstMeetingSection').style.display = 'block';
        document.getElementById('firstMeetingSection').classList.add('first-meeting-new');
        
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.querySelector('input[name="firstMeetingDatetime"]').value = now.toISOString().slice(0, 16);
        
        const template = localStorage.getItem('meetingTemplate') || '';
        document.querySelector('textarea[name="firstMeetingContent"]').value = template;
    }
    
    setupMultiSelect();
    setupFirstMeetingFileDrop();
    document.getElementById('contactFormModal').style.display = 'block';
    document.querySelector('#contactFormModal .modal-content').scrollTop = 0;
}

// 連絡先保存
async function saveContactForm(event) {
    event.preventDefault();
    showLoading();
    
    const formData = new FormData(event.target);
    
    // 既存データをベースに更新（編集時）
    let contact;
    if (currentEditingContactId) {
        const existing = contacts.find(c => c.id === currentEditingContactId);
        if (existing) {
            // 既存データをコピーしてから更新
            contact = { ...existing };
        } else {
            // 既存データが見つからない場合は新規作成
            contact = { id: currentEditingContactId };
        }
    } else {
        // 新規作成
        contact = { id: generateId() };
    }
    
    // フォームデータで更新
    contact.name = formData.get('name');
    contact.yomi = formData.get('yomi');
    contact.company = formData.get('company');
    contact.referredBy = formData.get('referredBy');
    contact.strengths = formData.get('strengths');
    contact.careerHistory = formData.get('careerHistory');
    contact.cutout = formData.get('cutout');
    contact.area = formData.get('area');
    contact.residence = formData.get('residence');
    
    // 複数メールアドレス・電話番号の取得
    contact.emails = formData.getAll('emails[]').filter(email => email.trim());
    contact.phones = formData.getAll('phones[]').filter(phone => phone.trim());
    
    // 関係者の取得
    contact.relatedContacts = formData.getAll('relatedContacts[]').filter(id => id);
    
    // マルチセレクトの値を取得（空配列でも必ず設定）
    contact.types = getSelectedValues('types');
    contact.affiliations = getSelectedValues('affiliations');
    contact.wantToConnect = getSelectedValues('wantToConnect');
    contact.goldenEgg = getSelectedValues('goldenEgg');
    
    // タイムスタンプ
    if (!contact.createdAt) {
        contact.createdAt = new Date().toISOString();
    }
    contact.updatedAt = new Date().toISOString();
    
    // attachmentsが未定義の場合は空配列を設定
    if (!contact.attachments) {
        contact.attachments = [];
    }
    
    try {
        // 画像ファイルの処理（氏名を含むファイル名で保存）
        if (currentPhotoFile) {
            const timestamp = new Date().getTime();
            const photoName = addContactNameToFileName(`photo_${timestamp}.jpg`, contact.name);
            const photoResult = await uploadFile(currentPhotoFile, photoName, contact.name);
            contact.photo = photoResult.id;
            contact.photoUrl = photoResult.url;
        }
        
        if (currentCardImageFile) {
            const timestamp = new Date().getTime();
            const cardImageName = addContactNameToFileName(`名刺_${timestamp}.jpg`, contact.name);
            const cardImageResult = await uploadFile(currentCardImageFile, cardImageName, contact.name);
            contact.cardImage = cardImageResult.id;
            contact.cardImageUrl = cardImageResult.url;
        }
        
        // 添付ファイルの処理（氏名を含むファイル名で保存）
        for (const file of selectedFiles) {
            const timestamp = new Date().getTime();
            const fileName = addContactNameToFileName(`${timestamp}_${file.name}`, contact.name);
            const fileResult = await uploadFile(file, fileName, contact.name);
            contact.attachments.push({
                name: file.name,
                id: fileResult.id,
                url: fileResult.url,
                uploadedAt: new Date().toISOString()
            });
        }
        
        // 削除された添付ファイルを除外
        if (contact.attachments && contact.attachments.length > 0) {
            contact.attachments = contact.attachments.filter(att => 
                !deletedAttachments.includes(att.id)
            );
        }
        
        // 連絡先を保存（既存の場合は更新、新規の場合は追加）
        const index = contacts.findIndex(c => c.id === contact.id);
        if (index >= 0) {
            contacts[index] = contact;
        } else {
            contacts.push(contact);
        }
        
        // 初回ミーティングの処理
        const firstMeetingDatetime = formData.get('firstMeetingDatetime');
        const firstMeetingContent = formData.get('firstMeetingContent');
        const firstMeetingSection = document.getElementById('firstMeetingSection');
        
        if (firstMeetingSection.style.display !== 'none' && 
            (firstMeetingDatetime || firstMeetingContent)) {
            
            const taskTexts = Array.from(document.querySelectorAll('#firstMeetingTaskContainer input[name="firstTaskText[]"]')).map(input => input.value);
            const taskDues = Array.from(document.querySelectorAll('#firstMeetingTaskContainer input[name="firstTaskDue[]"]')).map(input => input.value);
            
            const tasks = [];
            taskTexts.forEach((text, index) => {
                if (text.trim()) {
                    tasks.push({
                        text: text.trim(),
                        due: taskDues[index] || null,
                        done: false
                    });
                }
            });
            
            const firstMeeting = {
                id: generateId(),
                contactId: contact.id,
                datetime: firstMeetingDatetime || new Date().toISOString(),
                content: firstMeetingContent || '',
                tasks: tasks,
                attachments: [],
                isFirstMeeting: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            for (const file of selectedFirstMeetingFiles) {
                const timestamp = new Date().getTime();
                const fileName = addContactNameToFileName(`firstmeeting_${timestamp}_${file.name}`, contact.name);
                const fileResult = await uploadFile(file, fileName, contact.name);
                firstMeeting.attachments.push({
                    name: file.name,
                    id: fileResult.id,
                    url: fileResult.url,
                    uploadedAt: new Date().toISOString()
                });
            }
            
            meetings.push(firstMeeting);
        }
        
        updateAllReferrerLinks();
        
        await saveData();
        
        renderContactList();
        updateDropdownOptions();
        closeModal('contactFormModal');
        resetContactForm();
        updateContactCount();
        
        hideLoading();
        showNotification('連絡先を保存しました');
    } catch (error) {
        console.error('連絡先保存エラー:', error);
        showNotification('連絡先の保存に失敗しました', 'error');
        hideLoading();
    }
}

// 連絡先削除
async function deleteContact(contactId) {
    if (!confirm('この連絡先を削除してもよろしいですか？\n関連するミーティング記録も削除されます。')) {
        return;
    }
    
    showLoading();
    
    try {
        meetings = meetings.filter(m => m.contactId !== contactId);
        contacts = contacts.filter(c => c.id !== contactId);
        
        await saveData();
        
        renderContactList();
        updateDropdownOptions();
        closeModal('contactDetailModal');
        updateContactCount();
        
        hideLoading();
        showNotification('連絡先を削除しました');
    } catch (error) {
        console.error('連絡先削除エラー:', error);
        showNotification('連絡先の削除に失敗しました', 'error');
        hideLoading();
    }
}

// 連絡先詳細表示
function showContactDetail(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    const contactMeetings = meetings.filter(m => m.contactId === contactId)
        .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    
    // 顔写真部分を生成
    let photoHtml = '';
    if (contact.photoUrl && !contact.photoUrl.includes('dropbox')) {
        const escapedName = escapeHtml(contact.name).replace(/'/g, "\\'");
        photoHtml = `<div class="contact-photo" style="width: 120px; height: 120px; margin-bottom: 20px;">
            <img src="${contact.photoUrl}" alt="${escapeHtml(contact.name)}" loading="lazy" onerror="handleImageError(this, '${escapedName}')">
        </div>`;
    }
    
    // 複数メール・電話の表示
    const emailsHtml = contact.emails && contact.emails.length > 0 ? 
        contact.emails.map(email => `<div style="margin-bottom: 4px;">${linkifyText(email)}</div>`).join('') :
        (contact.email ? linkifyText(contact.email) : '');
    
    const phonesHtml = contact.phones && contact.phones.length > 0 ?
        contact.phones.map(phone => `<div style="margin-bottom: 4px;">${escapeHtml(phone)}</div>`).join('') :
        (contact.phone ? escapeHtml(contact.phone) : '');
    
    // 関係者の表示
    let relatedContactsHtml = '';
    if (contact.relatedContacts && contact.relatedContacts.length > 0) {
        const relatedNames = contact.relatedContacts.map(relatedId => {
            const related = contacts.find(c => c.id === relatedId);
            if (related) {
                return `<a href="#" onclick="showContactDetail('${related.id}'); return false;">${escapeHtml(related.name)}</a>`;
            }
            return null;
        }).filter(Boolean);
        
        if (relatedNames.length > 0) {
            relatedContactsHtml = `<tr><td style="padding: 8px 0; color: #aaaaaa;">関係者:</td><td style="padding: 8px 0;">${relatedNames.join('、')}</td></tr>`;
        }
    }
    
    let html = `
        <div style="margin-bottom: 20px;">
            ${photoHtml}
            <h3 style="font-size: 24px; margin-bottom: 10px;">${escapeHtml(contact.name)}</h3>
            ${contact.yomi ? `<p style="color: #aaaaaa; margin-bottom: 10px;">よみ: ${escapeHtml(contact.yomi)}</p>` : ''}
            ${contact.company ? `<p style="color: #aaaaaa; margin-bottom: 20px;">${escapeHtml(contact.company)}</p>` : ''}
        </div>
        
        <div class="detail-tabs">
            <button class="detail-tab active" onclick="switchTab(event, 'basic')">基本情報</button>
            <button class="detail-tab" onclick="switchTab(event, 'strength')">強み・経歴</button>
            <button class="detail-tab" onclick="switchTab(event, 'files')">ファイル</button>
        </div>
        
        <div id="basic" class="tab-content active">
            <div class="tab-panel">
                <table style="width: 100%; margin-bottom: 20px;">
                    ${emailsHtml ? `<tr><td style="padding: 8px 0; color: #aaaaaa; vertical-align: top;">メール:</td><td style="padding: 8px 0;">${emailsHtml}</td></tr>` : ''}
                    ${phonesHtml ? `<tr><td style="padding: 8px 0; color: #aaaaaa; vertical-align: top;">電話:</td><td style="padding: 8px 0;">${phonesHtml}</td></tr>` : ''}
                    ${contact.homepage ? `<tr><td style="padding: 8px 0; color: #aaaaaa;">HP:</td><td style="padding: 8px 0;">${linkifyText(contact.homepage)}</td></tr>` : ''}
                    ${contact.area ? `<tr><td style="padding: 8px 0; color: #aaaaaa;">エリア:</td><td style="padding: 8px 0;">${escapeHtml(contact.area)}</td></tr>` : ''}
                    ${contact.residence ? `<tr><td style="padding: 8px 0; color: #aaaaaa;">居住地:</td><td style="padding: 8px 0;">${escapeHtml(contact.residence)}</td></tr>` : ''}
                    ${contact.referredBy ? `<tr><td style="padding: 8px 0; color: #aaaaaa;">紹介元:</td><td style="padding: 8px 0;">${getReferrerDisplay(contact)}</td></tr>` : ''}
                    ${relatedContactsHtml}
                </table>
                
                ${contact.types && contact.types.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <strong>種別:</strong> ${contact.types.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}
                    </div>
                ` : ''}
                
                ${contact.affiliations && contact.affiliations.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <strong>所属・チャプター:</strong> ${contact.affiliations.map(a => `<span class="tag">${escapeHtml(a)}</span>`).join(' ')}
                    </div>
                ` : ''}
                
                ${contact.wantToConnect && contact.wantToConnect.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <strong>繋がりたい人・業種:</strong> ${contact.wantToConnect.map(w => `<span class="tag">${escapeHtml(w)}</span>`).join(' ')}
                    </div>
                ` : ''}
                
                ${contact.goldenEgg && contact.goldenEgg.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <strong>金の卵:</strong> ${contact.goldenEgg.map(g => `<span class="tag">${escapeHtml(g)}</span>`).join(' ')}
                    </div>
                ` : ''}
                
                ${contact.cutout ? `
                    <div style="margin-bottom: 15px;">
                        <strong>切り出し方:</strong>
                        <div class="markdown">${renderMarkdown(contact.cutout)}</div>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div id="strength" class="tab-content">
            <div class="tab-panel">
                ${contact.strengths ? `
                    <div style="margin-bottom: 20px;">
                        <strong>強み:</strong>
                        <div class="collapsible-content ${contact.strengths.length > 500 ? 'collapsed' : ''}" id="strengths-${contact.id}">
                            <div class="markdown">${renderMarkdown(contact.strengths)}</div>
                        </div>
                        ${contact.strengths.length > 500 ? `
                            <a href="#" class="toggle-link" onclick="toggleCollapsible('strengths-${contact.id}'); return false;">続きを読む</a>
                        ` : ''}
                    </div>
                ` : ''}
                
                ${contact.careerHistory ? `
                    <div>
                        <strong>過去の経歴:</strong>
                        <div class="collapsible-content ${contact.careerHistory.length > 500 ? 'collapsed' : ''}" id="career-${contact.id}">
                            <div class="markdown">${renderMarkdown(contact.careerHistory)}</div>
                        </div>
                        ${contact.careerHistory.length > 500 ? `
                            <a href="#" class="toggle-link" onclick="toggleCollapsible('career-${contact.id}'); return false;">続きを読む</a>
                        ` : ''}
                    </div>
                ` : ''}
                
                ${!contact.strengths && !contact.careerHistory ? 
                    '<p style="color: #aaaaaa;">まだ情報が登録されていません。</p>' : ''}
            </div>
        </div>
        
        <div id="files" class="tab-content">
            <div class="tab-panel">`;
            
            // 名刺画像部分を生成
            if (contact.cardImageUrl && !contact.cardImageUrl.includes('dropbox')) {
                html += `
                    <div style="margin-bottom: 20px;">
                        <strong>名刺画像:</strong>
                        <div style="margin-top: 10px;">
                            <img src="${contact.cardImageUrl}" style="max-width: 100%; border-radius: 8px; cursor: pointer;" 
                                 onclick="window.open('${contact.cardImageUrl}', '_blank')"
                                 loading="lazy"
                                 onerror="handleImageError(this, '名刺')">
                        </div>
                    </div>`;
            }
            
            // 添付ファイル部分を生成
            if (contact.attachments && contact.attachments.length > 0) {
                html += `
                    <div>
                        <strong>添付ファイル:</strong>
                        <div class="file-list" style="margin-top: 10px;">`;
                
                contact.attachments.forEach(att => {
                    const escapedAttName = escapeHtml(att.name).replace(/'/g, "\\'");
                    html += `
                        <div class="file-item">
                            <span>${escapeHtml(att.name)}</span>
                            <a href="#" onclick="openFile('${att.id || att.url}', '${escapedAttName}'); return false;" class="btn-small btn-secondary">開く</a>
                        </div>`;
                });
                
                html += `
                        </div>
                    </div>`;
            }
            
            if (!contact.cardImageUrl && (!contact.attachments || contact.attachments.length === 0)) {
                html += '<p style="color: #aaaaaa;">ファイルがアップロードされていません。</p>';
            }
            
            html += `
            </div>
        </div>
        
        <div class="action-buttons">
            <button class="btn-primary" onclick="showContactForm('${contact.id}')">編集</button>
            <button class="btn-secondary" onclick="showMeetingForm('${contact.id}')">ミーティング記録追加</button>
            <button class="btn-danger" onclick="deleteContact('${contact.id}')">削除</button>
        </div>
        
        <div class="meeting-timeline">
            <h3 style="margin-bottom: 20px;">ミーティング履歴</h3>
            ${contactMeetings.length > 0 ? 
                renderMeetingHistory(contactMeetings) : 
                '<p style="color: #aaaaaa;">まだミーティング記録がありません。</p>'
            }
        </div>
    `;
    
    currentEditingContactId = contactId;
    document.getElementById('contactDetailBody').innerHTML = html;
    document.getElementById('contactDetailModal').style.display = 'block';
    document.querySelector('#contactDetailModal .modal-content').scrollTop = 0;
}

// マルチセレクトオプション確認
function ensureMultiSelectOptions(contact) {
    if (contact.types) {
        contact.types.forEach(type => {
            if (!dropdownOptions.types.includes(type)) {
                dropdownOptions.types.push(type);
            }
        });
    }
    if (contact.affiliations) {
        contact.affiliations.forEach(aff => {
            if (!dropdownOptions.affiliations.includes(aff)) {
                dropdownOptions.affiliations.push(aff);
            }
        });
    }
    if (contact.wantToConnect) {
        contact.wantToConnect.forEach(want => {
            if (!dropdownOptions.wantToConnect.includes(want)) {
                dropdownOptions.wantToConnect.push(want);
            }
        });
    }
    if (contact.goldenEgg) {
        contact.goldenEgg.forEach(egg => {
            if (!dropdownOptions.goldenEgg.includes(egg)) {
                dropdownOptions.goldenEgg.push(egg);
            }
        });
    }
}

// 連絡先数更新
function updateContactCount() {
    const countElement = document.getElementById('contactCount');
    if (countElement) {
        countElement.textContent = contacts.length;
    }
}

// 初回ミーティングタスク追加
function addFirstMeetingTask() {
    const container = document.getElementById('firstMeetingTaskContainer');
    const newRow = document.createElement('div');
    newRow.className = 'task-input-row';
    newRow.innerHTML = `
        <input type="text" name="firstTaskText[]" placeholder="タスク内容">
        <input type="datetime-local" name="firstTaskDue[]" placeholder="期限">
        <button type="button" class="btn-small btn-danger" onclick="removeTaskInput(this)">削除</button>
    `;
    container.appendChild(newRow);
}