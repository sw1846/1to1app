// ui.js - UI操作・表示機能（改修版）

// タブ切替
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    document.getElementById('contactsTabHeader').style.display = tab === 'contacts' ? 'block' : 'none';
    document.getElementById('contactsTab').style.display = tab === 'contacts' ? 'block' : 'none';
    document.getElementById('todosTab').style.display = tab === 'todos' ? 'block' : 'none';
    
    if (tab === 'todos') {
        renderTodos();
    }
}

// 表示切替
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderContacts();
}

// モーダル閉じる
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// 連絡先表示
function renderContacts() {
    const container = document.getElementById('contactsList');
    let filteredContacts = getFilteredContacts();

    filteredContacts = sortContacts(filteredContacts);

    container.innerHTML = '';
    container.className = '';

    switch (currentView) {
        case 'card':
            container.className = 'card-grid';
            filteredContacts.forEach(contact => {
                container.appendChild(createContactCard(contact));
            });
            break;
        case 'list':
            container.className = 'list-view';
            filteredContacts.forEach(contact => {
                container.appendChild(createContactListItem(contact));
            });
            break;
        case 'tree':
            container.className = 'tree-view';
            renderContactTree(container, filteredContacts);
            break;
        case 'kanban':
            container.className = 'kanban-view';
            renderKanbanView(container, filteredContacts);
            break;
    }
}

// フィルタリング
function getFilteredContacts() {
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;

    return contacts.filter(contact => {
        const matchesSearch = !searchQuery || 
            contact.name.toLowerCase().includes(searchQuery) ||
            (contact.company && contact.company.toLowerCase().includes(searchQuery)) ||
            (contact.businesses && contact.businesses.some(b => b.toLowerCase().includes(searchQuery))) ||
            (contact.business && contact.business.toLowerCase().includes(searchQuery)) ||
            (contact.history && contact.history.toLowerCase().includes(searchQuery)) ||
            (contact.priorInfo && contact.priorInfo.toLowerCase().includes(searchQuery));

        const matchesType = !typeFilter || (Array.isArray(contact.types) && contact.types.includes(typeFilter));
        
        const matchesAffiliation = !filterValues.affiliation || 
            (Array.isArray(contact.affiliations) && contact.affiliations.some(a => a.toLowerCase().includes(filterValues.affiliation.toLowerCase())));
        
        const matchesBusiness = !filterValues.business || 
            ((Array.isArray(contact.businesses) && contact.businesses.some(b => b.toLowerCase().includes(filterValues.business.toLowerCase()))) ||
            (typeof contact.business === 'string' && contact.business.toLowerCase().includes(filterValues.business.toLowerCase())));
        
        const matchesIndustryInterests = !filterValues.industryInterests || 
            (Array.isArray(contact.industryInterests) && contact.industryInterests.some(i => i.toLowerCase().includes(filterValues.industryInterests.toLowerCase())));
        
        const matchesResidence = !filterValues.residence || 
            (contact.residence && contact.residence.toLowerCase().includes(filterValues.residence.toLowerCase()));
        
        const matchesReferrer = !referrerFilter || contact.referrer === referrerFilter;

        return matchesSearch && matchesType && matchesAffiliation && matchesBusiness && matchesIndustryInterests && matchesResidence && matchesReferrer;
    });
}

function filterContacts() {
    renderContacts();
}

// 検索とフィルターをクリアする新機能
function clearSearchAndFilters() {
    // 検索入力をクリア
    document.getElementById('searchInput').value = '';
    
    // 種別フィルターをクリア
    document.getElementById('typeFilter').value = '';
    
    // 各フィルター値をクリア
    filterValues.affiliation = '';
    filterValues.business = '';
    filterValues.industryInterests = '';
    filterValues.residence = '';
    
    // フィルター入力フィールドをクリア
    const affiliationInput = document.getElementById('affiliationFilter');
    const businessInput = document.getElementById('businessFilter');
    const industryInput = document.getElementById('industryInterestsFilter');
    const residenceInput = document.getElementById('residenceFilter');
    
    if (affiliationInput) affiliationInput.value = '';
    if (businessInput) businessInput.value = '';
    if (industryInput) industryInput.value = '';
    if (residenceInput) residenceInput.value = '';
    
    // 紹介者フィルターもクリア
    clearReferrerFilter();
    
    // 再描画
    renderContacts();
    
    // 通知表示
    showNotification('検索とフィルターをクリアしました', 'success');
}

