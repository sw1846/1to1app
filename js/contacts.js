// contacts.js - 分散ファイル構造対応の連絡先管理機能

// 連絡先モーダルを開く
function openContactModal(contactId = null) {
    currentContactId = contactId;
    const modal = document.getElementById('contactModal');
    const title = document.getElementById('modalTitle');
    const initialMeetingSection = document.getElementById('initialMeetingSection');

    if (!modal || !title) {
        console.error('Modal elements not found');
        return;
    }

    // 選択状態をリセット
    selectedOptions = {
        type: [],
        affiliation: [],
        industryInterests: []
    };

    multiSelectSearchQueries = {
        type: '',
        affiliation: '',
        industryInterests: ''
    };

    if (contactId) {
        title.textContent = '連絡先編集';
        if (initialMeetingSection) {
            initialMeetingSection.style.display = 'none';
        }
        loadContactData(contactId);
    } else {
        title.textContent = '連絡先追加';
        if (initialMeetingSection) {
            initialMeetingSection.style.display = 'block';
        }
        resetContactForm();
    }

    // Markdownエディタを編集モードに設定
    const markdownFields = ['business', 'strengths', 'approach', 'history', 'priorInfo'];
    markdownFields.forEach(field => {
        if (typeof switchMarkdownView === 'function') {
            switchMarkdownView(field, 'edit');
        }
    });

    modal.classList.add('active');
    modal.querySelector('.modal-content').scrollTop = 0;
}

// 連絡先データ読み込み
function loadContactData(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    // 基本情報
    const nameInput = document.getElementById('nameInput');
    const furiganaInput = document.getElementById('furiganaInput');
    const companyInput = document.getElementById('companyInput');
    const websiteInput = document.getElementById('websiteInput');
    
    if (nameInput) nameInput.value = contact.name || '';
    if (furiganaInput) furiganaInput.value = contact.furigana || '';
    if (companyInput) companyInput.value = contact.company || '';
    if (websiteInput) websiteInput.value = contact.website || '';
    
    // 接触方法
    const contactMethodReferral = document.getElementById('contactMethodReferral');
    const contactMethodDirect = document.getElementById('contactMethodDirect');
    const referrerInput = document.getElementById('referrerInput');
    const directContactInput = document.getElementById('directContactInput');
    
    if (contact.contactMethod === 'referral') {
        if (contactMethodReferral) contactMethodReferral.checked = true;
        if (referrerInput) referrerInput.value = contact.referrer || '';
    } else {
        if (contactMethodDirect) contactMethodDirect.checked = true;
        if (directContactInput) directContactInput.value = contact.directContact || '所属が同じ';
    }
    if (typeof handleContactMethodChange === 'function') {
        handleContactMethodChange();
    }
    
    // Markdownフィールド
    const businessInput = document.getElementById('businessInput');
    const strengthsInput = document.getElementById('strengthsInput');
    const approachInput = document.getElementById('approachInput');
    const historyInput = document.getElementById('historyInput');
    const priorInfoInput = document.getElementById('priorInfoInput');
    
    if (businessInput) businessInput.value = contact.business || '';
    if (strengthsInput) strengthsInput.value = contact.strengths || '';
    if (approachInput) approachInput.value = contact.approach || '';
    if (historyInput) historyInput.value = contact.history || '';
    if (priorInfoInput) priorInfoInput.value = contact.priorInfo || '';
    
    // その他の情報
    const activityAreaInput = document.getElementById('activityAreaInput');
    const residenceInput = document.getElementById('residenceInput');
    const hobbiesInput = document.getElementById('hobbiesInput');
    const revenueInput = document.getElementById('revenueInput');
    
    if (activityAreaInput) activityAreaInput.value = contact.activityArea || '';
    if (residenceInput) residenceInput.value = contact.residence || '';
    if (hobbiesInput) hobbiesInput.value = contact.hobbies || '';
    if (revenueInput) revenueInput.value = contact.revenue || '';

    // 写真
    const photoPreview = document.getElementById('photoPreview');
    const photoPreviewContainer = document.getElementById('photoPreviewContainer');
    if (contact.photo && photoPreview && photoPreviewContainer) {
        if (contact.photo.startsWith('drive:')) {
            // Google Driveから画像を読み込み
            loadImageFromGoogleDrive(contact.photo).then(dataUrl => {
                if (dataUrl) {
                    photoPreview.src = dataUrl;
                    photoPreviewContainer.style.display = 'block';
                }
            });
        } else {
            photoPreview.src = contact.photo;
            photoPreviewContainer.style.display = 'block';
        }
    } else if (photoPreview && photoPreviewContainer) {
        photoPreview.src = '';
        photoPreview.removeAttribute('src');
        photoPreviewContainer.style.display = 'none';
    }
    
    // 名刺画像
    const businessCardPreview = document.getElementById('businessCardPreview');
    const businessCardPreviewContainer = document.getElementById('businessCardPreviewContainer');
    if (contact.businessCard && businessCardPreview && businessCardPreviewContainer) {
        if (contact.businessCard.startsWith('drive:')) {
            // Google Driveから画像を読み込み
            loadImageFromGoogleDrive(contact.businessCard).then(dataUrl => {
                if (dataUrl) {
                    businessCardPreview.src = dataUrl;
                    businessCardPreviewContainer.style.display = 'block';
                }
            });
        } else {
            businessCardPreview.src = contact.businessCard;
            businessCardPreviewContainer.style.display = 'block';
        }
    } else if (businessCardPreview && businessCardPreviewContainer) {
        businessCardPreview.src = '';
        businessCardPreview.removeAttribute('src');
        businessCardPreviewContainer.style.display = 'none';
    }

    // 複数選択項目
    selectedOptions.type = Array.isArray(contact.types) ? [...contact.types] : [];
    selectedOptions.affiliation = Array.isArray(contact.affiliations) ? [...contact.affiliations] : [];
    selectedOptions.industryInterests = Array.isArray(contact.industryInterests) ? [...contact.industryInterests] : [];
    
    if (typeof updateMultiSelectTags === 'function') {
        updateMultiSelectTags('type');
        updateMultiSelectTags('affiliation');
        updateMultiSelectTags('industryInterests');
    }

    // メールアドレス
    const emailContainer = document.getElementById('emailContainer');
    if (emailContainer) {
        emailContainer.innerHTML = '';
        if (contact.emails && contact.emails.length > 0) {
            contact.emails.forEach((email) => {
                if (typeof addEmailInput === 'function') {
                    addEmailInput(email);
                }
            });
        } else if (typeof addEmailInput === 'function') {
            addEmailInput('');
        }
    }

    // 電話番号
    const phoneContainer = document.getElementById('phoneContainer');
    if (phoneContainer) {
        phoneContainer.innerHTML = '';
        if (contact.phones && contact.phones.length > 0) {
            contact.phones.forEach((phone) => {
                if (typeof addPhoneInput === 'function') {
                    addPhoneInput(phone);
                }
            });
        } else if (typeof addPhoneInput === 'function') {
            addPhoneInput('');
        }
    }

    // 事業内容
    const businessContainer = document.getElementById('businessContainer');
    if (businessContainer) {
        businessContainer.innerHTML = '';
        if (contact.businesses && contact.businesses.length > 0) {
            contact.businesses.forEach((business) => {
                if (typeof addBusinessInput === 'function') {
                    addBusinessInput(business);
                }
            });
        } else if (typeof addBusinessInput === 'function') {
            addBusinessInput('');
        }
    }

    // 添付ファイル
    if (contact.attachments && typeof displayAttachments === 'function') {
        displayAttachments(contact.attachments, 'attachmentList');
    }
}

