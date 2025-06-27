// ===== 未完了アクション管理機能 =====

let outstandingActionsVisible = false;

// 未完了アクションの表示/非表示切り替え
function toggleOutstandingActions() {
    outstandingActionsVisible = !outstandingActionsVisible;
    const actionsList = document.getElementById('outstandingActionsList');
    const toggleText = document.getElementById('toggleActionsText');
    
    if (outstandingActionsVisible) {
        renderOutstandingActions();
        actionsList.style.display = 'block';
        toggleText.textContent = '非表示';
    } else {
        actionsList.style.display = 'none';
        toggleText.textContent = '表示';
    }
}

// 未完了アクションの描画
function renderOutstandingActions() {
    const container = document.getElementById('outstandingActionsList');
    if (!container) return;
    
    // すべての未完了タスクを収集
    const outstandingTasks = [];
    
    meetings.forEach(meeting => {
        if (meeting.tasks && meeting.tasks.length > 0) {
            const contact = contacts.find(c => c.id === meeting.contactId);
            if (!contact) return;
            
            meeting.tasks.forEach((task, index) => {
                if (!task.done) {
                    outstandingTasks.push({
                        task: task,
                        meeting: meeting,
                        contact: contact,
                        taskIndex: index,
                        dueDate: task.due ? new Date(task.due) : null,
                        isOverdue: task.due && new Date(task.due) < new Date()
                    });
                }
            });
        }
    });
    
    // 期限でソート（期限なし → 期限あり（昇順））
    outstandingTasks.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate - b.dueDate;
    });
    
    if (outstandingTasks.length === 0) {
        container.innerHTML = '<p style="color: #aaaaaa; text-align: center; padding: 20px;">未完了のアクションはありません</p>';
        return;
    }
    
    // グループ化して表示
    const overdueTasksHtml = renderTaskGroup('期限切れ', outstandingTasks.filter(t => t.isOverdue), 'overdue');
    const todayTasksHtml = renderTaskGroup('本日期限', outstandingTasks.filter(t => isToday(t.dueDate)), 'today');
    const thisWeekTasksHtml = renderTaskGroup('今週期限', outstandingTasks.filter(t => isThisWeek(t.dueDate) && !isToday(t.dueDate)), 'thisweek');
    const laterTasksHtml = renderTaskGroup('それ以降', outstandingTasks.filter(t => t.dueDate && !t.isOverdue && !isToday(t.dueDate) && !isThisWeek(t.dueDate)), 'later');
    const noDueTasksHtml = renderTaskGroup('期限なし', outstandingTasks.filter(t => !t.dueDate), 'nodue');
    
    container.innerHTML = overdueTasksHtml + todayTasksHtml + thisWeekTasksHtml + laterTasksHtml + noDueTasksHtml;
}

// タスクグループの描画
function renderTaskGroup(title, tasks, className) {
    if (tasks.length === 0) return '';
    
    return `
        <div class="outstanding-group ${className}">
            <h4 style="color: ${getGroupColor(className)}; margin-bottom: 10px;">${title} (${tasks.length}件)</h4>
            <div class="outstanding-tasks">
                ${tasks.map(item => renderOutstandingTask(item)).join('')}
            </div>
        </div>
    `;
}

// 未完了タスクアイテムの描画
function renderOutstandingTask(item) {
    const dueText = item.task.due ? formatDate(item.task.due) : '期限なし';
    const meetingDate = formatDate(item.meeting.datetime);
    
    return `
        <div class="outstanding-task-item">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
                <input type="checkbox" 
                       class="task-checkbox" 
                       onchange="toggleTaskStatus('${item.meeting.id}', ${item.taskIndex}); renderOutstandingActions();">
                <div style="flex: 1;">
                    <div class="task-text">${escapeHtml(item.task.text)}</div>
                    <div style="font-size: 12px; color: #aaaaaa; margin-top: 4px;">
                        <a href="#" onclick="showContactDetail('${item.contact.id}'); return false;" style="color: #4c8bf5;">
                            ${escapeHtml(item.contact.name)}
                        </a>
                        <span style="margin: 0 8px;">•</span>
                        <span>ミーティング: ${meetingDate}</span>
                        <span style="margin: 0 8px;">•</span>
                        <span class="${item.isOverdue ? 'overdue' : ''}" style="color: ${item.isOverdue ? '#d93025' : '#aaaaaa'};">
                            期限: ${dueText}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 日付ヘルパー関数
function isToday(date) {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

function isThisWeek(date) {
    if (!date) return false;
    const today = new Date();
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return date >= today && date <= weekFromNow;
}

function getGroupColor(className) {
    switch (className) {
        case 'overdue': return '#d93025';
        case 'today': return '#ff9800';
        case 'thisweek': return '#4c8bf5';
        case 'later': return '#34a853';
        case 'nodue': return '#aaaaaa';
        default: return '#aaaaaa';
    }
}

// スタイルを追加
if (!document.querySelector('#outstandingActionsStyles')) {
    const style = document.createElement('style');
    style.id = 'outstandingActionsStyles';
    style.textContent = `
        .outstanding-group {
            margin-bottom: 25px;
            padding: 15px;
            background: #333333;
            border-radius: 6px;
            border: 1px solid #444444;
        }
        
        .outstanding-group.overdue {
            border-left: 3px solid #d93025;
        }
        
        .outstanding-group.today {
            border-left: 3px solid #ff9800;
        }
        
        .outstanding-group.thisweek {
            border-left: 3px solid #4c8bf5;
        }
        
        .outstanding-group.later {
            border-left: 3px solid #34a853;
        }
        
        .outstanding-group.nodue {
            border-left: 3px solid #aaaaaa;
        }
        
        .outstanding-tasks {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .outstanding-task-item {
            background: #2a2a2a;
            padding: 12px;
            border-radius: 4px;
            border: 1px solid #3a3a3a;
            transition: all 0.2s ease;
        }
        
        .outstanding-task-item:hover {
            border-color: #4c8bf5;
            background: #2d2d2d;
        }
        
        .task-text {
            font-size: 14px;
            line-height: 1.5;
            color: #f0f0f0;
        }
        
        .overdue {
            color: #d93025 !important;
            font-weight: 500;
        }
    `;
    document.head.appendChild(style);
}