// utils.js - 分散ファイル構造対応のユーティリティ関数(修正版)

// [CLAUDE FIX] 重複排除・正規化・エラーハンドリング強化

// ユニークIDを生成
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// HTMLエスケープ
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 日付フォーマット
function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.warn('[fix][utils] formatDate error:', error);
        return dateString;
    }
}

// [CLAUDE FIX] 文字列正規化関数(全角半角・大小文字・空白統一)
function normalizeString(text) {
    if (!text || typeof text !== 'string') return '';
    
    try {
        return text
            .trim()
            .replace(/\s+/g, ' ')  // 連続空白を1つに
            .normalize('NFKC')     // 全角半角正規化
            .toLowerCase();        // 小文字統一
    } catch (error) {
        console.warn('[fix][utils] normalizeString error:', error);
        return text.trim().toLowerCase();
    }
}

// [CLAUDE FIX] 配列の重複排除・日本語ソート
function uniqueSortedJa(array) {
    if (!Array.isArray(array)) return [];
    
    try {
        const normalized = array
            .filter(item => item && typeof item === 'string')
            .map(item => item.trim())
            .filter(item => item !== '');
        
        const unique = [...new Set(normalized)];
        return unique.sort((a, b) => a.localeCompare(b, 'ja', { numeric: true, caseFirst: 'lower' }));
    } catch (error) {
        console.warn('[fix][utils] uniqueSortedJa error:', error);
        return array.filter(Boolean);
    }
}

// URLとメールアドレスをリンク化
function linkifyText(text) {

/* [fix][utils] START (anchor:utils.js:sanitizeImageUrl) */
// Google Drive アクセストークン取得（gapiのトークンを優先）
function getGoogleAccessToken(){
    try{
        const t = (window.gapi && gapi.client && gapi.client.getToken && gapi.client.getToken()) || null;
        return (t && t.access_token) ? t.access_token : null;
    }catch(e){
        return null;
    }
}

// drive:FILEID → alt=media のダウンロードURLへ
function buildDriveDownloadUrl(fileId){
    if(!fileId) return null;
    const token = getGoogleAccessToken();
    const base = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?alt=media';
    return token ? (base + '&access_token=' + encodeURIComponent(token)) : base;
}

// 画像用URLのサニタイズ＆drive: → ダウンロードURL化
function sanitizeImageUrl(url){
    try{
        if(!url || typeof url !== 'string') return null;
        const u = url.trim();
        if (u.startsWith('data:') || u.startsWith('http:') || u.startsWith('https:') || u.startsWith('blob:')){
            return u;
        }
        if (u.startsWith('drive:')){
            const id = u.slice(6).trim();
            if(!id) return null;
            return buildDriveDownloadUrl(id);
        }
        return null;
    }catch(e){
        console.warn('[fix][utils] sanitizeImageUrl error', e);
        return null;
    }
}
/* [fix][utils] END (anchor:utils.js:sanitizeImageUrl) */
    if (!text) return '';
    
    try {
        const urlPattern = /(https?:\/\/[^\s<]+)/g;
        const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        
        text = text.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');
        text = text.replace(emailPattern, '<a href="mailto:$1">$1</a>');
        
        return text;
    } catch (error) {
        console.warn('[fix][utils] linkifyText error:', error);
        return text;
    }
}

// Markdownレンダリング
function renderMarkdown(text) {
    if (!text) return '';
    
    try {
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
    } catch (error) {
        console.warn('[fix][utils] renderMarkdown error:', error);
        return escapeHtml(text);
    }
}

