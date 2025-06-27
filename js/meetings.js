// ===== ミーティング管理機能 =====

// ミーティングフォーム表示
function showMeetingForm(contactId, meetingId = null) {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;
    
    closeModal('contactDetailModal');
    currentEditingMeetingId = meetingId;
    resetMeetingForm();
    
    document.getElementById('meetingFormTitle').textContent = 
        `${contact.name} - ${meetingId ? 'ミーティング編集' : 'ミーティング記録'}`);
    
    const form = document.getElementById('meetingForm');
    
    if (meetingId) {
        const meeting = meetings.find(m => m.id === meetingId);
        if (meeting) {
            const datetime = new Date(meeting.datetime);
            datetime.setMinutes(datetime.getMinutes() - datetime.getTimezoneOffset());
            form.datetime.value = datetime.toISOString().slice(0, 16);
            form.content.value = meeting.content || '';
            
            // タスクを復元
            if (meeting.tasks && meeting.tasks.length > 0) {
                meeting.tasks.forEach(task => {
                    addTaskInputWithData(task);
                });
            }
            
            // 添付ファイルを表示
            if (meeting.attachments && meeting.attachments.length > 0) {
                displayExistingMeetingAttachments(meeting.attachments);
            }
        }
    } else {
        // 新規の場合、現在時刻をセット
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        form.datetime.value = now.toISOString().slice(0, 16);
        
        // テンプレートを適用
        const template = localStorage.getItem('meetingTemplate') || '';
        form.content.value = template;
        
        // ドラフト保存の設定
        setupDraftSave();
    }
    
    document.getElementById('meetingFormModal').style.display = 'block';
}

// ミーティング保存
async function saveMeetingForm(event) {
    event.preventDefault();
    showLoading();
    
    const formData = new FormData(event.target);
    const contactId = currentEditingContactId;
    
    // タスクデータを収集
    const taskTexts = formData.getAll('taskText[]');
    const taskDues = formData.getAll('taskDue[]');
    const taskDones = Array.from(document.querySelectorAll('input[name="taskDone[]"]')).map(cb => cb.checked);
    
    const tasks = [];
    taskTexts.forEach((text, index) => {
        if (text.trim()) {
            tasks.push({
                text: text.trim(),
                due: taskDues[index] || null,
                done: taskDones[index] || false
            });
        }
    });
    
    const meeting = {
        id: currentEditingMeetingId || generateId(),
        contactId: contactId,
        datetime: formData.get('datetime'),
        content: formData.get('content'),
        tasks: tasks,
        attachments: [],
        createdAt: currentEditingMeetingId ? 
            meetings.find(m => m.id === currentEditingMeetingId)?.createdAt || new Date().toISOString() : 
            new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    try {
        // 既存のミーティングの場合、添付ファイルを引き継ぐ
        if (currentEditingMeetingId) {
            const existingMeeting = meetings.find(m => m.id === currentEditingMeetingId);
            if (existingMeeting && existingMeeting.attachments) {
                meeting.attachments = existingMeeting.attachments.filter(att => 
                    !deletedMeetingAttachments.includes(att.id)
                );
            }
        }
        
        // 新しい添付ファイルをアップロード
        const contact = contacts.find(c => c.id === contactId);
        for (const file of selectedMeetingFiles) {
            const timestamp = new Date().getTime();
            const fileName = addContactNameToFileName(`meeting_${timestamp}_${file.name}`, contact.name);
            const fileResult = await uploadFile(file, fileName, contact.name);
            meeting.attachments.push({
                name: file.name,
                id: fileResult.id,
                url: fileResult.url,
                uploadedAt: new Date().toISOString()
            });
        }
        
        // ミーティングを保存
        if (currentEditingMeetingId) {
            const index = meetings.findIndex(m => m.id === currentEditingMeetingId);
            if (index >= 0) {
                meetings[index] = meeting;
            }
        } else {
            meetings.push(meeting);
        }
        
        await saveData();
        
        // ドラフトをクリア
        if (draftSaveTimer) {
            clearTimeout(draftSaveTimer);
            localStorage.removeItem('meetingDraft');
        }
        
        closeModal('meetingFormModal');
        resetMeetingForm();
        
        // 連絡先詳細を再表示
        showContactDetail(contactId);
        
        // 未完了アクションを更新
        if (outstandingActionsVisible) {
            renderOutstandingActions();
        }
        
        hideLoading();
        showNotification('ミーティング記録を保存しました');
    } catch (error) {
        console.error('ミーティング保存エラー:', error);
        showNotification('ミーティング記録の保存に失敗しました', 'error');
        hideLoading();
    }
}

// ミーティング削除
async function deleteMeeting(meetingId) {
    if (!confirm('このミーティング記録を削除してもよろしいですか？')) {
        return;
    }
    
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    
    showLoading();
    
    try {
        meetings = meetings.filter(m => m.id !== meetingId);
        await saveData();
        
        showContactDetail(meeting.contactId);
        
        // 未完了アクションを更新
        if (outstandingActionsVisible) {
            renderOutstandingActions();
        }
        
        hideLoading();
        showNotification('ミーティング記録を削除しました');
    } catch (error) {
        console.error('ミーティング削除エラー:', error);
        showNotification('ミーティング記録の削除に失敗しました', 'error');
        hideLoading();
    }
}

// タスク入力追加
function addTaskInput() {
    const container = document.getElementById('taskInputContainer');
    const newRow = document.createElement('div');
    newRow.className = 'task-input-row';
    newRow.innerHTML = `
        <input type="checkbox" name="taskDone[]" style="width: auto;">
        <input type="text" name="taskText[]" placeholder="タスク内容">
        <input type="datetime-local" name="taskDue[]" placeholder="期限">
        <button type="button" class="btn-small btn-danger" onclick="removeTaskInput(this)">削除</button>
    `;
    container.appendChild(newRow);
}

// データ付きタスク入力追加
function addTaskInputWithData(task) {
    const container = document.getElementById('taskInputContainer');
    const newRow = document.createElement('div');
    newRow.className = 'task-input-row';
    
    let dueValue = '';
    if (task.due) {
        const dueDate = new Date(task.due);
        dueDate.setMinutes(dueDate.getMinutes() - dueDate.getTimezoneOffset());
        dueValue = dueDate.toISOString().slice(0, 16);
    }
    
    newRow.innerHTML = `
        <input type="checkbox" name="taskDone[]" ${task.done ? 'checked' : ''} style="width: auto;">
        <input type="text" name="taskText[]" value="${escapeHtml(task.text)}" placeholder="タスク内容">
        <input type="datetime-local" name="taskDue[]" value="${dueValue}" placeholder="期限">
        <button type="button" class="btn-small btn-danger" onclick="removeTaskInput(this)">削除</button>
    `;
    container.appendChild(newRow);
}

// タスクのステータス切り替え
async function toggleTaskStatus(meetingId, taskIndex) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting || !meeting.tasks || !meeting.tasks[taskIndex]) return;
    
    meeting.tasks[taskIndex].done = !meeting.tasks[taskIndex].done;
    meeting.updatedAt = new Date().toISOString();
    
    try {
        await saveData();
        
        // UIを更新
        const checkbox = event.target;
        const taskItem = checkbox.closest('.task-item');
        if (taskItem) {
            taskItem.classList.toggle('completed', meeting.tasks[taskIndex].done);
        }
    } catch (error) {
        console.error('タスクステータス更新エラー:', error);
        // エラー時は元に戻す
        meeting.tasks[taskIndex].done = !meeting.tasks[taskIndex].done;
        showNotification('タスクの更新に失敗しました', 'error');
    }
}

