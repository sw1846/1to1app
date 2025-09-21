// meetings.js - ミーティング・ToDo管理機能

// ミーティングモーダルを開く
function openMeetingModal(contactId, meetingId = null) {
    currentContactId = contactId;
    currentMeetingId = meetingId;
    
    closeModal('contactDetailModal');
    
    const modal = document.getElementById('meetingModal');
    const title = document.getElementById('meetingModalTitle');
    
    if (meetingId) {
        title.textContent = 'ミーティング編集';
        loadMeetingData(meetingId);
    } else {
        title.textContent = 'ミーティング追加';
        document.getElementById('newMeetingDateInput').value = new Date().toISOString().slice(0, 16);
        document.getElementById('newMeetingContentInput').value = '';
        document.getElementById('newTodoList').innerHTML = '<button type="button" class="btn btn-primary" onclick="addNewTodoItem()">➕ ToDo追加</button>';
        document.getElementById('meetingAttachmentList').innerHTML = '';
    }
    
    modal.classList.add('active');
    modal.querySelector('.modal-content').scrollTop = 0;
}

// ミーティングデータ読み込み
function loadMeetingData(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    document.getElementById('newMeetingDateInput').value = meeting.date || '';
    document.getElementById('newMeetingContentInput').value = meeting.content || '';
    
    const todoList = document.getElementById('newTodoList');
    todoList.innerHTML = '';
    
    if (meeting.todos && meeting.todos.length > 0) {
        meeting.todos.forEach(todo => {
            const todoItem = document.createElement('div');
            todoItem.className = 'todo-item';
            todoItem.innerHTML = `
                <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                <input type="text" class="form-input todo-text" placeholder="ToDo内容" value="${escapeHtml(todo.text)}">
                <input type="date" class="form-input" style="width: auto;" value="${todo.dueDate || ''}">
                <button class="btn btn-danger" onclick="this.parentElement.remove()">✕</button>
            `;
            todoList.appendChild(todoItem);
        });
    }
    
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn btn-primary';
    addButton.onclick = addNewTodoItem;
    addButton.innerHTML = '➕ ToDo追加';
    todoList.appendChild(addButton);
    
    if (meeting.attachments) {
        displayAttachments(meeting.attachments, 'meetingAttachmentList');
    }
}

// ミーティング保存
async function saveMeeting() {
    showLoading(true);
    try {
        const contact = contacts.find(c => c.id === currentContactId);
        const contactName = contact ? contact.name : '未設定';
        
        const attachments = getAttachments('meetingAttachmentList');
        for (let i = 0; i < attachments.length; i++) {
            if (attachments[i].data && !attachments[i].path.includes('attachments/')) {
                const filePath = await saveAttachmentToFileSystem(
                    attachments[i].name,
                    attachments[i].data,
                    contactName
                );
                attachments[i].path = filePath;
            }
        }
        
        const meetingData = {
            contactId: currentContactId,
            date: document.getElementById('newMeetingDateInput').value,
            content: document.getElementById('newMeetingContentInput').value,
            todos: getTodos('newTodoList'),
            attachments: attachments
        };

        if (currentMeetingId) {
            const index = meetings.findIndex(m => m.id === currentMeetingId);
            meetings[index] = {
                ...meetings[index],
                ...meetingData,
                updatedAt: new Date().toISOString()
            };
        } else {
            const meeting = {
                id: generateId(),
                ...meetingData,
                createdAt: new Date().toISOString()
            };
            meetings.push(meeting);
        }

        await saveAllData();
        closeModal('meetingModal');
        showContactDetail(currentContactId);
        renderContacts();
        renderTodos();
        updateTodoTabBadge();
        showNotification(currentMeetingId ? 'ミーティングを更新しました' : 'ミーティングを保存しました', 'success');
    } catch (err) {
        console.error('保存エラー:', err);
        showNotification('保存に失敗しました', 'error');
    } finally {
        showLoading(false);
    }
}

// ミーティング編集
function editMeeting(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    
    openMeetingModal(meeting.contactId, meetingId);
}

// ミーティング削除
async function deleteMeeting(meetingId) {
    if (!confirm('このミーティング記録を削除してもよろしいですか？')) {
        return;
    }

    meetings = meetings.filter(m => m.id !== meetingId);
    
    await saveAllData();
    showContactDetail(currentContactId);
    renderContacts();
    renderTodos();
    updateTodoTabBadge();
    showNotification('ミーティングを削除しました', 'success');
}

