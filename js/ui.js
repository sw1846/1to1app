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

/* [fix][avatar] START (anchor:ui.js:createContactCard) */

/* [fix][avatar] START (anchor:ui.js:createContactCard) */
function createContactCard(contact) {
    const card = document.createElement('div');
    card.className = 'contact-card' + (typeof getTypeColorClass === 'function' ? getTypeColorClass(contact) : '');
    card.dataset.contactId = contact.id;

    // 詳細表示
    card.onclick = () => {
        if (typeof showContactDetail === 'function') {
            showContactDetail(contact.id);
        }
    };

    // 画像URL解決
    const photoUrl = (typeof resolveImageUrl === 'function') ? resolveImageUrl(contact, 'photo') : null;
    const photoHtml = photoUrl
        ? `<img class="contact-photo" src="${typeof generatePlaceholderImage==='function'?generatePlaceholderImage():''}" data-src="${photoUrl}" alt="avatar">`
        : `<div class="contact-photo contact-photo--placeholder"></div>`;

    // 会社・氏名等
    const safe = (v)=> (typeof escapeHtml === 'function') ? escapeHtml(String(v||'')) : String(v||'');
    const latestMeetingDate = (typeof getLatestMeetingDate === 'function') ? getLatestMeetingDate(contact.id) : '';

    card.innerHTML = `
        ${photoHtml}
        <div class="contact-info">
            <div class="contact-name">${safe(contact.name)}</div>
            <div class="contact-company">${safe(contact.company || '')}</div>
            <div class="contact-meta">
                ${latestMeetingDate ? `<span class="meta-item">最終面談: ${safe(latestMeetingDate)}</span>` : ''}
            </div>
        </div>
    `;

    // 遅延読み込み
    try{
      var img = card.querySelector('img[data-src]');
      if(img && typeof loadImageSafely === 'function'){
        setTimeout(function(){ loadImageSafely(img, img.getAttribute('data-src')); }, 0);
      }
    }catch(e){}

    // カンバン用ドラッグ属性
    card.draggable = true;
    card.addEventListener('dragstart', handleDragStart);

    return card;
}
/* [fix][avatar] END (anchor:ui.js:createContactCard) */

/* [fix][avatar] END (anchor:ui.js:createContactCard) */

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



// [IMAGE FIX] 画像URL解決（レガシー対応版）

/* [fix][avatar] START (anchor:ui.js:resolveImageUrl) */
function resolveImageUrl(contact, type = 'photo') {
    try{
        const fieldName = (type === 'photo') ? 'photo' : 'businessCard';
        const refField = fieldName + 'Ref';
        let url = contact && contact[fieldName] ? String(contact[fieldName]) : null;

        // 1) 直接URLがあればサニタイズして返す（data/http/https/blob/drive）
        if (url) {
            const sanitized = (typeof sanitizeImageUrl === 'function') ? sanitizeImageUrl(url) : url;
            if (sanitized) return sanitized;
        }

        // 2) *Ref オブジェクトを優先（directUrl / driveFileId）
        const ref = contact && contact[refField];
        if (ref && typeof ref === 'object') {
            if (ref.directUrl) {
                const s = (typeof sanitizeImageUrl === 'function') ? sanitizeImageUrl(ref.directUrl) : ref.directUrl;
                if (s) return s;
            }
            if (ref.driveFileId) {
                if (typeof buildDriveDownloadUrl === 'function') {
                    return buildDriveDownloadUrl(ref.driveFileId);
                }
                return 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(ref.driveFileId) + '?alt=media';
            }
        }

        // 3) photo/businessCard に drive: が残っている場合
        if (url && url.startsWith && url.startsWith('drive:')) {
            const id = url.slice(6).trim();
            if (id) {
                return (typeof buildDriveDownloadUrl === 'function') ? buildDriveDownloadUrl(id) : null;
            }
        }

        // 4) 見つからない場合は null
        return null;
    }catch(e){
        console.warn('[fix][avatar] resolveImageUrl error', e);
        return null;
    }
}
/* [fix][avatar] END (anchor:ui.js:resolveImageUrl) */


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

