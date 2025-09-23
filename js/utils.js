// utils.js - ユーティリティ関数（完全版）

// ユニークIDを生成
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// HTMLエスケープ
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 日付フォーマット
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// URLとメールアドレスをリンク化
function linkifyText(text) {
    if (!text) return '';
    
    const urlPattern = /(https?:\/\/[^\s<]+)/g;
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    
    text = text.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');
    text = text.replace(emailPattern, '<a href="mailto:$1">$1</a>');
    
    return text;
}

// Markdownレンダリング
function renderMarkdown(text) {
    if (!text) return '';
    
    let html = escapeHtml(text);
    
    // コードブロック
    const codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
        return placeholder;
    });
    
    // インラインコード
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
        inlineCodes.push(`<code>${code}</code>`);
        return placeholder;
    });
    
    // 見出し
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // 太字とイタリック
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // 取り消し線
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    
    // リンク
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 画像
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%;">');
    
    // リスト
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^• (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
        const isOrdered = match.includes('<li>') && /^\d+\./.test(match);
        return isOrdered ? `<ol>${match}</ol>` : `<ul>${match}</ul>`;
    });
    
    // 引用
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // 水平線
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^\*\*\*$/gm, '<hr>');
    
    // URLとメールアドレスのリンク化
    html = linkifyText(html);
    
    // 改行
    html = html.replace(/\n/g, '<br>');
    
    // インラインコードを復元
    inlineCodes.forEach((code, index) => {
        html = html.replace(`__INLINE_CODE_${index}__`, code);
    });
    
    // コードブロックを復元
    codeBlocks.forEach((code, index) => {
        html = html.replace(`__CODE_BLOCK_${index}__`, code);
    });
    
    return html;
}

// CSVエスケープ
function escapeCSV(text) {
    if (!text) return '';
    return text.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function unescapeCSV(text) {
    if (!text) return '';
    return text.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
}

// CSVパース
function parseCSV(text) {
    const rows = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const row = [];
        let cell = '';
        let inQuotes = false;
        
        for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            const nextChar = lines[i][j + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    cell += '"';
                    j++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(cell);
                cell = '';
            } else {
                cell += char;
            }
        }
        
        row.push(cell);
        if (row.length > 1 || row[0]) {
            rows.push(row);
        }
    }
    
    return rows;
}

// 添付ファイルパース
function parseAttachments(attachmentsStr) {
    if (!attachmentsStr) return [];
    
    return attachmentsStr.split(';').filter(a => a).map(attachmentStr => {
        const [name, pathOrData] = attachmentStr.split(':');
        return {
            name: name,
            path: pathOrData,
            data: pathOrData.startsWith('data:') ? pathOrData : '',
            type: ''
        };
    });
}

// ToDoパース（既存の関数を置き換え）
function parseTodos(todosStr) {
    if (!todosStr) return [];
    
    return todosStr.split('|').filter(t => t).map(todoStr => {
        const completed = /^[✓✔]/.test(todoStr);  // 両方の文字に対応
        const match = todoStr.match(/[☐✓✔]\s*(.+?)(?:\s*\(期限:(.+?)\))?$/);
        
        if (match) {
            return {
                text: match[1],
                completed: completed,
                dueDate: match[2] || null
            };
        }
        
        return null;
    }).filter(t => t);
}

