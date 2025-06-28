// contacts.js - 連絡先管理

// 現在編集中の連絡先
let currentContact = null;
let pendingFiles = {
    photo: null,
    businessCard: null,
    attachments: []
};

// 連絡先リスト取得
function getContacts() {
    return window.contacts || [];
}

// 連絡先検索
function searchContacts(query, filters = {}) {
    let results = getContacts();
    
    // フリーワード検索
    if (query) {
        const lowerQuery = query.toLowerCase();
        results = results.filter(contact => {
            return (
                (contact.name && contact.name.toLowerCase().includes(lowerQuery)) ||
                (contact.yomi && contact.yomi.toLowerCase().includes(lowerQuery)) ||
                (contact.company && contact.company.toLowerCase().includes(lowerQuery)) ||
                (contact.email && contact.email.toLowerCase().includes(lowerQuery))
            );
        });
    }
    
    // フィルター適用
    if (filters.type && filters.type !== '') {
        results = results.filter(contact => 
            contact.types && contact.types.includes(filters.type)
        );
    }
    
    if (filters.affiliation && filters.affiliation !== '') {
        results = results.filter(contact => 
            contact.affiliations && contact.affiliations.includes(filters.affiliation)
        );
    }
    
    // ふりがなでソート
    return utils.sortByYomi(results, 'yomi');
}

// 連絡先取得
function getContactById(id) {
    return getContacts().find(contact => contact.id === id);
}

// 新規連絡先モーダル表示
function showNewContactModal() {
    currentContact = null;
    pendingFiles = {
        photo: null,
        businessCard: null,
        attachments: []
    };
    
    document.getElementById('modalTitle').textContent = '新規連絡先';
    document.getElementById('contactForm').reset();
    document.getElementById('initialMeetingSection').style.display = 'block';
    
    // マルチセレクトリセット
    resetMultiSelects();
    
    // ファイルプレビューリセット
    document.getElementById('photoPreview').innerHTML = '';
    document.getElementById('businessCardPreview').innerHTML = '';
    document.getElementById('attachmentsList').innerHTML = '';
    
    document.getElementById('contactModal').style.display = 'block';
}

// 連絡先編集モーダル表示
function showEditContactModal(contactId) {
    currentContact = getContactById(contactId);
    if (!currentContact) return;
    
    pendingFiles = {
        photo: null,
        businessCard: null,
        attachments: []
    };
    
    document.getElementById('modalTitle').textContent = '連絡先編集';
    document.getElementById('initialMeetingSection').style.display = 'none';
    
    // フォームに値を設定
    const form = document.getElementById('contactForm');
    Object.keys(currentContact).forEach(key => {
        if (form[key] && typeof currentContact[key] === 'string') {
            form[key].value = currentContact[key];
        }
    });
    
    // マルチセレクト設定
    setMultiSelectValues();
    
    // ファイルプレビュー設定
    if (currentContact.photo) {
        showExistingFile('photo', currentContact.photo);
    }
    if (currentContact.businessCard) {
        showExistingFile('businessCard', currentContact.businessCard);
    }
    if (currentContact.attachments) {
        currentContact.attachments.forEach(file => {
            showExistingFile('attachment', file);
        });
    }
    
    document.getElementById('contactModal').style.display = 'block';
}