/* [fix][image-viewer] START (anchor:ui.js:openImageLightbox) */
// 画像の簡易ライトボックス（名刺や顔写真の拡大表示）
function openImageLightbox(url){
    try{
        if(!url) return;
        let overlay = document.getElementById('imageLightbox');
        if(!overlay){
            overlay = document.createElement('div');
            overlay.id = 'imageLightbox';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:9999;';
            overlay.addEventListener('click', ()=> overlay.remove());
            const img = document.createElement('img');
            img.id = 'imageLightboxImg';
            img.style.cssText = 'max-width:90vw;max-height:90vh;box-shadow:0 10px 30px rgba(0,0,0,.5);border-radius:8px;';
            overlay.appendChild(img);
            document.body.appendChild(overlay);
        }
        const img = document.getElementById('imageLightboxImg');
        img.src = url;
        overlay.style.display = 'flex';
    }catch(e){
        console.warn('[fix][image-viewer] openImageLightbox error', e);
        window.open(url, '_blank');
    }
}
/* [fix][image-viewer] END (anchor:ui.js:openImageLightbox) */

/* [fix][image-utils] START (anchor:ui.js:image-utils) */
// 小さな透明GIFをプレースホルダに使用
function generatePlaceholderImage(){
    try{
        // 1x1 transparent GIF
        return 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
    }catch(e){
        return '';
    }
}

// data-src を安全に読み込み、エラー時に非表示/プレースホルダ維持

/* [fix][avatar] START (anchor:ui.js:loadImageSafely) */
function loadImageSafely(img, rawUrl){
    try{
        if(!img || !rawUrl) return;
        var srcCandidate = String(rawUrl);
        if(typeof isDriveRef==='function' && isDriveRef(srcCandidate) && typeof loadImageFromGoogleDrive==='function'){
            (async function(){
                const blobUrl = await loadImageFromGoogleDrive(srcCandidate);
                if(blobUrl){
                    img.onload = ()=>{ img.onload = img.onerror = null; };
                    img.onerror = ()=>{ img.onload = img.onerror = null; };
                    img.src = blobUrl;
                    try{ img.removeAttribute('data-src'); }catch(_){}
                }else{
                    var url = (typeof sanitizeImageUrl === 'function') ? sanitizeImageUrl(srcCandidate) : srcCandidate;
                    try{
                      if(url && url.indexOf('googleapis.com/drive/v3/files')>-1 && url.indexOf('access_token=')===-1 && typeof getGoogleAccessToken==='function'){
                        var tk = getGoogleAccessToken();
                        if(tk){ url += (url.indexOf('?')>-1?'&':'?') + 'access_token=' + encodeURIComponent(tk); }
                      }
                    }catch(_e){}
                    img.onload = ()=>{ img.onload = img.onerror = null; };
                    img.onerror = ()=>{ img.onload = img.onerror = null; };
                    img.src = url;
                    try{ img.removeAttribute('data-src'); }catch(_){}
                }
            })();
            return;
        }
        var url = (typeof sanitizeImageUrl === 'function') ? sanitizeImageUrl(String(rawUrl)) : String(rawUrl);
        try{
          if(url && url.indexOf('googleapis.com/drive/v3/files')>-1 && url.indexOf('access_token=')===-1 && typeof getGoogleAccessToken==='function'){
            var tk = getGoogleAccessToken();
            if(tk){ url += (url.indexOf('?')>-1?'&':'?') + 'access_token=' + encodeURIComponent(tk); }
          }
        }catch(_e){}
        var tried = false;
        const onload = ()=>{ img.onload = img.onerror = null; };
        const onerror = ()=>{ 
            if(!tried){
                tried = true;
                try{
                    var u2 = (typeof sanitizeImageUrl === 'function') ? sanitizeImageUrl(String(rawUrl)) : String(rawUrl);
                    if(u2 && u2 !== img.src){ img.src = u2; return; }
                }catch(_e){}
            }
            img.onload = img.onerror = null;
        };
        img.onload = onload;
        img.onerror = onerror;
        img.src = url;
        try{ img.removeAttribute('data-src'); }catch(_){}
    }catch(e){
        console.warn('[fix][image-utils] loadImageSafely error', e);
    }
}
/* [fix][avatar] END (anchor:ui.js:loadImageSafely) */