// ローディング表示
function showLoading(show = true) {
    let spinner = document.getElementById('loadingSpinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'loadingSpinner';
        spinner.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 3000;
            display: none;
        `;
        spinner.innerHTML = '<div class="loading-spinner" style="width: 50px; height: 50px;"></div>';
        document.body.appendChild(spinner);
    }
    spinner.style.display = show ? 'block' : 'none';
}

// 通知表示
function showNotification(message, type = 'info') {
    const notificationArea = document.getElementById('notificationArea');
    if (!notificationArea) {
        console.warn('Notification area not found');
        return;
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="btn btn-icon" onclick="this.parentElement.remove()">✕</button>
    `;
    
    notificationArea.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// オプションの更新
function updateOptionIfNew(optionKey, value) {
    if (value && !options[optionKey].includes(value)) {
        options[optionKey].push(value);
        options[optionKey].sort();
    }
}

// CSVダウンロード
function downloadCSV(csv, filename) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

// ======= 追加された関数群 =======

// ドロップゾーンの設定
function setupDropZone(dropZoneId, targetType, isImage = false) {
    const dropZone = document.getElementById(dropZoneId);
    if (!dropZone) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    fileInput.accept = isImage ? 'image/*' : '*/*';
    fileInput.multiple = !isImage;
    
    dropZone.appendChild(fileInput);

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
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

// ファイル処理
function handleFiles(files, targetType, isImage) {
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (isImage) {
                handleImageFile(e.result, targetType);
            } else {
                handleAttachmentFile(file.name, e.result, file.type, targetType);
            }
        };
        reader.readAsDataURL(file);
    });
}

// 画像ファイル処理
function handleImageFile(dataUrl, targetType) {
    if (targetType === 'photo') {
        const preview = document.getElementById('photoPreview');
        const container = document.getElementById('photoPreviewContainer');
        if (preview && container) {
            preview.src = dataUrl;
            container.style.display = 'block';
        }
    } else if (targetType === 'businessCard') {
        const preview = document.getElementById('businessCardPreview');
        const container = document.getElementById('businessCardPreviewContainer');
        if (preview && container) {
            preview.src = dataUrl;
            container.style.display = 'block';
        }
    }
}