// ソート
function sortContacts(contactList) {
    return contactList.sort((a, b) => {
        switch (currentSort) {
            case 'meeting-desc':
                const dateA = getLatestMeetingDate(a.id);
                const dateB = getLatestMeetingDate(b.id);
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB - dateA;
            case 'meeting-asc':
                const dateAsc = getLatestMeetingDate(a.id);
                const dateBsc = getLatestMeetingDate(b.id);
                if (!dateAsc && !dateBsc) return 0;
                if (!dateAsc) return 1;
                if (!dateBsc) return -1;
                return dateAsc - dateBsc;
            case 'referrer-revenue-desc':
                return (b.referrerRevenue || 0) - (a.referrerRevenue || 0);
            case 'revenue-desc':
                return (b.revenue || 0) - (a.revenue || 0);
            case 'referral-count-desc':
                return (b.referralCount || 0) - (a.referralCount || 0);
            default:
                return 0;
        }
    });
}

// 種別に基づいて色付けバーのクラスを返す
function getTypeColorClass(contact) {
    if (!contact.types || !Array.isArray(contact.types) || contact.types.length === 0) {
        return '';
    }
    
    if (contact.types.includes('顧客候補')) {
        return ' type-customer-candidate';
    } else if (contact.types.includes('顧客')) {
        return ' type-customer';
    } else if (contact.types.includes('取次店・販売店')) {
        return ' type-distributor';
    }
    
    return '';
}

// カード作成
function createContactCard(contact) {
    const card = document.createElement('div');
    card.className = 'contact-card' + getTypeColorClass(contact);
    card.onclick = () => showContactDetail(contact.id);

    const contactMeetings = meetings.filter(m => m.contactId === contact.id);
    const todoCount = contactMeetings.reduce((sum, m) => sum + (m.todos?.filter(t => !t.completed).length || 0), 0);
    const latestMeetingDate = getLatestMeetingDate(contact.id);

    const businessesDisplay = contact.businesses && contact.businesses.length > 0 ? 
        contact.businesses.slice(0, 2).join(', ') + (contact.businesses.length > 2 ? '...' : '') : '';

    card.innerHTML = `
        ${contact.photo ? `<img src="${contact.photo}" class="contact-photo">` : '<div class="contact-photo"></div>'}
        <div class="contact-info">
            <h3>${escapeHtml(contact.name)}</h3>
            ${contact.furigana ? `<p>${escapeHtml(contact.furigana)}</p>` : ''}
            ${contact.company ? `<p>${escapeHtml(contact.company)}</p>` : ''}
            ${businessesDisplay ? `<p>📋 ${escapeHtml(businessesDisplay)}</p>` : ''}
            ${contact.emails && contact.emails[0] ? `<p>📧 ${escapeHtml(contact.emails[0])}</p>` : ''}
            ${contact.phones && contact.phones[0] ? `<p>📞 ${escapeHtml(contact.phones[0])}</p>` : ''}
            ${contact.revenue ? `<p>💰 売上: ¥${contact.revenue.toLocaleString()}</p>` : ''}
            ${contact.referrerRevenue ? `<p>👥 紹介売上: ¥${contact.referrerRevenue.toLocaleString()}</p>` : ''}
            ${contact.referralCount > 0 ? `<p>🔗 <span class="clickable-link" onclick="event.stopPropagation(); filterByReferrer('${escapeHtml(contact.name)}')">紹介数: ${contact.referralCount}人</span></p>` : ''}
            ${todoCount > 0 ? `<p>📋 未完了ToDo: ${todoCount}件</p>` : ''}
            ${latestMeetingDate ? `<p>📅 最終面談: ${formatDate(latestMeetingDate)}</p>` : ''}
        </div>
    `;

    return card;
}