// 既存HTMLからの呼び出し互換（連絡先詳細のonclick="showImageModal(url, ...)"）
function showImageModal(url, title){
    try{
        if (typeof openImageLightbox === 'function'){ openImageLightbox(url); }
        else if (url){ window.open(url, '_blank'); }
    }catch(e){
        console.warn('[fix][image-utils] showImageModal error', e);
    }
}
/* [fix][image-utils] END (anchor:ui.js:image-utils) */

/* [fix][filters] START (anchor:ui.js:refresh-filter-dropdowns) */
function refreshFilterDropdowns(){
  try{
    // 種別セレクトを options.types から再構築
    var sel = document.getElementById('typeFilter');
    if(sel){
      var cur = sel.value;
      // クリア
      while(sel.firstChild) sel.removeChild(sel.firstChild);
      var addOpt = function(v, label){ var o=document.createElement('option'); o.value=v; o.textContent=label||v; sel.appendChild(o); };
      addOpt('','すべて');
      var types = (window.options && Array.isArray(window.options.types)) ? window.options.types.slice(0) : [];
      // 既存データからも補完（安全に）
      try{
        if(Array.isArray(window.contacts)){
          window.contacts.forEach(function(c){
            (Array.isArray(c.types) ? c.types : []).forEach(function(t){
              if(t && types.indexOf(t)===-1) types.push(t);
            });
          });
        }
      }catch(_){}
      // 重複除去 & ソート
      types = Array.from(new Set(types.filter(Boolean))).sort(function(a,b){ return String(a).localeCompare(String(b),'ja'); });
      types.forEach(function(t){ addOpt(t, t); });
      // 既存選択を復元（なければ空）
      sel.value = (types.indexOf(cur)>=0 || cur==='') ? cur : '';
    }
  }catch(e){ console.warn('[fix][filters] refreshFilterDropdowns error', e); }
}
// オプション更新イベントに追従
try{
  window.addEventListener('options:updated', function(){ refreshFilterDropdowns(); }, false);
}catch(_){}
/* [fix][filters] END (anchor:ui.js:refresh-filter-dropdowns) */