// CSVエスケープ
function escapeCSV(text) {
    if (!text) return '';
    return text.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function unescapeCSV(text) {
    if (!text) return '';
    return text.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
}

// CSVパース
function parseCSV(text) {
    try {
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
    } catch (error) {
        console.error('[fix][utils] parseCSV error:', error);
        return [];
    }
}

// 添付ファイルパース
function parseAttachments(attachmentsStr) {
    if (!attachmentsStr) return [];
    
    try {
        return attachmentsStr.split(';').filter(a => a).map(attachmentStr => {
            const [name, pathOrData] = attachmentStr.split(':');
            return {
                name: name,
                path: pathOrData,
                data: pathOrData.startsWith('data:') ? pathOrData : '',
                type: ''
            };
        });
    } catch (error) {
        console.warn('[fix][utils] parseAttachments error:', error);
        return [];
    }
}

// ToDoパース(分散ファイル構造対応)
function parseTodos(todosStr) {
    if (!todosStr) return [];
    
    try {
        return todosStr.split('|').filter(t => t).map(todoStr => {
            const completed = /^[✓✔]/.test(todoStr);
            const match = todoStr.match(/[☐✓✔]\s*(.+?)(?:\s*\(期限:(.+?)\))?$/);
            
            if (match) {
                return {
                    text: match[1],
                    completed: completed,
                    dueDate: match[2] || null
                };
            }
            
            return null;
        }).filter(t => t);
    } catch (error) {
        console.warn('[fix][utils] parseTodos error:', error);
        return [];
    }
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
    const notificationArea = document.getElementById('notificationArea');
    if (!notificationArea) {
        console.warn('[fix][utils] notification area not found, using console:', message);
        console.info(`[notification] ${type}: ${message}`);
        return;
    }
    
    try {
        const notification = document.createElement('div');
        notification.className = `notification ${type} show`;
        notification.innerHTML = `
            <span>${escapeHtml(message)}</span>
            <button class="btn btn-icon" onclick="this.parentElement.remove()">✕</button>
        `;
        
        notificationArea.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        console.log(`[fix][utils] notification shown: ${type} - ${message}`);
    } catch (error) {
        console.error('[fix][utils] showNotification error:', error);
        console.info(`[notification fallback] ${type}: ${message}`);
    }
}

// [CLAUDE FIX] オプションの安全な更新(エラー修正版)
function updateOptionIfNew(optionKey, value) {
    try {
        if (!value || typeof value !== 'string') return;
        
        const normalizedValue = normalizeString(value);
        if (!normalizedValue) return;
        
        // グローバルオプションの初期化保証
        if (typeof window.options !== 'object' || !window.options) {
            window.options = {};
        }
        
        // 指定キーの配列初期化保証
        if (!Array.isArray(window.options[optionKey])) {
            window.options[optionKey] = [];
            console.log(`[fix][options] initialized ${optionKey} array`);
        }
        
        // 既存の値を正規化して比較
        const existingNormalized = window.options[optionKey].map(item => normalizeString(item));
        
        // 重複チェック(正規化ベース)
        if (!existingNormalized.includes(normalizedValue)) {
            window.options[optionKey].push(value);  // 元の値で保存
            window.options[optionKey] = uniqueSortedJa(window.options[optionKey]);
            console.log(`[fix][options] added "${value}" to ${optionKey}`);
        }
    } catch (error) {
        console.error(`[fix][options] updateOptionIfNew error for ${optionKey}:`, error);
        // エラーが発生してもアプリケーションを停止しない
    }
}

// CSV ダウンロード
function downloadCSV(csv, filename) {
    try {
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        console.log('[fix][utils] CSV downloaded:', filename);
    } catch (error) {
        console.error('[fix][utils] downloadCSV error:', error);
        if (typeof showNotification === 'function') {
            showNotification('CSVダウンロードに失敗しました', 'error');
        }
    }
}

// ======= 分散ファイル構造対応の新機能 =======

// 検索インデックスの構築
function buildSearchIndex(contacts = []) {
    try {
        if (!Array.isArray(contacts)) return {};
        
        const searchIndex = {};
        
        contacts.forEach(contact => {
            if (!contact || !contact.id) return;
            
            const searchText = [
                contact.name,
                contact.furigana,
                contact.company,
                ...(contact.types || []),
                ...(contact.affiliations || []),
                ...(contact.businesses || []),
                contact.business,
                contact.strengths,
                contact.approach,
                contact.history,
                contact.priorInfo,
                contact.activityArea,
                contact.residence,
                contact.hobbies
            ].filter(text => text).join(' ').toLowerCase();
            
            searchIndex[contact.id] = searchText;
        });
        
        console.log('[fix][utils] built search index for', Object.keys(searchIndex).length, 'contacts');
        return searchIndex;
    } catch (error) {
        console.error('[fix][utils] buildSearchIndex error:', error);
        return {};
    }
}

// [CLAUDE FIX] 高速検索機能(副作用なし)
function fastSearch(query, contacts = [], searchIndex = {}) {
    try {
        if (!query || query.trim() === '') return contacts;
        if (!Array.isArray(contacts)) return [];
        
        const lowerQuery = normalizeString(query);
        const words = lowerQuery.split(/\s+/).filter(w => w.length > 0);
        
        if (words.length === 0) return contacts;
        
        return contacts.filter(contact => {
            if (!contact || !contact.id) return false;
            
            const indexText = searchIndex[contact.id] || '';
            
            // 全ての単語が含まれているかチェック
            return words.every(word => indexText.includes(word));
        });
    } catch (error) {
        console.error('[fix][utils] fastSearch error:', error);
        return contacts;
    }
}

// [CLAUDE FIX] フィルター適用(純関数版)
function applyFilters(contacts, filters) {
    try {
        if (!Array.isArray(contacts)) return [];
        if (!filters || typeof filters !== 'object') return contacts;
        
        return contacts.filter(contact => {
            if (!contact) return false;
            
            // 種別フィルター(OR条件)
            if (filters.types && filters.types.length > 0) {
                const contactTypes = Array.isArray(contact.types) ? contact.types : [];
                const hasMatchingType = filters.types.some(filterType => 
                    contactTypes.some(contactType => 
                        normalizeString(contactType) === normalizeString(filterType)
                    )
                );
                if (!hasMatchingType) return false;
            }
            
            // 所属フィルター
            if (filters.affiliation) {
                const normalizedFilter = normalizeString(filters.affiliation);
                const contactAffiliations = Array.isArray(contact.affiliations) ? contact.affiliations : [];
                const hasMatchingAffiliation = contactAffiliations.some(affiliation => 
                    normalizeString(affiliation).includes(normalizedFilter)
                );
                if (!hasMatchingAffiliation) return false;
            }
            
            // 事業内容フィルター
            if (filters.business) {
                const normalizedFilter = normalizeString(filters.business);
                const contactBusinesses = Array.isArray(contact.businesses) ? contact.businesses : [];
                const businessText = [
                    ...contactBusinesses,
                    contact.business || ''
                ].join(' ');
                if (!normalizeString(businessText).includes(normalizedFilter)) return false;
            }
            
            // 業種関心フィルター
            if (filters.industryInterests) {
                const normalizedFilter = normalizeString(filters.industryInterests);
                const contactInterests = Array.isArray(contact.industryInterests) ? contact.industryInterests : [];
                const hasMatchingInterest = contactInterests.some(interest => 
                    normalizeString(interest).includes(normalizedFilter)
                );
                if (!hasMatchingInterest) return false;
            }
            
            // 居住地フィルター
            if (filters.residence) {
                const normalizedFilter = normalizeString(filters.residence);
                const contactResidence = normalizeString(contact.residence || '');
                if (!contactResidence.includes(normalizedFilter)) return false;
            }
            
            // 検索クエリフィルター
            if (filters.query) {
                const searchableText = [
                    contact.name,
                    contact.furigana,
                    contact.company,
                    contact.business,
                    ...(contact.businesses || [])
                ].filter(Boolean).join(' ');
                
                const normalizedQuery = normalizeString(filters.query);
                if (!normalizeString(searchableText).includes(normalizedQuery)) return false;
            }
            
            return true;
        });
    } catch (error) {
        console.error('[fix][utils] applyFilters error:', error);
        return contacts;
    }
}

// 連絡先インデックスの更新
function updateContactIndex(contact, contactsIndex = {}) {
    try {
        if (!contact || !contact.id) return contactsIndex;
        
        contactsIndex[contact.id] = {
            id: contact.id,
            name: contact.name || '',
            company: contact.company || '',
            lastUpdated: new Date().toISOString(),
            status: contact.status || '新規',
            types: Array.isArray(contact.types) ? contact.types : [],
            createdAt: contact.createdAt || new Date().toISOString()
        };
        
        return contactsIndex;
    } catch (error) {
        console.error('[fix][utils] updateContactIndex error:', error);
        return contactsIndex;
    }
}

// ミーティングインデックスの更新
function updateMeetingIndex(contactId, meetings = [], meetingsIndex = {}) {
    try {
        if (!contactId) return meetingsIndex;
        
        const contactMeetings = meetings.filter(m => m.contactId === contactId);
        
        meetingsIndex[contactId] = {
            contactId: contactId,
            meetingCount: contactMeetings.length,
            lastMeetingDate: contactMeetings.length > 0 ? 
                Math.max(...contactMeetings.map(m => new Date(m.date || 0).getTime())) : null,
            lastUpdated: new Date().toISOString(),
            totalTodos: contactMeetings.reduce((sum, m) => sum + (m.todos?.length || 0), 0),
            completedTodos: contactMeetings.reduce((sum, m) => sum + (m.todos?.filter(t => t.completed).length || 0), 0)
        };
        
        return meetingsIndex;
    } catch (error) {
        console.error('[fix][utils] updateMeetingIndex error:', error);
        return meetingsIndex;
    }
}

// [CLAUDE FIX] インデックスの再構築(安全版)
function rebuildIndexes(contacts = [], meetings = [], metadata = {}) {
    try {
        console.log('[fix][utils] rebuilding indexes...');
        
        if (!Array.isArray(contacts)) contacts = [];
        if (!Array.isArray(meetings)) meetings = [];
        
        // 連絡先インデックス
        let contactsIndex = {};
        contacts.forEach(contact => {
            contactsIndex = updateContactIndex(contact, contactsIndex);
        });
        
        // ミーティングインデックス
        let meetingsIndex = {};
        const contactIds = [...new Set(meetings.map(m => m.contactId).filter(Boolean))];
        contactIds.forEach(contactId => {
            meetingsIndex = updateMeetingIndex(contactId, meetings, meetingsIndex);
        });
        
        // 検索インデックス
        const searchIndex = buildSearchIndex(contacts);
        
        // メタデータ更新
        const updatedMetadata = {
            ...metadata,
            totalContacts: contacts.length,
            totalMeetings: meetings.length,
            lastUpdated: new Date().toISOString(),
            version: '2.0'
        };
        
        console.log('[fix][utils] indexes rebuilt - contacts:', Object.keys(contactsIndex).length, 'meetings:', Object.keys(meetingsIndex).length);
        
        return {
            contactsIndex,
            meetingsIndex,
            searchIndex,
            metadata: updatedMetadata
        };
    } catch (error) {
        console.error('[fix][utils] rebuildIndexes error:', error);
        return {
            contactsIndex: {},
            meetingsIndex: {},
            searchIndex: {},
            metadata: {}
        };
    }
}

// データマイグレーション(レガシー形式から分散構造へ)
function migrateFromLegacyFormat(legacyContacts, legacyMeetings, legacyOptions) {
    try {
        console.log('[fix][utils] migrating legacy data...');
        
        // 連絡先データの変換
        const migratedContacts = (legacyContacts || []).map((contact, index) => {
            // IDが存在しない場合は生成
            if (!contact.id) {
                contact.id = String(index + 1).padStart(6, '0');
            }
            
            // データ形式の正規化
            return normalizeContactData(contact);
        });
        
        // ミーティングデータの変換
        const migratedMeetings = (legacyMeetings || []).map((meeting, index) => {
            if (!meeting.id) {
                meeting.id = String(index + 1).padStart(6, '0');
            }
            return meeting;
        });
        
        // メタデータの設定
        const migratedMetadata = {
            version: '2.0',
            migrationFrom: 'legacy',
            migrationDate: new Date().toISOString(),
            totalContacts: migratedContacts.length,
            totalMeetings: migratedMeetings.length,
            nextContactId: migratedContacts.length + 1,
            nextMeetingId: migratedMeetings.length + 1
        };
        
        console.log('[fix][utils] migration completed');
        
        return {
            contacts: migratedContacts,
            meetings: migratedMeetings,
            options: legacyOptions || {},
            metadata: migratedMetadata
        };
    } catch (error) {
        console.error('[fix][utils] migrateFromLegacyFormat error:', error);
        return {
            contacts: legacyContacts || [],
            meetings: legacyMeetings || [],
            options: legacyOptions || {},
            metadata: {}
        };
    }
}

// 連絡先データの正規化
function normalizeContactData(contact) {
    try {
        if (!contact) return contact;
        
        // レガシー形式の変換
        if (contact.referrer && !contact.contactMethod) {
            contact.contactMethod = 'referral';
        } else if (!contact.contactMethod) {
            contact.contactMethod = 'direct';
            contact.directContact = '所属が同じ';
        }
        
        // 文字列から配列への変換
        if (typeof contact.type === 'string') {
            contact.types = contact.type ? [contact.type] : [];
            delete contact.type;
        }
        if (typeof contact.affiliation === 'string') {
            contact.affiliations = contact.affiliation ? [contact.affiliation] : [];
            delete contact.affiliation;
        }
        
        // 必須フィールドの確保
        contact.types = contact.types || [];
        contact.affiliations = contact.affiliations || [];
        contact.industryInterests = contact.industryInterests || [];
        contact.businesses = contact.businesses || [];
        contact.emails = contact.emails || [];
        contact.phones = contact.phones || [];
        contact.priorInfo = contact.priorInfo || '';
        contact.status = contact.status || '新規';
        
        // タイムスタンプの追加
        if (!contact.createdAt) {
            contact.createdAt = new Date().toISOString();
        }
        if (!contact.updatedAt) {
            contact.updatedAt = new Date().toISOString();
        }
        
        return contact;
    } catch (error) {
        console.error('[fix][utils] normalizeContactData error:', error);
        return contact;
    }
}

// バッチ処理用のユーティリティ
async function batchProcess(items, processor, batchSize = 50) {
    try {
        const results = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(processor));
            results.push(...batchResults);
            
            // UI の応答性を保つため、小さな遅延を入れる
            if (i + batchSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        return results;
    } catch (error) {
        console.error('[fix][utils] batchProcess error:', error);
        return [];
    }
}

// ファイルサイズの計算
function calculateDataSize(data) {
    try {
        return new Blob([JSON.stringify(data)]).size;
    } catch (error) {
        console.warn('[fix][utils] calculateDataSize error:', error);
        return 0;
    }
}

// データの圧縮(シンプルな最適化)
function compressData(data) {
    try {
        // 不要なフィールドの削除
        const compressed = JSON.parse(JSON.stringify(data));
        
        // 空の配列や文字列を削除
        function removeEmpty(obj) {
            if (Array.isArray(obj)) {
                return obj.filter(item => item !== null && item !== undefined && item !== '');
            } else if (obj && typeof obj === 'object') {
                const cleaned = {};
                for (const [key, value] of Object.entries(obj)) {
                    const cleanedValue = removeEmpty(value);
                    if (cleanedValue !== null && cleanedValue !== undefined && cleanedValue !== '' && 
                        !(Array.isArray(cleanedValue) && cleanedValue.length === 0)) {
                        cleaned[key] = cleanedValue;
                    }
                }
                return cleaned;
            }
            return obj;
        }
        
        return removeEmpty(compressed);
    } catch (error) {
        console.warn('[fix][utils] compressData error:', error);
        return data;
    }
}

// パフォーマンス測定
function measurePerformance(name, func) {
    try {
        const start = performance.now();
        const result = func();
        const end = performance.now();
        console.log(`[fix][perf] ${name}: ${(end - start).toFixed(2)}ms`);
        return result;
    } catch (error) {
        console.error(`[fix][perf] ${name} error:`, error);
        return null;
    }
}

// 非同期パフォーマンス測定
async function measureAsyncPerformance(name, func) {
    try {
        const start = performance.now();
        const result = await func();
        const end = performance.now();
        console.log(`[fix][perf] ${name}: ${(end - start).toFixed(2)}ms`);
        return result;
    } catch (error) {
        console.error(`[fix][perf] ${name} error:`, error);
        return null;
    }
}

// データ整合性チェック
function validateDataIntegrity(contacts = [], meetings = []) {
    try {
        const issues = [];
        
        // 連絡先の整合性チェック
        contacts.forEach(contact => {
            if (!contact.id) {
                issues.push(`連絡先「${contact.name}」にIDがありません`);
            }
            if (!contact.name) {
                issues.push(`ID「${contact.id}」の連絡先に名前がありません`);
            }
            if (contact.referrer) {
                const referrerExists = contacts.some(c => c.name === contact.referrer);
                if (!referrerExists) {
                    issues.push(`連絡先「${contact.name}」の紹介者「${contact.referrer}」が見つかりません`);
                }
            }
        });
        
        // ミーティングの整合性チェック
        meetings.forEach(meeting => {
            if (!meeting.id) {
                issues.push(`ミーティングにIDがありません`);
            }
            if (!meeting.contactId) {
                issues.push(`ミーティング「${meeting.id}」に連絡先IDがありません`);
            } else {
                const contactExists = contacts.some(c => c.id === meeting.contactId);
                if (!contactExists) {
                    issues.push(`ミーティング「${meeting.id}」の連絡先「${meeting.contactId}」が見つかりません`);
                }
            }
        });
        
        if (issues.length > 0) {
            console.warn('[fix][utils] data integrity issues found:', issues);
        } else {
            console.log('[fix][utils] data integrity check passed');
        }
        
        return issues;
    } catch (error) {
        console.error('[fix][utils] validateDataIntegrity error:', error);
        return ['データ整合性チェックでエラーが発生しました'];
    }
}

// [CLAUDE FIX] Google Drive 画像読み込みユーティリティ
/* [fix][avatar-cache] START (anchor:utils.js:loadImageFromGoogleDrive) */
async function loadImageFromGoogleDrive(ref) {
    try {
        if (!ref) return null;
        if (ref.startsWith('data:')) return ref;
        
        if (ref.startsWith('drive:')) {
            const fileId = ref.split(':')[1];
            
            // [fix][avatar-cache] LRUキャッシュをチェック
            if (typeof window.__imageCache !== 'undefined' && typeof window.__imageCache.get === 'function') {
                const cached = window.__imageCache.get(ref);
                if (cached) {
                    console.log('[fix][avatar-cache] cache hit:', ref);
                    return cached;
                }
            }
            
            // トークン取得
            let token = null;
            if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken) {
                const tokenObj = gapi.client.getToken();
                token = tokenObj && tokenObj.access_token;
            }
            
            if (!token) {
                console.warn('[fix][avatar-cache] no access token for Drive image');
                return null;
            }
            
            // [fix][avatar-cache] タイムアウト付きfetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒
            
            try {
                const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    console.warn('[fix][avatar-cache] Drive fetch failed:', response.status);
                    return null;
                }
                
                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);
                
                // [fix][avatar-cache] キャッシュに保存
                if (typeof window.__imageCache !== 'undefined' && typeof window.__imageCache.set === 'function') {
                    window.__imageCache.set(ref, objectUrl);
                }
                
                return objectUrl;
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    console.warn('[fix][avatar-cache] fetch timeout');
                } else {
                    throw fetchError;
                }
                return null;
            }
        }
        
        // それ以外はURLとしてそのまま返す
        return ref;
    } catch (error) {
        console.warn('[fix][avatar-cache] loadImageFromGoogleDrive error:', error);
        return null;
    }
}
/* [fix][avatar-cache] END (anchor:utils.js:loadImageFromGoogleDrive) */

