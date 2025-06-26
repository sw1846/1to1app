// ===== ミーティング管理機能 =====

// ミーティングフォーム表示
function showMeetingForm(contactId, meetingId = null) {
    currentEditingContactId = contactId;
    currentEditingMeetingId = meetingId;
    resetMeetingForm();
    
    const contact = contacts.find(c => c.id === contactId);
    document.getElementById('meetingFormTitle').textContent = 
        `${contact.name}さんとのミーティング記録${meetingId ? '編集' : ''}`;
    
    if (meetingId) {
        const meeting = meetings.find(m => m.id === meetingId);
        if (meeting) {
            const form = document.getElementById('meetingForm');
            form.datetime.value = meeting.datetime;
            form.content.value = meeting.content || '';
            
            if (meeting.tasks && meeting.tasks.length > 0) {
                displayTaskInputs(meeting.tasks);
            }
            
            displayExistingMeetingAttachments(meeting.attachments || []);
        }
    } else {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('meetingForm').datetime.value = now.toISOString().slice(0, 16);
        
        const template = localStorage.getItem('meetingTemplate') || '';
        document.getElementById('meetingForm').content.value = template;
        
        displayTaskInputs([]);
    }
    
    restoreDraft();
    
    const contentTextarea = document.querySelector('#meetingForm textarea[name="content"]');
    if (contentTextarea) {
        contentTextarea.addEventListener('input', () => {
            clearTimeout(draftSaveTimer);
            draftSaveTimer = setTimeout(saveDraft, 5000);
        });
    }
    
    document.getElementById('meetingFormModal').style.display = 'block';
    document.querySelector('#meetingFormModal .modal-content').scrollTop = 0;
}