// 添付ファイル処理
function handleAttachmentFile(fileName, dataUrl, fileType, targetListId) {
    const fileList = document.getElementById(targetListId);
    if (!fileList) return;
    
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
        📎 <span>${escapeHtml(fileName)}</span>
        <button class="btn btn-icon" onclick="this.parentElement.remove()">✕</button>
    `;
    fileItem.dataset.fileName = fileName;
    fileItem.dataset.fileData = dataUrl;
    fileItem.dataset.fileType = fileType;
    fileList.appendChild(fileItem);
}

// 複数選択の設定
function setupMultiSelect() {
    updateMultiSelectOptions();
}

// 複数選択オプション更新
function updateMultiSelectOptions() {
    updateMultiSelectOption('type', options.types);
    updateMultiSelectOption('affiliation', options.affiliations);
    updateMultiSelectOption('industryInterests', options.industryInterests);
}

function updateMultiSelectOption(type, optionList) {
    const container = document.getElementById(`${type}Options`);
    if (!container) return;

    container.innerHTML = '';
    
    // ソート済みのオプションを追加
    const sortedOptions = [...optionList].sort();
    sortedOptions.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'multi-select-option';
        optionDiv.innerHTML = `
            <input type="checkbox" value="${escapeHtml(option)}" 
                   ${selectedOptions[type].includes(option) ? 'checked' : ''}
                   onchange="toggleMultiSelectOption('${type}', '${escapeHtml(option)}')">
            <label>${escapeHtml(option)}</label>
        `;
        container.appendChild(optionDiv);
    });

    // 新規追加オプション
    const addNewDiv = document.createElement('div');
    addNewDiv.className = 'multi-select-option';
    addNewDiv.innerHTML = `
        <input type="text" placeholder="新規追加..." 
               onkeypress="if(event.key==='Enter') addNewOption('${type}', this.value, this)">
    `;
    container.appendChild(addNewDiv);
}

// 複数選択トグル
function toggleMultiSelectDropdown(type) {
    const dropdown = document.getElementById(`${type}Dropdown`);
    if (!dropdown) return;
    
    const isVisible = dropdown.classList.contains('show');
    
    // 他のドロップダウンを閉じる
    document.querySelectorAll('.multi-select-dropdown').forEach(d => {
        d.classList.remove('show');
    });
    
    if (!isVisible) {
        dropdown.classList.add('show');
    }
}

// 複数選択オプション切り替え
function toggleMultiSelectOption(type, value) {
    const index = selectedOptions[type].indexOf(value);
    if (index > -1) {
        selectedOptions[type].splice(index, 1);
    } else {
        selectedOptions[type].push(value);
    }
    updateMultiSelectTags(type);
}

// 複数選択タグ更新
function updateMultiSelectTags(type) {
    const container = document.getElementById(`${type}Tags`);
    if (!container) return;

    if (selectedOptions[type].length === 0) {
        container.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.875rem;">選択してください...</span>';
        return;
    }

    container.innerHTML = selectedOptions[type].map(option => `
        <span class="multi-select-tag">
            ${escapeHtml(option)}
            <button onclick="removeMultiSelectTag('${type}', '${escapeHtml(option)}')">×</button>
        </span>
    `).join('');
}

// 複数選択タグ削除
function removeMultiSelectTag(type, value) {
    const index = selectedOptions[type].indexOf(value);
    if (index > -1) {
        selectedOptions[type].splice(index, 1);
        updateMultiSelectTags(type);
        updateMultiSelectOptions();
    }
}

// 新規オプション追加
function addNewOption(type, value, inputElement) {
    if (!value || value.trim() === '') return;
    
    const trimmedValue = value.trim();
    if (!options[type].includes(trimmedValue)) {
        options[type].push(trimmedValue);
        options[type].sort();
    }
    
    if (!selectedOptions[type].includes(trimmedValue)) {
        selectedOptions[type].push(trimmedValue);
    }
    
    updateMultiSelectTags(type);
    updateMultiSelectOptions();
    inputElement.value = '';
}

// 複数選択フィルタリング
function filterMultiSelectOptions(type, query) {
    multiSelectSearchQueries[type] = query.toLowerCase();
    const container = document.getElementById(`${type}Options`);
    if (!container) return;
    
    const options = container.querySelectorAll('.multi-select-option');
    
    options.forEach(option => {
        const label = option.querySelector('label');
        if (label) {
            const text = label.textContent.toLowerCase();
            option.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
        }
    });
}

// 紹介者オートコンプリート設定
function setupReferrerAutocomplete() {
    const input = document.getElementById('referrerInput');
    const dropdown = document.getElementById('referrerDropdown');
    
    if (!input || !dropdown) return;

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase();
        if (query.length < 2) {
            dropdown.classList.remove('show');
            return;
        }

        const matches = contacts
            .filter(c => c.name.toLowerCase().includes(query))
            .slice(0, 10);

        if (matches.length === 0) {
            dropdown.classList.remove('show');
            return;
        }

        dropdown.innerHTML = matches.map(contact => `
            <div class="autocomplete-item" onclick="selectReferrer('${escapeHtml(contact.name)}')">
                ${escapeHtml(contact.name)}${contact.company ? ` (${escapeHtml(contact.company)})` : ''}
            </div>
        `).join('');

        dropdown.classList.add('show');
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

// 紹介者選択
function selectReferrer(name) {
    const input = document.getElementById('referrerInput');
    const dropdown = document.getElementById('referrerDropdown');
    if (input && dropdown) {
        input.value = name;
        dropdown.classList.remove('show');
    }
}

// Markdownエディタ設定
function setupMarkdownEditors() {
    const fields = ['business', 'strengths', 'approach', 'history', 'priorInfo'];
    fields.forEach(field => {
        const textarea = document.getElementById(`${field}Input`);
        if (textarea) {
            textarea.addEventListener('input', () => {
                updateMarkdownPreview(field);
            });
        }
    });
}

// Markdownビュー切り替え
function switchMarkdownView(field, view) {
    const textarea = document.getElementById(`${field}Input`);
    const preview = document.getElementById(`${field}Preview`);
    if (!textarea || !preview) return;
    
    const tabs = textarea.closest('.markdown-editor-container')?.querySelectorAll('.markdown-editor-tab') || [];

    tabs.forEach(tab => tab.classList.remove('active'));
    
    if (view === 'edit') {
        textarea.style.display = 'block';
        preview.style.display = 'none';
        if (tabs[0]) tabs[0].classList.add('active');
    } else {
        textarea.style.display = 'none';
        preview.style.display = 'block';
        updateMarkdownPreview(field);
        if (tabs[1]) tabs[1].classList.add('active');
    }
}

// Markdownプレビュー更新
function updateMarkdownPreview(field) {
    const textarea = document.getElementById(`${field}Input`);
    const preview = document.getElementById(`${field}Preview`);
    if (textarea && preview) {
        preview.innerHTML = renderMarkdown(textarea.value);
    }
}

// モーダル外クリック設定
function setupModalClose() {
    document.addEventListener('mousedown', (e) => {
        modalMouseDownTarget = e.target;
    });

    document.addEventListener('click', (e) => {
        if (modalMouseDownTarget === e.target && e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
}

// 接触方法切り替え
function handleContactMethodChange() {
    const directChecked = document.getElementById('contactMethodDirect')?.checked;
    const directSection = document.getElementById('directContactSection');
    const referralSection = document.getElementById('referralContactSection');
    
    if (directSection && referralSection) {
        if (directChecked) {
            directSection.style.display = 'block';
            referralSection.style.display = 'none';
        } else {
            directSection.style.display = 'none';
            referralSection.style.display = 'block';
        }
    }
}

// メール入力追加
function addEmailInput(value = '') {
    const container = document.getElementById('emailContainer');
    if (!container) return;
    
    const inputDiv = document.createElement('div');
    inputDiv.className = 'multi-input-item';
    inputDiv.innerHTML = `
        <input type="email" class="form-input" value="${escapeHtml(value)}" placeholder="メールアドレス">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">削除</button>
    `;
    container.appendChild(inputDiv);
}

// 電話番号入力追加
function addPhoneInput(value = '') {
    const container = document.getElementById('phoneContainer');
    if (!container) return;
    
    const inputDiv = document.createElement('div');
    inputDiv.className = 'multi-input-item';
    inputDiv.innerHTML = `
        <input type="tel" class="form-input" value="${escapeHtml(value)}" placeholder="電話番号">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">削除</button>
    `;
    container.appendChild(inputDiv);
}

// 事業内容入力追加
function addBusinessInput(value = '') {
    const container = document.getElementById('businessContainer');
    if (!container) return;
    
    const inputDiv = document.createElement('div');
    inputDiv.className = 'multi-input-item';
    inputDiv.innerHTML = `
        <input type="text" class="form-input" value="${escapeHtml(value)}" placeholder="事業内容">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">削除</button>
    `;
    container.appendChild(inputDiv);
}

// 複数入力値取得
function getMultiInputValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    const inputs = container.querySelectorAll('input');
    return Array.from(inputs).map(input => input.value.trim()).filter(value => value !== '');
}

// CSVエクスポート機能
function exportToCSV() {
    if (contacts.length === 0) {
        showNotification('エクスポートするデータがありません', 'warning');
        return;
    }

    const headers = [
        '名前', 'ふりがな', '会社・組織', 'メールアドレス', '電話番号', 'ホームページ',
        '事業内容', '種別', '所属', '会いたい業種等', '接触方法', '紹介者',
        '事業内容詳細', '強み', '切り出し方', '過去の経歴', '事前情報',
        '活動エリア', '居住地', '趣味・興味', '売上', '作成日時', '更新日時'
    ];

    const csvData = contacts.map(contact => {
        return [
            contact.name || '',
            contact.furigana || '',
            contact.company || '',
            (contact.emails || []).join(';'),
            (contact.phones || []).join(';'),
            contact.website || '',
            (contact.businesses || []).join(';'),
            (contact.types || []).join(';'),
            (contact.affiliations || []).join(';'),
            (contact.industryInterests || []).join(';'),
            contact.contactMethod || '',
            contact.referrer || '',
            escapeCSV(contact.business || ''),
            escapeCSV(contact.strengths || ''),
            escapeCSV(contact.approach || ''),
            escapeCSV(contact.history || ''),
            escapeCSV(contact.priorInfo || ''),
            contact.activityArea || '',
            contact.residence || '',
            contact.hobbies || '',
            contact.revenue || '',
            contact.createdAt || '',
            contact.updatedAt || ''
        ].map(field => `"${String(field).replace(/"/g, '""')}"`);
    });

    const csv = [headers.map(h => `"${h}"`), ...csvData].map(row => row.join(',')).join('\n');
    const filename = `contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    
    downloadCSV(csv, filename);
    showNotification('CSVファイルをエクスポートしました', 'success');
}

// CSVインポート機能
function importFromCSV() {
    const input = document.getElementById('csvFileInput');
    if (input) {
        input.click();
    }
}

function handleCSVImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csv = e.target.result;
            const rows = parseCSV(csv);
            
            if (rows.length < 2) {
                showNotification('CSVファイルが正しくありません', 'error');
                return;
            }

            const importedContacts = rows.slice(1).map(row => {
                return {
                    id: generateId(),
                    name: row[0] || '',
                    furigana: row[1] || '',
                    company: row[2] || '',
                    emails: row[3] ? row[3].split(';').filter(e => e) : [],
                    phones: row[4] ? row[4].split(';').filter(p => p) : [],
                    website: row[5] || '',
                    businesses: row[6] ? row[6].split(';').filter(b => b) : [],
                    types: row[7] ? row[7].split(';').filter(t => t) : [],
                    affiliations: row[8] ? row[8].split(';').filter(a => a) : [],
                    industryInterests: row[9] ? row[9].split(';').filter(i => i) : [],
                    contactMethod: row[10] || 'direct',
                    referrer: row[11] || '',
                    business: unescapeCSV(row[12] || ''),
                    strengths: unescapeCSV(row[13] || ''),
                    approach: unescapeCSV(row[14] || ''),
                    history: unescapeCSV(row[15] || ''),
                    priorInfo: unescapeCSV(row[16] || ''),
                    activityArea: row[17] || '',
                    residence: row[18] || '',
                    hobbies: row[19] || '',
                    revenue: parseFloat(row[20]) || 0,
                    status: '新規',
                    createdAt: row[21] || new Date().toISOString(),
                    updatedAt: row[22] || new Date().toISOString()
                };
            }).filter(contact => contact.name);

            if (importedContacts.length === 0) {
                showNotification('インポートできるデータがありませんでした', 'warning');
                return;
            }

            contacts.push(...importedContacts);
            
            // オプションを更新
            importedContacts.forEach(contact => {
                contact.types.forEach(type => updateOptionIfNew('types', type));
                contact.affiliations.forEach(aff => updateOptionIfNew('affiliations', aff));
                contact.industryInterests.forEach(ii => updateOptionIfNew('industryInterests', ii));
            });

            if (typeof calculateReferrerRevenues === 'function') {
                calculateReferrerRevenues();
            }
            if (typeof saveAllData === 'function') {
                saveAllData();
            }
            if (typeof renderContacts === 'function') {
                renderContacts();
            }
            if (typeof updateFilters === 'function') {
                updateFilters();
            }
            updateMultiSelectOptions();

            showNotification(`${importedContacts.length}件の連絡先をインポートしました`, 'success');
        } catch (error) {
            console.error('CSVインポートエラー:', error);
            showNotification('CSVファイルの読み込みに失敗しました', 'error');
        }
    };
    reader.readAsText(file, 'utf-8');
}