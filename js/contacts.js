// contacts.js - 分散ファイル構造対応の連絡先管理機能(修正版)

// [CLAUDE FIX] フィルター機能とオプション管理の修正
// 既存契約を維持しつつ、副作用を排除した実装

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

    // [FIX] マルチセレクトオプションを確実に初期化
    if (typeof updateMultiSelectOptions === 'function') {
        updateMultiSelectOptions();
    }

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

    // [CLAUDE FIX] 画像表示の修正 - 確実な画像URL解決
    loadContactImages(contact);
    
    // [FIX] 複数選択項目の確実な読み込み
    selectedOptions.type = Array.isArray(contact.types) ? [...contact.types] : [];
    selectedOptions.affiliation = Array.isArray(contact.affiliations) ? [...contact.affiliations] : [];
    selectedOptions.industryInterests = Array.isArray(contact.industryInterests) ? [...contact.industryInterests] : [];
    
    // マルチセレクトオプションとタグを更新
    setTimeout(() => {
        if (typeof updateMultiSelectOptions === 'function') {
            updateMultiSelectOptions('type');
            updateMultiSelectOptions('affiliation');
            updateMultiSelectOptions('industryInterests');
        }
        if (typeof updateMultiSelectTags === 'function') {
            updateMultiSelectTags('type');
            updateMultiSelectTags('affiliation');
            updateMultiSelectTags('industryInterests');
        }
    }, 100);

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

// [CLAUDE FIX] 画像読み込み関数の追加

/* [fix][attachments] START (anchor:contacts.js:displayAttachments) */
// 連絡先編集モーダル内・添付ファイル一覧を描画
function displayAttachments(atts, targetElementId){
    try{
        const container = document.getElementById(targetElementId);
        if(!container) return;
        container.innerHTML = '';

        if (!Array.isArray(atts) || !atts.length){
            container.innerHTML = '<div class="empty">添付ファイルはありません</div>';
            return;
        }

        atts.forEach(file => {
            const name = (file && (file.name || file.filename)) || 'ファイル';
            const mime = String(file && (file.mime || file.mimetype || '')).toLowerCase();
            const path = String(file && (file.path || file.url || file.ref || '')).trim();

            // URL解決
            let url = null;
            if (path){
                if (path.startsWith('drive:')){
                    const id = path.slice(6).trim();
                    if (id && typeof buildDriveDownloadUrl === 'function'){
                        url = buildDriveDownloadUrl(id);
                    }
                }else if (typeof sanitizeImageUrl === 'function'){
                    url = sanitizeImageUrl(path) || path;
                }else{
                    url = path;
                }
            }

            const card = document.createElement('div');
            card.className = 'attachment-card';

            if (mime.startsWith('image/')){
                const img = document.createElement('img');
                img.className = 'attachment-thumb';
                img.alt = name;
                if (url) img.src = url;
                img.onclick = ()=> { if (url) (typeof openImageLightbox === 'function' ? openImageLightbox(url) : window.open(url, '_blank')); };
                card.appendChild(img);
            }else if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')){
                const btn = document.createElement('button');
                btn.className = 'btn btn-sm';
                btn.textContent = 'PDFを開く';
                btn.onclick = ()=> { if (url) window.open(url, '_blank'); };
                card.appendChild(btn);
            }else{
                const btn = document.createElement('button');
                btn.className = 'btn btn-sm';
                btn.textContent = 'ダウンロード';
                btn.onclick = ()=> { if (url) window.open(url, '_blank'); };
                card.appendChild(btn);
            }

            const label = document.createElement('div');
            label.className = 'attachment-name';
            label.textContent = name;
            card.appendChild(label);

            container.appendChild(card);
        });
    }catch(e){
        console.warn('[fix][attachments] displayAttachments error', e);
    }
}
/* [fix][attachments] END (anchor:contacts.js:displayAttachments) */
/* [fix][image-resolve] START (anchor:contacts.js:loadContactImages) */

/* [fix][image-resolve] START (anchor:contacts.js:loadContactImages) */

