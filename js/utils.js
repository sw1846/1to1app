// utils.js - ユーティリティ関数

// ユニークIDを生成
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// HTMLエスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 日付フォーマット
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// URLとメールアドレスをリンク化
function linkifyText(text) {
    if (!text) return '';
    
    const urlPattern = /(https?:\/\/[^\s<]+)/g;
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    
    text = text.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');
    text = text.replace(emailPattern, '<a href="mailto:$1">$1</a>');
    
    return text;
}

// Markdownレンダリング
function renderMarkdown(text) {
    if (!text) return '';
    
    let html = escapeHtml(text);
    
    // コードブロック
    const codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
        return placeholder;
    });
    
    // インラインコード
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
        inlineCodes.push(`<code>${code}</code>`);
        return placeholder;
    });
    
    // 見出し
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // 太字とイタリック
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // 取り消し線
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    
    // リンク
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 画像
    html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%;">');
    
    // リスト
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^• (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
        const isOrdered = match.includes('<li>') && /^\d+\./.test(match);
        return isOrdered ? `<ol>${match}</ol>` : `<ul>${match}</ul>`;
    });
    
    // 引用
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    
    // 水平線
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/^\*\*\*$/gm, '<hr>');
    
    // URLとメールアドレスのリンク化
    html = linkifyText(html);
    
    // 改行
    html = html.replace(/\n/g, '<br>');
    
    // インラインコードを復元
    inlineCodes.forEach((code, index) => {
        html = html.replace(`__INLINE_CODE_${index}__`, code);
    });
    
    // コードブロックを復元
    codeBlocks.forEach((code, index) => {
        html = html.replace(`__CODE_BLOCK_${index}__`, code);
    });
    
    return html;
}

// CSVエスケープ
function escapeCSV(text) {
    return text.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function unescapeCSV(text) {
    return text.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
}

// CSVパース
function parseCSV(text) {
    const rows = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const row = [];
        let cell = '';
        let inQuotes = false;
        
        for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            const nextChar = lines[i][j + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    cell += '"';
                    j++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(cell);
                cell = '';
            } else {
                cell += char;
            }
        }
        
        row.push(cell);
        if (row.length > 1 || row[0]) {
            rows.push(row);
        }
    }
    
    return rows;
}

// 添付ファイルパース
function parseAttachments(attachmentsStr) {
    if (!attachmentsStr) return [];
    
    return attachmentsStr.split(';').filter(a => a).map(attachmentStr => {
        const [name, pathOrData] = attachmentStr.split(':');
        return {
            name: name,
            path: pathOrData,
            data: pathOrData.startsWith('data:') ? pathOrData : '',
            type: ''
        };
    });
}

// ToDoパース（既存の関数を置き換え）
function parseTodos(todosStr) {
    if (!todosStr) return [];
    
    return todosStr.split('|').filter(t => t).map(todoStr => {
        const completed = /^[✔✓]/.test(todoStr);  // 両方の文字に対応
        const match = todoStr.match(/[☐✔✓]\s*(.+?)(?:\s*\(期限:(.+?)\))?$/);
        
        if (match) {
            return {
                text: match[1],
                completed: completed,
                dueDate: match[2] || null
            };
        }
        
        return null;
    }).filter(t => t);
}

// ローディング表示
function showLoading(show = true) {
    let spinner = document.getElementById('loadingSpinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'loadingSpinner';
        spinner.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 3000;
            display: none;
        `;
        spinner.innerHTML = '<div class="loading-spinner" style="width: 50px; height: 50px;"></div>';
        document.body.appendChild(spinner);
    }
    spinner.style.display = show ? 'block' : 'none';
}

// 通知表示
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    notification.innerHTML = `
        <span>${message}</span>
        <button class="btn btn-icon" onclick="this.parentElement.remove()">✕</button>
    `;
    
    document.getElementById('notificationArea').appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// オプションの更新
function updateOptionIfNew(optionKey, value) {
    if (value && !options[optionKey].includes(value)) {
        options[optionKey].push(value);
        options[optionKey].sort();
    }
}

// CSVダウンロード
function downloadCSV(csv, filename) {
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}