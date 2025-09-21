// main.js - 初期化とイベントハンドラ

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    initializeEventListeners();
    await loadSavedDirectory();
    initializeTheme();
});

// イベントリスナーの初期化
function initializeEventListeners() {
    // テーマ切替
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // フォルダ選択
    document.getElementById('selectFolderBtn').addEventListener('click', selectDirectory);

    // 連絡先追加
    document.getElementById('addContactBtn').addEventListener('click', () => openContactModal());

    // エクスポート・インポート
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    document.getElementById('importBtn').addEventListener('click', importFromCSV);

    // データマージボタン
    document.getElementById('mergeDataBtn').addEventListener('click', mergeOldData);

    // タブ切替
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    // 表示切替
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchView(e.target.dataset.view));
    });

    // 検索・ソート
    document.getElementById('searchInput').addEventListener('input', filterContacts);
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderContacts();
    });

    // フィルター
    document.getElementById('typeFilter').addEventListener('change', filterContacts);
    document.getElementById('affiliationFilter').addEventListener('input', (e) => {
        filterValues.affiliation = e.target.value;
        filterContacts();
    });
    document.getElementById('businessFilter').addEventListener('input', (e) => {
        filterValues.business = e.target.value;
        filterContacts();
    });
    document.getElementById('industryInterestsFilter').addEventListener('input', (e) => {
        filterValues.industryInterests = e.target.value;
        filterContacts();
    });
    document.getElementById('residenceFilter').addEventListener('input', (e) => {
        filterValues.residence = e.target.value;
        filterContacts();
    });

    // ドロップゾーン
    setupDropZone('photoDropZone', 'photo', true);
    setupDropZone('businessCardDropZone', 'businessCard', true);
    setupDropZone('attachmentDropZone', 'attachmentList', false);
    setupDropZone('meetingAttachmentDropZone', 'meetingAttachmentList', false);

    // 複数選択の設定
    setupMultiSelect();
    setupReferrerAutocomplete();

    // Markdownエディタの設定
    setupMarkdownEditors();

    // モーダル外クリックで閉じる
    setupModalClose();

    // 接触方法の切り替え
    document.getElementById('contactMethodDirect').addEventListener('change', handleContactMethodChange);
    document.getElementById('contactMethodReferral').addEventListener('change', handleContactMethodChange);

    // キーボードショートカット
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveAllData();
        }
    });

    // 複数選択の外側クリックで閉じる
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multi-select-container')) {
            document.querySelectorAll('.multi-select-dropdown').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        }
    });
}

// テーマ管理
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    document.getElementById('themeIcon').textContent = theme === 'light' ? '🌙' : '☀️';
}

// Markdownエディタの設定
function setupMarkdownEditors() {
    document.querySelectorAll('.markdown-editor-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const field = tab.dataset.field;
            const view = tab.dataset.view;
            switchMarkdownView(field, view);
        });
    });

    const markdownFields = ['business', 'strengths', 'approach', 'history', 'priorInfo'];
    markdownFields.forEach(field => {
        const textarea = document.getElementById(field + 'Input');
        if (textarea) {
            textarea.addEventListener('input', () => {
                updateMarkdownPreview(field);
            });
        }
    });
}

function switchMarkdownView(field, view) {
    const tabs = document.querySelectorAll(`.markdown-editor-tab[data-field="${field}"]`);
    const textarea = document.getElementById(field + 'Input');
    const preview = document.getElementById(field + 'Preview');

    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === view);
    });

    if (view === 'edit') {
        textarea.style.display = 'block';
        preview.style.display = 'none';
    } else {
        textarea.style.display = 'none';
        preview.style.display = 'block';
        updateMarkdownPreview(field);
    }
}

function updateMarkdownPreview(field) {
    const textarea = document.getElementById(field + 'Input');
    const preview = document.getElementById(field + 'Preview');
    if (textarea && preview) {
        preview.innerHTML = renderMarkdown(textarea.value);
    }
}

// モーダル外クリックで閉じる
function setupModalClose() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('mousedown', (e) => {
            modalMouseDownTarget = e.target;
        });
        
        modal.addEventListener('mouseup', (e) => {
            if (e.target === modal && modalMouseDownTarget === modal) {
                modal.classList.remove('active');
            }
            modalMouseDownTarget = null;
        });
    });
}

// 接触方法の切り替え処理
function handleContactMethodChange() {
    const isDirect = document.getElementById('contactMethodDirect').checked;
    document.getElementById('contactMethodDirectInput').style.display = isDirect ? 'block' : 'none';
    document.getElementById('contactMethodReferralInput').style.display = !isDirect ? 'block' : 'none';
}

// ドロップゾーン設定
function setupDropZone(dropZoneId, targetType, isImage) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    if (isImage) {
        fileInput.accept = 'image/*';
    }
    
    dropZone.appendChild(fileInput);

    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files, targetType, isImage);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files, targetType, isImage);
    });
}

