// meetings.js - 分散ファイル構造対応のミーティング・ToDo管理機能

// ミーティングモーダルを開く
function openMeetingModal(contactId, meetingId = null) {
    currentContactId = contactId;
    currentMeetingId = meetingId;
    
    if (typeof closeModal === 'function') {
        closeModal('contactDetailModal');
    }
    
    const modal = document.getElementById('meetingModal');
    const title = document.getElementById('meetingModalTitle');
    
    if (!modal || !title) {
        console.error('Meeting modal elements not found');
        return;
    }
    
    if (meetingId) {
        title.textContent = 'ミーティング編集';
        loadMeetingData(meetingId);
    } else {
        title.textContent = 'ミーティング追加';
        resetMeetingForm();
    }
    
    modal.classList.add('active');
    modal.querySelector('.modal-content').scrollTop = 0;
}

// ミーティングフォームリセット
function resetMeetingForm() {
    const dateInput = document.getElementById('newMeetingDateInput');
    const contentInput = document.getElementById('newMeetingContentInput');
    const todoList = document.getElementById('newTodoList');
    const attachmentList = document.getElementById('meetingAttachmentList');
    
    if (dateInput) {
        dateInput.value = new Date().toISOString().slice(0, 16);
    }
    if (contentInput) {
        contentInput.value = '';
    }
    if (todoList) {
        todoList.innerHTML = '<button type="button" class="btn btn-primary" onclick="addNewTodoItem()">➕ ToDo追加</button>';
    }
    if (attachmentList) {
        attachmentList.innerHTML = '';
    }
}

