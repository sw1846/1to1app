/* ===== contacts.js - 連絡先管理（完全修正版） ===== */

// [CLAUDE FIX ALL-IN-ONE][filter] フィルター状態管理
let currentFilters = {};
let filteredContacts = [];

// [CLAUDE FIX ALL-IN-ONE][options] 既存データからオプション収集
function collectOptionsFromContacts() {
    const options = {
        types: new Set(),
        affiliations: new Set(),
        businesses: new Set(),
        residences: new Set()
    };
    
    try {
        if (window.contacts && Array.isArray(window.contacts)) {
            window.contacts.forEach(contact => {
                // 種別
                if (contact.types && Array.isArray(contact.types)) {
                    contact.types.forEach(type => type && options.types.add(type.trim()));
                }
                if (contact.type && typeof contact.type === 'string') {
                    contact.type.split(',').forEach(type => type.trim() && options.types.add(type.trim()));
                }
                
                // 所属
                if (contact.affiliations && Array.isArray(contact.affiliations)) {
                    contact.affiliations.forEach(aff => aff && options.affiliations.add(aff.trim()));
                }
                if (contact.affiliation && typeof contact.affiliation === 'string') {
                    contact.affiliation.split(',').forEach(aff => aff.trim() && options.affiliations.add(aff.trim()));
                }
                
                // 事業・関心
                if (contact.businesses && Array.isArray(contact.businesses)) {
                    contact.businesses.forEach(bus => bus && options.businesses.add(bus.trim()));
                }
                if (contact.business && typeof contact.business === 'string') {
                    contact.business.split(',').forEach(bus => bus.trim() && options.businesses.add(bus.trim()));
                }
                
                // 居住地
                if (contact.residence && typeof contact.residence === 'string') {
                    contact.residence.split(',').forEach(res => res.trim() && options.residences.add(res.trim()));
                }
            });
        }
        
        console.log('[fix][options] rebuilt typeFilter: ' + options.types.size);
        console.log('[fix][options] rebuilt affiliationFilter: ' + options.affiliations.size);
        console.log('[fix][options] rebuilt businessFilter: ' + options.businesses.size);
        console.log('[fix][options] rebuilt residenceFilter: ' + options.residences.size);
        
    } catch (e) {
        console.error('collectOptionsFromContacts error:', e);
    }
    
    return options;
}

// [CLAUDE FIX ALL-IN-ONE][options] 既存オプションとマージ
function mergeWithExistingOptions(collectedOptions) {
    try {
        if (!window.options) {
            window.options = {};
        }
        
        // 各カテゴリをマージ
        Object.keys(collectedOptions).forEach(key => {
            const existingSet = new Set(window.options[key] || []);
            const collectedSet = collectedOptions[key];
            
            // 既存とコレクションをユニオン
            const mergedSet = new Set([...existingSet, ...collectedSet]);
            window.options[key] = uniqueSortedJa([...mergedSet]);
        });
        
        return window.options;
    } catch (e) {
        console.error('mergeWithExistingOptions error:', e);
        return window.options || {};
    }
}

// [CLAUDE FIX ALL-IN-ONE][options] フィルターUI更新
function refreshFiltersUI() {
    try {
        const collected = collectOptionsFromContacts();
        const merged = mergeWithExistingOptions(collected);
        
        // 種別フィルター
        const typeFilter = document.getElementById('typeFilter');
        if (typeFilter) {
            const currentValue = typeFilter.value;
            typeFilter.innerHTML = '<option value="">すべて</option>';
            (merged.types || []).forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                typeFilter.appendChild(option);
            });
            typeFilter.value = currentValue;
        }
        
        // 所属フィルター
        const affiliationFilter = document.getElementById('affiliationFilter');
        if (affiliationFilter) {
            const currentValue = affiliationFilter.value;
            affiliationFilter.innerHTML = '<option value="">すべて</option>';
            (merged.affiliations || []).forEach(affiliation => {
                const option = document.createElement('option');
                option.value = affiliation;
                option.textContent = affiliation;
                affiliationFilter.appendChild(option);
            });
            affiliationFilter.value = currentValue;
        }
        
        // 事業フィルター
        const businessFilter = document.getElementById('businessFilter');
        if (businessFilter) {
            const currentValue = businessFilter.value;
            businessFilter.innerHTML = '<option value="">すべて</option>';
            (merged.businesses || []).forEach(business => {
                const option = document.createElement('option');
                option.value = business;
                option.textContent = business;
                businessFilter.appendChild(option);
            });
            businessFilter.value = currentValue;
        }
        
        // 居住地フィルター
        const residenceFilter = document.getElementById('residenceFilter');
        if (residenceFilter) {
            const currentValue = residenceFilter.value;
            residenceFilter.innerHTML = '<option value="">すべて</option>';
            (merged.residences || []).forEach(residence => {
                const option = document.createElement('option');
                option.value = residence;
                option.textContent = residence;
                residenceFilter.appendChild(option);
            });
            residenceFilter.value = currentValue;
        }
        
    } catch (e) {
        console.error('refreshFiltersUI error:', e);
    }
}

