// meetings.js - ミーティング管理

// 現在編集中のミーティング
let currentMeeting = null;
let currentContactId = null;

// ミーティングリスト取得
function getMeetings() {
    return window.meetings || [];
}

// 連絡先のミーティング取得
function getMeetingsByContactId(contactId) {
    return (window.meetings || []).filter(meeting => meeting.contactId === contactId)
        .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
}

// ミーティング取得
function getMeetingById(id) {
    return (window.meetings || []).find(meeting => meeting.id === id);
}

// 連絡先のミーティングリスト表示
function renderMeetingsForContact(contactId) {
    currentContactId = contactId;
    const meetings = getMeetingsByContactId(contactId);
    const container = document.getElementById('meetingsList');
    
    if (meetings.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">ミーティング記録はありません</p>';
        return;
    }
    
    let html = '';
    meetings.forEach(meeting => {
        const todos = meeting.todos || [];
        const completedTodos = todos.filter(todo => todo.completed).length;
        
        html += `
            <div class="meeting-item">
                <div class="meeting-header">
                    <div>
                        <div class="meeting-date">${utils.formatDate(meeting.datetime)}</div>
                        ${todos.length > 0 ? `<small style="color: var(--text-secondary);">ToDo: ${completedTodos}/${todos.length} 完了</small>` : ''}
                    </div>
                    <div>
                        <button class="btn btn-secondary" onclick="editMeeting('${meeting.id}')">編集</button>
                        <button class="btn btn-danger" onclick="deleteMeeting('${meeting.id}')">削除</button>
                    </div>
                </div>
                <div style="margin-top: 0.5rem; white-space: pre-wrap;">${utils.escapeHtml(meeting.content)}</div>
                ${renderTodos(todos)}
                ${renderMeetingAttachments(meeting.attachments)}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ToDo表示
function renderTodos(todos) {
    if (!todos || todos.length === 0) return '';
    
    let html = '<div style="margin-top: 1rem;">';
    todos.forEach((todo, index) => {
        const dueClass = todo.due && new Date(todo.due) < new Date() && !todo.completed ? 'style="color: var(--danger);"' : '';
        
        html += `
            <div class="todo-item ${todo.completed ? 'completed' : ''}">
                <input type="checkbox" ${todo.completed ? 'checked' : ''} 
                       onchange="toggleTodoStatus('${todo.id}')" />
                <span ${dueClass}>${utils.escapeHtml(todo.text)}</span>
                ${todo.due ? `<small style="color: var(--text-secondary); margin-left: 0.5rem;">期限: ${utils.formatDate(todo.due)}</small>` : ''}
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

// ミーティング添付ファイル表示
function renderMeetingAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';
    
    let html = '<div style="margin-top: 1rem;"><strong style="color: var(--text-secondary); font-size: 0.9rem;">添付ファイル:</strong>';
    attachments.forEach(file => {
        html += `
            <div class="file-item" style="margin-top: 0.5rem;">
                <span>${utils.escapeHtml(file.name)}</span>
                <button class="btn btn-secondary" onclick="viewFile('${file.id}', '${file.name}')">
                    ${utils.canOpenInBrowser(file.name) ? '表示' : 'ダウンロード'}
                </button>
            </div>
        `;
    });
    html += '</div>';
    
    return html;
}

// 新規ミーティング追加
function addMeeting() {
    if (!currentContactId) return;
    
    currentMeeting = null;
    showMeetingModal();
}

// ミーティング編集
function editMeeting(meetingId) {
    currentMeeting = getMeetingById(meetingId);
    if (!currentMeeting) return;
    
    showMeetingModal();
}

// ミーティングモーダル表示
function showMeetingModal() {
    // モーダルHTML作成
    const modalHtml = `
        <div id="meetingModal" class="modal" style="display: block;">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${currentMeeting ? 'ミーティング編集' : '新規ミーティング'}</h2>
                    <button class="btn btn-secondary" onclick="closeMeetingModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="meetingForm">
                        <div class="form-group">
                            <label>日時 *</label>
                            <input type="datetime-local" name="datetime" class="form-control" required
                                   value="${currentMeeting ? currentMeeting.datetime.slice(0, 16) : new Date().toISOString().slice(0, 16)}">
                        </div>
                        
                        <div class="form-group">
                            <label>内容 *</label>
                            <textarea name="content" class="form-control" rows="5" required>${currentMeeting ? utils.escapeHtml(currentMeeting.content) : ''}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>ToDo リスト</label>
                            <div id="todoList">
                                ${currentMeeting && currentMeeting.todos ? renderEditableTodos(currentMeeting.todos) : ''}
                            </div>
                            <button type="button" class="btn btn-secondary" onclick="addTodoItem()">
                                + ToDo追加
                            </button>
                        </div>
                        
                        <div class="form-group">
                            <label>添付ファイル</label>
                            <div class="file-upload" data-type="meeting-attachments">
                                <input type="file" multiple id="meetingAttachmentsInput">
                                <p>クリックまたはドラッグ＆ドロップ（複数可）</p>
                                <div id="meetingAttachmentsList" class="file-list">
                                    ${currentMeeting && currentMeeting.attachments ? renderExistingAttachments(currentMeeting.attachments) : ''}
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>テンプレート</label>
                            <select class="form-control" onchange="applyMeetingTemplate(this.value)">
                                <option value="">-- テンプレートを選択 --</option>
                                <option value="initial">初回ミーティング</option>
                                <option value="followup">フォローアップ</option>
                                <option value="proposal">提案・商談</option>
                                <option value="review">レビュー・振り返り</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeMeetingModal()">
                        キャンセル
                    </button>
                    <button type="button" class="btn" onclick="saveMeeting()">
                        保存
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // モーダルを追加
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    // ファイルアップロード初期化
    initializeMeetingFileUpload();
    
    // ドラフト復元
    const draft = utils.loadDraft('meeting');
    if (draft && !currentMeeting) {
        document.querySelector('[name="content"]').value = draft.content || '';
        if (draft.todos) {
            draft.todos.forEach(() => addTodoItem());
            const todoInputs = document.querySelectorAll('.todo-input');
            draft.todos.forEach((todo, index) => {
                if (todoInputs[index]) {
                    todoInputs[index].value = todo.text;
                }
            });
        }
    }
    
    // 自動保存設定
    const autoSave = utils.debounce(() => {
        if (!currentMeeting) {
            const formData = new FormData(document.getElementById('meetingForm'));
            const todos = Array.from(document.querySelectorAll('.todo-input')).map(input => ({
                text: input.value,
                id: utils.generateUUID()
            }));
            
            utils.saveDraft('meeting', {
                content: formData.get('content'),
                todos: todos
            });
        }
    }, 1000);
    
    document.querySelector('[name="content"]').addEventListener('input', autoSave);
}

// 編集可能なToDo表示
function renderEditableTodos(todos) {
    let html = '';
    todos.forEach(todo => {
        html += `
            <div class="todo-edit-item" data-todo-id="${todo.id}">
                <input type="checkbox" ${todo.completed ? 'checked' : ''} 
                       onchange="updateTodoInEdit('${todo.id}', 'completed', this.checked)">
                <input type="text" class="form-control todo-input" style="display: inline-block; width: 40%;" 
                       value="${utils.escapeHtml(todo.text)}"
                       onchange="updateTodoInEdit('${todo.id}', 'text', this.value)">
                <input type="date" class="form-control" style="display: inline-block; width: 30%;" 
                       value="${todo.due ? todo.due.split('T')[0] : ''}"
                       onchange="updateTodoInEdit('${todo.id}', 'due', this.value)">
                <button type="button" class="btn btn-danger" onclick="removeTodoItem('${todo.id}')">削除</button>
            </div>
        `;
    });
    return html;
}

// 既存添付ファイル表示
function renderExistingAttachments(attachments) {
    let html = '';
    attachments.forEach(file => {
        html += `
            <div class="file-item" data-file-id="${file.id}">
                <span>${utils.escapeHtml(file.name)}</span>
                <button type="button" class="btn btn-danger" onclick="removeExistingAttachment('${file.id}')">
                    削除
                </button>
            </div>
        `;
    });
    return html;
}

// ミーティング保存
async function saveMeeting() {
    const form = document.getElementById('meetingForm');
    const formData = new FormData(form);
    
    if (!formData.get('datetime') || !formData.get('content')) {
        utils.showNotification('日時と内容は必須です', 'error');
        return;
    }
    
    try {
        utils.showLoading();
        
        // ミーティングデータ作成
        const meetingData = {
            id: currentMeeting ? currentMeeting.id : utils.generateUUID(),
            contactId: currentMeeting ? currentMeeting.contactId : currentContactId,
            datetime: new Date(formData.get('datetime')).toISOString(),
            content: formData.get('content'),
            todos: collectTodos(),
            attachments: currentMeeting ? [...currentMeeting.attachments] : [],
            createdAt: currentMeeting ? currentMeeting.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // 削除された添付ファイルを除外
        if (currentMeeting) {
            const remainingFileIds = Array.from(document.querySelectorAll('[data-file-id]'))
                .map(el => el.dataset.fileId);
            
            meetingData.attachments = meetingData.attachments.filter(file => 
                remainingFileIds.includes(file.id)
            );
        }
        
        // 新規添付ファイルアップロード
        const fileInput = document.getElementById('meetingAttachmentsInput');
        if (fileInput.files.length > 0) {
            const contact = contactsModule.getContactById(meetingData.contactId);
            
            for (const file of fileInput.files) {
                const attachmentData = await drive.uploadFile(file, contact.name);
                meetingData.attachments.push(attachmentData);
            }
        }
        
        // データ保存
        if (currentMeeting) {
            // 更新
            const index = window.meetings.findIndex(m => m.id === currentMeeting.id);
            window.meetings[index] = meetingData;
        } else {
            // 新規作成
            window.meetings.push(meetingData);
        }
        
        // Drive に保存
        await drive.saveData();
        
        // ドラフトクリア
        utils.clearDraft('meeting');
        
        // モーダルを閉じる
        closeMeetingModal();
        
        // 表示更新
        meetingsModule.renderMeetingsForContact(meetingData.contactId);
        
        utils.showNotification(currentMeeting ? 'ミーティングを更新しました' : 'ミーティングを登録しました');
        
    } catch (error) {
        console.error('Save meeting error:', error);
        utils.showNotification('保存に失敗しました', 'error');
    } finally {
        utils.hideLoading();
    }
}

// ToDo収集
function collectTodos() {
    const todos = [];
    document.querySelectorAll('.todo-edit-item').forEach(item => {
        const todoId = item.dataset.todoId || utils.generateUUID();
        const checkbox = item.querySelector('input[type="checkbox"]');
        const textInput = item.querySelector('.todo-input');
        const dateInput = item.querySelector('input[type="date"]');
        
        if (textInput.value.trim()) {
            todos.push({
                id: todoId,
                text: textInput.value.trim(),
                completed: checkbox.checked,
                due: dateInput.value ? new Date(dateInput.value).toISOString() : null
            });
        }
    });
    
    return todos;
}

// ミーティング削除
async function deleteMeeting(meetingId) {
    const meeting = getMeetingById(meetingId);
    if (!meeting) return;
    
    if (!confirm('このミーティング記録を削除してよろしいですか？')) {
        return;
    }
    
    try {
        utils.showLoading();
        
        // 添付ファイルを削除
        if (meeting.attachments) {
            for (const file of meeting.attachments) {
                await drive.deleteFile(file.id);
            }
        }
        
        // ミーティングを削除
        window.meetings = window.meetings.filter(m => m.id !== meetingId);
        
        // Drive に保存
        await drive.saveData();
        
        // 表示更新
        meetingsModule.renderMeetingsForContact(meeting.contactId);
        
        utils.showNotification('ミーティングを削除しました');
        
    } catch (error) {
        console.error('Delete meeting error:', error);
        utils.showNotification('削除に失敗しました', 'error');
    } finally {
        utils.hideLoading();
    }
}

// ToDo状態切替
async function toggleTodoStatus(todoId) {
    const meetingsList = window.meetings || [];
    let updated = false;
    
    for (const meeting of meetingsList) {
        if (meeting.todos) {
            const todo = meeting.todos.find(t => t.id === todoId);
            if (todo) {
                todo.completed = !todo.completed;
                meeting.updatedAt = new Date().toISOString();
                updated = true;
                break;
            }
        }
    }
    
    if (updated) {
        try {
            await drive.saveData();
            meetingsModule.renderMeetingsForContact(currentContactId);
        } catch (error) {
            console.error('Toggle todo error:', error);
            utils.showNotification('更新に失敗しました', 'error');
        }
    }
}

// ミーティングファイルアップロード初期化
function initializeMeetingFileUpload() {
    const fileInput = document.getElementById('meetingAttachmentsInput');
    const fileUpload = document.querySelector('.file-upload[data-type="meeting-attachments"]');
    
    fileInput.addEventListener('change', (e) => {
        handleMeetingAttachmentsUpload(e.target.files);
    });
    
    // ドラッグ&ドロップ設定
    fileUpload.addEventListener('click', (e) => {
        if (e.target === fileUpload || e.target.tagName === 'P') {
            fileInput.click();
        }
    });
    
    fileUpload.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUpload.classList.add('drag-over');
    });
    
    fileUpload.addEventListener('dragleave', () => {
        fileUpload.classList.remove('drag-over');
    });
    
    fileUpload.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUpload.classList.remove('drag-over');
        handleMeetingAttachmentsUpload(e.dataTransfer.files);
    });
}

// ミーティング添付ファイルアップロード処理
function handleMeetingAttachmentsUpload(files) {
    const list = document.getElementById('meetingAttachmentsList');
    
    Array.from(files).forEach(file => {
        const listItem = document.createElement('div');
        listItem.className = 'file-item';
        listItem.innerHTML = `
            <span>${utils.escapeHtml(file.name)} (${utils.formatFileSize(file.size)})</span>
            <span style="color: var(--success);">新規</span>
        `;
        list.appendChild(listItem);
    });
}

// テンプレート適用
function applyMeetingTemplate(templateType) {
    const contentTextarea = document.querySelector('[name="content"]');
    
    const templates = {
        initial: `■ 自己紹介
- 
- 

■ ビジネス内容
- 
- 

■ 強み・特徴
- 
- 

■ 今後の展開
- 
- 

■ 次回アクション
- `,
        
        followup: `■ 前回からの進捗
- 
- 

■ 現在の課題
- 
- 

■ 相談事項
- 
- 

■ 次回までのアクション
- `,
        
        proposal: `■ 提案内容
- 
- 

■ メリット
- 
- 

■ 実施スケジュール
- 
- 

■ 必要なリソース
- 
- 

■ 次のステップ
- `,
        
        review: `■ 実施内容
- 
- 

■ 成果
- 
- 

■ 改善点
- 
- 

■ 今後の方針
- `
    };
    
    if (templates[templateType]) {
        contentTextarea.value = templates[templateType];
    }
}

// モーダル操作
function closeMeetingModal() {
    const modal = document.getElementById('meetingModal');
    if (modal) {
        modal.remove();
    }
    currentMeeting = null;
}

// グローバル関数として公開
window.addMeeting = addMeeting;
window.editMeeting = editMeeting;
window.deleteMeeting = deleteMeeting;
window.saveMeeting = saveMeeting;
window.closeMeetingModal = closeMeetingModal;
window.toggleTodoStatus = toggleTodoStatus;
window.addTodoItem = () => {
    const todoList = document.getElementById('todoList');
    const todoItem = document.createElement('div');
    todoItem.className = 'todo-edit-item';
    todoItem.innerHTML = `
        <input type="checkbox">
        <input type="text" class="form-control todo-input" style="display: inline-block; width: 40%;" placeholder="ToDo内容">
        <input type="date" class="form-control" style="display: inline-block; width: 30%;">
        <button type="button" class="btn btn-danger" onclick="this.parentElement.remove()">削除</button>
    `;
    todoList.appendChild(todoItem);
};

window.removeTodoItem = (todoId) => {
    document.querySelector(`[data-todo-id="${todoId}"]`).remove();
};

window.updateTodoInEdit = (todoId, field, value) => {
    // 編集中のデータを保持（実際の更新は保存時）
};

window.removeExistingAttachment = (fileId) => {
    document.querySelector(`[data-file-id="${fileId}"]`).remove();
};

window.applyMeetingTemplate = applyMeetingTemplate;

// エクスポート（モジュールとして）
window.meetingsModule = {
    getMeetings,
    getMeetingsByContactId,
    getMeetingById,
    renderMeetingsForContact
};