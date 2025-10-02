/* [fix][avatar-cache] 画像のLRUキャッシュ+同時実行制御+キャンセル */
(function(){
    if(window.__imageCache){ return; }
    const MAX = 180;
    const cache = new Map(); // key: ref (e.g., 'drive:FILEID') -> objectURL/http/data
    const pending = new Map(); // ref -> Promise
    let inflight = 0;
    const QUEUE = [];
    const MAX_CONCURRENCY = 6;

    function lruGet(k){
        if(!cache.has(k)) return null;
        const v = cache.get(k);
        cache.delete(k); cache.set(k, v);
        return v;
    }
    function lruSet(k, v){
        if(cache.has(k)) cache.delete(k);
        cache.set(k, v);
        // エビクション
        while(cache.size > MAX){
            const oldestKey = cache.keys().next().value;
            const oldestVal = cache.get(oldestKey);
            cache.delete(oldestKey);
            try{ if(typeof oldestVal === 'string' && oldestVal.startsWith('blob:')) URL.revokeObjectURL(oldestVal); }catch(_e){}
            console.log('[fix][avatar-cache] evict:', oldestKey);
        }
    }

    async function doFetch(ref, signal){
        try{
            if(typeof getImageObjectUrl === 'function'){
                return await getImageObjectUrl(ref, signal);
            }else if(typeof loadImageFromGoogleDriveWithSignal === 'function'){
                return await loadImageFromGoogleDriveWithSignal(ref, signal);
            }else if(typeof loadImageFromGoogleDrive === 'function'){
                return await loadImageFromGoogleDrive(ref);
            }
            return ref;
        }catch(e){
            if(e && e.name === 'AbortError'){ return null; }
            throw e;
        }
    }

    function pump(){
        while(inflight < MAX_CONCURRENCY && QUEUE.length){
            const job = QUEUE.shift();
            const {ref, resolve, reject, signal} = job;
            const cached = lruGet(ref);
            if(cached){ console.log('[fix][avatar-cache] hit LRU:', ref); resolve(cached); continue; }
            if(pending.has(ref)){ pending.get(ref).then(resolve).catch(reject); continue; }
            inflight++;
            const p = doFetch(ref, signal).then(url=>{
                if(url){ lruSet(ref, url); }
                return url;
            }).finally(()=>{
                inflight--;
                pending.delete(ref);
                pump();
            });
            pending.set(ref, p);
            p.then(resolve).catch(reject);
        }
    }

    function enqueue(ref, signal){
        const cached = lruGet(ref);
        if(cached){ console.log('[fix][avatar-cache] hit LRU:', ref); return Promise.resolve(cached); }
        return new Promise((resolve, reject)=>{
            QUEUE.push({ref, resolve, reject, signal});
            pump();
        });
    }

    window.__imageCache = { get:lruGet, set:lruSet, size: ()=>cache.size };
    window.__imageQueue = { enqueue };
    window.__imagePending = pending;
    window.__imageAbort = { current: null };
})();

// === 画像srcが 'drive:{fileId}' の場合にトークン付APIでDataURLへ変換して差し込む共通処理 ===
async function hydrateDriveImage(imgEl){


/* [merge][restore] START function getFilteredContacts */
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
/* [merge][restore] END function getFilteredContacts */


/* [merge][restore] START function renderContacts */
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
/* [merge][restore] END function renderContacts */


/* [merge][restore] START function createContactListItem */
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
/* [merge][restore] END function createContactListItem */


/* [merge][restore] START function createContactCard */
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
/* [merge][restore] END function createContactCard */


/* [merge][restore] START function renderContactTree */
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
/* [merge][restore] END function renderContactTree */


/* [merge][restore] START function createTreeNode */
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
/* [merge][restore] END function createTreeNode */


/* [merge][restore] START function filterByReferrer */
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
/* [merge][restore] END function filterByReferrer */


/* [merge][restore] START function clearReferrerFilter */
function clearReferrerFilter() {
    window.referrerFilter = null;
    const referrerFilterMessage = document.getElementById('referrerFilterMessage');
    if (referrerFilterMessage) {
        referrerFilterMessage.style.display = 'none';
    }
    renderContacts();
}
/* [merge][restore] END function clearReferrerFilter */


/* [merge][restore] START function sortContacts */
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
                return toNum(b.referrerRevenue) - toNum(a.referrerRevenue);
            case 'revenue-desc':
                return toNum(b.revenue) - toNum(a.revenue);
            case 'referral-count-desc':
                return toNum(b.referralCount) - toNum(a.referralCount);
            default:
                return 0;
        }
    });
}
/* [merge][restore] END function sortContacts */


/* [merge][restore] START function toNum */
function toNum(v){ if(v===null||v===undefined) return 0; const n = Number(String(v).replace(/[^\d\.\-]/g,'')); return isFinite(n)? n : 0; }
/* [merge][restore] END function toNum */


