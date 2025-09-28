/* ===== meetings.js - ミーティング管理（完全修正版） ===== */

// ミーティング詳細表示
function showMeetingDetail(meetingId) {
    try {
        const meeting = (window.meetings || []).find(m => m.id === meetingId);
        if (!meeting) {
            console.error('Meeting not found:', meetingId);
            return;
        }
        
        const modal = document.getElementById('meetingDetailModal');
        if (!modal) {
            console.error('Meeting detail modal not found');
            return;
        }
        
        // モーダル内容を生成
        const modalContent = generateMeetingDetailHTML(meeting);
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = modalContent;
        }
        
        // モーダル表示
        modal.style.display = 'block';
        
        // 現在のミーティングIDを保存
        window.currentMeetingId = meetingId;
        
    } catch (e) {
        console.error('showMeetingDetail error:', e);
    }
}

// ミーティング詳細HTML生成
function generateMeetingDetailHTML(meeting) {
    try {
        const contactName = getContactName(meeting.contactId);
        const date = meeting.date ? formatDate(meeting.date) : '';
        const time = meeting.time || '';
        
        return `
            <div class="meeting-detail-header">
                <h3>${escapeHtml(meeting.title || 'タイトルなし')}</h3>
                <div class="meeting-meta">
                    <p><strong>連絡先:</strong> <a href="#" onclick="showContactDetailFromMeeting('${meeting.contactId}')">${escapeHtml(contactName)}</a></p>
                    <p><strong>日時:</strong> ${date} ${time}</p>
                    <p><strong>場所:</strong> ${escapeHtml(meeting.location || '')}</p>
                </div>
            </div>
            <div class="meeting-detail-body">
                <div class="detail-section">
                    <h4>内容</h4>
                    <div class="meeting-content">${formatMeetingContent(meeting.content)}</div>
                </div>
                ${meeting.todos && meeting.todos.length > 0 ? `
                    <div class="detail-section">
                        <h4>TODO</h4>
                        <div class="todos-list">
                            ${meeting.todos.map(todo => generateTodoHTML(todo)).join('')}
                        </div>
                    </div>
                ` : ''}
                ${meeting.attachments && meeting.attachments.length > 0 ? `
                    <div class="detail-section">
                        <h4>添付ファイル</h4>
                        <div class="attachments-list">
                            ${meeting.attachments.map((attachment, index) => generateAttachmentHTML(attachment, index)).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    } catch (e) {
        console.error('generateMeetingDetailHTML error:', e);
        return '<div class="error">詳細表示でエラーが発生しました</div>';
    }
}

// ミーティング内容フォーマット
function formatMeetingContent(content) {
    if (!content) return '';
    
    try {
        // Markdownライクな簡易変換
        let formatted = escapeHtml(content);
        
        // 改行を<br>に変換
        formatted = formatted.replace(/\n/g, '<br>');
        
        // **太字** を <strong> に変換
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // *斜体* を <em> に変換
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return formatted;
    } catch (e) {
        console.error('formatMeetingContent error:', e);
        return escapeHtml(content);
    }
}

// TODO項目HTML生成
function generateTodoHTML(todo) {
    try {
        const checked = todo.completed ? 'checked' : '';
        const completedClass = todo.completed ? 'completed' : '';
        const dueDate = todo.dueDate ? ` (期限: ${formatDate(todo.dueDate)})` : '';
        
        return `
            <div class="todo-item ${completedClass}">
                <input type="checkbox" ${checked} disabled>
                <span class="todo-text">${escapeHtml(todo.text)}${dueDate}</span>
            </div>
        `;
    } catch (e) {
        console.error('generateTodoHTML error:', e);
        return '<div class="todo-item error">TODO表示エラー</div>';
    }
}

// 添付ファイルHTML生成
function generateAttachmentHTML(attachment, index) {
    try {
        const fileIcon = getFileIcon(attachment.name);
        const fileSize = attachment.size ? formatFileSize(attachment.size) : '';
        
        return `
            <div class="attachment-item" onclick="openMeetingAttachment('${window.currentMeetingId}', ${index})">
                <span class="file-icon">${fileIcon}</span>
                <span class="file-name">${escapeHtml(attachment.name)}</span>
                <span class="file-size">${fileSize}</span>
            </div>
        `;
    } catch (e) {
        console.error('generateAttachmentHTML error:', e);
        return '<div class="attachment-item error">ファイル表示エラー</div>';
    }
}

// ファイルアイコン取得
function getFileIcon(filename) {
    try {
        if (!filename) return '📄';
        
        const ext = filename.toLowerCase().split('.').pop();
        const iconMap = {
            pdf: '📄',
            doc: '📝',
            docx: '📝',
            xls: '📊',
            xlsx: '📊',
            ppt: '📋',
            pptx: '📋',
            jpg: '🖼️',
            jpeg: '🖼️',
            png: '🖼️',
            gif: '🖼️',
            mp4: '🎥',
            mov: '🎥',
            avi: '🎥',
            mp3: '🎵',
            wav: '🎵',
            zip: '🗜️',
            rar: '🗜️',
            '7z': '🗜️'
        };
        
        return iconMap[ext] || '📄';
    } catch (e) {
        return '📄';
    }
}

// ミーティングから連絡先詳細表示
function showContactDetailFromMeeting(contactId) {
    try {
        // ミーティング詳細モーダルを閉じる
        const meetingModal = document.getElementById('meetingDetailModal');
        if (meetingModal) {
            meetingModal.style.display = 'none';
        }
        
        // 連絡先詳細を表示
        if (window.showContactDetail) {
            window.showContactDetail(contactId);
        }
        
    } catch (e) {
        console.error('showContactDetailFromMeeting error:', e);
    }
}

// ミーティング添付ファイルを開く
function openMeetingAttachment(meetingId, attachmentIndex) {
    try {
        const meeting = (window.meetings || []).find(m => m.id === meetingId);
        if (!meeting || !meeting.attachments || !meeting.attachments[attachmentIndex]) {
            console.error('Attachment not found:', meetingId, attachmentIndex);
            return;
        }
        
        const attachment = meeting.attachments[attachmentIndex];
        
        // ファイルを開く処理
        if (attachment.url) {
            window.open(attachment.url, '_blank');
        } else if (attachment.data) {
            // Base64データの場合
            const blob = base64ToBlob(attachment.data, attachment.type);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            
            // メモリリークを防ぐため、しばらく後にURLを解放
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } else {
            console.warn('Attachment data not available:', attachment);
            showNotification('ファイルを開けませんでした', 'warning');
        }
        
    } catch (e) {
        console.error('openMeetingAttachment error:', e);
        showNotification('ファイルを開く際にエラーが発生しました', 'error');
    }
}

// Base64をBlobに変換
function base64ToBlob(base64, mimeType) {
    try {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    } catch (e) {
        console.error('base64ToBlob error:', e);
        return null;
    }
}

// 新規ミーティング作成
function createNewMeeting(contactId) {
    try {
        const newMeeting = {
            id: generateUUID(),
            contactId: contactId,
            title: '',
            date: new Date().toISOString().split('T')[0],
            time: '',
            location: '',
            content: '',
            todos: [],
            attachments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // 編集モーダルを表示
        showMeetingEditModal(newMeeting, true);
        
    } catch (e) {
        console.error('createNewMeeting error:', e);
    }
}

// ミーティング編集モーダル表示
function showMeetingEditModal(meeting, isNew = false) {
    try {
        const modal = document.getElementById('meetingEditModal');
        if (!modal) {
            console.error('Meeting edit modal not found');
            return;
        }
        
        // フォームにデータを設定
        populateMeetingForm(meeting);
        
        // モーダルのタイトルを設定
        const modalTitle = modal.querySelector('.modal-title');
        if (modalTitle) {
            modalTitle.textContent = isNew ? '新規ミーティング' : 'ミーティング編集';
        }
        
        modal.style.display = 'block';
        
        // 現在編集中のミーティングを保存
        window.currentEditingMeeting = meeting;
        window.isNewMeeting = isNew;
        
    } catch (e) {
        console.error('showMeetingEditModal error:', e);
    }
}

// ミーティングフォームにデータ設定
function populateMeetingForm(meeting) {
    try {
        const formFields = {
            'meetingTitle': meeting.title || '',
            'meetingDate': meeting.date || '',
            'meetingTime': meeting.time || '',
            'meetingLocation': meeting.location || '',
            'meetingContent': meeting.content || ''
        };
        
        Object.entries(formFields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = value;
            }
        });
        
        // 連絡先選択
        const contactSelect = document.getElementById('meetingContact');
        if (contactSelect && meeting.contactId) {
            contactSelect.value = meeting.contactId;
        }
        
    } catch (e) {
        console.error('populateMeetingForm error:', e);
    }
}

