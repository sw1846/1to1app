// ===== モーダル関連機能 =====

// モーダルを閉じる
function closeModal(modalId) {
    if (modalId === 'meetingFormModal' && hasUnsavedDraft) {
        if (!confirm('保存されていない下書きがあります。閉じてもよろしいですか？')) {
            return;
        }
    }
    
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    if (draftSaveTimer) {
        clearTimeout(draftSaveTimer);
        draftSaveTimer = null;
    }
    
    // 連絡先フォームを閉じた場合のみcurrentEditingContactIdをクリア
    if (modalId === 'contactFormModal') {
        console.log('連絡先フォームを閉じました');
        currentEditingContactId = null;
    }
}

// フォームリセット
function resetContactForm() {
    console.log('=== フォームリセット開始 ===');
    
    document.getElementById('contactForm').reset();
    document.getElementById('photoPreview').innerHTML = '';
    document.getElementById('cardImagePreview').innerHTML = '';
    document.getElementById('existingAttachments').innerHTML = '';
    document.getElementById('newAttachments').innerHTML = '';
    currentPhotoFile = null;
    currentCardImageFile = null;
    selectedFiles = [];
    deletedAttachments = [];
    
    ['types', 'affiliations', 'wantToConnect', 'goldenEgg'].forEach(field => {
        const dropdown = document.getElementById(`${field}-dropdown`);
        if (dropdown) {
            const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            
            const display = dropdown.previousElementSibling;
            if (display) {
                display.innerHTML = '<span style="color: #aaaaaa;">選択してください</span>';
            }
        }
    });
    
    selectedFirstMeetingFiles = [];
    document.getElementById('firstMeetingSection').style.display = 'none';
    document.getElementById('firstMeetingTaskContainer').innerHTML = '';
    document.getElementById('firstMeetingAttachments').innerHTML = '';
    
    console.log('フォームリセット完了');
}

function resetMeetingForm() {
    document.getElementById('meetingForm').reset();
    document.getElementById('existingMeetingAttachments').innerHTML = '';
    document.getElementById('newMeetingAttachments').innerHTML = '';
    document.getElementById('taskInputContainer').innerHTML = '';
    selectedMeetingFiles = [];
    deletedMeetingAttachments = [];
    hasUnsavedDraft = false;
}

// マルチセレクト設定
function setupMultiSelect() {
    ['types', 'affiliations', 'wantToConnect', 'goldenEgg'].forEach(field => {
        const sorted = [...dropdownOptions[field]].sort((a, b) => a.localeCompare(b, 'ja'));
        updateMultiSelectOptions(field, sorted);
    });
}

// マルチセレクトオプション更新（インクリメンタルサーチ付き）
function updateMultiSelectOptions(field, options) {
    const dropdown = document.getElementById(`${field}-dropdown`);
    const selectedValues = getSelectedValues(field);
    
    // 検索バーとオプションリストを含むHTML
    dropdown.innerHTML = `
        <div class="multi-select-search" onclick="event.stopPropagation();">
            <input type="text" placeholder="検索..." onkeyup="filterMultiSelectOptions('${field}', this.value)" onclick="event.stopPropagation();">
        </div>
        <div class="multi-select-options-list" id="${field}-options-list">
            ${renderMultiSelectOptions(field, options, selectedValues)}
        </div>
    `;
    
    // 検索バーのスタイルを追加
    const style = document.createElement('style');
    if (!document.querySelector('#multiSelectStyles')) {
        style.id = 'multiSelectStyles';
        style.textContent = `
            .multi-select-search {
                padding: 8px;
                border-bottom: 1px solid #444444;
                position: sticky;
                top: 0;
                background: #333333;
                z-index: 1;
            }
            .multi-select-search input {
                width: 100%;
                padding: 6px 10px;
                font-size: 13px;
                border: 1px solid #444444;
                border-radius: 4px;
                background: #2a2a2a;
                color: #f0f0f0;
            }
            .multi-select-options-list {
                max-height: 250px;
                overflow-y: auto;
            }
        `;
        document.head.appendChild(style);
    }
}