// ミーティングデータ読み込み
function loadMeetingData(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    const dateInput = document.getElementById('newMeetingDateInput');
    const contentInput = document.getElementById('newMeetingContentInput');
    const todoList = document.getElementById('newTodoList');
    
    if (dateInput) {
        dateInput.value = meeting.date || '';
    }
    if (contentInput) {
        contentInput.value = meeting.content || '';
    }
    
    // ToDoリスト読み込み
    if (todoList) {
        todoList.innerHTML = '';
        
        if (meeting.todos && meeting.todos.length > 0) {
            meeting.todos.forEach(todo => {
                const todoItem = document.createElement('div');
                todoItem.className = 'todo-item';
                todoItem.innerHTML = `
                    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                    <input type="text" class="form-input todo-text" placeholder="ToDo内容" value="${escapeHtml(todo.text)}">
                    <input type="date" class="form-input" style="width: auto;" value="${todo.dueDate || ''}">
                    <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
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
    }
    
    // 添付ファイル読み込み
    if (meeting.attachments && typeof displayAttachments === 'function') {
        displayAttachments(meeting.attachments, 'meetingAttachmentList');
    }
}

// 新しいミーティングIDを生成
function generateMeetingId() {
    if (typeof metadata !== 'undefined' && metadata.nextMeetingId) {
        const newId = String(metadata.nextMeetingId).padStart(6, '0');
        metadata.nextMeetingId++;
        return newId;
    }
    
    // フォールバック：既存の最大IDから次のIDを生成
    let maxId = 0;
    meetings.forEach(meeting => {
        const id = parseInt(meeting.id) || 0;
        if (id > maxId) {
            maxId = id;
        }
    });
    
    return String(maxId + 1).padStart(6, '0');
}

// ミーティング保存
async function saveMeeting() {
    if (typeof showLoading === 'function') {
        showLoading(true);
    }
    
    try {
        const contact = contacts.find(c => c.id === currentContactId);
        const contactName = contact ? contact.name : '未設定';
        
        // 添付ファイルの処理
        const attachments = typeof getAttachments === 'function' ? getAttachments('meetingAttachmentList') : [];
        for (let i = 0; i < attachments.length; i++) {
            if (attachments[i].data && !attachments[i].path.includes('attachments/') && !attachments[i].path.startsWith('drive:')) {
                if (typeof saveAttachmentToMeetingFileSystem === 'function') {
                    const filePath = await saveAttachmentToMeetingFileSystem(
                        attachments[i].name,
                        attachments[i].data,
                        currentMeetingId || generateMeetingId()
                    );
                    attachments[i].path = filePath;
                } else if (typeof saveAttachmentToFileSystem === 'function') {
                    // フォールバック：連絡先用のファイルシステムを使用
                    const filePath = await saveAttachmentToFileSystem(
                        attachments[i].name,
                        attachments[i].data,
                        contactName
                    );
                    attachments[i].path = filePath;
                }
            }
        }
        
        const dateInput = document.getElementById('newMeetingDateInput');
        const contentInput = document.getElementById('newMeetingContentInput');
        
        const meetingData = {
            contactId: currentContactId,
            date: dateInput ? dateInput.value : '',
            content: contentInput ? contentInput.value : '',
            todos: typeof getTodos === 'function' ? getTodos('newTodoList') : [],
            attachments: attachments
        };

        if (currentMeetingId) {
            // 編集の場合
            const index = meetings.findIndex(m => m.id === currentMeetingId);
            if (index !== -1) {
                meetings[index] = {
                    ...meetings[index],
                    ...meetingData,
                    updatedAt: new Date().toISOString()
                };
            }
        } else {
            // 新規追加の場合
            const meeting = {
                id: generateMeetingId(),
                ...meetingData,
                createdAt: new Date().toISOString()
            };
            meetings.push(meeting);
        }

        // 分散ファイル構造でデータを保存
        if (typeof saveAllData === 'function') {
            await saveAllData();
        }
        
        if (typeof closeModal === 'function') {
            closeModal('meetingModal');
        }
        
        if (typeof showContactDetail === 'function') {
            showContactDetail(currentContactId);
        }
        
        // UI更新
        if (typeof renderContacts === 'function') {
            renderContacts();
        }
        if (typeof renderTodos === 'function') {
            renderTodos();
        }
        if (typeof updateTodoTabBadge === 'function') {
            updateTodoTabBadge();
        }
        
        if (typeof showNotification === 'function') {
            showNotification(currentMeetingId ? 'ミーティングを更新しました' : 'ミーティングを保存しました', 'success');
        }
    } catch (err) {
        console.error('保存エラー:', err);
        if (typeof showNotification === 'function') {
            showNotification('保存に失敗しました', 'error');
        }
    } finally {
        if (typeof showLoading === 'function') {
            showLoading(false);
        }
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

    const meetingToDelete = meetings.find(m => m.id === meetingId);
    if (!meetingToDelete) return;

    const contactId = meetingToDelete.contactId;
    
    // データから削除
    meetings = meetings.filter(m => m.id !== meetingId);
    
    // 分散ファイル構造でデータを保存（関連するミーティングファイルが更新される）
    if (typeof saveAllData === 'function') {
        await saveAllData();
    }
    
    if (typeof showContactDetail === 'function') {
        showContactDetail(currentContactId);
    }
    
    // UI更新
    if (typeof renderContacts === 'function') {
        renderContacts();
    }
    if (typeof renderTodos === 'function') {
        renderTodos();
    }
    if (typeof updateTodoTabBadge === 'function') {
        updateTodoTabBadge();
    }
    
    if (typeof showNotification === 'function') {
        showNotification('ミーティングを削除しました', 'success');
    }
}

// ToDo一覧表示
function renderTodos() {
    const container = document.getElementById('todoSummaryList');
    if (!container) return;
    
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

    // 期限順でソート
    todos.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    const todoCountElement = document.getElementById('todoCount');
    if (todoCountElement) {
        todoCountElement.textContent = `${todos.length}件`;
    }

    container.innerHTML = todos.map(todo => `
        <div class="todo-summary-item">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}
                       onchange="toggleTodoComplete('${todo.meetingId}', ${todo.todoIndex})">
                <span class="todo-summary-contact">${escapeHtml(todo.contactName)}</span>
                <span class="${todo.completed ? 'completed' : ''}">${escapeHtml(todo.text)}</span>
            </div>
            <div>
                ${todo.dueDate ? `<span class="todo-date">期限: ${typeof formatDate === 'function' ? formatDate(todo.dueDate) : todo.dueDate}</span>` : ''}
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
    
    // 分散ファイル構造でデータを保存
    if (typeof saveAllData === 'function') {
        await saveAllData();
    }
    
    // 現在連絡先詳細が表示されている場合は更新
    const contactDetailModal = document.getElementById('contactDetailModal');
    if (currentContactId && contactDetailModal && contactDetailModal.classList.contains('active')) {
        if (typeof showContactDetail === 'function') {
            showContactDetail(currentContactId);
        }
    }
    
    // UI更新
    if (typeof renderContacts === 'function') {
        renderContacts();
    }
    if (typeof renderTodos === 'function') {
        renderTodos();
    }
    if (typeof updateTodoTabBadge === 'function') {
        updateTodoTabBadge();
    }
    
    if (typeof showNotification === 'function') {
        showNotification('ToDoを更新しました', 'success');
    }
}

// ToDoタブバッジの更新
function updateTodoTabBadge() {
    const badge = document.getElementById('todoTabBadge');
    if (!badge) return;
    
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

// ToDo項目追加（初回ミーティング用）
function addTodoItem() {
    const todoList = document.getElementById('todoList');
    if (!todoList) return;
    
    const todoItem = document.createElement('div');
    todoItem.className = 'todo-item';
    todoItem.innerHTML = `
        <input type="checkbox" class="todo-checkbox">
        <input type="text" class="form-input todo-text" placeholder="ToDo内容">
        <input type="date" class="form-input" style="width: auto;">
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
    `;
    todoList.insertBefore(todoItem, todoList.lastElementChild);
}

// ToDo項目追加（新規ミーティング用）
function addNewTodoItem() {
    const todoList = document.getElementById('newTodoList');
    if (!todoList) return;
    
    const todoItem = document.createElement('div');
    todoItem.className = 'todo-item';
    todoItem.innerHTML = `
        <input type="checkbox" class="todo-checkbox">
        <input type="text" class="form-input todo-text" placeholder="ToDo内容">
        <input type="date" class="form-input" style="width: auto;">
        <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">✕</button>
    `;
    todoList.insertBefore(todoItem, todoList.lastElementChild);
}

// ToDoリストを取得
function getTodos(listId) {
    const todoList = document.getElementById(listId);
    if (!todoList) return [];
    
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
        if (!meeting.date) return latest;
        const meetingDate = new Date(meeting.date);
        return meetingDate > latest ? meetingDate : latest;
    }, new Date(0));
}

// ミーティング数を取得
function getMeetingCount(contactId) {
    return meetings.filter(m => m.contactId === contactId).length;
}

// 特定の連絡先のミーティング一覧を取得
function getContactMeetings(contactId) {
    return meetings.filter(m => m.contactId === contactId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// 特定の連絡先の未完了ToDo数を取得
function getContactTodoCount(contactId) {
    const contactMeetings = meetings.filter(m => m.contactId === contactId);
    return contactMeetings.reduce((sum, meeting) => {
        return sum + (meeting.todos?.filter(todo => !todo.completed).length || 0);
    }, 0);
}

// ミーティング内容の検索
function searchMeetings(query) {
    if (!query || query.trim() === '') return meetings;
    
    const lowerQuery = query.toLowerCase();
    return meetings.filter(meeting => {
        const contact = contacts.find(c => c.id === meeting.contactId);
        const contactName = contact ? contact.name.toLowerCase() : '';
        const meetingContent = meeting.content ? meeting.content.toLowerCase() : '';
        const todoTexts = meeting.todos ? meeting.todos.map(t => t.text.toLowerCase()).join(' ') : '';
        
        return contactName.includes(lowerQuery) ||
               meetingContent.includes(lowerQuery) ||
               todoTexts.includes(lowerQuery);
    });
}

// 期限が近いToDoを取得
function getUpcomingTodos(days = 7) {
    const todos = [];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    
    meetings.forEach(meeting => {
        const contact = contacts.find(c => c.id === meeting.contactId);
        if (meeting.todos) {
            meeting.todos.forEach((todo, todoIndex) => {
                if (!todo.completed && todo.dueDate) {
                    const dueDate = new Date(todo.dueDate);
                    if (dueDate <= targetDate) {
                        todos.push({
                            ...todo,
                            contactName: contact ? contact.name : '不明',
                            contactId: meeting.contactId,
                            meetingId: meeting.id,
                            todoIndex: todoIndex,
                            daysUntilDue: Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24))
                        });
                    }
                }
            });
        }
    });
    
    return todos.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

// 完了したToDoの統計を取得
function getTodoStatistics() {
    let totalTodos = 0;
    let completedTodos = 0;
    const contactStats = {};
    
    meetings.forEach(meeting => {
        const contact = contacts.find(c => c.id === meeting.contactId);
        const contactName = contact ? contact.name : '不明';
        
        if (!contactStats[contactName]) {
            contactStats[contactName] = { total: 0, completed: 0 };
        }
        
        if (meeting.todos) {
            meeting.todos.forEach(todo => {
                totalTodos++;
                contactStats[contactName].total++;
                
                if (todo.completed) {
                    completedTodos++;
                    contactStats[contactName].completed++;
                }
            });
        }
    });
    
    return {
        totalTodos,
        completedTodos,
        completionRate: totalTodos > 0 ? (completedTodos / totalTodos * 100).toFixed(1) : 0,
        contactStats
    };
}

// ミーティング频度の分析
function getMeetingFrequencyAnalysis() {
    const contactFrequency = {};
    const monthlyMeetings = {};
    
    meetings.forEach(meeting => {
        const contact = contacts.find(c => c.id === meeting.contactId);
        const contactName = contact ? contact.name : '不明';
        
        // 連絡先別の频度
        if (!contactFrequency[contactName]) {
            contactFrequency[contactName] = 0;
        }
        contactFrequency[contactName]++;
        
        // 月別の频度
        if (meeting.date) {
            const monthKey = meeting.date.slice(0, 7); // YYYY-MM形式
            if (!monthlyMeetings[monthKey]) {
                monthlyMeetings[monthKey] = 0;
            }
            monthlyMeetings[monthKey]++;
        }
    });
    
    return {
        contactFrequency,
        monthlyMeetings,
        totalMeetings: meetings.length,
        averageMeetingsPerContact: Object.keys(contactFrequency).length > 0 ? 
            (meetings.length / Object.keys(contactFrequency).length).toFixed(1) : 0
    };
}

// ミーティング用添付ファイルの保存（オプション）
async function saveAttachmentToMeetingFileSystem(fileName, dataUrl, meetingId) {
    if (!folderStructure.attachmentsMeetings || !gapi.client.getToken()) return dataUrl;

    try {
        // ミーティングIDのフォルダを作成または取得
        const safeMeetingId = `meeting-${String(meetingId).padStart(6, '0')}`;
        let meetingFolderId = await getOrCreateFolder(safeMeetingId, folderStructure.attachmentsMeetings);

        // Base64をBlobに変換
        const byteCharacters = atob(dataUrl.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray]);

        // ファイルをアップロード
        const metadata = {
            name: fileName,
            parents: [meetingFolderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
        form.append('file', blob);

        const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
            {
                method: 'POST',
                headers: new Headers({'Authorization': 'Bearer ' + gapi.client.getToken().access_token}),
                body: form
            }
        );

        const file = await response.json();
        return `drive:${file.id}`;
    } catch (error) {
        console.error('ミーティング添付ファイル保存エラー:', error);
        return dataUrl;
    }
}

// 連絡先のミーティングデータの完全同期
async function syncContactMeetings(contactId) {
    const contactMeetings = meetings.filter(m => m.contactId === contactId);
    
    if (typeof folderStructure !== 'undefined' && folderStructure.meetings) {
        const fileName = `contact-${String(contactId).padStart(6, '0')}-meetings.json`;
        await saveJsonFileToFolder(fileName, contactMeetings, folderStructure.meetings);
        
        // ミーティングインデックスを更新
        if (typeof meetingsIndex !== 'undefined') {
            meetingsIndex[contactId] = {
                contactId: contactId,
                meetingCount: contactMeetings.length,
                lastMeetingDate: contactMeetings.length > 0 ? 
                    Math.max(...contactMeetings.map(m => new Date(m.date || 0).getTime())) : null,
                lastUpdated: new Date().toISOString()
            };
        }
    }
}