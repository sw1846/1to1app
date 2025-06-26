// ===== UI共通機能 =====

// 表示モード初期化
function initializeViewMode() {
    // ローカルストレージから表示モードを取得
    const savedMode = localStorage.getItem('viewMode');
    if (savedMode) {
        viewMode = savedMode;
    }
    
    // ボタンのアクティブ状態を更新
    updateViewModeButtons();
}

// フィルター表示状態初期化
function initializeFilterVisibility() {
    // ローカルストレージからフィルター表示状態を取得
    const savedVisibility = localStorage.getItem('filterVisible');
    if (savedVisibility !== null) {
        filterVisible = savedVisibility === 'true';
    }
    
    // フィルターの表示状態を反映
    const filterContent = document.getElementById('filterContent');
    const filterToggleIcon = document.getElementById('filterToggleIcon');
    
    if (filterContent && filterToggleIcon) {
        if (filterVisible) {
            filterContent.classList.add('show');
            filterToggleIcon.textContent = '▼';
        } else {
            filterContent.classList.remove('show');
            filterToggleIcon.textContent = '▶';
        }
    }
}

// 表示モード設定
function setViewMode(mode) {
    viewMode = mode;
    localStorage.setItem('viewMode', mode);
    updateViewModeButtons();
    renderContactList();
    saveOptions();
}

// 表示モードボタン更新
function updateViewModeButtons() {
    const cardBtn = document.getElementById('cardViewBtn');
    const listBtn = document.getElementById('listViewBtn');
    
    if (cardBtn && listBtn) {
        if (viewMode === 'card') {
            cardBtn.classList.add('active');
            listBtn.classList.remove('active');
        } else {
            cardBtn.classList.remove('active');
            listBtn.classList.add('active');
        }
    }
}

// フィルター表示切り替え
function toggleFilters() {
    const filterContent = document.getElementById('filterContent');
    const filterToggleIcon = document.getElementById('filterToggleIcon');
    
    if (filterContent.classList.contains('show')) {
        filterContent.classList.remove('show');
        filterToggleIcon.textContent = '▶';
        filterVisible = false;
    } else {
        filterContent.classList.add('show');
        filterToggleIcon.textContent = '▼';
        filterVisible = true;
    }
    
    localStorage.setItem('filterVisible', filterVisible);
    saveOptions();
}

// 連絡先クリックハンドラ
function handleContactClick(event, contactId) {
    // リンククリックの場合は詳細表示しない
    if (event.target.tagName === 'A') {
        return;
    }
    showContactDetail(contactId);
}

// タブ切り替え
function switchTab(event, tabName) {
    // すべてのタブコンテンツを非表示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // すべてのタブボタンを非アクティブ
    document.querySelectorAll('.detail-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 選択されたタブを表示
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

// 折りたたみコンテンツ切り替え
function toggleCollapsible(id) {
    const content = document.getElementById(id);
    const link = event.target;
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        link.textContent = '折りたたむ';
    } else {
        content.classList.add('collapsed');
        link.textContent = '続きを読む';
    }
}

// ドロップダウンオプション更新
function updateDropdownOptions() {
    // 各フィールドのオプションを収集
    const fields = ['types', 'affiliations', 'goldenEgg', 'wantToConnect', 'referredBy', 'area', 'residence'];
    
    fields.forEach(field => {
        const uniqueValues = new Set();
        
        if (field === 'referredBy' || field === 'area' || field === 'residence') {
            // 単一値フィールド
            contacts.forEach(contact => {
                if (contact[field]) {
                    uniqueValues.add(contact[field]);
                }
            });
        } else {
            // 配列フィールド
            contacts.forEach(contact => {
                if (contact[field] && Array.isArray(contact[field])) {
                    contact[field].forEach(value => uniqueValues.add(value));
                }
            });
        }
        
        if (field !== 'area' && field !== 'residence') {
            dropdownOptions[field] = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, 'ja'));
        }
    });
    
    // フィルター用ドロップダウンを更新
    updateFilterDropdowns();
}