// リストアイテム作成
function createContactListItem(contact) {
    const item = document.createElement('div');
    item.className = 'list-item' + getTypeColorClass(contact);
    item.onclick = () => showContactDetail(contact.id);

    const contactMeetings = meetings.filter(m => m.contactId === contact.id);
    const todoCount = contactMeetings.reduce((sum, m) => sum + (m.todos?.filter(t => !t.completed).length || 0), 0);
    const types = Array.isArray(contact.types) ? contact.types.join(', ') : '';

    item.innerHTML = `
        ${contact.photo ? `<img src="${contact.photo}" class="list-photo">` : '<div class="list-photo"></div>'}
        <div class="list-info">
            <h4>${escapeHtml(contact.name)}${contact.furigana ? ` (${escapeHtml(contact.furigana)})` : ''}</h4>
            <p>${contact.company || ''} ${types} ${contact.revenue ? `💰¥${contact.revenue.toLocaleString()}` : ''} ${todoCount > 0 ? `📋${todoCount}` : ''} ${contact.referralCount > 0 ? `<span class="clickable-link" onclick="event.stopPropagation(); filterByReferrer('${escapeHtml(contact.name)}')">🔗${contact.referralCount}</span>` : ''}</p>
        </div>
    `;

    return item;
}

// ツリービュー
function renderContactTree(container, contactList) {
    const rootContacts = contactList.filter(contact => {
        if (!contact.referrer || contact.contactMethod === 'direct') {
            return true;
        }
        
        const referrerInFilteredList = contactList.some(c => c.name === contact.referrer);
        const referrerExists = contacts.some(c => c.name === contact.referrer);
        
        return !referrerInFilteredList || !referrerExists;
    });
    
    rootContacts.forEach(contact => {
        const node = createTreeNode(contact, contactList);
        container.appendChild(node);
    });
}

function createTreeNode(contact, allContacts, level = 0) {
    const node = document.createElement('div');
    node.style.marginLeft = `${level * 20}px`;

    const item = document.createElement('div');
    item.className = 'tree-item' + getTypeColorClass(contact);
    item.onclick = () => showContactDetail(contact.id);

    const referrals = allContacts.filter(c => c.referrer === contact.name && c.contactMethod === 'referral');
    const hasChildren = referrals.length > 0;

    item.innerHTML = `
        <span class="tree-expand">${hasChildren ? '▼' : '　'}</span>
        ${contact.photo ? `<img src="${contact.photo}" class="list-photo" style="width: 30px; height: 30px;">` : '<div class="list-photo" style="width: 30px; height: 30px;"></div>'}
        <div class="list-info">
            <h4>${escapeHtml(contact.name)}</h4>
            <p style="font-size: 0.75rem;">
                ${contact.company || ''} 
                💰¥${(contact.revenue || 0).toLocaleString()} 
                👥¥${(contact.referrerRevenue || 0).toLocaleString()}
            </p>
        </div>
    `;

    node.appendChild(item);

    if (hasChildren) {
        const childContainer = document.createElement('div');
        childContainer.className = 'tree-node';
        referrals.forEach(referral => {
            childContainer.appendChild(createTreeNode(referral, allContacts, level + 1));
        });
        node.appendChild(childContainer);
    }

    return node;
}

// 紹介者フィルター
function filterByReferrer(referrerName) {
    referrerFilter = referrerName;
    document.getElementById('referrerFilterText').textContent = `「${referrerName}」が紹介した人のみ表示中`;
    document.getElementById('referrerFilterMessage').style.display = 'block';
    renderContacts();
}

function clearReferrerFilter() {
    referrerFilter = null;
    document.getElementById('referrerFilterMessage').style.display = 'none';
    renderContacts();
}

// フィルター更新
function updateFilters() {
    const typeSelect = document.getElementById('typeFilter');
    const currentTypeValue = typeSelect.value;
    typeSelect.innerHTML = '<option value="">種別: すべて</option>';
    options.types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });
    typeSelect.value = currentTypeValue;
}