// フォームリセット
function resetContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.reset();
    }
    
    // 接触方法を直接に設定
    const contactMethodDirect = document.getElementById('contactMethodDirect');
    const directContactInput = document.getElementById('directContactInput');
    if (contactMethodDirect) contactMethodDirect.checked = true;
    if (directContactInput) directContactInput.value = '所属が同じ';
    if (typeof handleContactMethodChange === 'function') {
        handleContactMethodChange();
    }
    
    // 画像プレビューをクリア
    const photoPreview = document.getElementById('photoPreview');
    const businessCardPreview = document.getElementById('businessCardPreview');
    const photoPreviewContainer = document.getElementById('photoPreviewContainer');
    const businessCardPreviewContainer = document.getElementById('businessCardPreviewContainer');
    
    if (photoPreview) {
        photoPreview.src = '';
        if (photoPreview.hasAttribute('src')) {
            photoPreview.removeAttribute('src');
        }
    }
    if (photoPreviewContainer) {
        photoPreviewContainer.style.display = 'none';
    }
    
    if (businessCardPreview) {
        businessCardPreview.src = '';
        if (businessCardPreview.hasAttribute('src')) {
            businessCardPreview.removeAttribute('src');
        }
    }
    if (businessCardPreviewContainer) {
        businessCardPreviewContainer.style.display = 'none';
    }
    
    // 複数入力フィールドをリセット
    const emailContainer = document.getElementById('emailContainer');
    const phoneContainer = document.getElementById('phoneContainer');
    const businessContainer = document.getElementById('businessContainer');
    const attachmentList = document.getElementById('attachmentList');
    
    if (emailContainer) {
        emailContainer.innerHTML = '';
        if (typeof addEmailInput === 'function') {
            addEmailInput('');
        }
    }
    if (phoneContainer) {
        phoneContainer.innerHTML = '';
        if (typeof addPhoneInput === 'function') {
            addPhoneInput('');
        }
    }
    if (businessContainer) {
        businessContainer.innerHTML = '';
        if (typeof addBusinessInput === 'function') {
            addBusinessInput('');
        }
    }
    if (attachmentList) {
        attachmentList.innerHTML = '';
    }
    
    // ToDoリストをリセット
    const todoList = document.getElementById('todoList');
    if (todoList) {
        todoList.innerHTML = '<button type="button" class="btn btn-primary" onclick="addTodoItem()">➕ ToDo追加</button>';
    }
    
    // 複数選択をリセット
    selectedOptions.type = [];
    selectedOptions.affiliation = [];
    selectedOptions.industryInterests = [];
    
    if (typeof updateMultiSelectTags === 'function') {
        updateMultiSelectTags('type');
        updateMultiSelectTags('affiliation');
        updateMultiSelectTags('industryInterests');
    }
}