/* [fix][avatar-cache] AbortSignal対応版(UIからのキャンセルに対応) */
async function loadImageFromGoogleDriveWithSignal(ref, signal){
    try{
        if(!ref) return null;
        if(ref.startsWith('data:')) return ref;
        if(ref.startsWith('drive:')){
            const fileId = ref.split(':')[1];
            let token = null;
            if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken) {
                const tokenObj = gapi.client.getToken();
                token = tokenObj && tokenObj.access_token;
            }
            if (!token && typeof AppData === 'object' && AppData.authToken) {
                token = AppData.authToken;
            }
            if(!token){
                console.warn('[fix][utils] no access token for Drive image (with signal)');
                return null;
            }
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { 'Authorization': `Bearer ${token}` },
                signal
            });
            if(!res.ok){ console.warn('[fix][utils] fetch failed', res.status); return null; }
            const blob = await res.blob();
            return URL.createObjectURL(blob);
        }
        // http(s)はそのまま返す
        if(/^https?:/.test(ref)) return ref;
        return null;
    }catch(e){
        if(e && e.name === 'AbortError'){ console.log('[fix][avatar-cache] aborted'); return null; }
        console.warn('[fix][utils] loadImageFromGoogleDriveWithSignal error', e);
        return null;
    }
}

