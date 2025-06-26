// ===== ファイルアップロード機能 =====

// ファイルドラッグ&ドロップ設定
function setupFileDragDrop() {
    const photoZone = document.getElementById('photoDropZone');
    const photoInput = document.getElementById('photoUpload');
    
    if (photoZone && photoInput) {
        photoZone.addEventListener('click', () => photoInput.click());
        photoZone.addEventListener('dragover', handleDragOver);
        photoZone.addEventListener('dragleave', handleDragLeave);
        photoZone.addEventListener('drop', (e) => handlePhotoDrop(e));
    }
    
    setupCardImageInput();
    
    const attachmentZone = document.getElementById('attachmentDropZone');
    const attachmentInput = document.getElementById('attachmentUpload');
    
    if (attachmentZone && attachmentInput) {
        attachmentZone.addEventListener('click', () => attachmentInput.click());
        attachmentZone.addEventListener('dragover', handleDragOver);
        attachmentZone.addEventListener('dragleave', handleDragLeave);
        attachmentZone.addEventListener('drop', (e) => handleDrop(e, 'contact'));
        attachmentInput.addEventListener('change', (e) => handleFileSelect(e, 'contact'));
    }
    
    const meetingZone = document.getElementById('meetingAttachmentDropZone');
    const meetingInput = document.getElementById('meetingAttachmentUpload');
    
    if (meetingZone && meetingInput) {
        meetingZone.addEventListener('click', () => meetingInput.click());
        meetingZone.addEventListener('dragover', handleDragOver);
        meetingZone.addEventListener('dragleave', handleDragLeave);
        meetingZone.addEventListener('drop', (e) => handleDrop(e, 'meeting'));
        meetingInput.addEventListener('change', (e) => handleFileSelect(e, 'meeting'));
    }
}

// 名刺画像入力設定
function setupCardImageInput() {
    const cardImageZone = document.getElementById('cardImageDropZone');
    const cardImageInput = document.getElementById('cardImageUpload');
    
    if (!cardImageZone || !cardImageInput) return;
    
    if (window.matchMedia("(max-width: 768px)").matches) {
        cardImageInput.setAttribute('capture', 'camera');
    }
    
    cardImageZone.addEventListener('click', () => cardImageInput.click());
    cardImageZone.addEventListener('dragover', handleDragOver);
    cardImageZone.addEventListener('dragleave', handleDragLeave);
    cardImageZone.addEventListener('drop', (e) => handleCardImageDrop(e));
}

// 初回ミーティングファイルドロップ設定
function setupFirstMeetingFileDrop() {
    const dropZone = document.getElementById('firstMeetingAttachmentDropZone');
    const fileInput = document.getElementById('firstMeetingAttachmentUpload');
    
    if (!dropZone || !fileInput) return;
    
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', (e) => handleFirstMeetingDrop(e));
    fileInput.addEventListener('change', (e) => handleFirstMeetingFileSelect(e));
}

// ドラッグオーバーハンドラー
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

// ドラッグリーブハンドラー
function handleDragLeave(e) {
    e.currentTarget.classList.remove('dragover');
}

// 顔写真ドロップハンドラー
function handlePhotoDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        processPhotoFile(files[0]);
    }
}

// 名刺画像ドロップハンドラー
function handleCardImageDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        processCardImageFile(files[0]);
    }
}

// 一般ファイルドロップハンドラー
function handleDrop(e, type) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    if (type === 'contact') {
        selectedFiles.push(...files);
        displayNewAttachments();
    } else {
        selectedMeetingFiles.push(...files);
        displayNewMeetingAttachments();
    }
}

// ファイル選択ハンドラー
function handleFileSelect(e, type) {
    const files = Array.from(e.target.files);
    if (type === 'contact') {
        selectedFiles.push(...files);
        displayNewAttachments();
    } else {
        selectedMeetingFiles.push(...files);
        displayNewMeetingAttachments();
    }
}

// 初回ミーティングファイルドロップハンドラー
function handleFirstMeetingDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    selectedFirstMeetingFiles.push(...files);
    displayFirstMeetingAttachments();
}

// 初回ミーティングファイル選択ハンドラー
function handleFirstMeetingFileSelect(e) {
    const files = Array.from(e.target.files);
    selectedFirstMeetingFiles.push(...files);
    displayFirstMeetingAttachments();
}

// 顔写真アップロードハンドラー
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        processPhotoFile(file);
    }
}

// 顔写真ファイル処理
function processPhotoFile(file) {
    if (!file.type.startsWith('image/')) {
        showNotification('画像ファイルを選択してください', 'error');
        return;
    }
    
    currentPhotoFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('photoPreview').innerHTML = 
            `<img src="${e.target.result}" style="max-width: 200px; margin-top: 10px; border-radius: 8px;">`;
    };
    reader.readAsDataURL(file);
}

// 名刺画像アップロードハンドラー
function handleCardImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        processCardImageFile(file);
    }
}

// 名刺画像ファイル処理
function processCardImageFile(file) {
    if (!file.type.startsWith('image/')) {
        showNotification('画像ファイルを選択してください', 'error');
        return;
    }
    
    currentCardImageFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('cardImagePreview').innerHTML = 
            `<img src="${e.target.result}" style="max-width: 100%; margin-top: 10px; border-radius: 8px;">`;
    };
    reader.readAsDataURL(file);
}

// 既存添付ファイル表示
function displayExistingAttachments(attachments) {
    const container = document.getElementById('existingAttachments');
    container.innerHTML = attachments.map(att => `
        <div class="file-item">
            <span>${escapeHtml(att.name)}</span>
            <div class="file-item-actions">
                <a href="#" onclick="openFile('${att.id || att.url}', '${escapeHtml(att.name).replace(/'/g, "\\'")}'); return false;" class="btn-small btn-secondary">開く</a>
                <button type="button" class="btn-small btn-danger" onclick="markAttachmentForDeletion('${att.id}')">削除</button>
            </div>
        </div>
    `).join('');
}

// 新規添付ファイル表示
function displayNewAttachments() {
    const container = document.getElementById('newAttachments');
    container.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item">
            <span>${escapeHtml(file.name)}</span>
            <button type="button" class="btn-small btn-danger" onclick="removeNewAttachment(${index})">削除</button>
        </div>
    `).join('');
}

// 初回ミーティング添付ファイル表示
function displayFirstMeetingAttachments() {
    const container = document.getElementById('firstMeetingAttachments');
    container.innerHTML = selectedFirstMeetingFiles.map((file, index) => `
        <div class="file-item">
            <span>${escapeHtml(file.name)}</span>
            <button type="button" class="btn-small btn-danger" onclick="removeFirstMeetingAttachment(${index})">削除</button>
        </div>
    `).join('');
}

// 添付ファイル削除マーク
function markAttachmentForDeletion(fileId) {
    deletedAttachments.push(fileId);
    event.target.closest('.file-item').style.display = 'none';
}

// 新規添付ファイル削除
function removeNewAttachment(index) {
    selectedFiles.splice(index, 1);
    displayNewAttachments();
}

// 初回ミーティング添付ファイル削除
function removeFirstMeetingAttachment(index) {
    selectedFirstMeetingFiles.splice(index, 1);
    displayFirstMeetingAttachments();
}