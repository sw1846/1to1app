// === 画像srcが 'drive:{fileId}' の場合にトークン付APIでDataURLへ変換して差し込む共通処理 ===
async function hydrateDriveImage(imgEl){
    try{
        if(!imgEl) return;
        const ref = imgEl.getAttribute('src') || imgEl.dataset.src || '';
        if(ref && ref.startsWith('drive:')){
            imgEl.removeAttribute('src'); // いったん空に
            if(typeof loadImageFromGoogleDrive === 'function'){
                const dataUrl = await loadImageFromGoogleDrive(ref);
                if(dataUrl){ imgEl.src = dataUrl; }
            }
        }
    }catch(e){ console.warn('hydrateDriveImage error', e); }
}

// ui.js - UI操作・表示機能（完全版）

// タブ切替
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    const contactsTabHeader = document.getElementById('contactsTabHeader');
    const contactsTab = document.getElementById('contactsTab');
    const todosTab = document.getElementById('todosTab');
    
    if (contactsTabHeader) contactsTabHeader.style.display = tab === 'contacts' ? 'block' : 'none';
    if (contactsTab) contactsTab.style.display = tab === 'contacts' ? 'block' : 'none';
    if (todosTab) todosTab.style.display = tab === 'todos' ? 'block' : 'none';
    
    if (tab === 'todos' && typeof renderTodos === 'function') {
        renderTodos();
    }
}

// 表示切替
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    if (typeof renderContacts === 'function') {
        renderContacts();
    }
}

// モーダル閉じる
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// [MULTI-SELECT FIX] 複数選択ドロップダウンの実装
function toggleMultiSelectDropdown(type) {
    const dropdown = document.getElementById(type + 'Dropdown');
    if (!dropdown) return;
    
    // 他のドロップダウンを閉じる
    document.querySelectorAll('.multi-select-dropdown').forEach(dd => {
        if (dd.id !== type + 'Dropdown') {
            dd.classList.remove('show');
        }
    });
    
    dropdown.classList.toggle('show');
    
    if (dropdown.classList.contains('show')) {
        updateMultiSelectOptions(type);
    }
}

// [MULTI-SELECT FIX] 複数選択オプションの更新
function updateMultiSelectOptions(type) {
    if (!type) {
        // 全種類を更新
        updateMultiSelectOptions('type');
        updateMultiSelectOptions('affiliation');
        updateMultiSelectOptions('industryInterests');
        return;
    }
    
    const optionsContainer = document.getElementById(type + 'Options');
    if (!optionsContainer) return;
    
    let optionsList = [];
    if (window.options && window.options[type + 's']) {
        optionsList = window.options[type + 's'];
    } else if (window.options && window.options[type]) {
        optionsList = window.options[type];
    }
    
    // 既存データから選択肢を収集
    if (window.contacts && Array.isArray(window.contacts)) {
        const fieldName = type === 'type' ? 'types' : (type + 's');
        const collected = new Set();
        
        window.contacts.forEach(contact => {
            if (contact[fieldName] && Array.isArray(contact[fieldName])) {
                contact[fieldName].forEach(item => {
                    if (item && typeof item === 'string') {
                        collected.add(item.trim());
                    }
                });
            }
        });
        
        const collectedArray = Array.from(collected).sort();
        optionsList = [...new Set([...optionsList, ...collectedArray])].sort();
    }
    
    optionsContainer.innerHTML = '';
    
    if (optionsList.length === 0) {
        optionsContainer.innerHTML = '<div class="multi-select-no-results">選択肢がありません</div>';
        return;
    }
    
    optionsList.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'multi-select-option';
        
        const selected = window.selectedOptions && window.selectedOptions[type] && 
                         window.selectedOptions[type].includes(option);
        
        optionDiv.innerHTML = `
            <input type="checkbox" ${selected ? 'checked' : ''} 
                   onchange="toggleMultiSelectOption('${type}', '${escapeHtml(option)}', this.checked)">
            <span>${escapeHtml(option)}</span>
        `;
        
        optionsContainer.appendChild(optionDiv);
    });
}