// ミーティング保存
function saveMeeting() {
    try {
        const meeting = window.currentEditingMeeting;
        const isNew = window.isNewMeeting;
        
        if (!meeting) {
            console.error('No meeting to save');
            return;
        }
        
        // フォームデータを収集
        const formData = {
            title: document.getElementById('meetingTitle')?.value || '',
            date: document.getElementById('meetingDate')?.value || '',
            time: document.getElementById('meetingTime')?.value || '',
            location: document.getElementById('meetingLocation')?.value || '',
            content: document.getElementById('meetingContent')?.value || '',
            contactId: document.getElementById('meetingContact')?.value || meeting.contactId
        };
        
        // バリデーション
        if (!formData.title.trim()) {
            showNotification('タイトルを入力してください', 'warning');
            return;
        }
        
        if (!formData.contactId) {
            showNotification('連絡先を選択してください', 'warning');
            return;
        }
        
        // ミーティングデータを更新
        Object.assign(meeting, formData);
        meeting.updatedAt = new Date().toISOString();
        
        // ミーティング配列に追加/更新
        if (!window.meetings) {
            window.meetings = [];
        }
        
        if (isNew) {
            window.meetings.push(meeting);
        } else {
            const index = window.meetings.findIndex(m => m.id === meeting.id);
            if (index >= 0) {
                window.meetings[index] = meeting;
            }
        }
        
        // Google Driveに保存
        if (window.saveMeetingToFolder) {
            window.saveMeetingToFolder(meeting).then(() => {
                showNotification('ミーティングを保存しました', 'success');
                
                // モーダルを閉じる
                closeMeetingEditModal();
                
                // UIを更新
                renderMeetings();
                
            }).catch(e => {
                console.error('Save meeting error:', e);
                showNotification('保存に失敗しました: ' + e.message, 'error');
            });
        } else {
            console.warn('saveMeetingToFolder function not available');
            showNotification('保存機能が利用できません', 'warning');
        }
        
    } catch (e) {
        console.error('saveMeeting error:', e);
        showNotification('保存エラー: ' + e.message, 'error');
    }
}