// ToDo一覧表示
function renderTodos() {
    const container = document.getElementById('todoSummaryList');
    const todos = [];
    
    meetings.forEach(meeting => {
        const contact = contacts.find(c => c.id === meeting.contactId);
        if (meeting.todos) {
            meeting.todos.forEach((todo, todoIndex) => {
                if (!todo.completed) {
                    todos.push({
                        ...todo,
                        contactName: contact ? contact.name : '不明',
                        contactId: meeting.contactId,
                        meetingId: meeting.id,
                        meetingDate: meeting.date,
                        todoIndex: todoIndex
                    });
                }
            });
        }
    });

    todos.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    document.getElementById('todoCount').textContent = `${todos.length}件`;

    container.innerHTML = todos.map(todo => `
        <div class="todo-summary-item">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}
                       onchange="toggleTodoComplete('${todo.meetingId}', ${todo.todoIndex})">
                <span class="todo-summary-contact">${escapeHtml(todo.contactName)}</span>
                <span class="${todo.completed ? 'completed' : ''}">${escapeHtml(todo.text)}</span>
            </div>
            <div>
                ${todo.dueDate ? `<span class="todo-date">期限: ${formatDate(todo.dueDate)}</span>` : ''}
                <button class="btn btn-sm" onclick="showContactDetail('${todo.contactId}')">詳細</button>
            </div>
        </div>
    `).join('') || '<p style="text-align: center; color: var(--text-secondary);">未完了のToDoはありません</p>';
}

// ToDo完了状態の切り替え
async function toggleTodoComplete(meetingId, todoIndex) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting || !meeting.todos || !meeting.todos[todoIndex]) return;
    
    meeting.todos[todoIndex].completed = !meeting.todos[todoIndex].completed;
    await saveAllData();
    
    if (currentContactId && document.getElementById('contactDetailModal').classList.contains('active')) {
        showContactDetail(currentContactId);
    }
    
    renderContacts();
    renderTodos();
    updateTodoTabBadge();
    showNotification('ToDoを更新しました', 'success');
}

// ToDoタブバッジの更新
function updateTodoTabBadge() {
    const badge = document.getElementById('todoTabBadge');
    let totalUncompletedTodos = 0;
    
    meetings.forEach(meeting => {
        if (meeting.todos) {
            totalUncompletedTodos += meeting.todos.filter(todo => !todo.completed).length;
        }
    });
    
    if (totalUncompletedTodos > 0) {
        badge.textContent = totalUncompletedTodos;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// ToDo項目追加
function addTodoItem() {
    const todoList = document.getElementById('todoList');
    const todoItem = document.createElement('div');
    todoItem.className = 'todo-item';
    todoItem.innerHTML = `
        <input type="checkbox" class="todo-checkbox">
        <input type="text" class="form-input todo-text" placeholder="ToDo内容">
        <input type="date" class="form-input" style="width: auto;">
        <button class="btn btn-danger" onclick="this.parentElement.remove()">✕</button>
    `;
    todoList.insertBefore(todoItem, todoList.lastElementChild);
}

function addNewTodoItem() {
    const todoList = document.getElementById('newTodoList');
    const todoItem = document.createElement('div');
    todoItem.className = 'todo-item';
    todoItem.innerHTML = `
        <input type="checkbox" class="todo-checkbox">
        <input type="text" class="form-input todo-text" placeholder="ToDo内容">
        <input type="date" class="form-input" style="width: auto;">
        <button class="btn btn-danger" onclick="this.parentElement.remove()">✕</button>
    `;
    todoList.insertBefore(todoItem, todoList.lastElementChild);
}

// ToDoリストを取得
function getTodos(listId) {
    const todoList = document.getElementById(listId);
    const todoItems = todoList.querySelectorAll('.todo-item');
    return Array.from(todoItems).map(item => {
        const checkbox = item.querySelector('.todo-checkbox');
        const textInput = item.querySelector('.todo-text');
        const dateInput = item.querySelector('input[type="date"]');
        
        if (!textInput || !textInput.value.trim()) return null;
        
        return {
            text: textInput.value,
            completed: checkbox ? checkbox.checked : false,
            dueDate: dateInput ? dateInput.value : null
        };
    }).filter(todo => todo !== null);
}

// 最新のミーティング日時を取得
function getLatestMeetingDate(contactId) {
    const contactMeetings = meetings.filter(m => m.contactId === contactId);
    if (contactMeetings.length === 0) return null;
    
    return contactMeetings.reduce((latest, meeting) => {
        const meetingDate = new Date(meeting.date);
        return meetingDate > latest ? meetingDate : latest;
    }, new Date(0));
}

// ミーティング数を取得
function getMeetingCount(contactId) {
    return meetings.filter(m => m.contactId === contactId).length;
}