// 連絡先詳細表示
function showContactDetail(contactId) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    currentContactId = contactId;
    const modal = document.getElementById('contactDetailModal');
    const title = document.getElementById('detailModalTitle');
    const content = document.getElementById('contactDetailContent');

    title.textContent = contact.name;

    const contactMeetings = meetings.filter(m => m.contactId === contactId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    let headerHtml = `
        <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
            ${contact.photo ? `<img src="${contact.photo}" style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="showImageModal('${contact.photo}', '顔写真')" title="クリックで拡大">` : ''}
            <div style="flex: 1;">
                <h3>${escapeHtml(contact.name)}${contact.furigana ? ` (${escapeHtml(contact.furigana)})` : ''}</h3>
                ${contact.company ? `<p><strong>会社:</strong> ${escapeHtml(contact.company)}</p>` : ''}
                ${contact.types && Array.isArray(contact.types) && contact.types.length > 0 ? `<p><strong>種別:</strong> ${contact.types.map(t => escapeHtml(t)).join(', ')}</p>` : ''}
                ${contact.affiliations && Array.isArray(contact.affiliations) && contact.affiliations.length > 0 ? `<p><strong>所属:</strong> ${contact.affiliations.map(a => escapeHtml(a)).join(', ')}</p>` : ''}
                ${contact.industryInterests && Array.isArray(contact.industryInterests) && contact.industryInterests.length > 0 ? `<p><strong>会いたい業種等:</strong> ${contact.industryInterests.map(i => escapeHtml(i)).join(', ')}</p>` : ''}
                ${contact.revenue ? `<p><strong>売上:</strong> ¥${contact.revenue.toLocaleString()}</p>` : ''}
                ${contact.referrerRevenue ? `<p><strong>紹介売上:</strong> ¥${contact.referrerRevenue.toLocaleString()}</p>` : ''}
            </div>
            ${contact.businessCard && contact.businessCard !== 'data:' ? `<img src="${contact.businessCard}" style="width: 200px; height: auto; border-radius: 0.5rem; cursor: pointer;" onclick="showImageModal('${contact.businessCard}', '名刺画像')" title="クリックで拡大">` : ''}
        </div>
    `;

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

    let detailsHtml = '';
    if (contact.business) {
        detailsHtml += `
            <div class="form-group">
                <h4>事業内容詳細</h4>
                <div class="collapsible-wrapper">
                    <div class="markdown-preview collapsible-content" id="businessContent">
                        ${renderMarkdown(contact.business)}
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
                        ${renderMarkdown(contact.strengths)}
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
                        ${renderMarkdown(contact.approach)}
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
                        ${renderMarkdown(contact.history)}
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
                        ${renderMarkdown(contact.priorInfo)}
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
                            📎 <a href="javascript:void(0)" onclick="openFile('${file.data}', '${file.name}', '${file.type || ''}')">${escapeHtml(file.name)}</a>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

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
                            <div class="meeting-date">${formatDate(meeting.date)}</div>
                            <div class="meeting-actions">
                                <button class="btn btn-sm" onclick="editMeeting('${meeting.id}')">編集</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteMeeting('${meeting.id}')">削除</button>
                            </div>
                        </div>
                        <div class="meeting-content">${renderMarkdown(meeting.content || '')}</div>
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
                                            ${todo.dueDate ? `<span class="todo-date">期限: ${formatDate(todo.dueDate)}</span>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${meeting.attachments && meeting.attachments.length > 0 ? `
                            <div class="file-list">
                                ${meeting.attachments.map(file => `
                                    <div class="file-item">
                                        📎 <a href="javascript:void(0)" onclick="openFile('${file.data}', '${file.name}', '${file.type || ''}')">${escapeHtml(file.name)}</a>
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

    setTimeout(() => {
        initializeCollapsibles();
    }, 100);

    modal.classList.add('active');
    modal.querySelector('.modal-content').scrollTop = 0;
}

// 画像拡大表示
function showImageModal(imageSrc, title) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    modalImage.src = imageSrc;
    modalImage.alt = title;
    modal.classList.add('active');
}

// 画像削除
function deleteImage(type) {
    if (type === 'photo') {
        document.getElementById('photoPreview').src = '';
        document.getElementById('photoPreview').removeAttribute('src');
        document.getElementById('photoPreviewContainer').style.display = 'none';
    } else if (type === 'businessCard') {
        document.getElementById('businessCardPreview').src = '';
        document.getElementById('businessCardPreview').removeAttribute('src');
        document.getElementById('businessCardPreviewContainer').style.display = 'none';
    }
}

// ファイルを開く
async function openFile(dataUrlOrPath, fileName, fileType) {
    let dataUrl = dataUrlOrPath;
    
    if (!dataUrl.startsWith('data:')) {
        dataUrl = await loadAttachmentFromFileSystem(dataUrl);
    }
    
    if (fileType === 'application/pdf') {
        const byteCharacters = atob(dataUrl.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        
        const newWindow = window.open(blobUrl, '_blank');
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        return;
    }
    
    const viewableTypes = [
        'image/', 'text/', 'video/', 'audio/', 'application/json'
    ];
    
    const isViewable = viewableTypes.some(type => fileType.startsWith(type));
    
    if (isViewable) {
        const newWindow = window.open();
        if (fileType.startsWith('text/') || fileType === 'application/json') {
            const base64 = dataUrl.split(',')[1];
            const text = atob(base64);
            newWindow.document.write('<pre>' + escapeHtml(text) + '</pre>');
        } else {
            newWindow.location = dataUrl;
        }
    } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
    }
}

// 折りたたみ機能初期化
function initializeCollapsibles() {
    const collapsibles = document.querySelectorAll('.collapsible-content');
    collapsibles.forEach(content => {
        const wrapper = content.parentElement;
        
        if (wrapper.querySelector('.expand-btn')) {
            return;
        }
        
        const lineHeight = parseFloat(getComputedStyle(content).lineHeight);
        const maxLines = 7;
        const maxHeight = lineHeight * maxLines;
        
        if (content.scrollHeight > maxHeight) {
            content.style.maxHeight = `${maxHeight}px`;
            
            const expandBtn = document.createElement('button');
            expandBtn.className = 'expand-btn';
            expandBtn.textContent = '展開';
            expandBtn.onclick = () => toggleCollapsible(content, expandBtn);
            
            wrapper.appendChild(expandBtn);
        }
    });
}

function toggleCollapsible(content, button) {
    const isExpanded = content.classList.contains('expanded');
    
    if (isExpanded) {
        content.classList.remove('expanded');
        content.style.maxHeight = '10.5rem';
        button.textContent = '展開';
    } else {
        content.classList.add('expanded');
        content.style.maxHeight = 'none';
        button.textContent = '折りたたむ';
    }
}

// 添付ファイル取得
function getAttachments(listId) {
    const fileList = document.getElementById(listId);
    const fileItems = fileList.querySelectorAll('.file-item');
    return Array.from(fileItems).map(item => ({
        name: item.dataset.fileName,
        data: item.dataset.fileData,
        type: item.dataset.fileType || '',
        path: item.dataset.filePath || item.dataset.fileData
    }));
}

// 添付ファイル表示
function displayAttachments(attachments, listId) {
    const fileList = document.getElementById(listId);
    fileList.innerHTML = '';
    attachments.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            📎 <span>${escapeHtml(file.name)}</span>
            <button class="btn btn-icon" onclick="this.parentElement.remove()">✕</button>
        `;
        fileItem.dataset.fileName = file.name;
        fileItem.dataset.fileData = file.data || '';
        fileItem.dataset.fileType = file.type || '';
        fileItem.dataset.filePath = file.path || file.data || '';
        fileList.appendChild(fileItem);
    });
}

// カンバンビュー
function renderKanbanView(container, contactList) {
    // ステータス管理ボタン
    const header = document.createElement('div');
    header.className = 'kanban-header';
    header.innerHTML = `
        <button class="btn btn-sm" onclick="openStatusManagementModal()">
            ⚙️ ステータス管理
        </button>
    `;
    container.appendChild(header);

    // カンバンボード
    const board = document.createElement('div');
    board.className = 'kanban-board';

    options.statuses.forEach(status => {
        const column = createKanbanColumn(status, contactList);
        board.appendChild(column);
    });

    container.appendChild(board);
}

function createKanbanColumn(status, contactList) {
    const column = document.createElement('div');
    column.className = 'kanban-column';
    column.dataset.status = status;

    // ドロップゾーン設定
    column.addEventListener('dragover', handleDragOver);
    column.addEventListener('drop', handleDrop);
    column.addEventListener('dragleave', handleDragLeave);

    // カラムヘッダー
    const statusContacts = contactList.filter(c => (c.status || '新規') === status);
    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    header.innerHTML = `
        <h3>${escapeHtml(status)}</h3>
        <span class="kanban-count">${statusContacts.length}</span>
    `;
    column.appendChild(header);

    // カード一覧
    const cards = document.createElement('div');
    cards.className = 'kanban-cards';
    
    statusContacts.forEach(contact => {
        const card = createKanbanCard(contact);
        cards.appendChild(card);
    });

    column.appendChild(cards);

    return column;
}

function createKanbanCard(contact) {
    const card = document.createElement('div');
    card.className = 'kanban-card' + getTypeColorClass(contact);
    card.draggable = true;
    card.dataset.contactId = contact.id;

    // ドラッグイベント
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    const contactMeetings = meetings.filter(m => m.contactId === contact.id);
    const todoCount = contactMeetings.reduce((sum, m) => sum + (m.todos?.filter(t => !t.completed).length || 0), 0);

    card.innerHTML = `
        <div class="kanban-card-content" onclick="showContactDetail('${contact.id}')">
            ${contact.photo ? `<img src="${contact.photo}" class="kanban-card-photo">` : ''}
            <div class="kanban-card-info">
                <h4>${escapeHtml(contact.name)}</h4>
                ${contact.company ? `<p class="kanban-card-company">${escapeHtml(contact.company)}</p>` : ''}
                ${contact.revenue ? `<p class="kanban-card-revenue">💰 ¥${contact.revenue.toLocaleString()}</p>` : ''}
                ${todoCount > 0 ? `<p class="kanban-card-todo">📋 ${todoCount}</p>` : ''}
            </div>
        </div>
    `;

    return card;
}

// ドラッグ&ドロップハンドラー
let draggedCard = null;
let sourceColumn = null;

function handleDragStart(e) {
    draggedCard = this;
    sourceColumn = this.closest('.kanban-column');
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.kanban-column').forEach(col => {
        col.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    this.classList.remove('drag-over');

    if (draggedCard && draggedCard !== this) {
        const targetColumn = this;
        const newStatus = targetColumn.dataset.status;
        const contactId = draggedCard.dataset.contactId;

        // ステータス更新
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
            contact.status = newStatus;
            await saveAllData();
            renderContacts();
            showNotification(`ステータスを「${newStatus}」に変更しました`, 'success');
        }
    }

    return false;
}

// ステータス管理モーダル（改修版）
let draggedStatusItem = null;

function openStatusManagementModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'statusManagementModal';

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>ステータス管理</h2>
                <button class="btn btn-icon" onclick="closeStatusManagementModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="status-list" id="statusList">
                    ${options.statuses.map((status, index) => `
                        <div class="status-item" data-index="${index}" draggable="true">
                            <span class="status-drag-handle">☰</span>
                            <input type="text" value="${escapeHtml(status)}" data-original="${escapeHtml(status)}" class="form-input">
                            <button class="btn btn-sm btn-danger" onclick="deleteStatus(${index})">削除</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-primary" onclick="addNewStatus()">➕ ステータス追加</button>
            </div>
            <div class="modal-footer">
                <button class="btn" onclick="closeStatusManagementModal()">キャンセル</button>
                <button class="btn btn-primary" onclick="saveStatuses()">保存</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    // ドラッグ&ドロップイベントを設定
    initializeStatusDragAndDrop();
}

function initializeStatusDragAndDrop() {
    const statusItems = document.querySelectorAll('.status-item');
    const statusList = document.getElementById('statusList');
    
    statusItems.forEach(item => {
        item.addEventListener('dragstart', handleStatusDragStart);
        item.addEventListener('dragover', handleStatusDragOver);
        item.addEventListener('drop', handleStatusDrop);
        item.addEventListener('dragend', handleStatusDragEnd);
    });
    
    statusList.addEventListener('dragover', handleStatusDragOver);
}

function handleStatusDragStart(e) {
    draggedStatusItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleStatusDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    
    const afterElement = getDragAfterElement(document.getElementById('statusList'), e.clientY);
    const dragging = document.querySelector('.status-item.dragging');
    
    if (dragging && afterElement == null) {
        document.getElementById('statusList').appendChild(dragging);
    } else if (dragging && afterElement) {
        document.getElementById('statusList').insertBefore(dragging, afterElement);
    }
    
    return false;
}

function handleStatusDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    return false;
}

