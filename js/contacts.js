// contacts.js - 連絡先管理機能

// 連絡先モーダルを開く
function openContactModal(contactId = null) {
    currentContactId = contactId;
    const modal = document.getElementById('contactModal');
    const title = document.getElementById('modalTitle');
    const initialMeetingSection = document.getElementById('initialMeetingSection');

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
        initialMeetingSection.style.display = 'none';
        loadContactData(contactId);
    } else {
        title.textContent = '連絡先追加';
        initialMeetingSection.style.display = 'block';
        resetContactForm();
    }

    const markdownFields = ['business', 'strengths', 'approach', 'history', 'priorInfo'];
    markdownFields.forEach(field => {
        switchMarkdownView(field, 'edit');
    });

    modal.classList.add('active');
    modal.querySelector('.modal-content').scrollTop = 0;
}

// 連絡先データ読み込み
function loadContactData(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    document.getElementById('nameInput').value = contact.name || '';
    document.getElementById('furiganaInput').value = contact.furigana || '';
    document.getElementById('companyInput').value = contact.company || '';
    document.getElementById('websiteInput').value = contact.website || '';
    
    if (contact.contactMethod === 'referral') {
        document.getElementById('contactMethodReferral').checked = true;
        document.getElementById('referrerInput').value = contact.referrer || '';
    } else {
        document.getElementById('contactMethodDirect').checked = true;
        document.getElementById('directContactInput').value = contact.directContact || '所属が同じ';
    }
    handleContactMethodChange();
    
    document.getElementById('businessInput').value = contact.business || '';
    document.getElementById('strengthsInput').value = contact.strengths || '';
    document.getElementById('approachInput').value = contact.approach || '';
    document.getElementById('historyInput').value = contact.history || '';
    document.getElementById('priorInfoInput').value = contact.priorInfo || '';
    document.getElementById('activityAreaInput').value = contact.activityArea || '';
    document.getElementById('residenceInput').value = contact.residence || '';
    document.getElementById('hobbiesInput').value = contact.hobbies || '';
    document.getElementById('revenueInput').value = contact.revenue || '';

    if (contact.photo) {
        document.getElementById('photoPreview').src = contact.photo;
        document.getElementById('photoPreviewContainer').style.display = 'block';
    } else {
        document.getElementById('photoPreview').src = '';
        document.getElementById('photoPreview').removeAttribute('src');
        document.getElementById('photoPreviewContainer').style.display = 'none';
    }
    
    if (contact.businessCard) {
        document.getElementById('businessCardPreview').src = contact.businessCard;
        document.getElementById('businessCardPreviewContainer').style.display = 'block';
    } else {
        document.getElementById('businessCardPreview').src = '';
        document.getElementById('businessCardPreview').removeAttribute('src');
        document.getElementById('businessCardPreviewContainer').style.display = 'none';
    }

    selectedOptions.type = Array.isArray(contact.types) ? [...contact.types] : [];
    selectedOptions.affiliation = Array.isArray(contact.affiliations) ? [...contact.affiliations] : [];
    selectedOptions.industryInterests = Array.isArray(contact.industryInterests) ? [...contact.industryInterests] : [];
    
    updateMultiSelectTags('type');
    updateMultiSelectTags('affiliation');
    updateMultiSelectTags('industryInterests');

    const emailContainer = document.getElementById('emailContainer');
    emailContainer.innerHTML = '';
    if (contact.emails && contact.emails.length > 0) {
        contact.emails.forEach((email) => {
            addEmailInput(email);
        });
    } else {
        addEmailInput('');
    }

    const phoneContainer = document.getElementById('phoneContainer');
    phoneContainer.innerHTML = '';
    if (contact.phones && contact.phones.length > 0) {
        contact.phones.forEach((phone) => {
            addPhoneInput(phone);
        });
    } else {
        addPhoneInput('');
    }

    const businessContainer = document.getElementById('businessContainer');
    businessContainer.innerHTML = '';
    if (contact.businesses && contact.businesses.length > 0) {
        contact.businesses.forEach((business) => {
            addBusinessInput(business);
        });
    } else {
        addBusinessInput('');
    }

    if (contact.attachments) {
        displayAttachments(contact.attachments, 'attachmentList');
    }
}

// フォームリセット
function resetContactForm() {
    document.getElementById('contactForm').reset();
    
    document.getElementById('contactMethodDirect').checked = true;
    document.getElementById('directContactInput').value = '所属が同じ';
    handleContactMethodChange();
    
    const photoPreview = document.getElementById('photoPreview');
    const businessCardPreview = document.getElementById('businessCardPreview');
    
    photoPreview.src = '';
    if (photoPreview.hasAttribute('src')) {
        photoPreview.removeAttribute('src');
    }
    document.getElementById('photoPreviewContainer').style.display = 'none';
    
    businessCardPreview.src = '';
    if (businessCardPreview.hasAttribute('src')) {
        businessCardPreview.removeAttribute('src');
    }
    document.getElementById('businessCardPreviewContainer').style.display = 'none';
    
    document.getElementById('emailContainer').innerHTML = '';
    addEmailInput('');
    document.getElementById('phoneContainer').innerHTML = '';
    addPhoneInput('');
    document.getElementById('businessContainer').innerHTML = '';
    addBusinessInput('');
    document.getElementById('attachmentList').innerHTML = '';
    document.getElementById('todoList').innerHTML = '<button type="button" class="btn btn-primary" onclick="addTodoItem()">➕ ToDo追加</button>';
    
    selectedOptions.type = [];
    selectedOptions.affiliation = [];
    selectedOptions.industryInterests = [];
    
    updateMultiSelectTags('type');
    updateMultiSelectTags('affiliation');
    updateMultiSelectTags('industryInterests');
}