// フィルタードロップダウン更新
function updateFilterDropdowns() {
    // エリアと居住地のユニークな値を収集
    const areas = new Set();
    const residences = new Set();
    
    contacts.forEach(contact => {
        if (contact.area) areas.add(contact.area);
        if (contact.residence) residences.add(contact.residence);
    });
    
    const areaOptions = Array.from(areas).sort((a, b) => a.localeCompare(b, 'ja'));
    const residenceOptions = Array.from(residences).sort((a, b) => a.localeCompare(b, 'ja'));
    
    // SearchableSelectインスタンスを作成または更新
    if (document.getElementById('filterTypeWrapper')) {
        window.searchableSelects.filterType = new SearchableSelect(
            'filterTypeWrapper',
            dropdownOptions.types || [],
            '',
            () => filterContacts()
        );
        
        window.searchableSelects.filterAffiliation = new SearchableSelect(
            'filterAffiliationWrapper',
            dropdownOptions.affiliations || [],
            '',
            () => filterContacts()
        );
        
        window.searchableSelects.filterWantToConnect = new SearchableSelect(
            'filterWantToConnectWrapper',
            dropdownOptions.wantToConnect || [],
            '',
            () => filterContacts()
        );
        
        window.searchableSelects.filterGoldenEgg = new SearchableSelect(
            'filterGoldenEggWrapper',
            dropdownOptions.goldenEgg || [],
            '',
            () => filterContacts()
        );
        
        window.searchableSelects.filterReferredBy = new SearchableSelect(
            'filterReferredByWrapper',
            dropdownOptions.referredBy || [],
            '',
            () => filterContacts()
        );
        
        window.searchableSelects.filterArea = new SearchableSelect(
            'filterAreaWrapper',
            areaOptions,
            '',
            () => filterContacts()
        );
        
        window.searchableSelects.filterResidence = new SearchableSelect(
            'filterResidenceWrapper',
            residenceOptions,
            '',
            () => filterContacts()
        );
    }
}

// テンプレートエディター表示
function showTemplateEditor() {
    const editor = document.getElementById('templateEditor');
    const template = localStorage.getItem('meetingTemplate') || '';
    document.getElementById('templateContent').value = template;
    editor.style.display = 'block';
}

// テンプレートエディター非表示
function hideTemplateEditor() {
    document.getElementById('templateEditor').style.display = 'none';
}

// テンプレート保存
async function saveTemplate() {
    const template = document.getElementById('templateContent').value;
    localStorage.setItem('meetingTemplate', template);
    userSettings.meetingTemplate = template;
    await saveOptions();
    hideTemplateEditor();
    showNotification('テンプレートを保存しました');
}

// 設定モーダル表示
function showSettingsModal() {
    hideTemplateEditor();
    document.getElementById('settingsModal').style.display = 'block';
}

// Google Driveリンクを直接アクセス可能なURLに変換
function toDirectLink(url) {
    if (!url) return '';
    
    // パターン1: /file/d/{id}/view 形式
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (fileMatch && fileMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
    }
    
    // パターン2: /d/{id} 形式
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    
    // パターン3: ?id={id} 形式
    const match2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (match2 && match2[1]) {
        return `https://lh3.googleusercontent.com/d/${match2[1]}`;
    }
    
    // パターン4: 既に変換済みの場合はそのまま返す
    if (url.includes('lh3.googleusercontent.com/d/')) {
        return url;
    }
    
    return url;
}

