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

// グローバル関数として公開
window.setupMultiSelect = setupMultiSelect;
window.switchMarkdownView = switchMarkdownView;
window.clearSearchAndFilters = clearSearchAndFilters;