// 連絡先保存
async function saveContact() {
    const name = document.getElementById('nameInput').value.trim();
    if (!name) {
        showNotification('名前は必須です', 'error');
        return;
    }

    showLoading(true);
    try {
        const attachments = getAttachments('attachmentList');
        for (let i = 0; i < attachments.length; i++) {
            if (attachments[i].data && !attachments[i].path.includes('attachments/')) {
                const filePath = await saveAttachmentToFileSystem(
                    attachments[i].name,
                    attachments[i].data,
                    name
                );
                attachments[i].path = filePath;
            }
        }

        const photoSrc = document.getElementById('photoPreview').src;
        const businessCardSrc = document.getElementById('businessCardPreview').src;
        
        const isDirect = document.getElementById('contactMethodDirect').checked;
        const contactMethod = isDirect ? 'direct' : 'referral';
        const directContact = isDirect ? document.getElementById('directContactInput').value : null;
        const referrer = !isDirect ? document.getElementById('referrerInput').value : null;
        
        const contact = {
            id: currentContactId || generateId(),
            name: name,
            furigana: document.getElementById('furiganaInput').value,
            company: document.getElementById('companyInput').value,
            emails: getMultiInputValues('emailContainer'),
            phones: getMultiInputValues('phoneContainer'),
            website: document.getElementById('websiteInput').value,
            businesses: getMultiInputValues('businessContainer'),
            contactMethod: contactMethod,
            directContact: directContact,
            referrer: referrer,
            business: document.getElementById('businessInput').value,
            strengths: document.getElementById('strengthsInput').value,
            approach: document.getElementById('approachInput').value,
            history: document.getElementById('historyInput').value,
            priorInfo: document.getElementById('priorInfoInput').value,
            activityArea: document.getElementById('activityAreaInput').value,
            residence: document.getElementById('residenceInput').value,
            hobbies: document.getElementById('hobbiesInput').value,
            revenue: parseFloat(document.getElementById('revenueInput').value) || 0,
            types: selectedOptions.type,
            affiliations: selectedOptions.affiliation,
            industryInterests: selectedOptions.industryInterests,
            status: currentContactId ? contacts.find(c => c.id === currentContactId).status || '新規' : '新規',
            photo: photoSrc && photoSrc !== '' && !photoSrc.endsWith('.html') ? photoSrc : null,
            businessCard: businessCardSrc && businessCardSrc !== '' && !businessCardSrc.endsWith('.html') ? businessCardSrc : null,
            attachments: attachments,
            createdAt: currentContactId ? contacts.find(c => c.id === currentContactId).createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        selectedOptions.type.forEach(type => updateOptionIfNew('types', type));
        selectedOptions.affiliation.forEach(aff => updateOptionIfNew('affiliations', aff));
        selectedOptions.industryInterests.forEach(ii => updateOptionIfNew('industryInterests', ii));

        if (currentContactId) {
            const index = contacts.findIndex(c => c.id === currentContactId);
            contacts[index] = contact;
        } else {
            contacts.push(contact);

            const meetingDate = document.getElementById('meetingDateInput').value;
            const meetingContent = document.getElementById('meetingContentInput').value;
            if (meetingDate || meetingContent) {
                const meeting = {
                    id: generateId(),
                    contactId: contact.id,
                    date: meetingDate,
                    content: meetingContent,
                    todos: getTodos('todoList'),
                    attachments: [],
                    createdAt: new Date().toISOString()
                };
                meetings.push(meeting);
            }
        }

        calculateReferrerRevenues();

        await saveAllData();
        closeModal('contactModal');
        renderContacts();
        renderTodos();
        updateFilters();
        updateMultiSelectOptions();
        updateTodoTabBadge();
        showNotification('連絡先を保存しました', 'success');
    } catch (err) {
        console.error('保存エラー:', err);
        showNotification('保存に失敗しました', 'error');
    } finally {
        showLoading(false);
    }
}

// 連絡先削除
async function deleteContact() {
    if (!confirm('この連絡先を削除してもよろしいですか?\n関連するミーティング記録も削除されます。')) {
        return;
    }

    contacts = contacts.filter(c => c.id !== currentContactId);
    meetings = meetings.filter(m => m.contactId !== currentContactId);
    
    cleanupUnusedOptions();
    
    await saveAllData();
    closeModal('contactDetailModal');
    renderContacts();
    renderTodos();
    updateFilters();
    updateMultiSelectOptions();
    updateTodoTabBadge();
    showNotification('連絡先を削除しました', 'success');
}

// 連絡先編集
function editContact() {
    closeModal('contactDetailModal');
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
    
    const referrals = contacts.filter(c => c.referrer === contacts.find(ct => ct.id === contactId)?.name);
    
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