// モーダル閉じる
function closeMeetingDetailModal() {
    const modal = document.getElementById('meetingDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function closeMeetingEditModal() {
    const modal = document.getElementById('meetingEditModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // 編集状態をクリア
    window.currentEditingMeeting = null;
    window.isNewMeeting = false;
}

// 連絡先のミーティング履歴取得
function getContactMeetings(contactId) {
    try {
        if (!contactId || !window.meetings) return [];
        
        return window.meetings
            .filter(meeting => meeting.contactId === contactId)
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    } catch (e) {
        console.error('getContactMeetings error:', e);
        return [];
    }
}

// 連絡先の最新ミーティング取得
function getLastMeeting(contactId) {
    try {
        const meetings = getContactMeetings(contactId);
        return meetings.length > 0 ? meetings[0] : null;
    } catch (e) {
        console.error('getLastMeeting error:', e);
        return null;
    }
}

// ミーティング統計取得
function getMeetingStats(contactId) {
    try {
        const meetings = getContactMeetings(contactId);
        
        return {
            total: meetings.length,
            thisMonth: meetings.filter(m => {
                const meetingDate = new Date(m.date);
                const now = new Date();
                return meetingDate.getMonth() === now.getMonth() && 
                       meetingDate.getFullYear() === now.getFullYear();
            }).length,
            lastMeeting: meetings.length > 0 ? meetings[0] : null
        };
    } catch (e) {
        console.error('getMeetingStats error:', e);
        return { total: 0, thisMonth: 0, lastMeeting: null };
    }
}

// グローバル関数エクスポート
window.showMeetingDetail = showMeetingDetail;
window.showContactDetailFromMeeting = showContactDetailFromMeeting;
window.openMeetingAttachment = openMeetingAttachment;
window.createNewMeeting = createNewMeeting;
window.saveMeeting = saveMeeting;
window.closeMeetingDetailModal = closeMeetingDetailModal;
window.closeMeetingEditModal = closeMeetingEditModal;
window.getContactMeetings = getContactMeetings;
window.getLastMeeting = getLastMeeting;
window.getMeetingStats = getMeetingStats;