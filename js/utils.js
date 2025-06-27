// ===== ユーティリティ関数 =====

// ID生成
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// セキュリティ改善: より堅牢なHTMLエスケープ（URL対応版）
function escapeHtml(text) {
    if (!text) return '';
    
    // URLの場合はエスケープしない
    if (typeof text === 'string' && (text.startsWith('http://') || text.startsWith('https://'))) {
        return text;
    }
    
    const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    
    return String(text).replace(/[&<>"'`=]/g, (char) => escapeMap[char]);
}

// 日付フォーマット
function formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
}

// 日時フォーマット
function formatDateTime(datetime) {
    const d = new Date(datetime);
    return `${formatDate(d)} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// ファイル名のサニタイズ（日本語対応版）
function sanitizeFileName(fileName) {
    // 日本語文字を保持しつつ、ファイルシステムで問題になる文字のみを置換
    return fileName
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\.+$/, '') // 末尾のドットを削除
        .substring(0, 200); // 長さ制限を緩和
}

// 通知表示
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type === 'error' ? 'error-notification' : ''}`;
    notification.textContent = message;
    
    if (document.body) {
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
}

// ローディング表示
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

// ローディング非表示
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// クリップボードにコピー
function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).textContent;
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('コピーしました');
        }).catch(err => {
            console.error('コピーに失敗しました:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification('コピーしました');
    } catch (err) {
        showNotification('コピーに失敗しました。手動でコピーしてください。', 'error');
    }
    
    document.body.removeChild(textArea);
}

// セキュリティ改善: 画像URLの安全な処理
async function getSecureImageUrl(fileId) {
    try {
        // 認証付きURLを取得
        const url = await getAuthenticatedFileUrl(fileId);
        return url || '';
    } catch (error) {
        console.error('画像URL取得エラー:', error);
        return '';
    }
}

// Markdownレンダリング（セキュリティ改善版）
function renderMarkdown(text) {
    if (!text) return '';
    
    // まずHTMLエスケープ（ただしURLは除外）
    let safeText = text.split(/(\bhttps?:\/\/[^\s<]+)/g).map((part, index) => {
        // 奇数インデックスはURL
        return index % 2 === 1 ? part : escapeHtml(part);
    }).join('');
    
    // コードブロックの処理
    const codeBlocks = [];
    let processedText = safeText.replace(/```([\s\S]*?)```/g, (match, code) => {
        codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
        return `__CODEBLOCK_${codeBlocks.length - 1}__`;
    });
    
    // インラインコード
    processedText = processedText.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 見出し
    processedText = processedText.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    processedText = processedText.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    processedText = processedText.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // 強調
    processedText = processedText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // リンク（URLの検証を追加）
    processedText = processedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
        // URLの簡易検証
        if (isValidUrl(url)) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        return match; // 無効なURLの場合は変換しない
    });
    
    // リスト
    processedText = processedText.replace(/^- (.+)$/gm, '<li>$1</li>');
    processedText = processedText.replace(/(<li>.*<\/li>)/s, (match) => {
        const items = match.split('\n').filter(item => item.trim());
        return '<ul>' + items.join('\n') + '</ul>';
    });
    
    processedText = processedText.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    // 引用
    processedText = processedText.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // 水平線
    processedText = processedText.replace(/^---$/gm, '<hr>');
    
    // 段落
    processedText = processedText.split('\n\n').map(para => {
        if (para.trim() && !para.startsWith('<')) {
            return `<p>${para.trim()}</p>`;
        }
        return para;
    }).join('\n');
    
    // コードブロックを戻す
    codeBlocks.forEach((code, index) => {
        processedText = processedText.replace(`__CODEBLOCK_${index}__`, code);
    });
    
    return processedText;
}