// マルチセレクトオプションをレンダリング
function renderMultiSelectOptions(field, options, selectedValues) {
    // 昇順でソート
    const sortedOptions = [...options].sort((a, b) => a.localeCompare(b, 'ja'));
    
    return sortedOptions.map(option => `
        <div class="multi-select-option" onclick="toggleOption('${field}', '${escapeHtml(option)}')">
            <input type="checkbox" ${selectedValues.includes(option) ? 'checked' : ''}>
            <span>${escapeHtml(option)}</span>
        </div>
    `).join('') + `
        <div class="multi-select-option" onclick="addNewOption('${field}')">
            <span style="color: #4c8bf5;">+ 新しい項目を追加</span>
        </div>
    `;
}

// マルチセレクトオプションをフィルタリング
function filterMultiSelectOptions(field, searchQuery) {
    const dropdown = document.getElementById(`${field}-dropdown`);
    const optionsList = dropdown.querySelector(`#${field}-options-list`);
    const selectedValues = getSelectedValues(field);
    
    if (!searchQuery) {
        // 検索クエリが空の場合は全オプションを表示
        optionsList.innerHTML = renderMultiSelectOptions(field, dropdownOptions[field], selectedValues);
        return;
    }
    
    // 検索クエリにマッチするオプションのみ表示
    const filteredOptions = dropdownOptions[field].filter(option => 
        option.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    optionsList.innerHTML = renderMultiSelectOptions(field, filteredOptions, selectedValues);
}

// マルチセレクトトグル
function toggleMultiSelect(field) {
    const dropdown = document.getElementById(`${field}-dropdown`);
    const allDropdowns = document.querySelectorAll('.multi-select-dropdown');
    
    allDropdowns.forEach(d => {
        if (d !== dropdown) d.classList.remove('show');
    });
    
    dropdown.classList.toggle('show');
    
    // ドロップダウンを開いた時、検索フィールドにフォーカス
    if (dropdown.classList.contains('show')) {
        const searchInput = dropdown.querySelector('input[type="text"]');
        if (searchInput) {
            searchInput.focus();
        }
    }
}

// オプショントグル
function toggleOption(field, value) {
    console.log(`toggleOption(${field}, ${value})`);
    
    const checkbox = event.target.querySelector('input[type="checkbox"]') || 
                    (event.target.tagName === 'INPUT' ? event.target : null);
    
    if (checkbox && event.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
    }
    
    updateMultiSelectDisplay(field);
}

// 選択値取得
function getSelectedValues(field) {
    const dropdown = document.getElementById(`${field}-dropdown`);
    if (!dropdown) {
        console.warn(`ドロップダウンが見つかりません: ${field}`);
        return [];
    }
    
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:checked');
    const values = Array.from(checkboxes).map(cb => {
        const span = cb.parentElement.querySelector('span');
        return span ? span.textContent : '';
    }).filter(v => v && v !== '+ 新しい項目を追加');
    
    console.log(`getSelectedValues(${field}):`, values);
    return values;
}

// 選択値設定
function setSelectedValues(field, values) {
    console.log(`setSelectedValues(${field}, ${JSON.stringify(values)})`);
    
    const dropdown = document.getElementById(`${field}-dropdown`);
    if (!dropdown) {
        console.error(`ドロップダウンが見つかりません: ${field}`);
        return;
    }
    
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        const span = cb.parentElement.querySelector('span');
        if (span) {
            const value = span.textContent;
            cb.checked = values.includes(value);
        }
    });
    updateMultiSelectDisplay(field);
}

// マルチセレクト表示更新
function updateMultiSelectDisplay(field) {
    const display = document.querySelector(`#${field}-dropdown`).previousElementSibling;
    const selected = getSelectedValues(field);
    
    if (selected.length === 0) {
        display.innerHTML = '<span style="color: #aaaaaa;">選択してください</span>';
    } else {
        display.innerHTML = selected.map(value => 
            `<span class="selected-tag">${escapeHtml(value)}<span class="remove" onclick="removeSelectedValue('${field}', '${escapeHtml(value).replace(/'/g, "\\'")}')">&times;</span></span>`
        ).join('');
    }
}