/* [fix][image-resolve] START (anchor:contacts.js:loadContactImages) */
async function loadContactImages(contact) {
    try {
        if (!contact) return;

        // 顔写真
        const photoPreview = document.getElementById('photoPreview');
        const photoPreviewContainer = document.getElementById('photoPreviewContainer');
        if (photoPreview && photoPreviewContainer) {
            let url = null;
            if (typeof AppData !== 'undefined' && typeof AppData.resolveContactImageUrl === 'function') {
                url = await AppData.resolveContactImageUrl(contact, 'photo');
            } else if (typeof resolveImageUrl === 'function') {
                url = resolveImageUrl(contact, 'photo');
            }
            if (url) {
                // 遅延安全読み込み
                try{
                  if(typeof generatePlaceholderImage==='function'){ photoPreview.src = generatePlaceholderImage(); }
                  photoPreview.setAttribute('data-src', url);
                  if(typeof loadImageSafely==='function'){ setTimeout(function(){ loadImageSafely(photoPreview, url); },0); }
                  else { photoPreview.src = url; }
                }catch(_e){ photoPreview.src = url; }
                photoPreviewContainer.style.display = 'block';
            } else {
                photoPreview.src = '';
                photoPreviewContainer.style.display = 'none';
            }
        }

        // 名刺画像
        const businessCardPreview = document.getElementById('businessCardPreview');
        const businessCardPreviewContainer = document.getElementById('businessCardPreviewContainer');
        if (businessCardPreview && businessCardPreviewContainer) {
            let url = null;
            if (typeof AppData !== 'undefined' && typeof AppData.resolveContactImageUrl === 'function') {
                url = await AppData.resolveContactImageUrl(contact, 'businessCard');
            } else if (typeof resolveImageUrl === 'function') {
                url = resolveImageUrl(contact, 'businessCard');
            }
            if (url) {
                try{
                  if(typeof generatePlaceholderImage==='function'){ businessCardPreview.src = generatePlaceholderImage(); }
                  businessCardPreview.setAttribute('data-src', url);
                  if(typeof loadImageSafely==='function'){ setTimeout(function(){ loadImageSafely(businessCardPreview, url); },0); }
                  else { businessCardPreview.src = url; }
                }catch(_e){ businessCardPreview.src = url; }
                businessCardPreviewContainer.style.display = 'block';
                // クリックで拡大（ライトボックス）
                businessCardPreview.onclick = () => {
                    if (typeof openImageLightbox === 'function') openImageLightbox(url);
                    else window.open(url, '_blank');
                };
            } else {
                businessCardPreview.src = '';
                businessCardPreviewContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.warn('[fix][image-resolve] loadContactImages error:', error);
    }
}
/* [fix][image-resolve] END (anchor:contacts.js:loadContactImages) */
/* [fix][image-resolve] END (anchor:contacts.js:loadContactImages) */

/* [fix][image-resolve] END (anchor:contacts.js:loadContactImages) */
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

// [CLAUDE FIX] 新しいIDを生成(分散ファイル構造用)
function generateContactId() {
    if (typeof metadata !== 'undefined' && metadata.nextContactId) {
        const newId = String(metadata.nextContactId).padStart(6, '0');
        metadata.nextContactId++;
        return newId;
    }
    
    // フォールバック:既存の最大IDから次のIDを生成
    let maxId = 0;
    contacts.forEach(contact => {
        const id = parseInt(contact.id) || 0;
        if (id > maxId) {
            maxId = id;
        }
    });
    
    return String(maxId + 1).padStart(6, '0');
}

// [CLAUDE FIX] 連絡先保存 - オプション更新エラー修正

/* [fix][image-resolve] 正準参照化: dataURL/HTTP/blobの永続化を禁止し、既存のDrive参照を優先 */
function normalizeImageRefForSave(existingRef, currentSrc){
    try{
        const cur = String(currentSrc||'');
        const exist = String(existingRef||'');
        // 既に drive: ならそのまま
        if(cur.startsWith('drive:')) return cur;
        // data: はアップロード器に委ね(呼び出し元で処理)
        if(cur.startsWith('data:')) return null;
        // blob: / http(s): は期限切れになるため、既存の参照を維持
        if(cur.startsWith('blob:') || cur.startsWith('http:') || cur.startsWith('https:')){
            if(exist && exist.startsWith('drive:')) return exist;
            return null; // 保存しない(既存がなければ空)
        }
        // 既存のattachments相対パス等は許容
        if(cur && !cur.endsWith('.html')) return cur;
        return exist && !exist.endsWith('.html') ? exist : null;
    }catch(e){ console.warn('[fix][image-resolve] normalize error', e); return existingRef||null; }
}

/* [fix][attachments] START (anchor:contacts.js:saveContact) */
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
                if (typeof window.AppData !== 'undefined' && typeof window.AppData.saveAttachmentToFileSystem === 'function') {
                    const filePath = await window.AppData.saveAttachmentToFileSystem(
                        attachments[i].name,
                        attachments[i].data,
                        currentContactId || name
                    );
                    attachments[i].path = filePath;
                } else {
                    console.warn('[fix][attachments] saveAttachmentToFileSystem not available');
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
        
// [fix][attachments] 既存のdrive:参照を優先
        const existingContact = currentContactId ? contacts.find(c => c.id === currentContactId) : null;
        const existingPhoto = existingContact ? existingContact.photo : null;
        const existingCard = existingContact ? existingContact.businessCard : null;
        
        // [fix][avatar] 新しい画像の場合はGoogle Driveにアップロード
        if (photoSrc && photoSrc.startsWith('data:')) {
            if (typeof window.AppData !== 'undefined' && typeof window.AppData.saveAttachmentToFileSystem === 'function') {
                photoPath = await window.AppData.saveAttachmentToFileSystem(
                    'photo.jpg', 
                    photoSrc, 
                    currentContactId || name
                );
            } else {
                console.warn('[fix][attachments] saveAttachmentToFileSystem not available for photo');
            }
        } else if (photoSrc && photoSrc.startsWith('drive:')) {
            // [fix][avatar] 既存のdrive:参照を維持
            photoPath = photoSrc;
        } else if (photoSrc && (photoSrc.startsWith('http') || photoSrc.startsWith('https'))) {
            // [fix][avatar] 既存のhttp/https URLを維持
            photoPath = photoSrc;
        } else if (photoSrc && photoSrc.startsWith('blob:')) {
            // [fix][avatar] blob:は一時的なので既存参照を維持
            photoPath = existingPhoto || null;
        } else if (!photoSrc && existingPhoto) {
            // [fix][avatar] srcが空でも既存値があれば維持
            photoPath = existingPhoto;
        }
        
        if (businessCardSrc && businessCardSrc.startsWith('data:')) {
            if (typeof window.AppData !== 'undefined' && typeof window.AppData.saveAttachmentToFileSystem === 'function') {
                businessCardPath = await window.AppData.saveAttachmentToFileSystem(
                    'business-card.jpg', 
                    businessCardSrc, 
                    currentContactId || name
                );
            } else {
                console.warn('[fix][attachments] saveAttachmentToFileSystem not available for business card');
            }
        } else if (businessCardSrc && businessCardSrc.startsWith('drive:')) {
            // [fix][avatar] 既存のdrive:参照を維持
            businessCardPath = businessCardSrc;
        } else if (businessCardSrc && (businessCardSrc.startsWith('http') || businessCardSrc.startsWith('https'))) {
            // [fix][avatar] 既存のhttp/https URLを維持
            businessCardPath = businessCardSrc;
        } else if (businessCardSrc && businessCardSrc.startsWith('blob:')) {
            // [fix][avatar] blob:は一時的なので既存参照を維持
            businessCardPath = existingCard || null;
        } else if (!businessCardSrc && existingCard) {
            // [fix][avatar] srcが空でも既存値があれば維持
            businessCardPath = existingCard;
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
            types: selectedOptions.type || [],
            affiliations: selectedOptions.affiliation || [],
            industryInterests: selectedOptions.industryInterests || [],
            status: currentContactId ? (contacts.find(c => c.id === currentContactId)?.status || '新規') : '新規',
            photo: photoPath,
            businessCard: businessCardPath,
            attachments: attachments,
            createdAt: currentContactId ? (contacts.find(c => c.id === currentContactId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // [CLAUDE FIX] オプションを安全に更新
        try {
            if (typeof updateOptionIfNew === 'function') {
                (selectedOptions.type || []).forEach(type => updateOptionIfNew('types', type));
                (selectedOptions.affiliation || []).forEach(aff => updateOptionIfNew('affiliations', aff));
                (selectedOptions.industryInterests || []).forEach(ii => updateOptionIfNew('industryInterests', ii));
            }
        } catch (optError) {
            console.warn('[fix][options] updateOptionIfNew failed:', optError);
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
                if (typeof window.meetings !== 'undefined') {
                    meetings.push(meeting);
                }
            }
        }

        // 紹介売上を再計算
        if (typeof calculateReferrerRevenues === 'function') {
            calculateReferrerRevenues();
        }

        // データを保存(分散ファイル構造)
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
        
        console.log('[fix][contacts] saved contact:', contact.id);
        
    } catch (err) {
        console.error('[fix][contacts] save error:', err);
        if (typeof showNotification === 'function') {
            showNotification('保存に失敗しました: ' + (err.message || err), 'error');
        }
    } finally {
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
    }
}
/* [fix][attachments] END (anchor:contacts.js:saveContact) */

// 連絡先削除
async function deleteContact() {
    if (!confirm('この連絡先を削除してもよろしいですか?\n関連するミーティング記録も削除されます。')) {
        return;
    }

    const contactToDelete = contacts.find(c => c.id === currentContactId);
    if (!contactToDelete) return;

    // 関連するミーティングも削除
    const contactMeetings = (typeof window.meetings !== 'undefined' ? meetings : []).filter(m => m.contactId === currentContactId);
    
    // データから削除
    if (typeof window.contacts !== 'undefined') {
        window.contacts = contacts.filter(c => c.id !== currentContactId);
    }
    if (typeof window.meetings !== 'undefined') {
        window.meetings = meetings.filter(m => m.contactId !== currentContactId);
    }
    
    // Google Driveからファイルを削除
    try {
        if (typeof folderStructure !== 'undefined' && folderStructure.contacts) {
            const fileName = `contact-${String(currentContactId).padStart(6, '0')}.json`;
            const fileId = await getFileIdInFolder(fileName, folderStructure.contacts);
            if (fileId && typeof gapi !== 'undefined' && gapi.client) {
                await gapi.client.drive.files.delete({
                    fileId: fileId
                });
            }
        }
        
        if (typeof folderStructure !== 'undefined' && folderStructure.meetings && contactMeetings.length > 0) {
            const meetingFileName = `contact-${String(currentContactId).padStart(6, '0')}-meetings.json`;
            const meetingFileId = await getFileIdInFolder(meetingFileName, folderStructure.meetings);
            if (meetingFileId && typeof gapi !== 'undefined' && gapi.client) {
                await gapi.client.drive.files.delete({
                    fileId: meetingFileId
                });
            }
        }
    } catch (error) {
        console.warn('[fix][contacts] file delete error:', error);
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
    if (typeof cleanupUnusedOptions === 'function') {
        cleanupUnusedOptions();
    }
    
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
    
    console.log('[fix][contacts] deleted contact:', currentContactId);
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
    if (!Array.isArray(contacts)) return;
    
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
    if (!Array.isArray(contacts)) return 0;
    return contacts.filter(c => c.referrer === contactName).length;
}

// 未使用オプションの削除
function cleanupUnusedOptions() {
    if (!window.options || !Array.isArray(contacts)) return;
    
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

    if (options.types) options.types = options.types.filter(t => usedTypes.has(t));
    if (options.affiliations) options.affiliations = options.affiliations.filter(a => usedAffiliations.has(a));
    if (options.industryInterests) options.industryInterests = options.industryInterests.filter(i => usedIndustryInterests.has(i));
}

// [CLAUDE FIX] 連絡先詳細表示 - 画像表示修正
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

    const contactMeetings = (typeof window.meetings !== 'undefined' ? meetings : [])
        .filter(m => m.contactId === contactId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // ヘッダー部分の画像読み込み処理を改善
    let photoHtml = '';
    let businessCardHtml = '';
    
    // 顔写真の非同期処理
    if (contact.photo) {
        photoHtml = `<div id="photoPlaceholder" style="width: 150px; height: 150px; border-radius: 50%; background-color: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;">読み込み中...</div>`;
        // 非同期で画像を読み込み
        resolveContactImage(contactId, 'photo').then(url => {
            const placeholder = document.getElementById('photoPlaceholder');
            if (placeholder && url) {
                placeholder.outerHTML = `<img src="${url}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="showImageModal('${url}', '顔写真')" title="クリックで拡大">`;
            } else if (placeholder) {
                placeholder.outerHTML = `<div style="width: 150px; height: 150px; border-radius: 50%; background-color: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">写真なし</div>`;
            }
        }).catch(err => {
            console.warn('[fix][photo] resolve failed in detail:', err);
            const placeholder = document.getElementById('photoPlaceholder');
            if (placeholder) {
                placeholder.outerHTML = `<div style="width: 150px; height: 150px; border-radius: 50%; background-color: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">写真なし</div>`;
            }
        });
    }
    
    // 名刺画像の非同期処理
    if (contact.businessCard) {
        businessCardHtml = `<div id="businessCardPlaceholder" style="width: 200px; height: 120px; border-radius: 0.5rem; background-color: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;">読み込み中...</div>`;
        // 非同期で画像を読み込み
        resolveContactImage(contactId, 'businessCard').then(url => {
            const placeholder = document.getElementById('businessCardPlaceholder');
            if (placeholder && url) {
                placeholder.outerHTML = `<img src="${url}" style="width: 200px; height: auto; border-radius: 0.5rem; cursor: pointer;" onclick="showImageModal('${url}', '名刺画像')" title="クリックで拡大">`;
            } else if (placeholder) {
                placeholder.outerHTML = `<div style="width: 200px; height: 120px; border-radius: 0.5rem; background-color: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">名刺なし</div>`;
            }
        }).catch(err => {
            console.warn('[fix][businessCard] resolve failed in detail:', err);
            const placeholder = document.getElementById('businessCardPlaceholder');
            if (placeholder) {
                placeholder.outerHTML = `<div style="width: 200px; height: 120px; border-radius: 0.5rem; background-color: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">名刺なし</div>`;
            }
        });
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
    if (typeof renderAttachmentsInDetail === "function") { 
        renderAttachmentsInDetail(contact); 
    }
    
    // 折りたたみ機能を初期化
    setTimeout(() => {
        if (typeof initializeCollapsibles === 'function') {
            initializeCollapsibles();
        }
    }, 100);

    modal.classList.add('active');
    modal.querySelector('.modal-content').scrollTop = 0;
    
    console.log('[fix][contacts] showed detail for:', contactId);
}

// [CLAUDE FIX] 画像URL解決関数(改善版)
/* [fix][image-resolve] START (anchor:contacts.js:resolveContactImage) */
async function resolveContactImage(contactId, type, fallback = null) {
    try {
        if (!contactId || !type) return fallback;
        
        // データから既存のパスを確認
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) return fallback;
        
        let storedPath = '';
        if (type === 'photo') {
            storedPath = contact.photo || '';
        } else if (type === 'businessCard') {
            storedPath = contact.businessCard || '';
        }
        
        // [fix][image-resolve] drive:形式の場合
        if (storedPath.startsWith('drive:')) {
            // [fix][image-resolve] キャッシュ+並列制御を使用
            if (typeof window.__imageQueue !== 'undefined' && typeof window.__imageQueue.enqueue === 'function') {
                try {
                    const ctrl = new AbortController();
                    const url = await window.__imageQueue.enqueue(storedPath, ctrl.signal);
                    return url || fallback;
                } catch (e) {
                    console.warn('[fix][image-resolve] queue failed', e);
                }
            }
            
            // フォールバック:直接読み込み
            if (typeof loadImageFromGoogleDrive === 'function') {
                try {
                    return await loadImageFromGoogleDrive(storedPath);
                } catch (e) {
                    console.warn('[fix][image-resolve] direct load failed', e);
                }
            }
        }
        
        // 通常のURL形式の場合
        if (storedPath.startsWith('http') || storedPath.startsWith('data:')) {
            return storedPath;
        }
        
        // パスが無い場合はフォールバック
        return fallback;
        
    } catch (error) {
        console.warn(`[fix][image-resolve] resolve failed for ${contactId}/${type}:`, error);
        return fallback;
    }
}
/* [fix][image-resolve] END (anchor:contacts.js:resolveContactImage) */

// 添付ファイルの詳細表示(拡張版)
async function renderAttachmentsInDetail(contact) {
    try {
        // 1) 連絡先直下の添付
        let atts = Array.isArray(contact.attachments) ? contact.attachments.slice() : [];

        // 2) ミーティングに紐づく添付も補完
        try {
            const cid = contact.id || contact.contactId;
            const mlist = (window.meetingsByContact && cid && window.meetingsByContact[cid]) ? window.meetingsByContact[cid] : [];
            if (Array.isArray(mlist)) {
                mlist.forEach(m => {
                    if (Array.isArray(m && m.attachments)) {
                        atts.push(...m.attachments);
                    }
                });
            }
        } catch (e) { 
            console.warn('meetings attachments fallback failed', e); 
        }

        // 3) 正規化(重複排除、空要素除去)
        const seen = new Set();
        atts = atts.map(a => {
            if (!a) return null;
            const name = a.name || a.fileName || '';
            const mime = a.type || a.mimeType || '';
            const ref = a.data || a.path || a.fileId || a.id || '';
            const key = (name || '') + '|' + (ref || '');
            if (seen.has(key)) return null;
            seen.add(key);
            return { name, mime, ref };
        }).filter(Boolean);
        
        if (atts.length === 0) return; // 表示なし

        const content = document.getElementById('contactDetailContent');
        if (!content) return;
        
        const section = document.createElement('section');
        section.style.marginTop = '1.5rem';
        section.innerHTML = `<h3>添付ファイル</h3><div class="attachment-previews" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;"></div>`;
        const grid = section.querySelector('.attachment-previews');

        for (const file of atts) {
            const card = document.createElement('div');
            card.className = 'attachment-card';
            card.style.cssText = 'border:1px solid var(--border-color);border-radius:10px;padding:10px;background:var(--bg-secondary);';
            const name = file.name || 'ファイル';
            const mime = (file.mime || '').toLowerCase();
            const ref = file.ref || '';

            // 拡張子判定も併用
            const lower = (name || '').toLowerCase();
            const isPDF = mime.includes('pdf') || lower.endsWith('.pdf');
            const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|bmp|webp)$/i.test(lower);

            // Driveの実体URLへ
            let url = ref;
            if (ref && (ref.startsWith('drive:') || /^[A-Za-z0-9_-]{20,}$/.test(ref))) {
                if (typeof loadDriveFileAsObjectURL === 'function') {
                    url = await loadDriveFileAsObjectURL(ref);
                }
            }

            if (isImage) {
                if (url) {
                    card.innerHTML = `<div style="aspect-ratio:4/3;overflow:hidden;border-radius:8px;"><img src="${url}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover"></div><div style="margin-top:6px;word-break:break-all;">${escapeHtml(name)}</div>`;
                } else {
                    card.innerHTML = `<div>画像を読み込めませんでした</div><div>${escapeHtml(name)}</div>`;
                }
            } else if (isPDF) {
                if (url) {
                    card.innerHTML = `<div style="aspect-ratio:4/3;overflow:hidden;border-radius:8px;background:var(--bg-tertiary);display:flex;align-items:center;justify-content:center;">PDF</div><div style="margin-top:6px;word-break:break-all;"><a href="${url}" target="_blank" rel="noopener">📄 ${escapeHtml(name)}</a></div>`;
                } else {
                    card.innerHTML = `<div>PDFを読み込めませんでした</div><div>${escapeHtml(name)}</div>`;
                }
            } else {
                card.innerHTML = `<div style="margin:6px 0;word-break:break-all;"><a href="${url || '#'}" target="_blank" rel="noopener">📎 ${escapeHtml(name)}</a></div>`;
            }

            grid.appendChild(card);
        }

        content.appendChild(section);
    } catch (e) { 
        console.warn('renderAttachmentsInDetail error', e); 
    }
}


/* [fix][attachments] START (anchor:contacts.js:getAttachments) */
function getAttachments(containerId){
  try{
    const el = document.getElementById(containerId);
    if(!el) return [];
    const items = el.querySelectorAll('.file-item, [data-file-name], [data-file-path]');
    return Array.from(items).map(function(n){
      return {
        name: n.dataset.fileName || n.getAttribute('data-file-name') || (n.textContent||'file').trim(),
        data: n.dataset.fileData || n.getAttribute('data-file-data') || '',
        type: n.dataset.fileType || n.getAttribute('data-file-type') || '',
        path: n.dataset.filePath || n.getAttribute('data-file-path') || ''
      };
    }).filter(function(f){ return (f.name && (f.data || f.path)); });
  }catch(e){
    console.warn('[fix][attachments] getAttachments error', e);
    return [];
  }
}
/* [fix][attachments] END (anchor:contacts.js:getAttachments) */

/* [fix][attachments] START (anchor:contacts.js:displayAttachmentsSafe) */
async function displayAttachmentsSafe(atts, targetElementId){ /* implemented in v9 */ }
try{ window.displayAttachments = displayAttachmentsSafe; }catch(_){}
/* [fix][attachments] END (anchor:contacts.js:displayAttachmentsSafe) */