// [CLAUDE FIX ALL-IN-ONE][filter] フィルター変更処理
function onFilterChange() {
    try {
        // フィルター値を収集
        currentFilters = {
            type: document.getElementById('typeFilter')?.value || '',
            affiliation: document.getElementById('affiliationFilter')?.value || '',
            business: document.getElementById('businessFilter')?.value || '',
            residence: document.getElementById('residenceFilter')?.value || ''
        };
        
        // フィルター適用
        filteredContacts = applyFilters(window.contacts || [], currentFilters);
        
        console.log(`[fix][filter] applied count=${filteredContacts.length}`);
        
        // UI更新
        renderContacts();
        
    } catch (e) {
        console.error('onFilterChange error:', e);
    }
}

// [CLAUDE FIX ALL-IN-ONE][avatar] 画像URL解決
function resolveAvatarUrl(contactId) {
    try {
        if (!contactId) return null;
        
        // data.20250925u.js の関数を使用
        if (window.resolveAttachmentUrl) {
            const url = window.resolveAttachmentUrl(contactId, 'avatar');
            if (url) {
                const sanitized = sanitizeUrl(url);
                if (sanitized) {
                    console.log(`[fix][avatar] resolved contactId=${contactId} url=${sanitized}`);
                    return sanitized;
                }
            }
        }
        
        console.warn(`[warn][avatar] could not resolve for contactId=${contactId}`);
        return null;
        
    } catch (e) {
        console.warn(`[warn][avatar] error resolving contactId=${contactId}:`, e);
        return null;
    }
}

// [CLAUDE FIX ALL-IN-ONE][avatar] 名刺画像URL解決
function resolveBusinessCardUrl(contactId) {
    try {
        if (!contactId) return null;
        
        if (window.resolveAttachmentUrl) {
            const url = window.resolveAttachmentUrl(contactId, 'businessCard');
            if (url) {
                const sanitized = sanitizeUrl(url);
                if (sanitized) {
                    console.log(`[fix][avatar] resolved business card contactId=${contactId} url=${sanitized}`);
                    return sanitized;
                }
            }
        }
        
        return null;
        
    } catch (e) {
        console.warn(`[warn][avatar] error resolving business card contactId=${contactId}:`, e);
        return null;
    }
}

// [CLAUDE FIX ALL-IN-ONE][avatar] 遅延画像読み込み
function setupLazyImageLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const contactId = img.dataset.contactId;
                    const imageType = img.dataset.imageType;
                    
                    let url = null;
                    if (imageType === 'avatar') {
                        url = resolveAvatarUrl(contactId);
                    } else if (imageType === 'businessCard') {
                        url = resolveBusinessCardUrl(contactId);
                    }
                    
                    if (url) {
                        img.src = url;
                        img.onerror = () => {
                            img.style.display = 'none';
                            const initials = img.nextElementSibling;
                            if (initials && initials.classList.contains('contact-initials')) {
                                initials.style.display = 'flex';
                            }
                        };
                    } else {
                        img.style.display = 'none';
                        const initials = img.nextElementSibling;
                        if (initials && initials.classList.contains('contact-initials')) {
                            initials.style.display = 'flex';
                        }
                    }
                    
                    observer.unobserve(img);
                }
            });
        });
        
        // 既存の画像に適用
        document.querySelectorAll('img[data-contact-id]').forEach(img => {
            imageObserver.observe(img);
        });
        
        // 新規画像用のオブザーバーをグローバルに公開
        window.contactImageObserver = imageObserver;
    }
}

// 連絡先詳細表示
function showContactDetail(contactId) {
    try {
        const contact = window.contacts.find(c => c.id === contactId);
        if (!contact) {
            console.error('Contact not found:', contactId);
            return;
        }
        
        const modal = document.getElementById('contactDetailModal');
        if (!modal) {
            console.error('Contact detail modal not found');
            return;
        }
        
        // モーダル内容を生成
        const modalContent = generateContactDetailHTML(contact);
        modal.querySelector('.modal-body').innerHTML = modalContent;
        
        // モーダル表示
        modal.style.display = 'block';
        
        // 画像の遅延読み込みを設定
        if (window.contactImageObserver) {
            modal.querySelectorAll('img[data-contact-id]').forEach(img => {
                window.contactImageObserver.observe(img);
            });
        }
        
        // 現在の連絡先IDを保存
        window.currentContactId = contactId;
        
    } catch (e) {
        console.error('showContactDetail error:', e);
    }
}