/* [fix][avatar-cache] 汎用ラッパー */
async function getImageObjectUrl(ref, signal){
    if(typeof loadImageFromGoogleDriveWithSignal === 'function') return loadImageFromGoogleDriveWithSignal(ref, signal);
    return loadImageFromGoogleDrive(ref);
}

// Drive汎用ファイル読み込みユーティリティ
async function loadDriveFileAsObjectURL(ref) {
    try {
        if (!ref) return null;
        if (ref.startsWith('data:')) return ref; // そのまま
        
        let fileId = ref;
        if (ref.startsWith('drive:')) fileId = ref.split(':')[1];
        
        let token = null;
        if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken) {
            const tokenObj = gapi.client.getToken();
            token = tokenObj && tokenObj.access_token;
        }
        
        if (!token) {
            console.warn('[fix][utils] no access token for Drive file');
            return null;
        }
        
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            console.warn('[fix][utils] Drive file fetch failed:', response.status);
            return null;
        }
        
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.warn('[fix][utils] loadDriveFileAsObjectURL error:', error);
        return null;
    }
}

// [CLAUDE FIX] URL サニタイズ
function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    try {
        // HTML エンコードされた文字列をデコード
        const decoded = url.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        
        // %3Ca%20href= のような不正な形式を除去
        if (decoded.includes('%3Ca') || decoded.includes('<a')) {
            console.warn('[fix][utils] invalid URL format detected:', url);
            return '';
        }
        
        // 有効なURLスキームかチェック
        if (decoded.startsWith('http://') || decoded.startsWith('https://') || decoded.startsWith('data:')) {
            return decoded;
        }
        
        return url;
    } catch (error) {
        console.warn('[fix][utils] sanitizeUrl error:', error);
        return '';
    }
}