/* [fix][kanban] START (anchor:ui.js:status-management-modal) */
function openStatusManagementModal(){
  try{
    // 既存を削除
    var old = document.getElementById('statusManageModal');
    if(old) old.remove();

    var statuses = (window.options && Array.isArray(window.options.statuses) && window.options.statuses.length)
      ? window.options.statuses.slice(0)
      : ['新規','商談中','成約','保留','終了'];

    var overlay = document.createElement('div');
    overlay.id = 'statusManageModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;';
    var modal = document.createElement('div');
    modal.style.cssText = 'background:#fff;min-width:520px;max-width:90vw;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);';
    modal.innerHTML = '<div style="padding:14px 16px;border-bottom:1px solid #eee;font-weight:600;">カンバンのステータス管理</div>';
    var body = document.createElement('div');
    body.style.cssText = 'padding:14px 16px;';

    var list = document.createElement('div');
    statuses.forEach(function(s, idx){
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;';
      row.innerHTML = `
        <input type="text" value="${s}" data-idx="${idx}" style="flex:1 1 auto;padding:6px 8px;border:1px solid #ddd;border-radius:6px;">
        <button class="btn btn-sm" data-act="up">↑</button>
        <button class="btn btn-sm" data-act="down">↓</button>
        <button class="btn btn-sm" data-act="del">削除</button>
      `;
      list.appendChild(row);
    });

    var addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;gap:8px;margin-top:10px;';
    addRow.innerHTML = `
      <input type="text" id="statusNewInput" placeholder="新しいステータス名" style="flex:1 1 auto;padding:6px 8px;border:1px solid #ddd;border-radius:6px;">
      <button class="btn btn-sm" id="statusAddBtn">追加</button>
    `;

    var footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #eee;';
    footer.innerHTML = `
      <button class="btn btn-sm" id="statusCancel">キャンセル</button>
      <button class="btn btn-sm btn-primary" id="statusSave">保存</button>
    `;

    body.appendChild(list);
    body.appendChild(addRow);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // 行内ボタン
    list.addEventListener('click', function(e){
      var btn = e.target.closest('button');
      if(!btn) return;
      var row = btn.parentElement;
      if(btn.dataset.act==='del'){
        row.remove();
      }else if(btn.dataset.act==='up'){
        var prev = row.previousElementSibling;
        if(prev) list.insertBefore(row, prev);
      }else if(btn.dataset.act==='down'){
        var next = row.nextElementSibling;
        if(next) list.insertBefore(next, row);
      }
    });

    // 追加
    document.getElementById('statusAddBtn').onclick = function(){
      var v = document.getElementById('statusNewInput').value.trim();
      if(!v) return;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;';
      row.innerHTML = `
        <input type="text" value="${v}" style="flex:1 1 auto;padding:6px 8px;border:1px solid #ddd;border-radius:6px;">
        <button class="btn btn-sm" data-act="up">↑</button>
        <button class="btn btn-sm" data-act="down">↓</button>
        <button class="btn btn-sm" data-act="del">削除</button>
      `;
      list.appendChild(row);
      document.getElementById('statusNewInput').value = '';
    };

    // 保存
    document.getElementById('statusSave').onclick = async function(){
      try{
        var newList = Array.from(list.querySelectorAll('input[type="text"]')).map(function(i){ return i.value.trim(); }).filter(Boolean);
        if(!window.options) window.options = {};
        window.options.statuses = Array.from(new Set(newList));
        // 永続化
        if(window.folderStructure && window.AppData && typeof window.AppData.saveOptionsToMetadata==='function'){
          try{ await window.AppData.saveOptionsToMetadata(window.folderStructure, window.options); notify('ステータスを保存しました'); }catch(e){ notify('保存に失敗しました'); }
        }
        // 再描画
        if(typeof refreshFilterDropdowns==='function') refreshFilterDropdowns();
        if(typeof renderContacts==='function') renderContacts();
        overlay.remove();
      }catch(e){ console.warn('[fix][kanban] save statuses failed', e); }
    };
    document.getElementById('statusCancel').onclick = function(){ overlay.remove(); };

  }catch(e){
    console.warn('[fix][kanban] openStatusManagementModal error', e);
  }
}
// 起動時にフィルターを初期化
try{ 
  if(document.readyState!=='loading') refreshFilterDropdowns();
  else window.addEventListener('DOMContentLoaded', function(){ refreshFilterDropdowns(); }, false);
}catch(_){}
/* [fix][kanban] END (anchor:ui.js:status-management-modal) */



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

/* [fix][kanban] START (anchor:ui.js:renderKanbanView) */
function renderKanbanView(container, contactList) {
    try{
      if(!(window.options && Array.isArray(window.options.statuses) && window.options.statuses.length)){
        if(!window.options) window.options = {};
        window.options.statuses = ['新規','商談中','成約','保留','終了'];
      }
      if(typeof uniquePreserveOrder==='function') window.options.statuses = uniquePreserveOrder(window.options.statuses);
    }catch(_){}

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

    // ステータス配列（options.statuses が無ければデフォルト）
    let statuses = (window.options && Array.isArray(window.options.statuses) && window.options.statuses.length)
        ? window.options.statuses.slice(0)
        : ['新規','商談中','成約','保留','終了'];

    // 重複排除＆空文字除去
    statuses = Array.from(new Set(statuses.filter(Boolean)));

    statuses.forEach(status => {
        const column = createKanbanColumn(status, contactList);
        board.appendChild(column);
    });

    container.appendChild(board);
}
/* [fix][kanban] END (anchor:ui.js:renderKanbanView) */

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


/* [fix][kanban] START (anchor:ui.js:drag-handlers) */
// グローバルにドラッグ中カード参照（既存handleDropが参照）
var draggedCard = (typeof draggedCard !== 'undefined') ? draggedCard : null;

function handleDragStart(e){
    try{
        draggedCard = this;
        if (e.dataTransfer){
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', this.dataset.contactId || '');
        }
        this.classList.add('dragging');
    }catch(err){ console.warn('[fix][kanban] handleDragStart error', err); }
}