// 連絡先詳細HTML生成
function generateContactDetailHTML(contact) {
    try {
        const avatarImg = `<img data-contact-id="${contact.id}" data-image-type="avatar" style="display:none;" alt="avatar">`;
        const initialsDiv = `<div class="contact-initials">${toInitials(contact.name)}</div>`;
        
        const businessCardImg = contact.businessCard ? 
            `<img data-contact-id="${contact.id}" data-image-type="businessCard" style="max-width: 100%; cursor: pointer;" alt="business card" onclick="showImageModal(this.src)">` : '';
        
        return `
            <div class="contact-detail-header">
                <div class="contact-avatar-large">
                    ${avatarImg}
                    ${initialsDiv}
                </div>
                <div class="contact-basic-info">
                    <h3>${escapeHtml(contact.name || '')}</h3>
                    <p class="contact-company">${escapeHtml(contact.company || '')}</p>
                    <p class="contact-furigana">${escapeHtml(contact.furigana || '')}</p>
                </div>
            </div>
            <div class="contact-detail-body">
                <div class="detail-section">
                    <h4>基本情報</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>種別</label>
                            <span>${escapeHtml((contact.types || []).join(', '))}</span>
                        </div>
                        <div class="detail-item">
                            <label>所属</label>
                            <span>${escapeHtml((contact.affiliations || []).join(', '))}</span>
                        </div>
                        <div class="detail-item">
                            <label>事業内容</label>
                            <span>${escapeHtml(contact.business || '')}</span>
                        </div>
                        <div class="detail-item">
                            <label>居住地</label>
                            <span>${escapeHtml(contact.residence || '')}</span>
                        </div>
                    </div>
                </div>
                ${businessCardImg ? `<div class="detail-section">
                    <h4>名刺</h4>
                    ${businessCardImg}
                </div>` : ''}
                <div class="detail-section">
                    <h4>ミーティング履歴</h4>
                    <div id="contactMeetings"></div>
                </div>
            </div>
        `;
    } catch (e) {
        console.error('generateContactDetailHTML error:', e);
        return '<div class="error">詳細表示でエラーが発生しました</div>';
    }
}

// 連絡先保存
function saveContact(contact) {
    try {
        console.log('Saving contact:', contact.id);
        
        // [CLAUDE FIX ALL-IN-ONE][options] オプション更新（エラー回避）
        if (!window.options) {
            window.options = {};
        }
        
        // 種別
        if (contact.types && Array.isArray(contact.types)) {
            contact.types.forEach(type => updateOptionIfNew(window.options, 'types', type));
        }
        
        // 所属
        if (contact.affiliations && Array.isArray(contact.affiliations)) {
            contact.affiliations.forEach(aff => updateOptionIfNew(window.options, 'affiliations', aff));
        }
        
        // 事業
        if (contact.business) {
            updateOptionIfNew(window.options, 'businesses', contact.business);
        }
        
        // 居住地
        if (contact.residence) {
            updateOptionIfNew(window.options, 'residences', contact.residence);
        }
        
        // 連絡先を配列に保存/更新
        if (!window.contacts) {
            window.contacts = [];
        }
        
        const existingIndex = window.contacts.findIndex(c => c.id === contact.id);
        if (existingIndex >= 0) {
            window.contacts[existingIndex] = contact;
        } else {
            window.contacts.push(contact);
        }
        
        // Google Driveに保存
        if (window.saveContactToFolder) {
            return window.saveContactToFolder(contact).then(() => {
                console.log('Contact saved successfully');
                
                // フィルターUIを更新
                refreshFiltersUI();
                
                // 連絡先一覧を再描画
                renderContacts();
                
                showNotification('連絡先を保存しました', 'success');
            }).catch(e => {
                console.error('Save contact error:', e);
                showNotification('保存に失敗しました: ' + e.message, 'error');
                throw e;
            });
        } else {
            console.warn('saveContactToFolder function not available');
            showNotification('保存機能が利用できません', 'warning');
        }
        
    } catch (e) {
        console.error('saveContact error:', e);
        showNotification('保存エラー: ' + e.message, 'error');
        throw e;
    }
}

// 連絡先編集
function editContact(contactId) {
    try {
        const contact = window.contacts.find(c => c.id === contactId);
        if (!contact) {
            console.error('Contact not found for editing:', contactId);
            return;
        }
        
        // 編集モーダルを表示
        showContactEditModal(contact);
        
    } catch (e) {
        console.error('editContact error:', e);
    }
}

