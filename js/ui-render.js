// ===== UI描画機能 =====

// 連絡先リストの描画
function renderContactList() {
    const grid = document.getElementById('contactGrid');
    if (!grid) return;
    
    const filteredContacts = filterAndSortContacts();
    
    if (viewMode === 'card') {
        renderCardView(grid, filteredContacts);
    } else {
        renderListView(grid, filteredContacts);
    }
}

// カード表示の描画
function renderCardView(container, contacts) {
    container.className = 'contact-grid';
    container.innerHTML = contacts.map(contact => {
        const lastMeeting = getLastMeetingDate(contact.id);
        const lastMeetingText = lastMeeting ? 
            `最終: ${formatDate(lastMeeting)}` : 
            'ミーティング記録なし';
        
        const escapedName = escapeHtml(contact.name).replace(/'/g, "\\'");
        
        return `
            <div class="contact-card" onclick="showContactDetail('${contact.id}')">
                <div class="contact-photo">
                    ${contact.photoUrl && !contact.photoUrl.includes('dropbox') ? 
                        `<img src="${contact.photoUrl}" alt="${escapeHtml(contact.name)}" loading="lazy" onerror="handleImageError(this, '${escapedName}')">` : 
                        `<span>${escapeHtml(contact.name.charAt(0))}</span>`
                    }
                </div>
                <div class="contact-name">${escapeHtml(contact.name)}</div>
                ${contact.company ? `<div class="contact-info">${escapeHtml(contact.company)}</div>` : ''}
                ${contact.emails && contact.emails.length > 0 ? 
                    `<div class="contact-info">${escapeHtml(contact.emails[0])}</div>` :
                    (contact.email ? `<div class="contact-info">${escapeHtml(contact.email)}</div>` : '')
                }
                <div class="last-meeting-info">${lastMeetingText}</div>
                ${renderContactTags(contact)}
            </div>
        `;
    }).join('');
}

// リスト表示の描画
function renderListView(container, contacts) {
    container.className = 'contact-list';
    container.innerHTML = contacts.map(contact => {
        const lastMeeting = getLastMeetingDate(contact.id);
        const lastMeetingText = lastMeeting ? 
            `最終: ${formatDate(lastMeeting)}` : '';
        
        const escapedName = escapeHtml(contact.name).replace(/'/g, "\\'");
        
        return `
            <div class="contact-list-item" onclick="showContactDetail('${contact.id}')">
                <div class="contact-list-photo">
                    ${contact.photoUrl && !contact.photoUrl.includes('dropbox') ? 
                        `<img src="${contact.photoUrl}" alt="${escapeHtml(contact.name)}" loading="lazy" onerror="handleImageError(this, '${escapedName}')">` : 
                        `<span>${escapeHtml(contact.name.charAt(0))}</span>`
                    }
                </div>
                <div class="contact-list-info">
                    <div class="contact-list-name">
                        ${escapeHtml(contact.name)}
                        ${contact.yomi ? `<span style="color: #aaaaaa; font-size: 12px;">(${escapeHtml(contact.yomi)})</span>` : ''}
                    </div>
                    <div class="contact-list-company">${contact.company ? escapeHtml(contact.company) : ''}</div>
                </div>
                ${lastMeetingText ? `<div class="contact-list-meeting">${lastMeetingText}</div>` : ''}
                ${renderContactTags(contact)}
            </div>
        `;
    }).join('');
}

// 連絡先のタグを描画
function renderContactTags(contact) {
    const tags = [];
    
    if (contact.types && contact.types.length > 0) {
        tags.push(...contact.types);
    }
    if (contact.affiliations && contact.affiliations.length > 0) {
        tags.push(...contact.affiliations.slice(0, 2));
    }
    
    if (tags.length === 0) return '';
    
    return `
        <div class="tags">
            ${tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            ${tags.length > 3 ? `<span class="tag">+${tags.length - 3}</span>` : ''}
        </div>
    `;
}

// ミーティング履歴の描画
function renderMeetingHistory(meetings) {
    return meetings.map(meeting => `
        <div class="meeting-item">
            <div class="meeting-date">${formatDateTime(meeting.datetime)}</div>
            <div class="meeting-content">
                <div class="markdown">${renderMarkdown(meeting.content)}</div>
            </div>
            ${meeting.tasks && meeting.tasks.length > 0 ? `
                <div class="meeting-tasks">
                    <strong>タスク:</strong>
                    <ul class="task-list">
                        ${meeting.tasks.map((task, index) => renderTaskItem(task, meeting.id, index)).join('')}
                    </ul>
                </div>
            ` : ''}
            ${meeting.attachments && meeting.attachments.length > 0 ? `
                <div class="meeting-attachments">
                    <strong>添付ファイル:</strong>
                    <div class="file-list">
                        ${meeting.attachments.map(att => {
                            const escapedAttName = escapeHtml(att.name).replace(/'/g, "\\'");
                            return `
                                <div class="file-item">
                                    <span>${escapeHtml(att.name)}</span>
                                    <a href="#" onclick="openFile('${att.id || att.url}', '${escapedAttName}'); return false;" class="btn-small btn-secondary">開く</a>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
            <div class="action-buttons">
                <button class="btn-small btn-secondary" onclick="showMeetingForm('${meeting.contactId}', '${meeting.id}')">編集</button>
                <button class="btn-small btn-danger" onclick="deleteMeeting('${meeting.id}')">削除</button>
            </div>
        </div>
    `).join('');
}

// タスクアイテムの描画
function renderTaskItem(task, meetingId, taskIndex) {
    const isOverdue = task.due && new Date(task.due) < new Date() && !task.done;
    const dueText = task.due ? formatDate(task.due) : '';
    
    return `
        <li class="task-item ${task.done ? 'completed' : ''}">
            <input type="checkbox" 
                   class="task-checkbox" 
                   ${task.done ? 'checked' : ''} 
                   onchange="toggleTaskStatus('${meetingId}', ${taskIndex})">
            <span class="task-text" 
                  contenteditable="true" 
                  onblur="updateTaskText('${meetingId}', ${taskIndex}, this.textContent)"
                  onkeydown="handleTaskKeydown(event)">${escapeHtml(task.text)}</span>
            ${dueText ? `<span class="task-due ${isOverdue ? 'overdue' : ''}">${dueText}</span>` : ''}
        </li>
    `;
}

// ドロップダウンオプションの更新
function updateDropdownOptions() {
    // フィルター用のSearchableSelectを更新
    updateFilterDropdowns();
    
    // マルチセレクト用のオプションも更新
    setupMultiSelect();
}

// フィルタードロップダウンの更新
function updateFilterDropdowns() {
    // 各フィルターのSearchableSelectを初期化
    const filters = [
        { id: 'filterTypeWrapper', field: 'types', onChange: filterContacts },
        { id: 'filterAffiliationWrapper', field: 'affiliations', onChange: filterContacts },
        { id: 'filterWantToConnectWrapper', field: 'wantToConnect', onChange: filterContacts },
        { id: 'filterGoldenEggWrapper', field: 'goldenEgg', onChange: filterContacts },
        { id: 'filterAreaWrapper', field: 'area', onChange: filterContacts },
        { id: 'filterResidenceWrapper', field: 'residence', onChange: filterContacts }
    ];
    
    filters.forEach(filter => {
        const wrapper = document.getElementById(filter.id);
        if (wrapper) {
            // 既存のフィールドから一意な値を収集
            const uniqueValues = new Set();
            contacts.forEach(contact => {
                if (filter.field === 'area' || filter.field === 'residence') {
                    if (contact[filter.field]) {
                        uniqueValues.add(contact[filter.field]);
                    }
                } else if (contact[filter.field] && Array.isArray(contact[filter.field])) {
                    contact[filter.field].forEach(value => uniqueValues.add(value));
                }
            });
            
            const options = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, 'ja'));
            new SearchableSelect(wrapper, options, '', filter.onChange);
        }
    });
    
    // 紹介元フィルター（特別処理）
    const referredByWrapper = document.getElementById('filterReferredByWrapper');
    if (referredByWrapper) {
        const referrers = new Set();
        contacts.forEach(contact => {
            if (contact.referredBy) {
                referrers.add(contact.referredBy);
            }
        });
        const referrerOptions = Array.from(referrers).sort((a, b) => a.localeCompare(b, 'ja'));
        new SearchableSelect(referredByWrapper, referrerOptions, '', filterContacts);
    }
}

// ミーティング添付ファイル表示
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

// ミーティング添付ファイル削除マーク
function markMeetingAttachmentForDeletion(fileId) {
    deletedMeetingAttachments.push(fileId);
    event.target.closest('.file-item').style.display = 'none';
}

// 新規ミーティング添付ファイル削除
function removeNewMeetingAttachment(index) {
    selectedMeetingFiles.splice(index, 1);
    displayNewMeetingAttachments();
}