// 新しいIDを生成（分散ファイル構造用）
function generateContactId() {
    if (typeof metadata !== 'undefined' && metadata.nextContactId) {
        const newId = String(metadata.nextContactId).padStart(6, '0');
        metadata.nextContactId++;
        return newId;
    }
    
    // フォールバック：既存の最大IDから次のIDを生成
    let maxId = 0;
    contacts.forEach(contact => {
        const id = parseInt(contact.id) || 0;
        if (id > maxId) {
            maxId = id;
        }
    });
    
    return String(maxId + 1).padStart(6, '0');
}

// 連絡先保存
async function saveContact() {
    const nameInput = document.getElementById('nameInput');
    if (!nameInput) {
        if (typeof showNotification === 'function') {
            showNotification('名前入力フィールドが見つかりません', 'error');
        }
        return;
    }

    const name = nameInput.value.trim();
    if (!name) {
        if (typeof showNotification === 'function') {
            showNotification('名前は必須です', 'error');
        }
        return;
    }

    if (typeof showLoading === 'function') {
        showLoading(true);
    }
    
    try {
        // 添付ファイルの処理
        const attachments = typeof getAttachments === 'function' ? getAttachments('attachmentList') : [];
        for (let i = 0; i < attachments.length; i++) {
            if (attachments[i].data && !attachments[i].path.includes('attachments/') && !attachments[i].path.startsWith('drive:')) {
                if (typeof saveAttachmentToFileSystem === 'function') {
                    const filePath = await saveAttachmentToFileSystem(
                        attachments[i].name,
                        attachments[i].data,
                        name
                    );
                    attachments[i].path = filePath;
                }
            }
        }

        // 写真の処理
        const photoPreview = document.getElementById('photoPreview');
        const businessCardPreview = document.getElementById('businessCardPreview');
        const photoSrc = photoPreview ? photoPreview.src : '';
        const businessCardSrc = businessCardPreview ? businessCardPreview.src : '';
        
        let photoPath = null;
        let businessCardPath = null;
        
        // 新しい画像の場合はGoogle Driveにアップロード
        if (photoSrc && photoSrc.startsWith('data:')) {
            photoPath = await saveAttachmentToFileSystem('photo.jpg', photoSrc, name);
        } else if (photoSrc && !photoSrc.endsWith('.html')) {
            photoPath = photoSrc; // 既存の画像パス
        }
        
        if (businessCardSrc && businessCardSrc.startsWith('data:')) {
            businessCardPath = await saveAttachmentToFileSystem('business-card.jpg', businessCardSrc, name);
        } else if (businessCardSrc && !businessCardSrc.endsWith('.html')) {
            businessCardPath = businessCardSrc; // 既存の画像パス
        }
        
        // 接触方法の処理
        const contactMethodDirect = document.getElementById('contactMethodDirect');
        const isDirect = contactMethodDirect ? contactMethodDirect.checked : true;
        const contactMethod = isDirect ? 'direct' : 'referral';
        
        const directContactInput = document.getElementById('directContactInput');
        const referrerInput = document.getElementById('referrerInput');
        const directContact = isDirect && directContactInput ? directContactInput.value : null;
        const referrer = !isDirect && referrerInput ? referrerInput.value : null;
        
        // フォーム値の取得
        const furiganaInput = document.getElementById('furiganaInput');
        const companyInput = document.getElementById('companyInput');
        const websiteInput = document.getElementById('websiteInput');
        const businessInput = document.getElementById('businessInput');
        const strengthsInput = document.getElementById('strengthsInput');
        const approachInput = document.getElementById('approachInput');
        const historyInput = document.getElementById('historyInput');
        const priorInfoInput = document.getElementById('priorInfoInput');
        const activityAreaInput = document.getElementById('activityAreaInput');
        const residenceInput = document.getElementById('residenceInput');
        const hobbiesInput = document.getElementById('hobbiesInput');
        const revenueInput = document.getElementById('revenueInput');
        
        // 連絡先オブジェクトの作成
        const contact = {
            id: currentContactId || generateContactId(),
            name: name,
            furigana: furiganaInput ? furiganaInput.value : '',
            company: companyInput ? companyInput.value : '',
            emails: typeof getMultiInputValues === 'function' ? getMultiInputValues('emailContainer') : [],
            phones: typeof getMultiInputValues === 'function' ? getMultiInputValues('phoneContainer') : [],
            website: websiteInput ? websiteInput.value : '',
            businesses: typeof getMultiInputValues === 'function' ? getMultiInputValues('businessContainer') : [],
            contactMethod: contactMethod,
            directContact: directContact,
            referrer: referrer,
            business: businessInput ? businessInput.value : '',
            strengths: strengthsInput ? strengthsInput.value : '',
            approach: approachInput ? approachInput.value : '',
            history: historyInput ? historyInput.value : '',
            priorInfo: priorInfoInput ? priorInfoInput.value : '',
            activityArea: activityAreaInput ? activityAreaInput.value : '',
            residence: residenceInput ? residenceInput.value : '',
            hobbies: hobbiesInput ? hobbiesInput.value : '',
            revenue: revenueInput ? (parseFloat(revenueInput.value) || 0) : 0,
            types: selectedOptions.type,
            affiliations: selectedOptions.affiliation,
            industryInterests: selectedOptions.industryInterests,
            status: currentContactId ? (contacts.find(c => c.id === currentContactId)?.status || '新規') : '新規',
            photo: photoPath,
            businessCard: businessCardPath,
            attachments: attachments,
            createdAt: currentContactId ? (contacts.find(c => c.id === currentContactId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // オプションを更新
        if (typeof updateOptionIfNew === 'function') {
            selectedOptions.type.forEach(type => updateOptionIfNew('types', type));
            selectedOptions.affiliation.forEach(aff => updateOptionIfNew('affiliations', aff));
            selectedOptions.industryInterests.forEach(ii => updateOptionIfNew('industryInterests', ii));
        }

        // 連絡先を保存または更新
        if (currentContactId) {
            const index = contacts.findIndex(c => c.id === currentContactId);
            if (index !== -1) {
                contacts[index] = contact;
            }
        } else {
            contacts.push(contact);

            // 初回ミーティング情報の処理
            const meetingDateInput = document.getElementById('meetingDateInput');
            const meetingContentInput = document.getElementById('meetingContentInput');
            const meetingDate = meetingDateInput ? meetingDateInput.value : '';
            const meetingContent = meetingContentInput ? meetingContentInput.value : '';
            
            if (meetingDate || meetingContent) {
                const todoList = document.getElementById('todoList');
                const todos = todoList && typeof getTodos === 'function' ? getTodos('todoList') : [];
                
                const meeting = {
                    id: typeof generateId === 'function' ? generateId() : Date.now().toString(),
                    contactId: contact.id,
                    date: meetingDate,
                    content: meetingContent,
                    todos: todos,
                    attachments: [],
                    createdAt: new Date().toISOString()
                };
                meetings.push(meeting);
            }
        }

        // 紹介売上を再計算
        if (typeof calculateReferrerRevenues === 'function') {
            calculateReferrerRevenues();
        }

        // データを保存（分散ファイル構造）
        if (typeof saveAllData === 'function') {
            await saveAllData();
        }
        
        if (typeof closeModal === 'function') {
            closeModal('contactModal');
        }
        
        // UI更新
        if (typeof renderContacts === 'function') {
            renderContacts();
        }
        if (typeof renderTodos === 'function') {
            renderTodos();
        }
        if (typeof updateFilters === 'function') {
            updateFilters();
        }
        if (typeof updateMultiSelectOptions === 'function') {
            updateMultiSelectOptions();
        }
        if (typeof updateTodoTabBadge === 'function') {
            updateTodoTabBadge();
        }
        
        if (typeof showNotification === 'function') {
            showNotification('連絡先を保存しました', 'success');
        }
    } catch (err) {
        console.error('保存エラー:', err);
        if (typeof showNotification === 'function') {
            showNotification('保存に失敗しました', 'error');
        }
    } finally {
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    }
}

// 連絡先削除
async function deleteContact() {
    if (!confirm('この連絡先を削除してもよろしいですか?\n関連するミーティング記録も削除されます。')) {
        return;
    }

    const contactToDelete = contacts.find(c => c.id === currentContactId);
    if (!contactToDelete) return;

    // 関連するミーティングも削除
    const contactMeetings = meetings.filter(m => m.contactId === currentContactId);
    
    // データから削除
    contacts = contacts.filter(c => c.id !== currentContactId);
    meetings = meetings.filter(m => m.contactId !== currentContactId);
    
    // Google Driveからファイルを削除
    try {
        if (typeof folderStructure !== 'undefined' && folderStructure.contacts) {
            const fileName = `contact-${String(currentContactId).padStart(6, '0')}.json`;
            const fileId = await getFileIdInFolder(fileName, folderStructure.contacts);
            if (fileId) {
                await gapi.client.drive.files.delete({
                    fileId: fileId
                });
            }
        }
        
        if (typeof folderStructure !== 'undefined' && folderStructure.meetings && contactMeetings.length > 0) {
            const meetingFileName = `contact-${String(currentContactId).padStart(6, '0')}-meetings.json`;
            const meetingFileId = await getFileIdInFolder(meetingFileName, folderStructure.meetings);
            if (meetingFileId) {
                await gapi.client.drive.files.delete({
                    fileId: meetingFileId
                });
            }
        }
    } catch (error) {
        console.error('ファイル削除エラー:', error);
    }
    
    // インデックスから削除
    if (typeof contactsIndex !== 'undefined') {
        delete contactsIndex[currentContactId];
    }
    if (typeof meetingsIndex !== 'undefined') {
        delete meetingsIndex[currentContactId];
    }
    if (typeof searchIndex !== 'undefined') {
        delete searchIndex[currentContactId];
    }
    
    // 未使用オプションをクリーンアップ
    cleanupUnusedOptions();
    
    if (typeof saveAllData === 'function') {
        await saveAllData();
    }
    
    if (typeof closeModal === 'function') {
        closeModal('contactDetailModal');
    }
    
    // UI更新
    if (typeof renderContacts === 'function') {
        renderContacts();
    }
    if (typeof renderTodos === 'function') {
        renderTodos();
    }
    if (typeof updateFilters === 'function') {
        updateFilters();
    }
    if (typeof updateMultiSelectOptions === 'function') {
        updateMultiSelectOptions();
    }
    if (typeof updateTodoTabBadge === 'function') {
        updateTodoTabBadge();
    }
    
    if (typeof showNotification === 'function') {
        showNotification('連絡先を削除しました', 'success');
    }
}

// 連絡先編集
function editContact() {
    if (typeof closeModal === 'function') {
        closeModal('contactDetailModal');
    }
    openContactModal(currentContactId);
}

// 紹介者からの売上計算
function calculateReferrerRevenues() {
    contacts.forEach(contact => {
        contact.referrerRevenue = calculateReferrerRevenue(contact.id);
        contact.referralCount = calculateReferralCount(contact.name);
    });
}

function calculateReferrerRevenue(contactId) {
    let totalRevenue = 0;
    
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return 0;
    
    const referrals = contacts.filter(c => c.referrer === contact.name);
    
    referrals.forEach(referral => {
        totalRevenue += referral.revenue || 0;
        totalRevenue += calculateReferrerRevenue(referral.id);
    });
    
    return totalRevenue;
}

function calculateReferralCount(contactName) {
    return contacts.filter(c => c.referrer === contactName).length;
}

// 未使用オプションの削除
function cleanupUnusedOptions() {
    const usedTypes = new Set();
    const usedAffiliations = new Set();
    const usedIndustryInterests = new Set();

    contacts.forEach(contact => {
        if (Array.isArray(contact.types)) {
            contact.types.forEach(t => usedTypes.add(t));
        }
        if (Array.isArray(contact.affiliations)) {
            contact.affiliations.forEach(a => usedAffiliations.add(a));
        }
        if (Array.isArray(contact.industryInterests)) {
            contact.industryInterests.forEach(i => usedIndustryInterests.add(i));
        }
    });

    options.types = options.types.filter(t => usedTypes.has(t));
    options.affiliations = options.affiliations.filter(a => usedAffiliations.has(a));
    options.industryInterests = options.industryInterests.filter(i => usedIndustryInterests.has(i));
}

// 連絡先詳細表示
function showContactDetail(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    currentContactId = contactId;
    const modal = document.getElementById('contactDetailModal');
    const title = document.getElementById('detailModalTitle');
    const content = document.getElementById('contactDetailContent');

    if (!modal || !title || !content) {
        console.error('Detail modal elements not found');
        return;
    }

    title.textContent = contact.name;

    const contactMeetings = meetings.filter(m => m.contactId === contactId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // ヘッダー部分の画像読み込み処理を改善
    let photoHtml = '';
    let businessCardHtml = '';
    
    if (contact.photo) {
        if (contact.photo.startsWith('drive:')) {
            // Google Driveの画像の場合は非同期で読み込み
            photoHtml = `<div id="photoPlaceholder" style="width: 150px; height: 150px; border-radius: 50%; background-color: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;">読み込み中...</div>`;
            // 非同期で画像を読み込み
            loadImageFromGoogleDrive(contact.photo).then(dataUrl => {
                if (dataUrl) {
                    const placeholder = document.getElementById('photoPlaceholder');
                    if (placeholder) {
                        placeholder.outerHTML = `<img src="${dataUrl}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="showImageModal('${dataUrl}', '顔写真')" title="クリックで拡大">`;
                    }
                }
            });
        } else {
            photoHtml = `<img src="${contact.photo}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="showImageModal('${contact.photo}', '顔写真')" title="クリックで拡大">`;
        }
    }
    
    if (contact.businessCard) {
        if (contact.businessCard.startsWith('drive:')) {
            businessCardHtml = `<div id="businessCardPlaceholder" style="width: 200px; height: 120px; border-radius: 0.5rem; background-color: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;">読み込み中...</div>`;
            // 非同期で画像を読み込み
            loadImageFromGoogleDrive(contact.businessCard).then(dataUrl => {
                if (dataUrl) {
                    const placeholder = document.getElementById('businessCardPlaceholder');
                    if (placeholder) {
                        placeholder.outerHTML = `<img src="${dataUrl}" style="width: 200px; height: auto; border-radius: 0.5rem; cursor: pointer;" onclick="showImageModal('${dataUrl}', '名刺画像')" title="クリックで拡大">`;
                    }
                }
            });
        } else {
            businessCardHtml = `<img src="${contact.businessCard}" style="width: 200px; height: auto; border-radius: 0.5rem; cursor: pointer;" onclick="showImageModal('${contact.businessCard}', '名刺画像')" title="クリックで拡大">`;
        }
    }

    // ヘッダー部分
    let headerHtml = `
        <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
            ${photoHtml}
            <div style="flex: 1;">
                <h3>${escapeHtml(contact.name)}${contact.furigana ? ` (${escapeHtml(contact.furigana)})` : ''}</h3>
                ${contact.company ? `<p><strong>会社:</strong> ${escapeHtml(contact.company)}</p>` : ''}
                ${contact.types && Array.isArray(contact.types) && contact.types.length > 0 ? `<p><strong>種別:</strong> ${contact.types.map(t => escapeHtml(t)).join(', ')}</p>` : ''}
                ${contact.affiliations && Array.isArray(contact.affiliations) && contact.affiliations.length > 0 ? `<p><strong>所属:</strong> ${contact.affiliations.map(a => escapeHtml(a)).join(', ')}</p>` : ''}
                ${contact.industryInterests && Array.isArray(contact.industryInterests) && contact.industryInterests.length > 0 ? `<p><strong>会いたい業種等:</strong> ${contact.industryInterests.map(i => escapeHtml(i)).join(', ')}</p>` : ''}
                ${contact.revenue ? `<p><strong>売上:</strong> ¥${contact.revenue.toLocaleString()}</p>` : ''}
                ${contact.referrerRevenue ? `<p><strong>紹介売上:</strong> ¥${contact.referrerRevenue.toLocaleString()}</p>` : ''}
            </div>
            ${businessCardHtml}
        </div>
    `;

    // 連絡先情報部分
    let contactInfoHtml = '<div class="contact-detail-grid">';
    
    contactInfoHtml += '<div>';
    if (contact.emails && contact.emails.length > 0) {
        contactInfoHtml += `
            <div class="contact-detail-section">
                <h4>メールアドレス</h4>
                ${contact.emails.map(email => `<p>📧 <a href="mailto:${email}">${escapeHtml(email)}</a></p>`).join('')}
            </div>
        `;
    }
    if (contact.phones && contact.phones.length > 0) {
        contactInfoHtml += `
            <div class="contact-detail-section">
                <h4>電話番号</h4>
                ${contact.phones.map(phone => `<p>📞 <a href="tel:${phone}">${escapeHtml(phone)}</a></p>`).join('')}
            </div>
        `;
    }
    if (contact.businesses && contact.businesses.length > 0) {
        contactInfoHtml += `
            <div class="contact-detail-section">
                <h4>事業内容</h4>
                ${contact.businesses.map(business => `<p>📋 ${escapeHtml(business)}</p>`).join('')}
            </div>
        `;
    }
    contactInfoHtml += '</div>';
    
    contactInfoHtml += '<div>';
    if (contact.website) {
        contactInfoHtml += `
            <div class="contact-detail-section">
                <h4>ホームページ</h4>
                <p>🌐 <a href="${contact.website}" target="_blank">${escapeHtml(contact.website)}</a></p>
            </div>
        `;
    }
    
    // 接触方法の表示
    if (contact.contactMethod === 'referral' && contact.referrer) {
        const referrerContact = contacts.find(c => c.name === contact.referrer);
        contactInfoHtml += `
            <div class="contact-detail-section">
                <h4>接触(紹介)</h4>
                <p>👤 ${referrerContact ? `<span class="clickable-link" onclick="closeModal('contactDetailModal'); showContactDetail('${referrerContact.id}')">${escapeHtml(contact.referrer)}</span>` : escapeHtml(contact.referrer)}</p>
            </div>
        `;
    } else if (contact.contactMethod === 'direct' || contact.directContact) {
        contactInfoHtml += `
            <div class="contact-detail-section">
                <h4>接触(直接)</h4>
                <p>🤝 ${escapeHtml(contact.directContact || '所属が同じ')}</p>
            </div>
        `;
    } else if (contact.referrer) {
        const referrerContact = contacts.find(c => c.name === contact.referrer);
        contactInfoHtml += `
            <div class="contact-detail-section">
                <h4>接触(紹介)</h4>
                <p>👤 ${referrerContact ? `<span class="clickable-link" onclick="closeModal('contactDetailModal'); showContactDetail('${referrerContact.id}')">${escapeHtml(contact.referrer)}</span>` : escapeHtml(contact.referrer)}</p>
            </div>
        `;
    }
    
    if (contact.residence) {
        contactInfoHtml += `
            <div class="contact-detail-section">
                <h4>居住地</h4>
                <p>🏠 ${escapeHtml(contact.residence)}</p>
            </div>
        `;
    }
    
    contactInfoHtml += '</div>';
    contactInfoHtml += '</div>';

    // 詳細情報部分
    let detailsHtml = '';
    if (contact.business) {
        detailsHtml += `
            <div class="form-group">
                <h4>事業内容詳細</h4>
                <div class="collapsible-wrapper">
                    <div class="markdown-preview collapsible-content" id="businessContent">
                        ${typeof renderMarkdown === 'function' ? renderMarkdown(contact.business) : escapeHtml(contact.business)}
                    </div>
                </div>
            </div>
        `;
    }
    if (contact.strengths) {
        detailsHtml += `
            <div class="form-group">
                <h4>強み</h4>
                <div class="collapsible-wrapper">
                    <div class="markdown-preview collapsible-content" id="strengthsContent">
                        ${typeof renderMarkdown === 'function' ? renderMarkdown(contact.strengths) : escapeHtml(contact.strengths)}
                    </div>
                </div>
            </div>
        `;
    }
    if (contact.approach) {
        detailsHtml += `
            <div class="form-group">
                <h4>切り出し方</h4>
                <div class="collapsible-wrapper">
                    <div class="markdown-preview collapsible-content" id="approachContent">
                        ${typeof renderMarkdown === 'function' ? renderMarkdown(contact.approach) : escapeHtml(contact.approach)}
                    </div>
                </div>
            </div>
        `;
    }
    if (contact.history) {
        detailsHtml += `
            <div class="form-group">
                <h4>過去の経歴</h4>
                <div class="collapsible-wrapper">
                    <div class="markdown-preview collapsible-content" id="historyContent">
                        ${typeof renderMarkdown === 'function' ? renderMarkdown(contact.history) : escapeHtml(contact.history)}
                    </div>
                </div>
            </div>
        `;
    }
    if (contact.priorInfo) {
        detailsHtml += `
            <div class="form-group">
                <h4>事前情報</h4>
                <div class="collapsible-wrapper">
                    <div class="markdown-preview collapsible-content" id="priorInfoContent">
                        ${typeof renderMarkdown === 'function' ? renderMarkdown(contact.priorInfo) : escapeHtml(contact.priorInfo)}
                    </div>
                </div>
            </div>
        `;
    }
    if (contact.attachments && contact.attachments.length > 0) {
        detailsHtml += `
            <div class="form-group">
                <h4>添付ファイル</h4>
                <div class="file-list">
                    ${contact.attachments.map(file => `
                        <div class="file-item">
                            📎 <a href="javascript:void(0)" onclick="openFile('${file.data || file.path}', '${file.name}', '${file.type || ''}')">${escapeHtml(file.name)}</a>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ミーティング履歴部分
    let meetingsHtml = `
        <div class="meeting-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3>ミーティング履歴</h3>
                <button class="btn btn-primary" onclick="openMeetingModal('${contactId}')">➕ ミーティング追加</button>
            </div>
            <div class="meeting-list">
                ${contactMeetings.length > 0 ? contactMeetings.map(meeting => `
                    <div class="meeting-item">
                        <div class="meeting-header">
                            <div class="meeting-date">${typeof formatDate === 'function' ? formatDate(meeting.date) : meeting.date}</div>
                            <div class="meeting-actions">
                                <button class="btn btn-sm" onclick="editMeeting('${meeting.id}')">編集</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteMeeting('${meeting.id}')">削除</button>
                            </div>
                        </div>
                        <div class="meeting-content">${typeof renderMarkdown === 'function' ? renderMarkdown(meeting.content || '') : escapeHtml(meeting.content || '')}</div>
                        ${meeting.todos && meeting.todos.length > 0 ? `
                            <div class="todo-section">
                                <div class="todo-section-header">
                                    📋 ToDo
                                    <span class="todo-badge">${meeting.todos.filter(t => !t.completed).length}/${meeting.todos.length}</span>
                                </div>
                                <div class="todo-list">
                                    ${meeting.todos.map((todo, todoIndex) => `
                                        <div class="todo-item">
                                            <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} 
                                                   onchange="toggleTodoComplete('${meeting.id}', ${todoIndex})">
                                            <span class="todo-text ${todo.completed ? 'completed' : ''}">${escapeHtml(todo.text)}</span>
                                            ${todo.dueDate ? `<span class="todo-date">期限: ${typeof formatDate === 'function' ? formatDate(todo.dueDate) : todo.dueDate}</span>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${meeting.attachments && meeting.attachments.length > 0 ? `
                            <div class="file-list">
                                ${meeting.attachments.map(file => `
                                    <div class="file-item">
                                        📎 <a href="javascript:void(0)" onclick="openFile('${file.data || file.path}', '${file.name}', '${file.type || ''}')">${escapeHtml(file.name)}</a>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('') : '<p>ミーティング履歴がありません</p>'}
            </div>
        </div>
    `;

    content.innerHTML = headerHtml + contactInfoHtml + detailsHtml + meetingsHtml;

    
    // 添付ファイルのプレビューを描画
    if (typeof renderAttachmentsInDetail === "function") { renderAttachmentsInDetail(contact); }
// 折りたたみ機能を初期化
    setTimeout(() => {
        if (typeof initializeCollapsibles === 'function') {
            initializeCollapsibles();
        }
    }, 100);

    modal.classList.add('active');
    modal.querySelector('.modal-content').scrollTop = 0;
}


// ========= 連絡先詳細: 添付ファイルの表示（画像/PDF対応） =========
async function renderAttachmentsInDetail(contact){
    try{
        // 1) 連絡先直下の添付
        let atts = Array.isArray(contact && contact.attachments) ? contact.attachments.slice() : [];

        // 2) ミーティング配下の添付も補完
        try{
            const cid = contact.id || contact.contactId;
            const mlist = (window.meetingsByContact && cid && window.meetingsByContact[cid]) ? window.meetingsByContact[cid] : [];
            if(Array.isArray(mlist)){
                mlist.forEach(m => {
                    if(Array.isArray(m && m.attachments)) atts.push(...m.attachments);
                });
            }
        }catch(e){ console.warn('meetings attachments fallback failed', e); }

        // 3) 正規化
        const seen = new Set();
        atts = atts.map(a => {
            if(!a) return null;
            const name = a.name || a.fileName || '';
            const mime = a.type || a.mimeType || '';
            const ref  = a.data || a.path || a.fileId || a.id || '';
            const key = (name||'') + '|' + (ref||'');
            if(seen.has(key)) return null;
            seen.add(key);
            return { name, mime, ref };
        }).filter(Boolean);
        if(atts.length === 0) return;

        const content = document.getElementById('contactDetailContent');
        if(!content) return;
        const section = document.createElement('section');
        section.style.marginTop = '1.5rem';
        section.innerHTML = `<h3>添付ファイル</h3><div class="attachment-previews" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;"></div>`;
        const grid = section.querySelector('.attachment-previews');

        for(const file of atts){
            const card = document.createElement('div');
            card.className = 'attachment-card';
            card.style.cssText = 'border:1px solid var(--border-color);border-radius:10px;padding:10px;background:var(--bg-secondary);';

            const name = file.name || 'ファイル';
            const mime = (file.mime || '').toLowerCase();
            const ref  = file.ref || '';

            const lower = (name || '').toLowerCase();
            const isPDF = mime.includes('pdf') || lower.endsWith('.pdf');
            const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp)$/i.test(lower);

            // Drive 実体URLへ解決
            let url = ref;
            if(ref && (ref.startsWith('drive:') || /^[A-Za-z0-9_-]{20,}$/.test(ref))){
                if(typeof loadDriveFileAsObjectURL === 'function'){
                    url = await loadDriveFileAsObjectURL(ref);
                }
            }

            if(isImage){
                card.innerHTML = url
                  ? `<div style="aspect-ratio:4/3;overflow:hidden;border-radius:8px;"><img src="${url}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover"></div><div style="margin-top:6px;word-break:break-all;">${escapeHtml(name)}</div>`
                  : `<div>画像を読み込めませんでした</div><div>${escapeHtml(name)}</div>`;
            }else if(isPDF){
                card.innerHTML = url
                  ? `<div style="aspect-ratio:4/3;overflow:hidden;border-radius:8px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;">PDF</div><div style="margin-top:6px;word-break:break-all;"><a href="${url}" target="_blank" rel="noopener">📄 ${escapeHtml(name)}</a></div>`
                  : `<div>PDFを読み込めませんでした</div><div>${escapeHtml(name)}</div>`;
            }else{
                card.innerHTML = `<div style="margin:6px 0;word-break:break-all;"><a href="${url||'#'}" target="_blank" rel="noopener">📎 ${escapeHtml(name)}</a></div>`;
            }

            grid.appendChild(card);
        }

        content.appendChild(section);
    }catch(e){
        console.warn('renderAttachmentsInDetail error', e);
    }
}

            }else if(type==='application/pdf' || (name||'').toLowerCase().endswith('.pdf')){
                const url = await (typeof loadDriveFileAsObjectURL==='function' ? loadDriveFileAsObjectURL(ref) : Promise.resolve(ref));
                if(url){
                    card.innerHTML = `<div style="aspect-ratio:4/3;overflow:hidden;border-radius:8px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;">PDF</div><div style="margin-top:6px;word-break:break-all;"><a href="${url}" target="_blank" rel="noopener">📄 ${escapeHtml(name)}</a></div>`;
                }else{
                    card.innerHTML = `<div>PDFを読み込めませんでした</div><div>${escapeHtml(name)}</div>`;
                }
            }else{
                const url = await (typeof loadDriveFileAsObjectURL==='function' ? loadDriveFileAsObjectURL(ref) : Promise.resolve(ref));
                card.innerHTML = `<div style="margin:6px 0;word-break:break-all;"><a href="${url||'#'}" target="_blank" rel="noopener">📎 ${escapeHtml(name)}</a></div>`;
            }
            grid.appendChild(card);
        }
        content.appendChild(section);
    }catch(e){ console.warn('renderAttachmentsInDetail error', e); }
}