// 選択値削除
function removeSelectedValue(field, value) {
    event.stopPropagation();
    const checkbox = Array.from(document.querySelectorAll(`#${field}-dropdown input[type="checkbox"]`))
        .find(cb => {
            const span = cb.parentElement.querySelector('span');
            return span && span.textContent === value;
        });
    if (checkbox) {
        checkbox.checked = false;
        updateMultiSelectDisplay(field);
    }
}

// 新規オプション追加
async function addNewOption(field) {
    event.stopPropagation();
    const newValue = prompt('新しい項目を入力してください:');
    if (newValue && newValue.trim()) {
        const trimmedValue = newValue.trim();
        if (!dropdownOptions[field].includes(trimmedValue)) {
            dropdownOptions[field].push(trimmedValue);
            dropdownOptions[field].sort((a, b) => a.localeCompare(b, 'ja'));
            updateMultiSelectOptions(field, dropdownOptions[field]);
            updateDropdownOptions();
            await saveData();
        }
    }
}

// インクリメンタルサーチ付きセレクトクラス
class SearchableSelect {
    constructor(wrapper, options, value = '', onChange = null) {
        this.wrapper = typeof wrapper === 'string' ? document.getElementById(wrapper) : wrapper;
        this.options = options;
        this.value = value;
        this.onChange = onChange;
        this.filteredOptions = [...options];
        this.init();
    }

    init() {
        this.wrapper.innerHTML = `
            <div class="searchable-select-input" onclick="event.stopPropagation()">
                ${this.value || 'すべて'}
            </div>
            <div class="searchable-select-dropdown">
                <div class="searchable-select-search">
                    <input type="text" placeholder="検索..." onclick="event.stopPropagation()">
                </div>
                <div class="searchable-select-options"></div>
            </div>
        `;

        this.input = this.wrapper.querySelector('.searchable-select-input');
        this.dropdown = this.wrapper.querySelector('.searchable-select-dropdown');
        this.searchInput = this.wrapper.querySelector('.searchable-select-search input');
        this.optionsContainer = this.wrapper.querySelector('.searchable-select-options');

        this.input.addEventListener('click', () => this.toggle());
        this.searchInput.addEventListener('input', (e) => this.filter(e.target.value));
        
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.close();
            }
        });

        this.renderOptions();
    }

    toggle() {
        if (this.dropdown.classList.contains('show')) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.dropdown.classList.add('show');
        this.searchInput.focus();
        this.searchInput.value = '';
        this.filter('');
    }

    close() {
        this.dropdown.classList.remove('show');
    }

    filter(query) {
        this.filteredOptions = this.options.filter(option => 
            option.toLowerCase().includes(query.toLowerCase())
        );
        this.renderOptions();
    }

    renderOptions() {
        // 昇順でソート
        const sortedOptions = [...this.filteredOptions].sort((a, b) => a.localeCompare(b, 'ja'));
        
        this.optionsContainer.innerHTML = `
            <div class="searchable-select-option ${!this.value ? 'selected' : ''}" data-value="">
                すべて
            </div>
            ${sortedOptions.map(option => `
                <div class="searchable-select-option ${this.value === option ? 'selected' : ''}" data-value="${escapeHtml(option)}">
                    ${escapeHtml(option)}
                </div>
            `).join('')}
        `;

        this.optionsContainer.querySelectorAll('.searchable-select-option').forEach(option => {
            option.addEventListener('click', () => {
                this.setValue(option.dataset.value);
                this.close();
            });
        });
    }

    setValue(value) {
        this.value = value;
        this.input.textContent = value || 'すべて';
        if (this.onChange) {
            this.onChange(value);
        }
    }

    getValue() {
        return this.value;
    }
}