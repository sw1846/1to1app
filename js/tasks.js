// ===== タスク管理機能 =====

// タスク入力欄表示
function displayTaskInputs(tasks = []) {
    const container = document.getElementById('taskInputContainer');
    container.innerHTML = tasks.map((task, index) => `
        <div class="task-input-row">
            <input type="text" name="taskText[]" value="${escapeHtml(task.text)}" placeholder="タスク内容">
            <input type="datetime-local" name="taskDue[]" value="${task.due ? task.due.slice(0, 16) : ''}" placeholder="期限">
            <button type="button" class="btn-small btn-danger" onclick="removeTaskInput(this)">削除</button>
        </div>
    `).join('');
    
    if (tasks.length === 0) {
        addTaskInput();
    }
    
    container.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(draftSaveTimer);
            draftSaveTimer = setTimeout(saveDraft, 5000);
        });
    });
}

// タスク入力欄追加
function addTaskInput() {
    const container = document.getElementById('taskInputContainer');
    const newRow = document.createElement('div');
    newRow.className = 'task-input-row';
    newRow.innerHTML = `
        <input type="text" name="taskText[]" placeholder="タスク内容">
        <input type="datetime-local" name="taskDue[]" placeholder="期限">
        <button type="button" class="btn-small btn-danger" onclick="removeTaskInput(this)">削除</button>
    `;
    container.appendChild(newRow);
    
    newRow.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(draftSaveTimer);
            draftSaveTimer = setTimeout(saveDraft, 5000);
        });
    });
}

// タスク入力欄削除
function removeTaskInput(button) {
    button.closest('.task-input-row').remove();
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(saveDraft, 1000);
}

// タスクリストレンダリング
function renderTaskListNew(meeting) {
    if (!meeting.tasks || meeting.tasks.length === 0) return '';
    
    return `
        <ul class="task-list">
            ${meeting.tasks.map((task, index) => {
                const isOverdue = task.due && new Date(task.due) < new Date();
                return `
                    <li class="task-item ${task.done ? 'completed' : ''}">
                        <input type="checkbox" 
                               class="task-checkbox"
                               ${task.done ? 'checked' : ''}
                               onchange="toggleTaskCompleteNew('${meeting.id}', ${index})">
                        <span class="task-text" 
                              ondblclick="startTaskEdit('${meeting.id}', ${index})"
                              id="task-${meeting.id}-${index}">${escapeHtml(task.text)}</span>
                        ${task.due ? 
                            `<span class="task-due ${isOverdue && !task.done ? 'overdue' : ''}">
                                ${formatDateTime(task.due)}${isOverdue && !task.done ? ' (期限切れ)' : ''}
                            </span>` : 
                            ''}
                    </li>
                `;
            }).join('')}
        </ul>
    `;
}

// タスク編集開始（セキュリティ改善版）
function startTaskEdit(meetingId, taskIndex) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting || !meeting.tasks[taskIndex] || meeting.tasks[taskIndex].done) return;
    
    const taskElement = document.getElementById(`task-${meetingId}-${taskIndex}`);
    const originalText = meeting.tasks[taskIndex].text;
    
    // セキュリティ改善: contentEditableの代わりに入力フィールドを使用
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.className = 'task-text editing';
    input.style.width = '100%';
    
    // 元の要素を隠して入力フィールドを表示
    taskElement.style.display = 'none';
    taskElement.parentNode.insertBefore(input, taskElement);
    input.focus();
    input.select();
    
    const saveEdit = async () => {
        const newText = sanitizeInput(input.value.trim());
        if (newText && newText !== originalText) {
            await saveTaskEdit(meetingId, taskIndex, newText);
        } else {
            cancelTaskEdit(meetingId, taskIndex);
        }
        input.remove();
        taskElement.style.display = 'inline-block';
    };
    
    const cancelEdit = () => {
        input.remove();
        taskElement.style.display = 'inline-block';
    };
    
    input.onkeydown = async function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            await saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    };
    
    input.onblur = saveEdit;
}

// セキュリティ改善: 入力値のサニタイズ
function sanitizeInput(text) {
    // HTMLタグを除去し、安全なテキストのみを許可
    const div = document.createElement('div');
    div.textContent = text;
    return div.textContent;
}

// タスク編集保存
async function saveTaskEdit(meetingId, taskIndex, newText) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting || !meeting.tasks[taskIndex]) return;
    
    meeting.tasks[taskIndex].text = newText;
    meeting.updatedAt = new Date().toISOString();
    
    try {
        await saveData();
        showNotification('タスクを更新しました');
        if (currentEditingContactId === meeting.contactId) {
            showContactDetail(meeting.contactId);
        }
        renderOutstandingActions();
    } catch (error) {
        showNotification('タスクの更新に失敗しました', 'error');
    }
}

