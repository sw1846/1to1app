// multiselect.js - 複数選択機能（種別・所属編集対応）

// グローバル状態
if (typeof window.selectedOptions === 'undefined') {
    window.selectedOptions = {
        type: [],
        affiliation: [],
        industryInterests: []
    };
}

if (typeof window.multiSelectSearchQueries === 'undefined') {
    window.multiSelectSearchQueries = {
        type: '',
        affiliation: '',
        industryInterests: ''
    };
}

/* [fix][multiselect] START (anchor:multiselect.js:toggleMultiSelectDropdown) */
// マルチセレクトドロップダウンの表示/非表示切り替え
function toggleMultiSelectDropdown(fieldName) {
    const dropdown = document.getElementById(fieldName + 'Dropdown');
    if (!dropdown) return;
    
    // 他のドロップダウンを閉じる
    document.querySelectorAll('.multi-select-dropdown').forEach(dd => {
        if (dd.id !== fieldName + 'Dropdown') {
            dd.classList.remove('show');
        }
    });
    
    // 対象のドロップダウンを切り替え
    dropdown.classList.toggle('show');
    
    // [fix][multiselect] ドロップダウンを開く時にオプションと追加UIを更新
    if (dropdown.classList.contains('show')) {
        updateMultiSelectOptions(fieldName);
        renderAddNewRow(fieldName);
    }
}
/* [fix][multiselect] END (anchor:multiselect.js:toggleMultiSelectDropdown) */

// マルチセレクトオプションの更新
function updateMultiSelectOptions(fieldName) {
    // 追加UI行を挿入
    if(fieldName){ renderAddNewRow(fieldName); }
    if (!fieldName) {
        // 全てのフィールドを更新
        updateMultiSelectOptions('type');
        updateMultiSelectOptions('affiliation');
        updateMultiSelectOptions('industryInterests');
        return;
    }
    
    const optionsContainer = document.getElementById(fieldName + 'Options');
    if (!optionsContainer) return;
    
    const availableOptions = getAvailableOptions(fieldName);
    const selectedItems = window.selectedOptions[fieldName] || [];
    
    optionsContainer.innerHTML = '';
    
    // 検索結果表示
    const searchQuery = (window.multiSelectSearchQueries[fieldName] || '').toLowerCase();
    const filteredOptions = availableOptions.filter(option => 
        option.toLowerCase().includes(searchQuery)
    );
    
    if (filteredOptions.length === 0) {
        optionsContainer.innerHTML = '<div class="multi-select-no-results">該当するオプションがありません</div>';
        return;
    }
    
    filteredOptions.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'multi-select-option';
        
        const isSelected = selectedItems.includes(option);
        optionDiv.innerHTML = `
            <input type="checkbox" ${isSelected ? 'checked' : ''} 
                   onchange="toggleMultiSelectOption('${fieldName}', '${escapeHtml(option)}', this.checked)">
            <span>${escapeHtml(option)}</span>
        `;
        
        optionsContainer.appendChild(optionDiv);
    });
}

// 利用可能なオプションを取得
function getAvailableOptions(fieldName) {
    const baseOptions = (window.options && window.options[fieldName]) ? window.options[fieldName] : [];
    
    // 既存の連絡先データから値を収集
    const usedValues = new Set();
    if (Array.isArray(window.contacts)) {
        window.contacts.forEach(contact => {
            const values = contact[fieldName] || contact[fieldName + 's'] || [];
            if (Array.isArray(values)) {
                values.forEach(value => {
                    if (value && typeof value === 'string') {
                        usedValues.add(value.trim());
                    }
                });
            }
        });
    }
    
    // ベースオプションと使用済み値をマージ
    const allOptions = new Set([...baseOptions, ...usedValues]);
    return Array.from(allOptions).filter(Boolean).sort();
}

// マルチセレクトオプションの選択/選択解除
function toggleMultiSelectOption(fieldName, option, isSelected) {
    if (!window.selectedOptions[fieldName]) {
        window.selectedOptions[fieldName] = [];
    }
    
    const selectedItems = window.selectedOptions[fieldName];
    const index = selectedItems.indexOf(option);
    
    if (isSelected && index === -1) {
        selectedItems.push(option);
    } else if (!isSelected && index !== -1) {
        selectedItems.splice(index, 1);
    }
    
    // タグ表示を更新
    updateMultiSelectTags(fieldName);
    
    // オプションを新規追加した場合はマスタに追加
    if (isSelected && typeof updateOptionIfNew === 'function') {
        updateOptionIfNew(fieldName, option);
    }
}