// [MULTI-SELECT FIX] 複数選択オプションの切り替え
function toggleMultiSelectOption(type, option, checked) {
    if (!window.selectedOptions) {
        window.selectedOptions = {
            type: [],
            affiliation: [],
            industryInterests: []
        };
    }
    
    if (!window.selectedOptions[type]) {
        window.selectedOptions[type] = [];
    }
    
    if (checked) {
        if (!window.selectedOptions[type].includes(option)) {
            window.selectedOptions[type].push(option);
        }
    } else {
        window.selectedOptions[type] = window.selectedOptions[type].filter(item => item !== option);
    }
    
    updateMultiSelectTags(type);
}

// [MULTI-SELECT FIX] 複数選択タグの表示更新
function updateMultiSelectTags(type) {
    const tagsContainer = document.getElementById(type + 'Tags');
    if (!tagsContainer) return;
    
    const selected = window.selectedOptions && window.selectedOptions[type] ? window.selectedOptions[type] : [];
    
    if (selected.length === 0) {
        tagsContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.875rem;">選択してください...</span>';
        return;
    }
    
    tagsContainer.innerHTML = selected.map(option => `
        <span class="multi-select-tag">
            ${escapeHtml(option)}
            <button type="button" onclick="removeMultiSelectTag('${type}', '${escapeHtml(option)}')">&times;</button>
        </span>
    `).join('');
}

// [MULTI-SELECT FIX] 複数選択タグの削除
function removeMultiSelectTag(type, option) {
    if (window.selectedOptions && window.selectedOptions[type]) {
        window.selectedOptions[type] = window.selectedOptions[type].filter(item => item !== option);
        updateMultiSelectTags(type);
        updateMultiSelectOptions(type);
    }
}

// [MULTI-SELECT FIX] 複数選択オプションのフィルタリング
function filterMultiSelectOptions(type, query) {
    const optionsContainer = document.getElementById(type + 'Options');
    if (!optionsContainer) return;
    
    const options = optionsContainer.querySelectorAll('.multi-select-option');
    const lowerQuery = query.toLowerCase();
    
    options.forEach(option => {
        const text = option.textContent.toLowerCase();
        if (text.includes(lowerQuery)) {
            option.classList.remove('hidden');
        } else {
            option.classList.add('hidden');
        }
    });
}

// [MULTI-SELECT FIX] 複数選択の初期化
function setupMultiSelect() {
    // グローバル関数として設定
    window.toggleMultiSelectDropdown = toggleMultiSelectDropdown;
    window.updateMultiSelectOptions = updateMultiSelectOptions;
    window.toggleMultiSelectOption = toggleMultiSelectOption;
    window.updateMultiSelectTags = updateMultiSelectTags;
    window.removeMultiSelectTag = removeMultiSelectTag;
    window.filterMultiSelectOptions = filterMultiSelectOptions;
    
    // 選択状態の初期化
    if (!window.selectedOptions) {
        window.selectedOptions = {
            type: [],
            affiliation: [],
            industryInterests: []
        };
    }
    
    // ドロップダウン外クリックで閉じる
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.multi-select-container')) {
            document.querySelectorAll('.multi-select-dropdown').forEach(dd => {
                dd.classList.remove('show');
            });
        }
    });
}