// 連絡先リストレンダリング（既存のコードに追加）
function renderContactList(filterFunc = null) {
    const grid = document.getElementById('contactGrid');
    let filteredContacts = filterFunc ? contacts.filter(filterFunc) : contacts;
    
    filteredContacts = sortContacts(filteredContacts);
    
    if (filteredContacts.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #aaaaaa; padding: 40px;">連絡先が見つかりません</p>';
        return;
    }
    
    if (viewMode === 'list') {
        grid.className = 'contact-list';
        grid.innerHTML = filteredContacts.map(contact => {
            const lastMeetingDate = getLastMeetingDate(contact.id);
            const lastMeetingText = lastMeetingDate ? 
                `最終: ${formatDate(lastMeetingDate)}` : 
                '未実施';
            
            // 顔写真の表示処理
            let photoHtml = '';
            if (contact.photoUrl && !contact.photoUrl.includes('dropbox')) {
                // photoUrlが存在しDropboxでない場合は直接使用
                photoHtml = `<img src="${contact.photoUrl}" alt="${escapeHtml(contact.name)}" loading="lazy" onerror="handleImageError(this, '${escapeHtml(contact.name).replace(/'/g, "\\'")}')">`;
            } else if (contact.photo && !contact.photo.startsWith('/')) {
                // photoのみ存在し、ファイルIDの場合
                photoHtml = `<div class="photo-placeholder" data-photo-id="${contact.photo}" data-contact-name="${escapeHtml(contact.name)}">
                    <span style="font-size: 20px;">${escapeHtml(contact.name.charAt(0))}</span>
                </div>`;
            } else {
                photoHtml = `<span style="font-size: 20px;">${escapeHtml(contact.name.charAt(0))}</span>`;
            }
            
            return `
                <div class="contact-list-item" onclick="handleContactClick(event, '${contact.id}')">
                    <div class="contact-list-photo">
                        ${photoHtml}
                    </div>
                    <div class="contact-list-info">
                        <div class="contact-list-name">
                            ${escapeHtml(contact.name)}
                            ${contact.yomi ? `<span style="font-size: 12px; color: #888;">（${escapeHtml(contact.yomi)}）</span>` : ''}
                        </div>
                        <div class="contact-list-company">${escapeHtml(contact.company || 'ー')}</div>
                        <div style="display: flex; gap: 10px; margin-top: 4px;">
                            ${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}" onclick="event.stopPropagation()" style="font-size: 13px;">📧</a>` : ''}
                            ${contact.homepage ? `<a href="${escapeHtml(contact.homepage)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" style="font-size: 13px;">🌐</a>` : ''}
                        </div>
                    </div>
                    <div class="contact-list-meeting">${lastMeetingText}</div>
                </div>
            `;
        }).join('');
    } else {
        // カード表示も同様に更新
        grid.className = 'contact-grid';
        grid.innerHTML = filteredContacts.map(contact => {
            const lastMeetingDate = getLastMeetingDate(contact.id);
            const lastMeetingText = lastMeetingDate ? 
                `最終打合せ: ${formatDate(lastMeetingDate)}` : 
                'ミーティング未実施';
            
            // 顔写真の表示処理
            let photoHtml = '';
            if (contact.photoUrl && !contact.photoUrl.includes('dropbox')) {
                // photoUrlが存在しDropboxでない場合は直接使用
                photoHtml = `<img src="${contact.photoUrl}" alt="${escapeHtml(contact.name)}" loading="lazy" onerror="handleImageError(this, '${escapeHtml(contact.name).replace(/'/g, "\\'")}')">`;
            } else if (contact.photo && !contact.photo.startsWith('/')) {
                // photoのみ存在し、ファイルIDの場合
                photoHtml = `<div class="photo-placeholder" data-photo-id="${contact.photo}" data-contact-name="${escapeHtml(contact.name)}">
                    <span style="font-size: 32px;">${escapeHtml(contact.name.charAt(0))}</span>
                </div>`;
            } else {
                photoHtml = `<span style="font-size: 32px;">${escapeHtml(contact.name.charAt(0))}</span>`;
            }
            
            return `
                <div class="contact-card" onclick="handleContactClick(event, '${contact.id}')">
                    <div class="contact-photo">
                        ${photoHtml}
                    </div>
                    <div class="contact-name">${escapeHtml(contact.name)}</div>
                    ${contact.yomi ? `<div class="contact-info" style="font-size: 12px; color: #888;">（${escapeHtml(contact.yomi)}）</div>` : ''}
                    ${contact.company ? `<div class="contact-info">会社: ${escapeHtml(contact.company)}</div>` : ''}
                    ${contact.email ? `<div class="contact-info"><a href="mailto:${escapeHtml(contact.email)}" onclick="event.stopPropagation()">📧 ${escapeHtml(contact.email)}</a></div>` : ''}
                    ${contact.phone ? `<div class="contact-info">📱 ${escapeHtml(contact.phone)}</div>` : ''}
                    ${contact.homepage ? `<div class="contact-info"><a href="${escapeHtml(contact.homepage)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">🌐 ${escapeHtml(contact.homepage)}</a></div>` : ''}
                    <div class="last-meeting-info">${lastMeetingText}</div>
                    <div class="tags">
                        ${(contact.types || []).map(type => `<span class="tag">${escapeHtml(type)}</span>`).join('')}
                        ${(contact.affiliations || []).map(aff => `<span class="tag">${escapeHtml(aff)}</span>`).join('')}
                        ${contact.referredBy ? `<span class="tag">紹介: ${escapeHtml(contact.referredBy)}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // レンダリング後に画像を非同期で読み込む
    loadContactPhotos();
}

// 連絡先の写真を非同期で読み込む新関数
async function loadContactPhotos() {
    const placeholders = document.querySelectorAll('.photo-placeholder');
    
    for (const placeholder of placeholders) {
        const photoId = placeholder.dataset.photoId;
        const contactName = placeholder.dataset.contactName;
        
        if (photoId) {
            // まず既存のphotoUrlを探す
            const contact = contacts.find(c => c.photo === photoId || c.name === contactName);
            
            if (contact && contact.photoUrl && !contact.photoUrl.includes('dropbox')) {
                // photoUrlが存在しDropboxでない場合は直接使用
                const img = document.createElement('img');
                img.src = contact.photoUrl;
                img.alt = contactName;
                img.loading = 'lazy';
                img.onerror = () => {
                    placeholder.innerHTML = `<span style="font-size: ${placeholder.parentElement.classList.contains('contact-list-photo') ? '20px' : '32px'};">${contactName.charAt(0)}</span>`;
                };
                placeholder.innerHTML = '';
                placeholder.appendChild(img);
            } else if (!photoId.startsWith('/')) {
                // ファイルIDの場合のみ認証付きURLを取得
                try {
                    const url = await getAuthenticatedFileUrl(photoId);
                    if (url) {
                        const img = document.createElement('img');
                        img.src = url;
                        img.alt = contactName;
                        img.loading = 'lazy';
                        img.onerror = () => {
                            placeholder.innerHTML = `<span style="font-size: ${placeholder.parentElement.classList.contains('contact-list-photo') ? '20px' : '32px'};">${contactName.charAt(0)}</span>`;
                        };
                        placeholder.innerHTML = '';
                        placeholder.appendChild(img);
                    }
                } catch (error) {
                    console.error('画像読み込みエラー:', error);
                }
            }
        }
    }
}