function handleDragOver(e){
    try{
        if (e.preventDefault) e.preventDefault(); // dropを許可
        if (e.dataTransfer){ e.dataTransfer.dropEffect = 'move'; }
        this.classList.add('drag-over');
        return false;
    }catch(err){ console.warn('[fix][kanban] handleDragOver error', err); return false; }
}

function handleDragLeave(e){
    try{
        this.classList.remove('drag-over');
    }catch(err){ console.warn('[fix][kanban] handleDragLeave error', err); }
}

function handleDragEnd(e){
    try{
        this.classList.remove('dragging');
    }catch(err){ console.warn('[fix][kanban] handleDragEnd error', err); }
}
/* [fix][kanban] END (anchor:ui.js:drag-handlers) */

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




/* [fix][search] START (anchor:ui.js:filters) */
function filterContacts(){
  try{
    if(typeof renderContacts === 'function'){ renderContacts(); }
  }catch(e){ console.warn('[fix][search] filterContacts error', e); }
}

function clearSearchAndFilters(){
  try{
    var q = document.getElementById('searchInput');
    if(q) q.value = '';
    var typeSel = document.getElementById('typeFilter');
    if(typeSel) typeSel.value = '';

    // テキスト系フィルタ
    window.filterValues = window.filterValues || {};
    ['affiliation','business','industryInterests','residence'].forEach(function(k){
      window.filterValues[k] = '';
      var el = document.getElementById(k==='industryInterests'?'industryInterestsFilter':(k+'Filter'));
      if(el && typeof el.value !== 'undefined') el.value = '';
    });

    // 紹介者フィルタ
    if(typeof clearReferrerFilter === 'function'){ clearReferrerFilter(); }
    else { window.referrerFilter = ''; }

    if(typeof renderContacts === 'function'){ renderContacts(); }
  }catch(e){ console.warn('[fix][search] clearSearchAndFilters error', e); }
}
/* [fix][search] END (anchor:ui.js:filters) */
/* [fix][expose] START (anchor:ui.js:publish-core-ui) */
(function(){
  try {
    console.log('[fix][expose] publishing core UI functions');
    var names = [
      'getFilteredContacts','renderContacts','createContactListItem','createContactCard',
      'renderContactTree','createTreeNode','filterByReferrer','clearReferrerFilter',
      'sortContacts','toNum','getTypeColorClass',
      'renderKanbanView','createKanbanColumn','createKanbanCard','handleDrop',
      'resolveImageUrl','hydrateDriveImage','loadImageSafely','sanitizeImageUrl','generatePlaceholderImage','filterContacts','clearSearchAndFilters','refreshFilterDropdowns','openStatusManagementModal'
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


/* [fix][avatar] START (anchor:ui.js:image-autofix) */
(function(){
  try{
    var obs = new MutationObserver(function(muts){
      muts.forEach(function(m){
        Array.from(m.addedNodes||[]).forEach(function(node){
          if(node && node.nodeType===1){
            if(node.matches && node.matches('img[data-src]')){
              try{ loadImageSafely(node, node.getAttribute('data-src')); }catch(_){}
            }
            var imgs = node.querySelectorAll ? node.querySelectorAll('img[data-src]') : [];
            imgs.forEach(function(img){
              try{ loadImageSafely(img, img.getAttribute('data-src')); }catch(_){}
            });
            var bads = node.querySelectorAll ? node.querySelectorAll('img[src^="drive:"]') : [];
            bads.forEach(function(img){
              try{
                var raw = img.getAttribute('src');
                img.removeAttribute('src');
                img.setAttribute('data-src', raw);
                loadImageSafely(img, raw);
              }catch(_){}
            });
          }
        });
      });
    });
    obs.observe(document.documentElement, {childList:true, subtree:true});
    document.querySelectorAll('img[src^="drive:"]').forEach(function(img){
      try{
        var raw = img.getAttribute('src');
        img.removeAttribute('src');
        img.setAttribute('data-src', raw);
        loadImageSafely(img, raw);
      }catch(_){}
    });
  }catch(e){ console.warn('[fix][avatar] observer failed', e); }
})();
/* [fix][avatar] END (anchor:ui.js:image-autofix) */