// マルチセレクトタグの表示更新
function updateMultiSelectTags(fieldName) {
    const tagsContainer = document.getElementById(fieldName + 'Tags');
    if (!tagsContainer) return;
    
    const selectedItems = window.selectedOptions[fieldName] || [];
    
    if (selectedItems.length === 0) {
        tagsContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.875rem;">選択してください...</span>';
        return;
    }
    
    tagsContainer.innerHTML = selectedItems.map(item => `
        <div class="multi-select-tag">
            <span>${escapeHtml(item)}</span>
            <button type="button" onclick="removeMultiSelectTag('${fieldName}', '${escapeHtml(item)}')">&times;</button>
        </div>
    `).join('');
}

// マルチセレクトタグの削除
function removeMultiSelectTag(fieldName, option) {
    const selectedItems = window.selectedOptions[fieldName] || [];
    const index = selectedItems.indexOf(option);
    
    if (index !== -1) {
        selectedItems.splice(index, 1);
        updateMultiSelectTags(fieldName);
        
        // ドロップダウンが開いている場合はオプションも更新
        const dropdown = document.getElementById(fieldName + 'Dropdown');
        if (dropdown && dropdown.classList.contains('show')) {
            updateMultiSelectOptions(fieldName);
        }
    }
}

// マルチセレクトオプションのフィルタリング
function filterMultiSelectOptions(fieldName, query) {
    window.multiSelectSearchQueries[fieldName] = query;
    updateMultiSelectOptions(fieldName);
}

// セットアップ関数
function setupMultiSelect() {
    // 初期オプションを設定
    updateMultiSelectOptions();
    renderAddNewRow('type');
    renderAddNewRow('affiliation');
    renderAddNewRow('industryInterests');
    
    // 初期タグ表示を更新
    updateMultiSelectTags('type');
    updateMultiSelectTags('affiliation');
    updateMultiSelectTags('industryInterests');
    
    // 外部クリックでドロップダウンを閉じる
    document.addEventListener('click', function(event) {
        const target = event.target;
        const isMultiSelectElement = target.closest('.multi-select-container');
        
        if (!isMultiSelectElement) {
            document.querySelectorAll('.multi-select-dropdown').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        }
    });
}

// メール入力の追加/削除
function addEmailInput(value = '') {
    const container = document.getElementById('emailContainer');
    if (!container) return;
    
    const inputDiv = document.createElement('div');
    inputDiv.className = 'multi-input-item';
    inputDiv.innerHTML = `
        <input type="email" class="form-input" placeholder="メールアドレス" value="${escapeHtml(value)}">
        <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">削除</button>
    `;
    container.appendChild(inputDiv);
}

// 電話番号入力の追加/削除
function addPhoneInput(value = '') {
    const container = document.getElementById('phoneContainer');
    if (!container) return;
    
    const inputDiv = document.createElement('div');
    inputDiv.className = 'multi-input-item';
    inputDiv.innerHTML = `
        <input type="tel" class="form-input" placeholder="電話番号" value="${escapeHtml(value)}">
        <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">削除</button>
    `;
    container.appendChild(inputDiv);
}

// 事業内容入力の追加/削除
function addBusinessInput(value = '') {
    const container = document.getElementById('businessContainer');
    if (!container) return;
    
    const inputDiv = document.createElement('div');
    inputDiv.className = 'multi-input-item';
    inputDiv.innerHTML = `
        <input type="text" class="form-input" placeholder="事業内容" value="${escapeHtml(value)}">
        <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">削除</button>
    `;
    container.appendChild(inputDiv);
}

// 複数入力値の取得
function getMultiInputValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    const inputs = container.querySelectorAll('input');
    return Array.from(inputs)
        .map(input => input.value.trim())
        .filter(value => value !== '');
}

// 接触方法の変更処理
function handleContactMethodChange() {
    const directRadio = document.getElementById('contactMethodDirect');
    const referralRadio = document.getElementById('contactMethodReferral');
    const directSection = document.getElementById('directContactSection');
    const referralSection = document.getElementById('referralContactSection');
    
    if (!directRadio || !referralRadio) return;
    
    const isDirect = directRadio.checked;
    
    if (directSection) {
        directSection.style.display = isDirect ? 'block' : 'none';
    }
    if (referralSection) {
        referralSection.style.display = isDirect ? 'none' : 'block';
    }
    
    // 紹介者の自動補完を設定
    if (!isDirect) {
        setupReferrerAutocomplete();
    }
}