// 連絡先保存
async function saveContact() {
    const form = document.getElementById('contactForm');
    const formData = new FormData(form);
    
    // バリデーション
    if (!formData.get('name')) {
        utils.showNotification('氏名は必須です', 'error');
        return;
    }
    
    try {
        utils.showLoading();
        
        // 連絡先データ作成
        const contactData = {
            id: currentContact ? currentContact.id : utils.generateUUID(),
            name: formData.get('name'),
            yomi: formData.get('yomi'),
            company: formData.get('company'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            homepage: formData.get('homepage'),
            referredBy: formData.get('referredBy'),
            area: formData.get('area'),
            residence: formData.get('residence'),
            interest: formData.get('interest'),
            strengths: formData.get('strengths'),
            careerHistory: formData.get('careerHistory'),
            cutout: formData.get('cutout'),
            types: getMultiSelectValues('types'),
            affiliations: getMultiSelectValues('affiliations'),
            wantToConnect: getMultiSelectValues('wantToConnect'),
            goldenEgg: getMultiSelectValues('goldenEgg'),
            createdAt: currentContact ? currentContact.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // ファイルアップロード処理
        if (pendingFiles.photo) {
            // 既存の写真を削除
            if (currentContact && currentContact.photo) {
                await drive.deleteFile(currentContact.photo.id);
            }
            
            // リサイズしてアップロード
            const resizedPhoto = await utils.resizeImage(pendingFiles.photo, 300, 300);
            const photoData = await drive.uploadFile(resizedPhoto, contactData.name);
            contactData.photo = photoData;
        } else if (currentContact && currentContact.photo) {
            contactData.photo = currentContact.photo;
        }
        
        if (pendingFiles.businessCard) {
            // 既存の名刺を削除
            if (currentContact && currentContact.businessCard) {
                await drive.deleteFile(currentContact.businessCard.id);
            }
            
            const cardData = await drive.uploadFile(pendingFiles.businessCard, contactData.name);
            contactData.businessCard = cardData;
        } else if (currentContact && currentContact.businessCard) {
            contactData.businessCard = currentContact.businessCard;
        }
        
        // 添付ファイル処理
        contactData.attachments = currentContact ? [...currentContact.attachments] : [];
        
        for (const file of pendingFiles.attachments) {
            const attachmentData = await drive.uploadFile(file, contactData.name);
            contactData.attachments.push(attachmentData);
        }
        
        // データ保存
        if (currentContact) {
            // 更新
            const index = window.contacts.findIndex(c => c.id === currentContact.id);
            window.contacts[index] = contactData;
        } else {
            // 新規作成
            window.contacts.push(contactData);
            
            // 初回ミーティング記録
            const meetingDate = formData.get('meetingDate');
            const meetingContent = formData.get('meetingContent');
            
            if (meetingDate || meetingContent) {
                const meeting = {
                    id: utils.generateUUID(),
                    contactId: contactData.id,
                    datetime: meetingDate || new Date().toISOString(),
                    content: meetingContent || '初回ミーティング',
                    todos: [],
                    attachments: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                window.meetings.push(meeting);
            }
        }
        
        // オプション更新
        updateOptions();
        
        // Drive に保存
        await drive.saveData();
        
        // モーダルを閉じる
        closeContactModal();
        
        // 表示更新
        ui.renderContacts();
        
        utils.showNotification(currentContact ? '連絡先を更新しました' : '連絡先を登録しました');
        
    } catch (error) {
        console.error('Save contact error:', error);
        utils.showNotification('保存に失敗しました', 'error');
    } finally {
        utils.hideLoading();
    }
}

// 連絡先削除
async function deleteContact() {
    if (!currentContact) return;
    
    if (!confirm(`${currentContact.name}さんを削除してよろしいですか？\n関連するミーティング記録も削除されます。`)) {
        return;
    }
    
    try {
        utils.showLoading();
        
        // 関連ファイルを削除
        if (currentContact.photo) {
            await drive.deleteFile(currentContact.photo.id);
        }
        if (currentContact.businessCard) {
            await drive.deleteFile(currentContact.businessCard.id);
        }
        if (currentContact.attachments) {
            for (const file of currentContact.attachments) {
                await drive.deleteFile(file.id);
            }
        }
        
        // 関連ミーティングを削除
        window.meetings = window.meetings.filter(m => m.contactId !== currentContact.id);
        
        // 連絡先を削除
        window.contacts = window.contacts.filter(c => c.id !== currentContact.id);
        
        // Drive に保存
        await drive.saveData();
        
        // モーダルを閉じる
        closeDetailModal();
        
        // 表示更新
        ui.renderContacts();
        
        utils.showNotification('連絡先を削除しました');
        
    } catch (error) {
        console.error('Delete contact error:', error);
        utils.showNotification('削除に失敗しました', 'error');
    } finally {
        utils.hideLoading();
    }
}

// 連絡先詳細表示
async function showContactDetail(contactId) {
    const contact = getContactById(contactId);
    if (!contact) return;
    
    currentContact = contact;
    
    document.getElementById('detailName').textContent = contact.name;
    
    // 詳細情報のHTML生成
    let detailHtml = '<div style="display: grid; gap: 1rem;">';
    
    // 基本情報
    if (contact.photo) {
        const photoSrc = await drive.getImageAsBase64(contact.photo.id);
        if (photoSrc) {
            detailHtml += `
                <div style="text-align: center; margin-bottom: 1rem;">
                    <img src="${photoSrc}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover;">
                </div>
            `;
        }
    }
    
    const fields = [
        { label: 'ふりがな', value: contact.yomi },
        { label: '会社名', value: contact.company },
        { label: 'メール', value: contact.email, type: 'email' },
        { label: '電話番号', value: contact.phone, type: 'tel' },
        { label: 'ホームページ', value: contact.homepage, type: 'url' },
        { label: '紹介者', value: contact.referredBy },
        { label: '活動エリア', value: contact.area },
        { label: '居住地', value: contact.residence },
        { label: '趣味', value: contact.interest }
    ];
    
    fields.forEach(field => {
        if (field.value) {
            let displayValue = utils.escapeHtml(field.value);
            
            if (field.type === 'email') {
                displayValue = `<a href="mailto:${field.value}" style="color: var(--accent);">${displayValue}</a>`;
            } else if (field.type === 'url') {
                displayValue = `<a href="${field.value}" target="_blank" style="color: var(--accent);">${displayValue}</a>`;
            } else if (field.type === 'tel') {
                displayValue = `<a href="tel:${field.value}" style="color: var(--accent);">${displayValue}</a>`;
            }
            
            detailHtml += `
                <div>
                    <strong style="color: var(--text-secondary);">${field.label}:</strong>
                    <div style="margin-top: 0.25rem;">${displayValue}</div>
                </div>
            `;
        }
    });
    
    // タグ情報
    const tagFields = [
        { label: '種別', values: contact.types },
        { label: '所属', values: contact.affiliations },
        { label: '繋がりたい人', values: contact.wantToConnect },
        { label: '金の卵', values: contact.goldenEgg }
    ];
    
    tagFields.forEach(field => {
        if (field.values && field.values.length > 0) {
            detailHtml += `
                <div>
                    <strong style="color: var(--text-secondary);">${field.label}:</strong>
                    <div class="contact-tags" style="margin-top: 0.5rem;">
                        ${field.values.map(v => `<span class="tag">${utils.escapeHtml(v)}</span>`).join('')}
                    </div>
                </div>
            `;
        }
    });
    
    // 長文フィールド
    const textFields = [
        { label: '強み', value: contact.strengths },
        { label: '過去の経歴', value: contact.careerHistory },
        { label: '印象的な一言', value: contact.cutout }
    ];
    
    textFields.forEach(field => {
        if (field.value) {
            detailHtml += `
                <div>
                    <strong style="color: var(--text-secondary);">${field.label}:</strong>
                    <div style="margin-top: 0.25rem; white-space: pre-wrap;">${utils.escapeHtml(field.value)}</div>
                </div>
            `;
        }
    });
    
    // 添付ファイル
    if (contact.businessCard || (contact.attachments && contact.attachments.length > 0)) {
        detailHtml += '<div><strong style="color: var(--text-secondary);">添付ファイル:</strong><div style="margin-top: 0.5rem;">';
        
        if (contact.businessCard) {
            detailHtml += `
                <div class="file-item">
                    <span>名刺画像</span>
                    <button class="btn btn-secondary" onclick="viewFile('${contact.businessCard.id}', '${contact.businessCard.name}')">
                        表示
                    </button>
                </div>
            `;
        }
        
        if (contact.attachments) {
            contact.attachments.forEach(file => {
                detailHtml += `
                    <div class="file-item">
                        <span>${utils.escapeHtml(file.name)}</span>
                        <button class="btn btn-secondary" onclick="viewFile('${file.id}', '${file.name}')">
                            ${utils.canOpenInBrowser(file.name) ? '表示' : 'ダウンロード'}
                        </button>
                    </div>
                `;
            });
        }
        
        detailHtml += '</div></div>';
    }
    
    detailHtml += '</div>';
    
    document.getElementById('detailContent').innerHTML = detailHtml;
    
    // ミーティングリスト表示
    meetingsModule.renderMeetingsForContact(contactId);
    
    document.getElementById('detailModal').style.display = 'block';
}

// ファイル表示/ダウンロード
async function viewFile(fileId, fileName) {
    try {
        if (utils.canOpenInBrowser(fileName)) {
            // ブラウザで表示
            const blob = await drive.downloadFile(fileId);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            
            // メモリリーク防止
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } else {
            // ダウンロード
            const blob = await drive.downloadFile(fileId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('File view error:', error);
        utils.showNotification('ファイルの表示に失敗しました', 'error');
    }
}

// マルチセレクト関連
function initializeMultiSelects() {
    document.querySelectorAll('.multi-select').forEach(select => {
        const display = select.querySelector('.multi-select-display');
        const dropdown = select.querySelector('.multi-select-dropdown');
        
        // クリックイベント
        display.addEventListener('click', () => {
            dropdown.classList.toggle('show');
            renderMultiSelectOptions(select);
        });
        
        // 外側クリックで閉じる
        document.addEventListener('click', (e) => {
            if (!select.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    });
}

function renderMultiSelectOptions(selectElement) {
    const field = selectElement.dataset.field;
    const dropdown = selectElement.querySelector('.multi-select-dropdown');
    const selectedValues = getMultiSelectValues(field);
    
    let html = `
        <div class="multi-select-search">
            <input type="text" placeholder="検索..." onkeyup="filterMultiSelectOptions(this, '${field}')">
        </div>
    `;
    
    // オプション表示
    const options = window.options[field] || [];
    options.forEach(option => {
        const isSelected = selectedValues.includes(option);
        html += `
            <div class="multi-select-option ${isSelected ? 'selected' : ''}" 
                 onclick="toggleMultiSelectOption('${field}', '${utils.escapeHtml(option)}')">
                ${utils.escapeHtml(option)}
            </div>
        `;
    });
    
    // 新規追加
    html += `
        <div class="multi-select-add" onclick="addNewMultiSelectOption('${field}')">
            ＋ 新規入力
        </div>
    `;
    
    dropdown.innerHTML = html;
}

function getMultiSelectValues(field) {
    const display = document.querySelector(`.multi-select[data-field="${field}"] .multi-select-display`);
    const tags = display.querySelectorAll('.tag');
    return Array.from(tags).map(tag => tag.textContent);
}

function setMultiSelectValues() {
    if (!currentContact) return;
    
    ['types', 'affiliations', 'wantToConnect', 'goldenEgg'].forEach(field => {
        const values = currentContact[field] || [];
        const display = document.querySelector(`.multi-select[data-field="${field}"] .multi-select-display`);
        
        if (values.length > 0) {
            display.innerHTML = values.map(v => 
                `<span class="tag">${utils.escapeHtml(v)}</span>`
            ).join('');
        } else {
            display.innerHTML = '<span style="color: var(--text-secondary);">選択してください</span>';
        }
    });
}

function resetMultiSelects() {
    document.querySelectorAll('.multi-select .multi-select-display').forEach(display => {
        display.innerHTML = '<span style="color: var(--text-secondary);">選択してください</span>';
    });
}

// オプション更新
function updateOptions() {
    ['types', 'affiliations', 'wantToConnect', 'goldenEgg'].forEach(field => {
        const allValues = new Set();
        
        window.contacts.forEach(contact => {
            if (contact[field]) {
                contact[field].forEach(value => allValues.add(value));
            }
        });
        
        window.options[field] = Array.from(allValues).sort((a, b) => a.localeCompare(b, 'ja'));
    });
}

// ファイルアップロード関連
function initializeFileUploads() {
    // 顔写真
    const photoInput = document.getElementById('photoInput');
    const photoUpload = document.querySelector('.file-upload[data-type="photo"]');
    
    photoInput.addEventListener('change', (e) => handlePhotoUpload(e.target.files[0]));
    setupDragDrop(photoUpload, handlePhotoUpload);
    
    // 名刺
    const businessCardInput = document.getElementById('businessCardInput');
    const businessCardUpload = document.querySelector('.file-upload[data-type="businessCard"]');
    
    businessCardInput.addEventListener('change', (e) => handleBusinessCardUpload(e.target.files[0]));
    setupDragDrop(businessCardUpload, handleBusinessCardUpload);
    
    // 添付ファイル
    const attachmentsInput = document.getElementById('attachmentsInput');
    const attachmentsUpload = document.querySelector('.file-upload[data-type="attachments"]');
    
    attachmentsInput.addEventListener('change', (e) => handleAttachmentsUpload(e.target.files));
    setupDragDrop(attachmentsUpload, (files) => handleAttachmentsUpload(files), true);
}

function setupDragDrop(element, handler, multiple = false) {
    element.addEventListener('click', () => {
        element.querySelector('input[type="file"]').click();
    });
    
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('drag-over');
    });
    
    element.addEventListener('dragleave', () => {
        element.classList.remove('drag-over');
    });
    
    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');
        
        const files = multiple ? e.dataTransfer.files : e.dataTransfer.files[0];
        handler(files);
    });
}

async function handlePhotoUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        utils.showNotification('画像ファイルを選択してください', 'error');
        return;
    }
    
    pendingFiles.photo = file;
    
    // プレビュー表示
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('photoPreview').innerHTML = `
            <img src="${e.target.result}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-top: 1rem;">
        `;
    };
    reader.readAsDataURL(file);
}

async function handleBusinessCardUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        utils.showNotification('画像ファイルを選択してください', 'error');
        return;
    }
    
    pendingFiles.businessCard = file;
    
    // プレビュー表示
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('businessCardPreview').innerHTML = `
            <img src="${e.target.result}" style="max-width: 200px; max-height: 150px; margin-top: 1rem;">
        `;
    };
    reader.readAsDataURL(file);
}