/* [merge][restore] START function getTypeColorClass */
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
/* [merge][restore] END function getTypeColorClass */

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

// [IMAGE FIX] 画像URL解決（レガシー対応版）
function resolveImageUrl(contact, type = 'photo') {
    try{
        const fieldName = (type === 'photo') ? 'photo' : 'businessCard';
        let url = contact && contact[fieldName];

        // [fix][avatar] Priority 1: Direct URL (data:, http:, https:, drive:)
        if(url && typeof url === 'string'){
            if(url.startsWith('data:') || url.startsWith('http:') || 
               url.startsWith('https:') || url.startsWith('drive:')){
                const sanitized = sanitizeImageUrl(url);
                if(sanitized) return sanitized;
            }
        }

        // [fix][avatar] Priority 2: Fallback to *Ref if string URL missing
        if (!url) {
            const refObj = (type === 'photo') ? (contact && contact.photoRef) : (contact && contact.businessCardRef);
            if (refObj && refObj.driveFileId) {
                url = 'drive:' + refObj.driveFileId;
            } else if (refObj && refObj.path) {
                // Path only is not directly loadable in <img>; leave null so placeholder is used.
                url = null;
            }
        }

        if (!url) return null;
        const sanitized = sanitizeImageUrl(url);
        return sanitized || null;
    }catch(e){
        console.warn('[fix][avatar] resolveImageUrl error', e);
        return null;
    }
}

// ui.js - UI操作・表示機能(完全版)

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


/* [merge][restore-kanban] START function renderKanbanView */
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
/* [merge][restore-kanban] END function renderKanbanView */



/* [merge][restore-kanban] START function createKanbanColumn */
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
/* [merge][restore-kanban] END function createKanbanColumn */



/* [merge][restore-kanban] START function createKanbanCard */
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
/* [merge][restore-kanban] END function createKanbanCard */



/* [fix][kanban] START (anchor:ui.js:handleDrop) */
async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    this.classList.remove('drag-over');

    if (draggedCard && draggedCard !== this) {
        const targetColumn = this;
        const newStatus = targetColumn.dataset.status;
        const contactId = draggedCard.dataset.contactId;

        // [fix][kanban] 楽観的UI更新
        const contact = (window.contacts||[]).find(c => c.id === contactId);
        if (contact) {
            const oldStatus = contact.status;
            contact.status = newStatus;

            // 即座にUI更新
            if (typeof renderContacts === 'function') {
                renderContacts();
            }

            // [fix][kanban] 永続化処理
            try {
                if (typeof AppData !== 'undefined' && typeof AppData.updateContactStatus === 'function') {
                    await AppData.updateContactStatus(contactId, newStatus);
                    if (typeof showNotification === 'function') {
                        showNotification(`ステータスを「${newStatus}」に変更しました`, 'success');
                    }
                    console.log('[fix][kanban] status saved:', contactId, '->', newStatus);
                } else {
                    throw new Error('AppData.updateContactStatus not available');
                }
            } catch (saveError) {
                // [fix][kanban] 保存失敗時はロールバック
                console.error('[fix][kanban] save failed:', saveError);
                contact.status = oldStatus;
                if (typeof renderContacts === 'function') {
                    renderContacts();
                }
                if (typeof showNotification === 'function') {
                    showNotification('ステータス変更の保存に失敗しました', 'error');
                }
            }
        }
    }

    return false;
}
/* [fix][kanban] END (anchor:ui.js:handleDrop) */


// グローバル関数として公開
if (typeof setupMultiSelect === 'function') window.setupMultiSelect = setupMultiSelect;
if (typeof switchMarkdownView === 'function') window.switchMarkdownView = switchMarkdownView;
if (typeof clearSearchAndFilters === 'function') window.clearSearchAndFilters = clearSearchAndFilters;


/* [fix][expose] START (anchor:ui.js:publish-core-ui) */
(function(){
  try {
    console.log('[fix][expose] publishing core UI functions');
    var names = [
      'getFilteredContacts','renderContacts','createContactListItem','createContactCard',
      'renderContactTree','createTreeNode','filterByReferrer','clearReferrerFilter',
      'sortContacts','toNum','getTypeColorClass',
      'renderKanbanView','createKanbanColumn','createKanbanCard','handleDrop',
      'resolveImageUrl','hydrateDriveImage','loadImageSafely','sanitizeImageUrl','generatePlaceholderImage'
    ];
    names.forEach(function(n){
      try{
        if (typeof window[n] !== 'function' && typeof globalThis[n] === 'function'){
          window[n] = globalThis[n];
        }
      }catch(_){}
    });
  } catch(e){
    console.warn('[fix][expose] failed to publish core UI functions', e);
  }
})();
/* [fix][expose] END (anchor:ui.js:publish-core-ui) */