// 紹介者自動補完の設定
function setupReferrerAutocomplete() {
    const input = document.getElementById('referrerInput');
    const dropdown = document.getElementById('referrerDropdown');
    
    if (!input || !dropdown) return;
    
    input.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        
        if (query.length < 1) {
            dropdown.style.display = 'none';
            return;
        }
        
        const matches = (window.contacts || [])
            .filter(contact => contact.name && contact.name.toLowerCase().includes(query))
            .slice(0, 10);
        
        if (matches.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        dropdown.innerHTML = matches.map(contact => `
            <div class="autocomplete-item" onclick="selectReferrer('${escapeHtml(contact.name)}')">
                ${escapeHtml(contact.name)}${contact.company ? ` (${escapeHtml(contact.company)})` : ''}
            </div>
        `).join('');
        
        dropdown.style.display = 'block';
    });
    
    // 外部クリックで閉じる
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.autocomplete-container')) {
            dropdown.style.display = 'none';
        }
    });
}

// 紹介者選択
function selectReferrer(name) {
    const input = document.getElementById('referrerInput');
    const dropdown = document.getElementById('referrerDropdown');
    
    if (input) input.value = name;
    if (dropdown) dropdown.style.display = 'none';
}

// Markdownエディタのビュー切り替え
function switchMarkdownView(fieldName, view) {
    const textarea = document.getElementById(fieldName + 'Input');
    const preview = document.getElementById(fieldName + 'Preview');
    const editTab = document.querySelector(`[onclick*="switchMarkdownView('${fieldName}', 'edit')"]`);
    const previewTab = document.querySelector(`[onclick*="switchMarkdownView('${fieldName}', 'preview')"]`);
    
    if (!textarea || !preview) return;
    
    if (view === 'edit') {
        textarea.style.display = 'block';
        preview.style.display = 'none';
        if (editTab) editTab.classList.add('active');
        if (previewTab) previewTab.classList.remove('active');
    } else {
        textarea.style.display = 'none';
        preview.style.display = 'block';
        if (editTab) editTab.classList.remove('active');
        if (previewTab) previewTab.classList.add('active');
        
        // プレビューを更新
        const content = textarea.value;
        if (typeof renderMarkdown === 'function') {
            preview.innerHTML = renderMarkdown(content);
        } else {
            preview.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
        }
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    // 接触方法の変更イベントを設定
    const directRadio = document.getElementById('contactMethodDirect');
    const referralRadio = document.getElementById('contactMethodReferral');
    
    if (directRadio) {
        directRadio.addEventListener('change', handleContactMethodChange);
    }
    if (referralRadio) {
        referralRadio.addEventListener('change', handleContactMethodChange);
    }
    
    // 初期状態を設定
    handleContactMethodChange();
    
    // マルチセレクトを初期化
    setupMultiSelect();
});

// グローバル関数として公開
window.toggleMultiSelectDropdown = toggleMultiSelectDropdown;
window.updateMultiSelectOptions = updateMultiSelectOptions;
window.toggleMultiSelectOption = toggleMultiSelectOption;
window.updateMultiSelectTags = updateMultiSelectTags;
window.removeMultiSelectTag = removeMultiSelectTag;
window.filterMultiSelectOptions = filterMultiSelectOptions;
window.setupMultiSelect = setupMultiSelect;
window.addEmailInput = addEmailInput;
window.addPhoneInput = addPhoneInput;
window.addBusinessInput = addBusinessInput;
window.getMultiInputValues = getMultiInputValues;
window.handleContactMethodChange = handleContactMethodChange;
window.setupReferrerAutocomplete = setupReferrerAutocomplete;
window.selectReferrer = selectReferrer;
window.switchMarkdownView = switchMarkdownView;

/* [fix][multiselect] START (anchor:multiselect.js:renderAddNewRow) */
// --- Add-New row (input + button) just under search ---
function renderAddNewRow(fieldName) {
    const dropdown = document.getElementById(fieldName + 'Dropdown');
    if (!dropdown) return;
    
    // [fix][multiselect] 既存の追加UIを削除（再描画のため）
    const existing = dropdown.querySelector('.multi-select-addnew');
    if (existing) {
        existing.remove();
    }
    
    const searchBox = dropdown.querySelector('.multi-select-search');
    const addDiv = document.createElement('div');
    addDiv.className = 'multi-select-addnew';
    addDiv.style.cssText = 'display: flex; gap: 0.5rem; padding: 0.4rem 0.6rem; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);';
    addDiv.innerHTML = `
        <input type="text" class="form-input" placeholder="新規値を追加..." style="flex:1; padding: 0.375rem 0.5rem; font-size: 0.875rem;" id="${fieldName}AddInput">
        <button type="button" class="btn btn-sm btn-primary" id="${fieldName}AddBtn" style="white-space: nowrap;">➕ 追加</button>
    `;
    
    // [fix][multiselect] 検索ボックスの直後に挿入
    if (searchBox && searchBox.parentNode) {
        searchBox.parentNode.insertBefore(addDiv, searchBox.nextSibling);
    } else {
        dropdown.prepend(addDiv);
    }
    
    const btn = addDiv.querySelector('#' + fieldName + 'AddBtn');
    const input = addDiv.querySelector('#' + fieldName + 'AddInput');
    
    // [fix][multiselect] ボタンクリックで追加
    btn.addEventListener('click', function(){
        const value = (input.value || '').trim();
        if(value){
            addNewOption(fieldName, value);
            input.value = '';
            input.focus();
        }
    });
    
    // [fix][multiselect] Enterキーでも追加
    input.addEventListener('keydown', function(e){
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = (input.value || '').trim();
            if(value){
                addNewOption(fieldName, value);
                input.value = '';
            }
        }
    });
}
/* [fix][multiselect] END (anchor:multiselect.js:renderAddNewRow) */