function handleAttachmentsUpload(files) {
    Array.from(files).forEach(file => {
        pendingFiles.attachments.push(file);
        
        // リスト表示
        const listItem = document.createElement('div');
        listItem.className = 'file-item';
        listItem.innerHTML = `
            <span>${utils.escapeHtml(file.name)} (${utils.formatFileSize(file.size)})</span>
            <button type="button" class="btn btn-danger" onclick="removePendingAttachment('${file.name}')">
                削除
            </button>
        `;
        document.getElementById('attachmentsList').appendChild(listItem);
    });
}

function removePendingAttachment(fileName) {
    pendingFiles.attachments = pendingFiles.attachments.filter(f => f.name !== fileName);
    
    // リスト更新
    const list = document.getElementById('attachmentsList');
    Array.from(list.children).forEach(item => {
        if (item.textContent.includes(fileName)) {
            item.remove();
        }
    });
}

function showExistingFile(type, fileData) {
    if (type === 'photo') {
        drive.getImageAsBase64(fileData.id).then(src => {
            if (src) {
                document.getElementById('photoPreview').innerHTML = `
                    <img src="${src}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-top: 1rem;">
                `;
            }
        });
    } else if (type === 'businessCard') {
        drive.getImageAsBase64(fileData.id).then(src => {
            if (src) {
                document.getElementById('businessCardPreview').innerHTML = `
                    <img src="${src}" style="max-width: 200px; max-height: 150px; margin-top: 1rem;">
                `;
            }
        });
    } else if (type === 'attachment') {
        const listItem = document.createElement('div');
        listItem.className = 'file-item';
        listItem.innerHTML = `
            <span>${utils.escapeHtml(fileData.name)}</span>
            <span style="color: var(--text-secondary);">既存ファイル</span>
        `;
        document.getElementById('attachmentsList').appendChild(listItem);
    }
}