// ミーティング保存
async function saveMeetingForm(event) {
    event.preventDefault();
    showLoading();
    
    const formData = new FormData(event.target);
    const taskTexts = formData.getAll('taskText[]');
    const taskDues = formData.getAll('taskDue[]');
    
    const tasks = [];
    taskTexts.forEach((text, index) => {
        if (text.trim()) {
            tasks.push({
                text: text.trim(),
                due: taskDues[index] || null,
                done: false
            });
        }
    });
    
    const meeting = {
        id: currentEditingMeetingId || generateId(),
        contactId: currentEditingContactId,
        datetime: formData.get('datetime'),
        content: formData.get('content'),
        tasks: tasks,
        attachments: [],
        createdAt: currentEditingMeetingId ? 
            meetings.find(m => m.id === currentEditingMeetingId)?.createdAt : 
            new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    if (currentEditingMeetingId) {
        const existing = meetings.find(m => m.id === currentEditingMeetingId);
        if (existing) {
            meeting.attachments = existing.attachments || [];
            if (existing.tasks) {
                tasks.forEach((task, index) => {
                    if (existing.tasks[index] && existing.tasks[index].text === task.text) {
                        task.done = existing.tasks[index].done;
                    }
                });
            }
        }
    }
    
    try {
        const contact = contacts.find(c => c.id === currentEditingContactId);
        for (const file of selectedMeetingFiles) {
            const timestamp = new Date().getTime();
            const fileName = `meeting_${timestamp}_${sanitizeFileName(file.name)}`;
            const fileResult = await uploadFile(file, fileName, contact.name);
            meeting.attachments.push({
                name: file.name,
                id: fileResult.id,
                url: fileResult.url,
                uploadedAt: new Date().toISOString()
            });
        }
        
        meeting.attachments = meeting.attachments.filter(att => 
            !deletedMeetingAttachments.includes(att.id)
        );
        
        const index = meetings.findIndex(m => m.id === meeting.id);
        if (index >= 0) {
            meetings[index] = meeting;
        } else {
            meetings.push(meeting);
        }
        
        await saveData();
        
        clearDraft();
        
        closeModal('meetingFormModal');
        showContactDetail(currentEditingContactId);
        renderContactList();
        renderOutstandingActions();
        
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
    
    showLoading();
    
    try {
        meetings = meetings.filter(m => m.id !== meetingId);
        
        await saveData();
        
        showContactDetail(currentEditingContactId);
        renderContactList();
        renderOutstandingActions();
        
        hideLoading();
        showNotification('ミーティング記録を削除しました');
    } catch (error) {
        console.error('ミーティング削除エラー:', error);
        showNotification('ミーティング記録の削除に失敗しました', 'error');
        hideLoading();
    }
}

// ミーティング編集
function editMeeting(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (meeting) {
        showMeetingForm(meeting.contactId, meetingId);
    }
}

// ミーティング履歴レンダリング
function renderMeetingHistory(meetings) {
    return meetings.map(meeting => `
        <div class="meeting-card">
            <div class="meeting-card-header">
                <div class="meeting-card-date">${formatDateTime(meeting.datetime)}</div>
                <div class="meeting-card-actions">
                    <button class="btn-small btn-secondary" onclick="editMeeting('${meeting.id}')">編集</button>
                    <button class="btn-small btn-danger" onclick="deleteMeeting('${meeting.id}')">削除</button>
                </div>
            </div>
            <div class="markdown-content ${meeting.content.length > 500 ? 'truncated' : ''}" id="content-${meeting.id}">
                ${renderMarkdown(meeting.content)}
            </div>
            ${meeting.content.length > 500 ? `
                <a href="#" class="read-more" onclick="toggleContent('${meeting.id}'); return false;">続きを読む</a>
            ` : ''}
            ${meeting.tasks && meeting.tasks.length > 0 ? `
                <div class="meeting-tasks">
                    <strong>次回アクション:</strong>
                    ${renderTaskListNew(meeting)}
                </div>
            ` : ''}
            ${meeting.attachments && meeting.attachments.length > 0 ? `
                <div style="margin-top: 10px;">
                    <strong>添付ファイル:</strong>
                    ${meeting.attachments.map(att => {
                        const escapedName = escapeHtml(att.name).replace(/'/g, "\\'");
                        return `<a href="#" onclick="openFile('${att.id || att.url}', '${escapedName}'); return false;" style="margin-left: 10px;">${escapeHtml(att.name)}</a>`;
                    }).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// ドラフト保存
function saveDraft() {
    const meetingForm = document.getElementById('meetingForm');
    if (!meetingForm || meetingForm.style.display === 'none') return;
    
    const content = meetingForm.content.value;
    const taskTexts = Array.from(meetingForm.querySelectorAll('input[name="taskText[]"]')).map(input => input.value);
    const taskDues = Array.from(meetingForm.querySelectorAll('input[name="taskDue[]"]')).map(input => input.value);
    
    if (content || taskTexts.some(text => text)) {
        const draftKey = currentEditingMeetingId ? 
            `draft_meeting_${currentEditingMeetingId}` : 
            `draft_meeting_${currentEditingContactId || 'new'}`;
        
        const draftData = {
            content: content,
            datetime: meetingForm.datetime.value,
            tasks: taskTexts.map((text, index) => ({
                text: text,
                due: taskDues[index]
            })).filter(task => task.text),
            timestamp: new Date().toISOString()
        };
        
        sessionStorage.setItem(draftKey, JSON.stringify(draftData));
        hasUnsavedDraft = true;
        
        const indicator = document.getElementById('draftStatus');
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }
}

// ドラフト復元
function restoreDraft() {
    const draftKey = currentEditingMeetingId ? 
        `draft_meeting_${currentEditingMeetingId}` : 
        `draft_meeting_${currentEditingContactId || 'new'}`;
    
    const draftData = sessionStorage.getItem(draftKey);
    if (draftData) {
        const draft = JSON.parse(draftData);
        const form = document.getElementById('meetingForm');
        
        if (!form.content.value || confirm('保存されていない下書きがあります。復元しますか？')) {
            form.content.value = draft.content;
            if (draft.datetime) form.datetime.value = draft.datetime;
            
            if (draft.tasks && draft.tasks.length > 0) {
                displayTaskInputs(draft.tasks);
            }
            
            showNotification('下書きを復元しました');
        }
    }
}

// ドラフトクリア
function clearDraft() {
    const draftKey = currentEditingMeetingId ? 
        `draft_meeting_${currentEditingMeetingId}` : 
        `draft_meeting_${currentEditingContactId || 'new'}`;
    
    sessionStorage.removeItem(draftKey);
    hasUnsavedDraft = false;
}

// 既存ミーティング添付ファイル表示
function displayExistingMeetingAttachments(attachments) {
    const container = document.getElementById('existingMeetingAttachments');
    container.innerHTML = attachments.map(att => `
        <div class="file-item">
            <span>${escapeHtml(att.name)}</span>
            <div class="file-item-actions">
                <a href="#" onclick="openFile('${att.id || att.url}', '${escapeHtml(att.name).replace(/'/g, "\\'")}'); return false;" class="btn-small btn-secondary">開く</a>
                <button type="button" class="btn-small btn-danger" onclick="markMeetingAttachmentForDeletion('${att.id}')">削除</button>
            </div>
        </div>
    `).join('');
}

// ミーティング添付ファイル削除マーク
function markMeetingAttachmentForDeletion(fileId) {
    deletedMeetingAttachments.push(fileId);
    event.target.closest('.file-item').style.display = 'none';
}

// 新規ミーティング添付ファイル表示
function displayNewMeetingAttachments() {
    const container = document.getElementById('newMeetingAttachments');
    container.innerHTML = selectedMeetingFiles.map((file, index) => `
        <div class="file-item">
            <span>${escapeHtml(file.name)}</span>
            <button type="button" class="btn-small btn-danger" onclick="removeNewMeetingAttachment(${index})">削除</button>
        </div>
    `).join('');
}

// 新規ミーティング添付ファイル削除
function removeNewMeetingAttachment(index) {
    selectedMeetingFiles.splice(index, 1);
    displayNewMeetingAttachments();
}

// コンテンツのトグル
function toggleContent(meetingId) {
    const content = document.getElementById(`content-${meetingId}`);
    const link = event.target;
    
    if (content.classList.contains('truncated')) {
        content.classList.remove('truncated');
        link.textContent = '折りたたむ';
    } else {
        content.classList.add('truncated');
        link.textContent = '続きを読む';
    }
}