// タスク編集キャンセル
function cancelTaskEdit(meetingId, taskIndex) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting || !meeting.tasks[taskIndex]) return;
    
    const taskElement = document.getElementById(`task-${meetingId}-${taskIndex}`);
    if (taskElement) {
        taskElement.textContent = meeting.tasks[taskIndex].text;
    }
}

// タスク完了状態トグル
async function toggleTaskCompleteNew(meetingId, taskIndex) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting || !meeting.tasks[taskIndex]) return;
    
    meeting.tasks[taskIndex].done = !meeting.tasks[taskIndex].done;
    meeting.updatedAt = new Date().toISOString();
    
    try {
        await saveData();
        renderOutstandingActions();
        if (currentEditingContactId === meeting.contactId) {
            showContactDetail(meeting.contactId);
        }
        renderContactList();
        showNotification('タスクステータスを更新しました');
    } catch (error) {
        meeting.tasks[taskIndex].done = !meeting.tasks[taskIndex].done;
        showNotification('更新に失敗しました', 'error');
    }
}

// 未完了アクション表示切り替え
function toggleOutstandingActions() {
    const list = document.getElementById('outstandingActionsList');
    const toggleText = document.getElementById('toggleActionsText');
    
    if (list.style.display === 'none') {
        list.style.display = 'block';
        toggleText.textContent = '非表示';
        renderOutstandingActions();
    } else {
        list.style.display = 'none';
        toggleText.textContent = '表示';
    }
}

// 未完了アクションレンダリング（セキュリティ改善版）
function renderOutstandingActions() {
    const outstandingTasks = [];
    
    meetings.forEach(meeting => {
        if (meeting.tasks && meeting.tasks.length > 0) {
            meeting.tasks.forEach((task, index) => {
                if (!task.done) {
                    const contact = contacts.find(c => c.id === meeting.contactId);
                    outstandingTasks.push({
                        meeting: meeting,
                        contact: contact,
                        task: task,
                        taskIndex: index,
                        isOverdue: task.due && new Date(task.due) < new Date()
                    });
                }
            });
        }
    });
    
    outstandingTasks.sort((a, b) => {
        if (a.task.due && b.task.due) {
            return new Date(a.task.due) - new Date(b.task.due);
        }
        if (a.task.due) return -1;
        if (b.task.due) return 1;
        return new Date(b.meeting.createdAt) - new Date(a.meeting.createdAt);
    });
    
    const container = document.getElementById('outstandingActionsList');
    
    if (outstandingTasks.length === 0) {
        container.innerHTML = '<p style="color: #aaaaaa;">未完了のアクションはありません。</p>';
        return;
    }
    
    const html = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="border-bottom: 1px solid #444;">
                    <th style="text-align: left; padding: 8px;">連絡先</th>
                    <th style="text-align: left; padding: 8px;">アクション内容</th>
                    <th style="text-align: left; padding: 8px;">期限</th>
                    <th style="text-align: center; padding: 8px;">完了</th>
                </tr>
            </thead>
            <tbody>
                ${outstandingTasks.map(item => {
                    if (!item.contact) return '';
                    return `
                    <tr>
                        <td style="padding: 8px;">
                            <a href="#" onclick="showContactDetail('${item.contact.id}'); return false;">
                                ${escapeHtml(item.contact.name)}
                            </a>
                        </td>
                        <td style="padding: 8px; max-width: 400px;">
                            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                                 ondblclick="startTaskEdit('${item.meeting.id}', ${item.taskIndex})"
                                 id="task-${item.meeting.id}-${item.taskIndex}">
                                ${escapeHtml(item.task.text)}
                            </div>
                        </td>
                        <td style="padding: 8px; ${item.isOverdue ? 'color: #d93025;' : ''}">
                            ${item.task.due ? formatDateTime(item.task.due) : '-'}
                        </td>
                        <td style="padding: 8px; text-align: center;">
                            <input type="checkbox" 
                                   onchange="toggleTaskCompleteNew('${item.meeting.id}', ${item.taskIndex})"
                                   style="cursor: pointer; width: 18px; height: 18px;">
                        </td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// 未完了タスク数取得
function getOutstandingTaskCount() {
    let count = 0;
    meetings.forEach(meeting => {
        if (meeting.tasks && meeting.tasks.length > 0) {
            meeting.tasks.forEach(task => {
                if (!task.done) {
                    count++;
                }
            });
        }
    });
    return count;
}