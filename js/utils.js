/* ===== utils.js - ユーティリティ関数（完全修正版） ===== */

// [CLAUDE FIX ALL-IN-ONE][options] オプション更新関数（未定義ガード付き）
function updateOptionIfNew(options, type, value) {
    try {
        if (!value || typeof value !== 'string') return;
        
        const trimmedValue = value.trim();
        if (!trimmedValue) return;
        
        // [CLAUDE FIX ALL-IN-ONE][options] 配列初期化保障
        if (!options[type] || !Array.isArray(options[type])) {
            options[type] = [];
        }
        
        // 正規化して重複チェック
        const normalizedValue = normalizeText(trimmedValue);
        const exists = options[type].some(existing => 
            normalizeText(existing) === normalizedValue
        );
        
        if (!exists) {
            options[type].push(trimmedValue);
            console.log(`[fix][options] added to ${type}: ${trimmedValue}`);
        }
    } catch (e) {
        console.warn(`[warn][options] updateOptionIfNew failed for ${type}:`, e);
    }
}

// [CLAUDE FIX ALL-IN-ONE][options] テキスト正規化
function normalizeText(text) {
    if (!text) return '';
    return text.toString().trim().toLowerCase()
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
        .replace(/[ぁ-ゖ]/g, s => String.fromCharCode(s.charCodeAt(0) + 0x60));
}

// [CLAUDE FIX ALL-IN-ONE][avatar] URL サニタイズ
function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    // HTML エンコードされたURLをデコード
    let decoded = url.replace(/%3C/g, '<').replace(/%3E/g, '>').replace(/%20/g, ' ');
    
    // HTMLタグが混入している場合は除去
    if (decoded.includes('<') || decoded.includes('>')) {
        console.warn('[warn][avatar] HTML tags detected in URL, sanitizing:', decoded);
        return '';
    }
    
    // 正常なURLパターンのみ許可
    if (decoded.match(/^https?:\/\//) || decoded.match(/^data:image\//)) {
        return decoded;
    }
    
    return '';
}

// [CLAUDE FIX ALL-IN-ONE][avatar] イニシャル生成
function toInitials(displayName) {
    if (!displayName || typeof displayName !== 'string') return '?';
    
    try {
        const words = displayName.trim().split(/\s+/);
        if (words.length === 1) {
            return words[0].charAt(0).toUpperCase();
        }
        return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
    } catch (error) {
        console.warn('[fix][utils] toInitials error:', error);
        return '?';
    }
}

// [CLAUDE FIX ALL-IN-ONE][options] ユニーク&ソート
function uniqueSortedJa(array) {
    if (!Array.isArray(array)) return [];
    
    const unique = [...new Set(array.filter(item => item && item.trim()))];
    return unique.sort((a, b) => a.localeCompare(b, 'ja'));
}

// [CLAUDE FIX ALL-IN-ONE][filter] フィルター適用（純関数）
function applyFilters(contacts, filters) {
    if (!contacts || !Array.isArray(contacts)) return [];
    if (!filters || typeof filters !== 'object') return contacts;
    
    return contacts.filter(contact => {
        // 各フィルター条件をANDで適用
        return Object.entries(filters).every(([key, filterValue]) => {
            if (!filterValue || filterValue === '') return true;
            
            const contactValue = contact[key];
            if (!contactValue) return false;
            
            // 配列の場合は OR 条件で検索
            if (Array.isArray(contactValue)) {
                return contactValue.some(value => 
                    normalizeText(value).includes(normalizeText(filterValue))
                );
            }
            
            // 文字列の場合は部分マッチ
            return normalizeText(contactValue).includes(normalizeText(filterValue));
        });
    });
}

// 日付フォーマット
function formatDate(date) {
    if (!date) return '';
    try {
        return new Date(date).toLocaleDateString('ja-JP');
    } catch (e) {
        return '';
    }
}

// UUID生成
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// HTMLエスケープ
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ローディング表示
function showLoading() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.style.display = 'flex';
}

function hideLoading() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.style.display = 'none';
}

// 通知表示
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// デバウンス関数
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

// 配列をチャンクに分割
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// 深いオブジェクトコピー
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const copy = {};
        Object.keys(obj).forEach(key => {
            copy[key] = deepClone(obj[key]);
        });
        return copy;
    }
}

// ファイルサイズフォーマット
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 文字列の切り詰め
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// 既存関数のエクスポート（互換性維持）
window.updateOptionIfNew = updateOptionIfNew;
window.normalizeText = normalizeText;
window.sanitizeUrl = sanitizeUrl;
window.toInitials = toInitials;
window.uniqueSortedJa = uniqueSortedJa;
window.applyFilters = applyFilters;
window.formatDate = formatDate;
window.generateUUID = generateUUID;
window.escapeHtml = escapeHtml;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showNotification = showNotification;
window.debounce = debounce;
window.chunkArray = chunkArray;
window.deepClone = deepClone;
window.formatFileSize = formatFileSize;
window.truncateText = truncateText;