// [FILTER FIX] 完全なフィルタリング機能
function getFilteredContacts() {
    console.log('[ui] getFilteredContacts called, total contacts:', (window.contacts || []).length);
    
    let filtered = (window.contacts || []).slice();
    
    try {
        // 1. テキスト検索
        const searchInput = document.getElementById('searchInput');
        const searchQuery = (searchInput && searchInput.value || '').trim().toLowerCase();
        if (searchQuery) {
            filtered = filtered.filter(contact => {
                const searchFields = [
                    contact.name,
                    contact.furigana,
                    contact.company,
                    contact.business,
                    ...(contact.businesses || []),
                    ...(contact.types || []),
                    ...(contact.affiliations || []),
                    ...(contact.industryInterests || [])
                ].filter(Boolean);
                
                return searchFields.some(field => 
                    String(field).toLowerCase().includes(searchQuery)
                );
            });
        }
        
        // 2. 種別フィルター
        const typeFilter = document.getElementById('typeFilter');
        const selectedType = typeFilter && typeFilter.value;
        if (selectedType) {
            filtered = filtered.filter(contact => 
                contact.types && contact.types.includes(selectedType)
            );
        }
        
        // 3. 所属フィルター
        const affiliationQuery = (window.filterValues && window.filterValues.affiliation) || '';
        if (affiliationQuery) {
            filtered = filtered.filter(contact => {
                if (!contact.affiliations) return false;
                return contact.affiliations.some(aff => 
                    String(aff).toLowerCase().includes(affiliationQuery)
                );
            });
        }
        
        // 4. 事業内容フィルター
        const businessQuery = (window.filterValues && window.filterValues.business) || '';
        if (businessQuery) {
            filtered = filtered.filter(contact => {
                const businessFields = [
                    contact.business,
                    ...(contact.businesses || [])
                ].filter(Boolean);
                
                return businessFields.some(field => 
                    String(field).toLowerCase().includes(businessQuery)
                );
            });
        }
        
        // 5. 業種関心フィルター
        const industryQuery = (window.filterValues && window.filterValues.industryInterests) || '';
        if (industryQuery) {
            filtered = filtered.filter(contact => {
                if (!contact.industryInterests) return false;
                return contact.industryInterests.some(industry => 
                    String(industry).toLowerCase().includes(industryQuery)
                );
            });
        }
        
        // 6. 居住地フィルター
        const residenceQuery = (window.filterValues && window.filterValues.residence) || '';
        if (residenceQuery) {
            filtered = filtered.filter(contact => 
                contact.residence && String(contact.residence).toLowerCase().includes(residenceQuery)
            );
        }
        
        // 7. 紹介者フィルター
        if (window.referrerFilter) {
            filtered = filtered.filter(contact => 
                contact.referrer === window.referrerFilter
            );
        }
        
    } catch (e) {
        console.warn('[ui] getFilteredContacts error', e);
    }
    
    console.log('[ui] getFilteredContacts result:', filtered.length);
    return filtered;
}

// 連絡先表示
function renderContacts(){
    var list = getFilteredContacts();
    console.log('[ui] renderContacts count:', list && list.length);

    const container = document.getElementById('contactsList');
    if (!container) return;
    
    let filteredContacts = list;
    // 空配列なら空状態を描画して終了
    if (!filteredContacts || !filteredContacts.length) {
        container.className = '';
        container.innerHTML = '<div class="empty">連絡先がありません。Driveの保存先に <code>index/contacts-index.json</code> が存在するか確認してください。</div>';
        return;
    }
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

function filterContacts() {
    renderContacts();
}

// 検索とフィルターをクリアする新機能
function clearSearchAndFilters() {
    // 検索入力をクリア
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    // 種別フィルターをクリア
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) typeFilter.value = '';
    
    // 各フィルター値をクリア
    if (window.filterValues) {
        window.filterValues.affiliation = '';
        window.filterValues.business = '';
        window.filterValues.industryInterests = '';
        window.filterValues.residence = '';
    }
    
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
    if (typeof showNotification === 'function') {
        showNotification('検索とフィルターをクリアしました', 'success');
    }
}