/* [fix][multiselect] START (anchor:multiselect.js:addNewOption) */
// --- Persist new taxonomy option ---
async function addNewOption(fieldName, value) {
    try{
        if(!value){ notify('値を入力してください'); return; }
        
        // [fix][multiselect] 正規化（全角/半角・大文字小文字）
        let normalizedValue = value.trim();
        if (typeof normalizeString === 'function') {
            try {
                normalizedValue = normalizeString(value);
            } catch (e) {
                console.warn('[multiselect] normalizeString failed', e);
            }
        }
        
        if(!normalizedValue){ notify('値が無効です'); return; }

        // window.options を準備
        if (!window.options || typeof window.options !== 'object') window.options = {};
        const optionKey = (fieldName === 'industryInterests') ? 'industryInterests'
                        : (fieldName === 'affiliation') ? 'affiliations'
                        : (fieldName === 'type') ? 'types' : fieldName;
        if (!Array.isArray(window.options[optionKey])) {
            window.options[optionKey] = [];
        }

        // [fix][multiselect] 重複（正規化ベース）をチェック
        const existingNormalized = window.options[optionKey].map(item => {
            if (typeof normalizeString === 'function') {
                try {
                    return normalizeString(item);
                } catch (e) {
                    return String(item || '').toLowerCase().trim();
                }
            }
            return String(item || '').toLowerCase().trim();
        });
        
        if (existingNormalized.includes(normalizedValue.toLowerCase())) {
            notify('既に存在します'); 
            return;
        }

        // 追加
        window.options[optionKey].push(value.trim());
        
        // [fix][multiselect] ソート（日本語対応）
        if (typeof uniqueSortedJa === 'function') {
            window.options[optionKey] = uniqueSortedJa(window.options[optionKey]);
        } else {
            window.options[optionKey] = Array.from(new Set(window.options[optionKey])).sort((a, b) => 
                a.localeCompare(b, 'ja')
            );
        }
        
        console.log(`[multiselect] added "${value}" to ${optionKey}`);

        // [fix][multiselect] メタデータへ永続化
        if (window.folderStructure && typeof AppData === 'object' && typeof AppData.saveOptionsToMetadata === 'function') {
            try {
                await AppData.saveOptionsToMetadata(window.folderStructure, window.options);
                console.log('[multiselect] saved to metadata.json');
                notify(`「${value.trim()}」を追加しました`);
            } catch (err) {
                console.warn('[multiselect] save failed', err);
                notify('保存に失敗しました');
            }
        } else {
            console.warn('[multiselect] saveOptionsToMetadata not available');
            notify(`「${value.trim()}」を追加しました（ローカルのみ）`);
        }

        // [fix][multiselect] UI即時反映
        updateMultiSelectOptions(fieldName);
        if (typeof updateFilters === 'function') {
            updateFilters();
        }
    }catch(e){
        console.error('[multiselect] addNewOption error', e);
        notify('エラーが発生しました');
    }
}
/* [fix][multiselect] END (anchor:multiselect.js:addNewOption) */

/* [fix][multiselect] START (anchor:multiselect.js:notify) */
/** fallback notify */
function notify(msg){
    try{
        // [fix][multiselect] showNotification を優先使用
        if (typeof window.showNotification === 'function') { 
            window.showNotification(String(msg), 'info'); 
        } else if (typeof window.showToast === 'function') { 
            window.showToast(String(msg)); 
        } else { 
            console.log('[multiselect]', String(msg)); 
        }
    }catch(e){ 
        console.log('[multiselect]', String(msg)); 
    }
}
/* [fix][multiselect] END (anchor:multiselect.js:notify) */

/* [fix][multiselect-add] expose for late mounts */
window.renderAddNewRow = renderAddNewRow;