function handleStatusDragEnd(e) {
    this.classList.remove('dragging');
    
    // インデックスを更新
    const items = document.querySelectorAll('.status-item');
    items.forEach((item, index) => {
        item.dataset.index = index;
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.status-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function closeStatusManagementModal() {
    const modal = document.getElementById('statusManagementModal');
    if (modal) {
        modal.remove();
    }
}

function addNewStatus() {
    const statusList = document.getElementById('statusList');
    const newIndex = statusList.children.length;
    const newItem = document.createElement('div');
    newItem.className = 'status-item';
    newItem.dataset.index = newIndex;
    newItem.draggable = true;
    newItem.innerHTML = `
        <span class="status-drag-handle">☰</span>
        <input type="text" value="" data-original="" class="form-input" placeholder="新しいステータス">
        <button class="btn btn-sm btn-danger" onclick="deleteStatus(${newIndex})">削除</button>
    `;
    
    // ドラッグイベントを追加
    newItem.addEventListener('dragstart', handleStatusDragStart);
    newItem.addEventListener('dragover', handleStatusDragOver);
    newItem.addEventListener('drop', handleStatusDrop);
    newItem.addEventListener('dragend', handleStatusDragEnd);
    
    statusList.appendChild(newItem);
}

function deleteStatus(index) {
    const statusList = document.getElementById('statusList');
    const items = Array.from(statusList.children);
    if (items.length > 1) {
        items[index].remove();
        // インデックスを更新
        document.querySelectorAll('.status-item').forEach((item, idx) => {
            item.dataset.index = idx;
        });
    } else {
        showNotification('最低1つのステータスが必要です', 'error');
    }
}

async function saveStatuses() {
    const statusList = document.getElementById('statusList');
    const statusInputs = Array.from(statusList.querySelectorAll('input'));
    const newStatuses = statusInputs.map(input => input.value.trim()).filter(status => status !== '');

    if (newStatuses.length === 0) {
        showNotification('最低1つのステータスが必要です', 'error');
        return;
    }

    // ステータス名が変更された場合、コンタクトのステータスも更新
    statusInputs.forEach(input => {
        const originalStatus = input.dataset.original;
        const newStatus = input.value.trim();
        
        if (originalStatus && newStatus && originalStatus !== newStatus) {
            // 該当するコンタクトのステータスを更新
            contacts.forEach(contact => {
                if ((contact.status || '新規') === originalStatus) {
                    contact.status = newStatus;
                }
            });
        }
    });

    // 削除されたステータスのコンタクトは最初のステータスに移動
    const deletedStatuses = options.statuses.filter(s => !newStatuses.includes(s));
    if (deletedStatuses.length > 0 && newStatuses.length > 0) {
        contacts.forEach(contact => {
            if (deletedStatuses.includes(contact.status || '新規')) {
                contact.status = newStatuses[0];
            }
        });
    }

    options.statuses = newStatuses;
    await saveAllData();
    closeStatusManagementModal();
    renderContacts();
    showNotification('ステータスを保存しました', 'success');
}