// 名前からイニシャルを生成
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


/* [fix][utils] START (anchor:utils.js:drive-helpers) */
function isDriveRef(u){
  if(!u || typeof u !== 'string') return false;
  return u.startsWith('drive:') || u.indexOf('googleapis.com/drive/v3/files')>-1;
}
function extractDriveFileId(u){
  if(!u) return null;
  if(typeof u === 'string' && u.startsWith('drive:')) return u.split(':')[1];
  const m = String(u||'').match(/drive\/v3\/files\/([^?&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function getGoogleAccessToken(){
  try{
    return (gapi && gapi.client && gapi.client.getToken) ? (gapi.client.getToken()||{}).access_token : null;
  }catch(_){ return null; }
}
function resolveDriveDownloadUrl(fileId){
  const token = getGoogleAccessToken();
  const base = 'https://www.googleapis.com/drive/v3/files/'+ encodeURIComponent(fileId) + '?alt=media';
  return token ? (base + '&access_token=' + encodeURIComponent(token)) : base;
}
async function resolveAttachmentUrl(ref){
  try{
    if(!ref) return null;
    if(isDriveRef(ref)){
      const id = extractDriveFileId(ref);
      if(!id) return null;
      return resolveDriveDownloadUrl(id);
    }
    return String(ref);
  }catch(e){
    console.warn('[fix][utils] resolveAttachmentUrl failed', e);
    return null;
  }
}
async function loadImageFromGoogleDrive(ref){
  try{
    const id = extractDriveFileId(ref);
    if(!id) return null;
    const tk = getGoogleAccessToken();
    if(!tk) return null;
    const url = 'https://www.googleapis.com/drive/v3/files/'+ encodeURIComponent(id) + '?alt=media';
    const resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + tk }});
    if(!resp.ok) throw new Error('fetch failed ' + resp.status);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }catch(e){
    console.warn('[fix][avatar] loadImageFromGoogleDrive failed', e);
    return null;
  }
}
/* [fix][utils] END (anchor:utils.js:drive-helpers) */