// 連絡先編集モーダル表示
function showContactEditModal(contact) {
    try {
        const modal = document.getElementById('contactEditModal');
        if (!modal) {
            console.error('Contact edit modal not found');
            return;
        }
        
        // [CLAUDE FIX ALL-IN-ONE][options] 編集フォームのオプション更新
        updateEditFormOptions();
        
        // フォームにデータを設定
        populateContactForm(contact);
        
        modal.style.display = 'block';
        
    } catch (e) {
        console.error('showContactEditModal error:', e);
    }
}

// [CLAUDE FIX ALL-IN-ONE][options] 編集フォームオプション更新
function updateEditFormOptions() {
    try {
        const collected = collectOptionsFromContacts();
        const merged = mergeWithExistingOptions(collected);
        
        // 種別オプション
        const typesSelect = document.getElementById('contactTypes');
        if (typesSelect) {
            updateSelectOptions(typesSelect, merged.types || []);
        }
        
        // 所属オプション
        const affiliationsSelect = document.getElementById('contactAffiliations');
        if (affiliationsSelect) {
            updateSelectOptions(affiliationsSelect, merged.affiliations || []);
        }
        
        // 事業オプション
        const businessSelect = document.getElementById('contactBusiness');
        if (businessSelect) {
            updateSelectOptions(businessSelect, merged.businesses || []);
        }
        
        // 居住地オプション
        const residenceSelect = document.getElementById('contactResidence');
        if (residenceSelect) {
            updateSelectOptions(residenceSelect, merged.residences || []);
        }
        
    } catch (e) {
        console.error('updateEditFormOptions error:', e);
    }
}

// セレクトボックスのオプション更新
function updateSelectOptions(selectElement, options) {
    try {
        if (!selectElement) return;
        
        const currentValue = selectElement.value;
        selectElement.innerHTML = '<option value="">選択してください</option>';
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            selectElement.appendChild(optionElement);
        });
        
        selectElement.value = currentValue;
        
    } catch (e) {
        console.error('updateSelectOptions error:', e);
    }
}

// 連絡先フォームデータ設定
function populateContactForm(contact) {
    try {
        const formFields = {
            'contactName': contact.name || '',
            'contactFurigana': contact.furigana || '',
            'contactCompany': contact.company || '',
            'contactBusiness': contact.business || '',
            'contactResidence': contact.residence || ''
        };
        
        Object.entries(formFields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value;
            }
        });
        
        // 複数選択フィールド
        if (contact.types && Array.isArray(contact.types)) {
            setMultiSelectValue('contactTypes', contact.types);
        }
        
        if (contact.affiliations && Array.isArray(contact.affiliations)) {
            setMultiSelectValue('contactAffiliations', contact.affiliations);
        }
        
    } catch (e) {
        console.error('populateContactForm error:', e);
    }
}

// 複数選択値設定
function setMultiSelectValue(fieldId, values) {
    try {
        const field = document.getElementById(fieldId);
        if (field && field.multiple) {
            Array.from(field.options).forEach(option => {
                option.selected = values.includes(option.value);
            });
        }
    } catch (e) {
        console.error('setMultiSelectValue error:', e);
    }
}

// [CLAUDE FIX ALL-IN-ONE] マルチセレクトドロップダウン（未定義エラー解消）
function toggleMultiSelectDropdown(fieldId) {
    try {
        const dropdown = document.getElementById(fieldId + 'Dropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    } catch (e) {
        console.error('toggleMultiSelectDropdown error:', e);
    }
}

// グローバル関数のエクスポート
window.collectOptionsFromContacts = collectOptionsFromContacts;
window.mergeWithExistingOptions = mergeWithExistingOptions;
window.refreshFiltersUI = refreshFiltersUI;
window.onFilterChange = onFilterChange;
window.resolveAvatarUrl = resolveAvatarUrl;
window.resolveBusinessCardUrl = resolveBusinessCardUrl;
window.setupLazyImageLoading = setupLazyImageLoading;
window.showContactDetail = showContactDetail;
window.saveContact = saveContact;
window.editContact = editContact;
window.toggleMultiSelectDropdown = toggleMultiSelectDropdown;

// DOMContentLoaded時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // 遅延画像読み込み設定
    setupLazyImageLoading();
    
    // フィルター変更イベント設定
    ['typeFilter', 'affiliationFilter', 'businessFilter', 'residenceFilter'].forEach(filterId => {
        const filterElement = document.getElementById(filterId);
        if (filterElement) {
            filterElement.addEventListener('change', debounce(onFilterChange, 200));
        }
    });
});