// タスクテキストの更新
async function updateTaskText(meetingId, taskIndex, newText) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting || !meeting.tasks || !meeting.tasks[taskIndex]) return;
    
    const trimmedText = newText.trim();
    if (!trimmedText) {
        event.target.textContent = meeting.tasks[taskIndex].text;
        showNotification('タスクの内容は空にできません', 'error');
        return;
    }
    
    meeting.tasks[taskIndex].text = trimmedText;
    meeting.updatedAt = new Date().toISOString();
    
    try {
        await saveData();
        showNotification('タスクを更新しました');
    } catch (error) {
        console.error('タスクテキスト更新エラー:', error);
        event.target.textContent = meeting.tasks[taskIndex].text;
        showNotification('タスクの更新に失敗しました', 'error');
    }
}

// タスク編集時のキーボードハンドリング
function handleTaskKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur();
    }
}

// ドラフト保存の設定
function setupDraftSave() {
    const form = document.getElementById('meetingForm');
    const inputs = form.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            hasUnsavedDraft = true;
            scheduleDraftSave();
        });
    });
    
    // 既存のドラフトがあれば復元
    const savedDraft = localStorage.getItem('meetingDraft');
    if (savedDraft && !currentEditingMeetingId) {
        const draft = JSON.parse(savedDraft);
        if (draft.contactId === currentEditingContactId) {
            if (confirm('保存されていない下書きがあります。復元しますか？')) {
                form.datetime.value = draft.datetime || '';
                form.content.value = draft.content || '';
                hasUnsavedDraft = true;
            } else {
                localStorage.removeItem('meetingDraft');
            }
        }
    }
}

// ドラフト保存のスケジュール
function scheduleDraftSave() {
    if (draftSaveTimer) {
        clearTimeout(draftSaveTimer);
    }
    
    draftSaveTimer = setTimeout(() => {
        saveDraft();
    }, 2000);
}

// ドラフト保存
function saveDraft() {
    if (!hasUnsavedDraft || currentEditingMeetingId) return;
    
    const form = document.getElementById('meetingForm');
    const draft = {
        contactId: currentEditingContactId,
        datetime: form.datetime.value,
        content: form.content.value,
        savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('meetingDraft', JSON.stringify(draft));
    
    // インジケーター表示
    const indicator = document.getElementById('draftStatus');
    indicator.classList.add('show');
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 2000);
}