// モーダル操作
function closeContactModal() {
    document.getElementById('contactModal').style.display = 'none';
    currentContact = null;
    pendingFiles = {
        photo: null,
        businessCard: null,
        attachments: []
    };
    utils.clearDraft('contact');
}

function closeDetailModal() {
    document.getElementById('detailModal').style.display = 'none';
    currentContact = null;
}

function editContact() {
    if (!currentContact) return;
    closeDetailModal();
    showEditContactModal(currentContact.id);
}

// グローバル関数として公開
window.showNewContactModal = showNewContactModal;
window.showEditContactModal = showEditContactModal;
window.showContactDetail = showContactDetail;
window.saveContact = saveContact;
window.deleteContact = deleteContact;
window.closeContactModal = closeContactModal;
window.closeDetailModal = closeDetailModal;
window.editContact = editContact;
window.viewFile = viewFile;
window.toggleMultiSelectOption = (field, option) => {
    const display = document.querySelector(`.multi-select[data-field="${field}"] .multi-select-display`);
    const currentValues = getMultiSelectValues(field);
    
    if (currentValues.includes(option)) {
        // 削除
        const newValues = currentValues.filter(v => v !== option);
        if (newValues.length > 0) {
            display.innerHTML = newValues.map(v => 
                `<span class="tag">${utils.escapeHtml(v)}</span>`
            ).join('');
        } else {
            display.innerHTML = '<span style="color: var(--text-secondary);">選択してください</span>';
        }
    } else {
        // 追加
        if (currentValues.length === 0 || display.querySelector('span[style*="color"]')) {
            display.innerHTML = '';
        }
        display.innerHTML += `<span class="tag">${utils.escapeHtml(option)}</span>`;
    }
    
    // ドロップダウン更新
    renderMultiSelectOptions(document.querySelector(`.multi-select[data-field="${field}"]`));
};

window.filterMultiSelectOptions = (input, field) => {
    const query = input.value.toLowerCase();
    const options = document.querySelectorAll(`.multi-select[data-field="${field}"] .multi-select-option`);
    
    options.forEach(option => {
        if (option.textContent.toLowerCase().includes(query)) {
            option.style.display = 'block';
        } else {
            option.style.display = 'none';
        }
    });
};

window.addNewMultiSelectOption = (field) => {
    const value = prompt('新しい項目を入力してください:');
    if (!value || value.trim() === '') return;
    
    // オプションに追加
    if (!window.options[field]) {
        window.options[field] = [];
    }
    
    if (!window.options[field].includes(value)) {
        window.options[field].push(value);
        window.options[field].sort((a, b) => a.localeCompare(b, 'ja'));
    }
    
    // 選択状態にする
    window.toggleMultiSelectOption(field, value);
};

window.removePendingAttachment = removePendingAttachment;

// エクスポート（モジュールとして）
window.contactsModule = {
    getContacts,
    searchContacts,
    getContactById,
    initializeMultiSelects,
    initializeFileUploads
};