async function handleFiles(files, targetType, isImage) {
    if (files.length === 0) return;

    if (isImage) {
        const file = files[0];
        if (!file.type.startsWith('image/')) {
            showNotification('画像ファイルを選択してください', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            if (targetType === 'photo') {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const size = 300;
                    canvas.width = size;
                    canvas.height = size;
                    
                    const scale = Math.min(size / img.width, size / img.height);
                    const x = (size - img.width * scale) / 2;
                    const y = (size - img.height * scale) / 2;
                    
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                    
                    const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const preview = document.getElementById('photoPreview');
                    const container = document.getElementById('photoPreviewContainer');
                    preview.src = resizedDataUrl;
                    container.style.display = 'block';
                };
                img.src = e.target.result;
            } else if (targetType === 'businessCard') {
                const preview = document.getElementById('businessCardPreview');
                const container = document.getElementById('businessCardPreviewContainer');
                preview.src = e.target.result;
                container.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    } else {
        const fileList = document.getElementById(targetType);
        const contactName = document.getElementById('nameInput')?.value || currentContactId ? contacts.find(c => c.id === currentContactId)?.name : '未設定';
        
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const renamedFileName = `${contactName}_${file.name}`;
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    📎 <span>${escapeHtml(renamedFileName)}</span>
                    <button class="btn btn-icon" onclick="this.parentElement.remove()">✕</button>
                `;
                fileItem.dataset.fileName = renamedFileName;
                fileItem.dataset.fileData = e.target.result;
                fileItem.dataset.fileType = file.type;
                fileItem.dataset.filePath = '';
                fileList.appendChild(fileItem);
            };
            reader.readAsDataURL(file);
        });
    }
}

// 複数入力フィールド
function addEmailInput(value = '') {
    const container = document.getElementById('emailContainer');
    const item = document.createElement('div');
    item.className = 'multi-input-item';
    item.innerHTML = `
        <input type="email" class="form-input" placeholder="メールアドレス" value="${escapeHtml(value)}">
        ${container.children.length > 0 ? '<button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">✕</button>' : '<button type="button" class="btn btn-primary" onclick="addEmailInput()">➕</button>'}
    `;
    container.appendChild(item);
}

function addPhoneInput(value = '') {
    const container = document.getElementById('phoneContainer');
    const item = document.createElement('div');
    item.className = 'multi-input-item';
    item.innerHTML = `
        <input type="tel" class="form-input" placeholder="電話番号" value="${escapeHtml(value)}">
        ${container.children.length > 0 ? '<button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">✕</button>' : '<button type="button" class="btn btn-primary" onclick="addPhoneInput()">➕</button>'}
    `;
    container.appendChild(item);
}

function addBusinessInput(value = '') {
    const container = document.getElementById('businessContainer');
    const item = document.createElement('div');
    item.className = 'multi-input-item';
    item.innerHTML = `
        <input type="text" class="form-input" placeholder="事業内容" value="${escapeHtml(value)}">
        ${container.children.length > 0 ? '<button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">✕</button>' : '<button type="button" class="btn btn-primary" onclick="addBusinessInput()">➕</button>'}
    `;
    container.appendChild(item);
}

function getMultiInputValues(containerId) {
    const container = document.getElementById(containerId);
    const inputs = container.querySelectorAll('input');
    return Array.from(inputs).map(input => input.value).filter(value => value.trim());
}

// 複数選択
function setupMultiSelect() {
    updateMultiSelectOptions();
}

function updateMultiSelectOptions() {
    updateMultiSelectDropdown('type', options.types.sort());
    updateMultiSelectDropdown('affiliation', options.affiliations.sort());
    updateMultiSelectDropdown('industryInterests', options.industryInterests.sort());
}

function updateMultiSelectDropdown(key, optionList) {
    const dropdown = document.getElementById(key + 'Dropdown');
    
    if (!Array.isArray(optionList)) {
        optionList = [];
    }
    
    if (!Array.isArray(selectedOptions[key])) {
        selectedOptions[key] = [];
    }
    
    dropdown.innerHTML = `
        <div class="multi-select-search">
            <input type="text" placeholder="検索..." 
                   id="${key}SearchInput"
                   onkeyup="filterMultiSelectOptions('${key}')"
                   onclick="event.stopPropagation();">
        </div>
        <div class="multi-select-options" id="${key}Options">
            ${optionList.map(option => `
                <div class="multi-select-option" onclick="toggleOption('${key}', '${escapeHtml(option)}')" data-value="${escapeHtml(option)}">
                    <input type="checkbox" ${selectedOptions[key].includes(option) ? 'checked' : ''}>
                    <span>${escapeHtml(option)}</span>
                </div>
            `).join('')}
        </div>
    `;
    
    dropdown.innerHTML += `
        <div class="multi-select-option" style="border-top: 1px solid var(--border-color); padding-top: 0.5rem; margin-top: 0.5rem;">
            <input type="text" placeholder="新規追加" onkeypress="if(event.key==='Enter'){event.preventDefault(); addNewOption('${key}', this.value); this.value='';}" onclick="event.stopPropagation();">
        </div>
    `;
    
    if (multiSelectSearchQueries[key]) {
        const searchInput = document.getElementById(key + 'SearchInput');
        if (searchInput) {
            searchInput.value = multiSelectSearchQueries[key];
            filterMultiSelectOptions(key);
        }
    }
}

function filterMultiSelectOptions(key) {
    const searchInput = document.getElementById(key + 'SearchInput');
    const query = searchInput.value.toLowerCase();
    multiSelectSearchQueries[key] = searchInput.value;
    
    const optionsContainer = document.getElementById(key + 'Options');
    const options = optionsContainer.querySelectorAll('.multi-select-option');
    
    let hasVisibleOptions = false;
    options.forEach(option => {
        const value = option.dataset.value;
        if (value && value.toLowerCase().includes(query)) {
            option.classList.remove('hidden');
            hasVisibleOptions = true;
        } else {
            option.classList.add('hidden');
        }
    });
    
    const noResultsMsg = optionsContainer.querySelector('.multi-select-no-results');
    if (!hasVisibleOptions && query) {
        if (!noResultsMsg) {
            const msg = document.createElement('div');
            msg.className = 'multi-select-no-results';
            msg.textContent = '該当する項目がありません';
            optionsContainer.appendChild(msg);
        }
    } else if (noResultsMsg) {
        noResultsMsg.remove();
    }
}

function toggleMultiSelect(key) {
    event.stopPropagation();
    const dropdown = document.getElementById(key + 'Dropdown');
    const isShowing = dropdown.classList.contains('show');
    
    document.querySelectorAll('.multi-select-dropdown').forEach(d => d.classList.remove('show'));
    
    if (!isShowing) {
        dropdown.classList.add('show');
        setTimeout(() => {
            const searchInput = document.getElementById(key + 'SearchInput');
            if (searchInput) {
                searchInput.focus();
            }
        }, 50);
    }
}

function toggleOption(key, option) {
    if (!Array.isArray(selectedOptions[key])) {
        selectedOptions[key] = [];
    }
    
    const index = selectedOptions[key].indexOf(option);
    if (index > -1) {
        selectedOptions[key].splice(index, 1);
    } else {
        selectedOptions[key].push(option);
    }
    updateMultiSelectTags(key);
    
    const optionKey = key === 'type' ? 'types' : 
                     key === 'affiliation' ? 'affiliations' : 
                     key === 'industryInterests' ? 'industryInterests' : key;
    
    updateMultiSelectDropdown(key, options[optionKey].sort());
}

function updateMultiSelectTags(key) {
    const tagsContainer = document.getElementById(key + 'Tags');
    const opts = selectedOptions[key];
    
    if (!Array.isArray(opts)) {
        selectedOptions[key] = [];
        tagsContainer.innerHTML = '<span style="color: var(--text-secondary);">選択してください</span>';
        return;
    }
    
    if (opts.length === 0) {
        tagsContainer.innerHTML = '<span style="color: var(--text-secondary);">選択してください</span>';
    } else {
        tagsContainer.innerHTML = opts.map(option => `
            <span class="multi-select-tag">
                ${escapeHtml(option)}
                <button onclick="event.stopPropagation(); toggleOption('${key}', '${escapeHtml(option)}')" type="button">✕</button>
            </span>
        `).join('');
    }
}

function addNewOption(key, value) {
    value = value.trim();
    if (!value) return;
    
    const optionKey = key === 'type' ? 'types' : 
                     key === 'affiliation' ? 'affiliations' : 
                     key === 'industryInterests' ? 'industryInterests' : key;
    
    if (!options[optionKey].includes(value)) {
        options[optionKey].push(value);
        options[optionKey].sort();
    }
    
    if (!selectedOptions[key].includes(value)) {
        selectedOptions[key].push(value);
    }
    
    updateMultiSelectTags(key);
    updateMultiSelectDropdown(key, options[optionKey]);
}

// 紹介者オートコンプリート
function setupReferrerAutocomplete() {
    const input = document.getElementById('referrerInput');
    const dropdown = document.getElementById('referrerDropdown');

    input.addEventListener('input', () => {
        const value = input.value.toLowerCase();
        const matches = contacts.filter(contact => 
            contact.name.toLowerCase().includes(value)
        );

        if (matches.length > 0 && value) {
            dropdown.innerHTML = matches.map(contact => 
                `<div class="autocomplete-item" onclick="selectAutocomplete('referrerInput', '${escapeHtml(contact.name)}')">${escapeHtml(contact.name)}</div>`
            ).join('');
            dropdown.classList.add('show');
        } else {
            dropdown.classList.remove('show');
        }
    });

    input.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.remove('show'), 200);
    });
}

function selectAutocomplete(inputId, value) {
    document.getElementById(inputId).value = value;
}