// URL検証
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// テキストのリンク化（セキュリティ改善版）
function linkifyText(text) {
    if (!text) return '';
    
    // URLパターンとメールパターン
    const urlPattern = /(https?:\/\/[^\s<]+)/g;
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    
    // まず安全なテキストに変換（URLとメールアドレスは保持）
    let result = text;
    
    // メールアドレスを一時的に置換
    const emailPlaceholders = [];
    result = result.replace(emailPattern, (match) => {
        emailPlaceholders.push(match);
        return `__EMAIL_${emailPlaceholders.length - 1}__`;
    });
    
    // URLを一時的に置換
    const urlPlaceholders = [];
    result = result.replace(urlPattern, (match) => {
        urlPlaceholders.push(match);
        return `__URL_${urlPlaceholders.length - 1}__`;
    });
    
    // HTMLエスケープ
    result = escapeHtml(result);
    
    // URLを戻してリンク化
    urlPlaceholders.forEach((url, index) => {
        if (isValidUrl(url)) {
            result = result.replace(`__URL_${index}__`, 
                `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
        } else {
            result = result.replace(`__URL_${index}__`, url);
        }
    });
    
    // メールアドレスを戻してリンク化
    emailPlaceholders.forEach((email, index) => {
        result = result.replace(`__EMAIL_${index}__`, 
            `<a href="mailto:${email}">${email}</a>`);
    });
    
    return result;
}

// 画像エラーハンドリング
function handleImageError(img, contactName) {
    console.error('画像読み込みエラー:', {
        url: img.src,
        name: contactName,
        error: '画像の読み込みに失敗しました'
    });
    
    const parentDiv = img.parentElement;
    if (!parentDiv) {
        return;
    }
    
    // 親要素のサイズを判定してフォントサイズを設定
    const width = parentDiv.style.width;
    const fontSize = width === '120px' ? '48px' : '32px';
    parentDiv.innerHTML = `<span style="font-size: ${fontSize};">${escapeHtml(contactName.charAt(0))}</span>`;
}

// 最終ミーティング日を取得
function getLastMeetingDate(contactId) {
    const contactMeetings = meetings.filter(m => m.contactId === contactId);
    if (contactMeetings.length === 0) return null;
    
    return contactMeetings
        .map(m => new Date(m.datetime))
        .sort((a, b) => b - a)[0];
}

// ファイル種別に応じた開き方（PDF対応版）
async function openFile(fileIdOrUrl, filename) {
    try {
        let url = fileIdOrUrl;
        let fileId = null;
        
        // URLかIDかを判定
        if (fileIdOrUrl && (fileIdOrUrl.startsWith('http://') || fileIdOrUrl.startsWith('https://'))) {
            // URLからファイルIDを抽出
            const match = fileIdOrUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match) {
                fileId = match[1];
            }
            url = toDirectLink(fileIdOrUrl);
        } else if (fileIdOrUrl && fileIdOrUrl.length > 10 && !fileIdOrUrl.includes('/')) {
            // ファイルIDの場合
            fileId = fileIdOrUrl;
            // PDFの場合は特別な処理
            if (filename && filename.toLowerCase().endsWith('.pdf')) {
                url = `https://drive.google.com/file/d/${fileId}/preview`;
            } else {
                url = await getAuthenticatedFileUrl(fileIdOrUrl);
                if (!url) {
                    showNotification('ファイルへのアクセスに失敗しました', 'error');
                    return;
                }
            }
        } else {
            showNotification('無効なファイル参照です', 'error');
            return;
        }
        
        // PDFの場合はプレビューURLを使用
        if (filename && filename.toLowerCase().endsWith('.pdf') && fileId) {
            url = `https://drive.google.com/file/d/${fileId}/preview`;
        }
        
        // 新規タブで開く
        window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
        console.error('ファイルアクセスエラー:', error);
        showNotification('ファイルを開けませんでした', 'error');
    }
}

// CSPヘッダー相当の設定をメタタグで追加する関数（修正版）
function setContentSecurityPolicy() {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self' https://*.googleapis.com https://*.googleusercontent.com https://drive.google.com https://www.google.com; " +
                   "script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com; " +
                   "style-src 'self' 'unsafe-inline'; " +
                   "img-src 'self' data: https://*.googleusercontent.com https://*.googleapis.com https://drive.google.com https://lh3.googleusercontent.com https://www.google.com; " +
                   "connect-src 'self' https://*.googleapis.com https://apis.google.com https://www.google.com; " +
                   "frame-src 'self' https://drive.google.com https://accounts.google.com https://content.googleapis.com"; // content.googleapis.com を追加
    document.head.appendChild(meta);
}

// ページ読み込み時にCSPを設定
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setContentSecurityPolicy);
} else {
    setContentSecurityPolicy();
}

// Google Driveリンクを直接アクセス可能なURLに変換（改善版）
function toDirectLink(url) {
    if (!url) return '';
    
    // 既にlh3.googleusercontent.comの場合はそのまま返す
    if (url.includes('lh3.googleusercontent.com/d/')) {
        return url;
    }
    
    // パターン1: /file/d/{id}/view 形式
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    if (fileMatch && fileMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
    }
    
    // パターン2: /d/{id} 形式
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    
    // パターン3: ?id={id} 形式
    const match2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (match2 && match2[1]) {
        return `https://lh3.googleusercontent.com/d/${match2[1]}`;
    }
    
    // パターン4: open?id={id} 形式
    const openMatch = url.match(/open\?id=([a-zA-Z0-9-_]+)/);
    if (openMatch && openMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
    }
    
    return url;
}