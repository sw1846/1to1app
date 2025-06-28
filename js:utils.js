// utils.js - ユーティリティ関数

// 通知表示
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// ローディング表示
function showLoading() {
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

// ファイル名のサニタイズ
function sanitizeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// タイムスタンプ生成
function generateTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

// ファイルサイズの人間が読める形式に変換
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 日付フォーマット
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Base64エンコード（ファイルアップロード用）
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// 画像リサイズ（プロフィール画像用）
function resizeImage(file, maxWidth, maxHeight) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.9);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// デバウンス関数（検索用）
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ドラフト保存（localStorage）
function saveDraft(key, data) {
    try {
        sessionStorage.setItem(`draft_${key}`, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save draft:', e);
    }
}

function loadDraft(key) {
    try {
        const draft = sessionStorage.getItem(`draft_${key}`);
        return draft ? JSON.parse(draft) : null;
    } catch (e) {
        console.error('Failed to load draft:', e);
        return null;
    }
}

function clearDraft(key) {
    try {
        sessionStorage.removeItem(`draft_${key}`);
    } catch (e) {
        console.error('Failed to clear draft:', e);
    }
}

// イニシャル生成（アバター用）
function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return parts[0][0] + parts[parts.length - 1][0];
    }
    return name.substring(0, 2);
}

// URLバリデーション
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// メールバリデーション
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// エスケープHTML（XSS対策）
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ディープコピー
function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// 配列のソート（日本語対応）
function sortByYomi(array, field) {
    return array.sort((a, b) => {
        const aValue = a[field] || '';
        const bValue = b[field] || '';
        return aValue.localeCompare(bValue, 'ja');
    });
}

// ファイル拡張子取得
function getFileExtension(filename) {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

// ブラウザで開けるファイル形式かチェック
function canOpenInBrowser(filename) {
    const ext = getFileExtension(filename).toLowerCase();
    const browserFormats = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'txt', 'html', 'htm'];
    return browserFormats.includes(ext);
}

// UUID生成
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// エクスポート
window.utils = {
    showNotification,
    showLoading,
    hideLoading,
    sanitizeFileName,
    generateTimestamp,
    formatFileSize,
    formatDate,
    fileToBase64,
    resizeImage,
    debounce,
    saveDraft,
    loadDraft,
    clearDraft,
    getInitials,
    isValidUrl,
    isValidEmail,
    escapeHtml,
    deepCopy,
    sortByYomi,
    getFileExtension,
    canOpenInBrowser,
    generateUUID
};