// ソート
function sortContacts(contactList) {
    return contactList.sort((a, b) => {
        switch (currentSort) {
            case 'meeting-desc':
                const dateA = typeof getLatestMeetingDate === 'function' ? getLatestMeetingDate(a.id) : null;
                const dateB = typeof getLatestMeetingDate === 'function' ? getLatestMeetingDate(b.id) : null;
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB - dateA;
            case 'meeting-asc':
                const dateAsc = typeof getLatestMeetingDate === 'function' ? getLatestMeetingDate(a.id) : null;
                const dateBsc = typeof getLatestMeetingDate === 'function' ? getLatestMeetingDate(b.id) : null;
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

// [IMAGE FIX] URL サニタイズ関数
function sanitizeImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    // HTMLエンコードされた文字列を検出して除外
    if (url.includes('%3C') || url.includes('<') || url.includes('javascript:')) {
        console.warn('[image] suspicious URL detected and rejected:', url);
        return null;
    }
    
    // Markdownリンク形式 [title](url) をパース
    const markdownMatch = url.match(/\[.*?\]\((.*?)\)/);
    if (markdownMatch) {
        return sanitizeImageUrl(markdownMatch[1]);
    }
    
    // 有効なURLかチェック
    try {
        if (url.startsWith('data:') || url.startsWith('drive:') || url.startsWith('http')) {
            return url;
        }
    } catch (e) {
        console.warn('[image] URL validation failed:', e);
    }
    
    return null;
}

// [IMAGE FIX] 画像URL解決
function resolveImageUrl(contact, type = 'photo') {
    const fieldName = type === 'photo' ? 'photo' : 'businessCard';
    const url = contact[fieldName];
    
    if (!url) return null;
    
    const sanitized = sanitizeImageUrl(url);
    if (!sanitized) return null;
    
    return sanitized;
}

// [IMAGE FIX] 安全な画像読み込み
async function loadImageSafely(imgElement, url) {
    if (!imgElement || !url) return;
    
    try {
        if (url.startsWith('drive:')) {
            const dataUrl = await loadImageFromGoogleDrive(url);
            if (dataUrl) {
                imgElement.src = dataUrl;
            } else {
                imgElement.src = generatePlaceholderImage();
            }
        } else {
            imgElement.src = url;
        }
    } catch (error) {
        console.warn('[image] Failed to load image:', error);
        imgElement.src = generatePlaceholderImage();
    }
}

// [IMAGE FIX] プレースホルダー画像生成
function generatePlaceholderImage() {
    return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZGRkZGRkIi8+PHRleHQgeD0iMzIiIHk9IjM2IiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij7jgZPjgpPjga7jgZk8L3RleHQ+PC9zdmc+";
}

// カード作成
function createContactCard(contact) {
    const card = document.createElement('div');
    card.className = 'contact-card' + getTypeColorClass(contact);
    card.onclick = () => {
        if (typeof showContactDetail === 'function') {
            showContactDetail(contact.id);
        }
    };

    const contactMeetings = window.meetings ? window.meetings.filter(m => m.contactId === contact.id) : [];
    const todoCount = contactMeetings.reduce((sum, m) => sum + (m.todos?.filter(t => !t.completed).length || 0), 0);
    const latestMeetingDate = typeof getLatestMeetingDate === 'function' ? getLatestMeetingDate(contact.id) : null;

    const businessesDisplay = contact.businesses && contact.businesses.length > 0 ? 
        contact.businesses.slice(0, 2).join(', ') + (contact.businesses.length > 2 ? '...' : '') : '';

    // [IMAGE FIX] 画像URL解決とサニタイズ
    const photoUrl = resolveImageUrl(contact, 'photo');
    const photoHtml = photoUrl 
        ? `<img class="contact-photo" src="${generatePlaceholderImage()}" data-src="${photoUrl}" data-contact-id="${contact.id}">`
        : '<div class="contact-photo"></div>';

    card.innerHTML = `
        ${photoHtml}
        <div class="contact-info">
            <h3>${escapeHtml(contact.name)}</h3>
            ${contact.furigana ? `<p>${escapeHtml(contact.furigana)}</p>` : ''}
            ${contact.company ? `<p>${escapeHtml(contact.company)}</p>` : ''}
            ${businessesDisplay ? `<p>📋 ${escapeHtml(businessesDisplay)}</p>` : ''}
            ${contact.emails && contact.emails[0] ? `<p>📧 ${escapeHtml(contact.emails[0])}</p>` : ''}
            ${contact.phones && contact.phones[0] ? `<p>📞 ${escapeHtml(contact.phones[0])}</p>` : ''}
            ${contact.revenue ? `<p>💰 売上: ¥${contact.revenue.toLocaleString()}</p>` : ''}
            ${contact.referrerRevenue ? `<p>🤝 紹介売上: ¥${contact.referrerRevenue.toLocaleString()}</p>` : ''}
            ${contact.referralCount > 0 ? `<p>🔗 <span class="clickable-link" onclick="event.stopPropagation(); filterByReferrer('${escapeHtml(contact.name)}')">紹介数: ${contact.referralCount}人</span></p>` : ''}
            ${todoCount > 0 ? `<p>📋 未完了ToDo: ${todoCount}件</p>` : ''}
            ${latestMeetingDate ? `<p>📅 最終面談: ${formatDate(latestMeetingDate)}</p>` : ''}
        </div>
    `;

    // [IMAGE FIX] 画像の非同期読み込み
    setTimeout(() => {
        const img = card.querySelector('img.contact-photo[data-src]');
        if (img && img.dataset.src) {
            loadImageSafely(img, img.dataset.src);
        }
    }, 0);
    
    return card;
}

// リストアイテム作成
function createContactListItem(contact) {
    const item = document.createElement('div');
    item.className = 'list-item' + getTypeColorClass(contact);
    item.onclick = () => {
        if (typeof showContactDetail === 'function') {
            showContactDetail(contact.id);
        }
    };

    const contactMeetings = window.meetings ? window.meetings.filter(m => m.contactId === contact.id) : [];
    const todoCount = contactMeetings.reduce((sum, m) => sum + (m.todos?.filter(t => !t.completed).length || 0), 0);
    const types = Array.isArray(contact.types) ? contact.types.join(', ') : '';

    // [IMAGE FIX] 画像URL解決とサニタイズ
    const photoUrl = resolveImageUrl(contact, 'photo');
    const photoHtml = photoUrl 
        ? `<img class="list-photo" src="${generatePlaceholderImage()}" data-src="${photoUrl}" data-contact-id="${contact.id}">`
        : '<div class="list-photo"></div>';

    item.innerHTML = `
        ${photoHtml}
        <div class="list-info">
            <h4>${escapeHtml(contact.name)}${contact.furigana ? ` (${escapeHtml(contact.furigana)})` : ''}</h4>
            <p>${contact.company || ''} ${types} ${contact.revenue ? `💰¥${contact.revenue.toLocaleString()}` : ''} ${todoCount > 0 ? `📋${todoCount}` : ''} ${contact.referralCount > 0 ? `<span class="clickable-link" onclick="event.stopPropagation(); filterByReferrer('${escapeHtml(contact.name)}')">🔗${contact.referralCount}</span>` : ''}</p>
        </div>
    `;

    // [IMAGE FIX] 画像の非同期読み込み
    setTimeout(() => {
        const img = item.querySelector('img.list-photo[data-src]');
        if (img && img.dataset.src) {
            loadImageSafely(img, img.dataset.src);
        }
    }, 0);
    
    return item;
}

// ツリービュー
function renderContactTree(container, contactList) {
    const rootContacts = contactList.filter(contact => {
        if (!contact.referrer || contact.contactMethod === 'direct') {
            return true;
        }
        
        const referrerInFilteredList = contactList.some(c => c.name === contact.referrer);
        const referrerExists = (window.contacts||[]).some(c => c.name === contact.referrer);
        
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
    item.onclick = () => {
        if (typeof showContactDetail === 'function') {
            showContactDetail(contact.id);
        }
    };

    const referrals = allContacts.filter(c => c.referrer === contact.name && c.contactMethod === 'referral');
    const hasChildren = referrals.length > 0;

    // [IMAGE FIX] 画像URL解決とサニタイズ
    const photoUrl = resolveImageUrl(contact, 'photo');
    const photoHtml = photoUrl 
        ? `<img class="list-photo" src="${generatePlaceholderImage()}" style="width: 30px; height: 30px;" data-src="${photoUrl}" data-contact-id="${contact.id}">`
        : '<div class="list-photo" style="width: 30px; height: 30px;"></div>';

    item.innerHTML = `
        <span class="tree-expand">${hasChildren ? '▼' : '　'}</span>
        ${photoHtml}
        <div class="list-info">
            <h4>${escapeHtml(contact.name)}</h4>
            <p style="font-size: 0.75rem;">
                ${contact.company || ''} 
                💰¥${(contact.revenue || 0).toLocaleString()} 
                🤝¥${(contact.referrerRevenue || 0).toLocaleString()}
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

    // [IMAGE FIX] 画像の非同期読み込み
    setTimeout(() => {
        const img = item.querySelector('img.list-photo[data-src]');
        if (img && img.dataset.src) {
            loadImageSafely(img, img.dataset.src);
        }
    }, 0);

    return node;
}

// 紹介者フィルター
function filterByReferrer(referrerName) {
    window.referrerFilter = referrerName;
    const referrerFilterText = document.getElementById('referrerFilterText');
    const referrerFilterMessage = document.getElementById('referrerFilterMessage');
    
    if (referrerFilterText) {
        referrerFilterText.textContent = `「${referrerName}」が紹介した人のみ表示中`;
    }
    if (referrerFilterMessage) {
        referrerFilterMessage.style.display = 'block';
    }
    renderContacts();
}

function clearReferrerFilter() {
    window.referrerFilter = null;
    const referrerFilterMessage = document.getElementById('referrerFilterMessage');
    if (referrerFilterMessage) {
        referrerFilterMessage.style.display = 'none';
    }
    renderContacts();
}

// [OPTIONS FIX] フィルター更新機能を強化
function updateFilters() {
    console.log('[ui] updateFilters called');
    
    // options が未定義でも落ちないようにガード
    const safeOptions = (window.options && typeof window.options === 'object') ? window.options : {};
    const types = Array.isArray(safeOptions.types) ? safeOptions.types : [];
    
    const typeSelect = document.getElementById('typeFilter');
    if (!typeSelect) return;
    
    const currentTypeValue = typeSelect.value;
    typeSelect.innerHTML = '<option value="">種別: すべて</option>';
    
    // ソート済みのオプションを追加
    const sortedTypes = [...types].sort();
    sortedTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });
    
    // 元の選択値を復元
    typeSelect.value = currentTypeValue;
    
    console.log('[ui] updateFilters completed, types:', sortedTypes.length);
}

// 画像拡大表示
function showImageModal(imageSrc, title) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    if (modal && modalImage) {
        modalImage.src = imageSrc;
        modalImage.alt = title;
        modal.classList.add('active');
    }
}

// 画像削除
function deleteImage(type) {
    if (type === 'photo') {
        const preview = document.getElementById('photoPreview');
        const container = document.getElementById('photoPreviewContainer');
        if (preview) {
            preview.src = '';
            preview.removeAttribute('src');
        }
        if (container) {
            container.style.display = 'none';
        }
    } else if (type === 'businessCard') {
        const preview = document.getElementById('businessCardPreview');
        const container = document.getElementById('businessCardPreviewContainer');
        if (preview) {
            preview.src = '';
            preview.removeAttribute('src');
        }
        if (container) {
            container.style.display = 'none';
        }
    }
}

// ファイルを開く
async function openFile(dataUrlOrPath, fileName, fileType) {
    // --- Drive file handling (added) ---
    try{
        if (typeof dataUrlOrPath === 'string' && dataUrlOrPath.startsWith('drive:')) {
            const fileId = dataUrlOrPath.split(':')[1];
            const token = (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken) ? (gapi.client.getToken() && gapi.client.getToken().access_token) : null;
            if (!token) { alert('Google Driveの認証が必要です'); return; }
            const resp = await fetch('https://www.googleapis.com/drive/v3/files/'+fileId+'?alt=media', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!resp.ok) { throw new Error('Drive fetch error '+resp.status); }
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            // PDFは新規タブで表示、それ以外はダウンロード（または新規タブで開く）
            if (fileType === 'application/pdf') {
                window.open(blobUrl, '_blank');
            } else {
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = fileName || 'download';
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
            return;
        }
    }catch(e){ console.warn('openFile drive handling error', e); }
    
    // Fallback: non-data plain path -> fetch as blob
    if (typeof dataUrlOrPath === 'string' && !dataUrlOrPath.startsWith('data:')) {
        try {
            const resp = await fetch(dataUrlOrPath);
            if (resp && resp.ok) {
                const blob = await resp.blob();
                const blobUrl = URL.createObjectURL(blob);
                if (fileType === 'application/pdf') { 
                    window.open(blobUrl, '_blank'); 
                } else {
                    const link = document.createElement('a'); 
                    link.href = blobUrl; 
                    link.download = fileName || 'download'; 
                    document.body.appendChild(link); 
                    link.click(); 
                    link.remove();
                }
                return;
            }
        } catch(e){ console.warn('openFile path fetch error', e); }
    }

    let dataUrl = dataUrlOrPath;
    
    if (!dataUrl.startsWith('data:') && typeof loadAttachmentFromFileSystem === 'function') {
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
    if (!fileList) return [];
    
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
    if (!fileList) return;
    
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

    (Array.isArray(window.options && window.options.statuses) ? window.options.statuses : ['新規','商談中','成約','保留','終了']).forEach(status => { /* guard statuses */
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

    const contactMeetings = window.meetings ? window.meetings.filter(m => m.contactId === contact.id) : [];
    const todoCount = contactMeetings.reduce((sum, m) => sum + (m.todos?.filter(t => !t.completed).length || 0), 0);

    // [IMAGE FIX] 画像URL解決とサニタイズ
    const photoUrl = resolveImageUrl(contact, 'photo');
    const photoHtml = photoUrl ? `<img class="kanban-card-photo" src="${generatePlaceholderImage()}" data-src="${photoUrl}" data-contact-id="${contact.id}">` : '';

    card.innerHTML = `
        <div class="kanban-card-content" onclick="showContactDetail('${contact.id}')">
            ${photoHtml}
            <div class="kanban-card-info">
                <h4>${escapeHtml(contact.name)}</h4>
                ${contact.company ? `<p class="kanban-card-company">${escapeHtml(contact.company)}</p>` : ''}
                ${contact.revenue ? `<p class="kanban-card-revenue">💰 ¥${contact.revenue.toLocaleString()}</p>` : ''}
                ${todoCount > 0 ? `<p class="kanban-card-todo">📋 ${todoCount}</p>` : ''}
            </div>
        </div>
    `;

    // [IMAGE FIX] 画像の非同期読み込み
    setTimeout(() => {
        const img = card.querySelector('img.kanban-card-photo[data-src]');
        if (img && img.dataset.src) {
            loadImageSafely(img, img.dataset.src);
        }
    }, 0);
    
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
        const contact = (window.contacts||[]).find(c => c.id === contactId);
        if (contact) {
            contact.status = newStatus;
            if (typeof saveAllData === 'function') {
                await saveAllData();
            }
            renderContacts();
            if (typeof showNotification === 'function') {
                showNotification(`ステータスを「${newStatus}」に変更しました`, 'success');
            }
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
                    ${(window.options.statuses || []).map((status, index) => `
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
    
    if (statusList) {
        statusList.addEventListener('dragover', handleStatusDragOver);
    }
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
    if (!statusList) return;
    
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
    if (!statusList) return;
    
    const items = Array.from(statusList.children);
    if (items.length > 1) {
        items[index].remove();
        // インデックスを更新
        document.querySelectorAll('.status-item').forEach((item, idx) => {
            item.dataset.index = idx;
        });
    } else {
        if (typeof showNotification === 'function') {
            showNotification('最低1つのステータスが必要です', 'error');
        }
    }
}

async function saveStatuses() {
    const statusList = document.getElementById('statusList');
    if (!statusList) return;
    
    const statusInputs = Array.from(statusList.querySelectorAll('input'));
    const newStatuses = statusInputs.map(input => input.value.trim()).filter(status => status !== '');

    if (newStatuses.length === 0) {
        if (typeof showNotification === 'function') {
            showNotification('最低1つのステータスが必要です', 'error');
        }
        return;
    }

    // ステータス名が変更された場合、コンタクトのステータスも更新
    statusInputs.forEach(input => {
        const originalStatus = input.dataset.original;
        const newStatus = input.value.trim();
        
        if (originalStatus && newStatus && originalStatus !== newStatus) {
            // 該当するコンタクトのステータスを更新
            (window.contacts||[]).forEach(contact => {
                if ((contact.status || '新規') === originalStatus) {
                    contact.status = newStatus;
                }
            });
        }
    });

    // 削除されたステータスのコンタクトは最初のステータスに移動
    const deletedStatuses = (window.options.statuses || []).filter(s => !newStatuses.includes(s));
    if (deletedStatuses.length > 0 && newStatuses.length > 0) {
        (window.contacts||[]).forEach(contact => {
            if (deletedStatuses.includes(contact.status || '新規')) {
                contact.status = newStatuses[0];
            }
        });
    }

    window.options.statuses = newStatuses;
    if (typeof saveAllData === 'function') {
        await saveAllData();
    }
    closeStatusManagementModal();
    renderContacts();
    if (typeof showNotification === 'function') {
        showNotification('ステータスを保存しました', 'success');
    }
}

// [CLAUDE FIX ALL-IN-ONE][avatar] IntersectionObserver による遅延読込＆解決
(function(){
  var io = null;
  function ensureIO(){
    if(io) return io;
    io = new IntersectionObserver(async function(entries){
      for(var i=0;i<entries.length;i++){
        var ent = entries[i];
        if(ent.isIntersecting){
          var img = ent.target;
          io.unobserve(img);
          try{
            var ref = img.getAttribute('data-src') || '';
            if(ref){
              console.log('[fix][avatar] resolving contact image, url=', ref);
              var url = await loadImageFromGoogleDrive(ref);
              if(url){ img.src = url; console.log('[fix][avatar] resolved url='+url); }
              else { console.warn('[warn][avatar] resolve failed for '+ref); img.src = generatePlaceholderImage(); }
            }
          }catch(e){ console.warn('[warn][avatar] error', e); img.src = generatePlaceholderImage(); }
        }
      }
    }, { rootMargin: '200px' });
    return io;
  }
  var _origRender = window.renderContacts;
  window.renderContacts = function(){
    if(typeof _origRender === 'function') _origRender.apply(this, arguments);
    try{
      var els = document.querySelectorAll('img[data-src]');
      var obs = ensureIO();
      els.forEach(function(el){ obs.observe(el); });
    }catch(e){}
  };
})();

// Markdown表示切替機能
function switchMarkdownView(fieldName, mode) {
    const editorContainer = document.querySelector(`#${fieldName}Input`).closest('.markdown-editor-container');
    if (!editorContainer) return;
    
    const tabs = editorContainer.querySelectorAll('.markdown-editor-tab');
    const textarea = editorContainer.querySelector(`#${fieldName}Input`);
    const preview = editorContainer.querySelector(`#${fieldName}Preview`);
    
    tabs.forEach(tab => {
        tab.classList.toggle('active', 
            (mode === 'edit' && tab.textContent.includes('編集')) ||
            (mode === 'preview' && tab.textContent.includes('プレビュー'))
        );
    });
    
    if (mode === 'edit') {
        textarea.style.display = 'block';
        if (preview) preview.style.display = 'none';
    } else {
        textarea.style.display = 'none';
        if (preview) {
            preview.style.display = 'block';
            if (typeof renderMarkdown === 'function') {
                preview.innerHTML = renderMarkdown(textarea.value);
            } else {
                preview.innerHTML = escapeHtml(textarea.value);
            }
        }
    }
}

// グローバル関数として公開
window.setupMultiSelect = setupMultiSelect;
window.switchMarkdownView = switchMarkdownView;
window.clearSearchAndFilters = clearSearchAndFilters;