// exports.js - CSV エクスポート・インポート機能（最小実装）

// CSVエクスポート
function exportToCSV() {
    try {
        if (!Array.isArray(window.contacts) || window.contacts.length === 0) {
            if (typeof showNotification === 'function') {
                showNotification('エクスポートする連絡先がありません', 'warning');
            }
            return;
        }
        
        // CSVヘッダー
        const headers = [
            'ID', '名前', 'ふりがな', '会社・組織', 'メールアドレス', '電話番号',
            '事業内容', '種別', '所属', '会いたい業種等', 'ホームページ',
            '接触方法', '紹介者', '直接接触', '事業内容詳細', '強み', '切り出し方',
            '過去の経歴', '事前情報', '活動エリア', '居住地', '趣味・興味',
            '売上', '作成日', '更新日'
        ];
        
        // CSVデータ
        const csvData = window.contacts.map(contact => {
            const emails = Array.isArray(contact.emails) ? contact.emails.join(';') : '';
            const phones = Array.isArray(contact.phones) ? contact.phones.join(';') : '';
            const businesses = Array.isArray(contact.businesses) ? contact.businesses.join(';') : '';
            const types = Array.isArray(contact.types) ? contact.types.join(';') : '';
            const affiliations = Array.isArray(contact.affiliations) ? contact.affiliations.join(';') : '';
            const industryInterests = Array.isArray(contact.industryInterests) ? contact.industryInterests.join(';') : '';
            
            return [
                contact.id || '',
                contact.name || '',
                contact.furigana || '',
                contact.company || '',
                emails,
                phones,
                businesses,
                types,
                affiliations,
                industryInterests,
                contact.website || '',
                contact.contactMethod || '',
                contact.referrer || '',
                contact.directContact || '',
                escapeCSV(contact.business || ''),
                escapeCSV(contact.strengths || ''),
                escapeCSV(contact.approach || ''),
                escapeCSV(contact.history || ''),
                escapeCSV(contact.priorInfo || ''),
                contact.activityArea || '',
                contact.residence || '',
                contact.hobbies || '',
                contact.revenue || 0,
                contact.createdAt || '',
                contact.updatedAt || ''
            ];
        });
        
        // CSV文字列を生成
        const csvContent = [headers, ...csvData]
            .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        
        // ファイル名を生成
        const now = new Date();
        const timestamp = now.getFullYear() + 
            String(now.getMonth() + 1).padStart(2, '0') + 
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') + 
            String(now.getMinutes()).padStart(2, '0');
        const filename = `contacts_${timestamp}.csv`;
        
        // ダウンロード実行
        if (typeof downloadCSV === 'function') {
            downloadCSV(csvContent, filename);
        } else {
            // フォールバック実装
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
        }
        
        if (typeof showNotification === 'function') {
            showNotification(`${window.contacts.length}件の連絡先をCSVでエクスポートしました`, 'success');
        }
        
        console.log('[exports] CSV exported:', filename, window.contacts.length, 'contacts');
        
    } catch (error) {
        console.error('[exports] exportToCSV error:', error);
        if (typeof showNotification === 'function') {
            showNotification('CSVエクスポートに失敗しました', 'error');
        }
    }
}

// CSVインポート
function importFromCSV() {
    const fileInput = document.getElementById('csvFileInput');
    if (fileInput) {
        fileInput.click();
    }
}

// CSVファイル処理
function handleCSVImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        if (typeof showNotification === 'function') {
            showNotification('CSVファイルを選択してください', 'error');
        }
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const csvContent = e.target.result;
            parseAndImportCSV(csvContent);
        } catch (error) {
            console.error('[exports] CSV read error:', error);
            if (typeof showNotification === 'function') {
                showNotification('CSVファイルの読み込みに失敗しました', 'error');
            }
        }
    };
    
    reader.readAsText(file, 'UTF-8');
    
    // ファイル入力をリセット
    event.target.value = '';
}

// CSV解析とインポート
function parseAndImportCSV(csvContent) {
    try {
        let rows;
        
        // parseCSV関数が利用可能な場合は使用
        if (typeof parseCSV === 'function') {
            rows = parseCSV(csvContent);
        } else {
            // 簡易CSV解析（フォールバック）
            rows = csvContent.split('\n').map(line => {
                const result = [];
                let current = '';
                let inQuotes = false;
                
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    const nextChar = line[i + 1];
                    
                    if (char === '"') {
                        if (inQuotes && nextChar === '"') {
                            current += '"';
                            i++; // skip next quote
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (char === ',' && !inQuotes) {
                        result.push(current);
                        current = '';
                    } else {
                        current += char;
                    }
                }
                result.push(current);
                return result;
            });
        }
        
        if (rows.length < 2) {
            if (typeof showNotification === 'function') {
                showNotification('CSVデータが不正です（ヘッダーまたはデータ行が不足）', 'error');
            }
            return;
        }
        
        // ヘッダー行を取得
        const headers = rows[0].map(h => h.trim());
        const dataRows = rows.slice(1).filter(row => row.length > 1 && row[0]); // 空行を除外
        
        if (dataRows.length === 0) {
            if (typeof showNotification === 'function') {
                showNotification('インポートするデータがありません', 'warning');
            }
            return;
        }
        
        let importedCount = 0;
        let errorCount = 0;
        
        // 各行を処理
        dataRows.forEach((row, index) => {
            try {
                const contact = {};
                
                // 基本フィールドのマッピング
                const fieldMapping = {
                    'ID': 'id',
                    '名前': 'name', 
                    'ふりがな': 'furigana',
                    '会社・組織': 'company',
                    'ホームページ': 'website',
                    '接触方法': 'contactMethod',
                    '紹介者': 'referrer',
                    '直接接触': 'directContact',
                    '事業内容詳細': 'business',
                    '強み': 'strengths',
                    '切り出し方': 'approach',
                    '過去の経歴': 'history',
                    '事前情報': 'priorInfo',
                    '活動エリア': 'activityArea',
                    '居住地': 'residence',
                    '趣味・興味': 'hobbies',
                    '作成日': 'createdAt',
                    '更新日': 'updatedAt'
                };
                
                // 基本フィールドを設定
                headers.forEach((header, i) => {
                    const value = row[i] || '';
                    const fieldName = fieldMapping[header];
                    if (fieldName) {
                        if (header === '事業内容詳細' || header === '強み' || header === '切り出し方' || 
                            header === '過去の経歴' || header === '事前情報') {
                            contact[fieldName] = unescapeCSV(value);
                        } else {
                            contact[fieldName] = value;
                        }
                    }
                });
                
                // 配列フィールドを処理
                const arrayFields = {
                    'メールアドレス': 'emails',
                    '電話番号': 'phones',
                    '事業内容': 'businesses',
                    '種別': 'types',
                    '所属': 'affiliations',
                    '会いたい業種等': 'industryInterests'
                };
                
                Object.keys(arrayFields).forEach(header => {
                    const index = headers.indexOf(header);
                    if (index !== -1) {
                        const value = row[index] || '';
                        contact[arrayFields[header]] = value ? value.split(';').map(v => v.trim()).filter(v => v) : [];
                    }
                });
                
                // 売上を数値に変換
                const revenueIndex = headers.indexOf('売上');
                if (revenueIndex !== -1) {
                    const revenueValue = row[revenueIndex] || '0';
                    contact.revenue = parseInt(revenueValue) || 0;
                }
                
                // 必須フィールドのチェック
                if (!contact.name) {
                    console.warn(`[exports] Row ${index + 2}: missing name`);
                    errorCount++;
                    return;
                }
                
                // IDが未設定の場合は生成
                if (!contact.id) {
                    contact.id = typeof generateContactId === 'function' ? 
                        generateContactId() : 
                        String(Date.now() + index).padStart(6, '0');
                }
                
                // タイムスタンプを設定
                const now = new Date().toISOString();
                if (!contact.createdAt) contact.createdAt = now;
                contact.updatedAt = now;
                
                // ステータスを設定
                contact.status = contact.status || '新規';
                
                // 既存の連絡先との重複チェック
                const existingIndex = window.contacts.findIndex(c => 
                    c.id === contact.id || 
                    (c.name === contact.name && c.company === contact.company)
                );
                
                if (existingIndex !== -1) {
                    // 既存データを更新
                    window.contacts[existingIndex] = { ...window.contacts[existingIndex], ...contact };
                } else {
                    // 新規追加
                    window.contacts.push(contact);
                }
                
                // オプションマスタを更新
                if (typeof updateOptionIfNew === 'function') {
                    (contact.types || []).forEach(type => updateOptionIfNew('types', type));
                    (contact.affiliations || []).forEach(aff => updateOptionIfNew('affiliations', aff));
                    (contact.industryInterests || []).forEach(interest => updateOptionIfNew('industryInterests', interest));
                }
                
                importedCount++;
                
            } catch (rowError) {
                console.error(`[exports] Row ${index + 2} import error:`, rowError);
                errorCount++;
            }
        });
        
        // データを保存
        if (typeof saveAllData === 'function') {
            saveAllData().then(() => {
                // UI更新
                if (typeof renderContacts === 'function') renderContacts();
                if (typeof updateFilters === 'function') updateFilters();
                if (typeof updateMultiSelectOptions === 'function') updateMultiSelectOptions();
            });
        } else {
            // UI更新
            if (typeof renderContacts === 'function') renderContacts();
            if (typeof updateFilters === 'function') updateFilters();
            if (typeof updateMultiSelectOptions === 'function') updateMultiSelectOptions();
        }
        
        // 結果通知
        const message = `${importedCount}件のデータをインポートしました` + 
            (errorCount > 0 ? ` (エラー: ${errorCount}件)` : '');
        
        if (typeof showNotification === 'function') {
            showNotification(message, errorCount > 0 ? 'warning' : 'success');
        }
        
        console.log('[exports] CSV import completed:', { imported: importedCount, errors: errorCount });
        
    } catch (error) {
        console.error('[exports] parseAndImportCSV error:', error);
        if (typeof showNotification === 'function') {
            showNotification('CSVの解析に失敗しました', 'error');
        }
    }
}

// ヘルパー関数：CSVエスケープ（utils.jsで未定義の場合のフォールバック）
function escapeCSV(text) {
    if (typeof window.escapeCSV === 'function') {
        return window.escapeCSV(text);
    }
    if (!text) return '';
    return String(text).replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function unescapeCSV(text) {
    if (typeof window.unescapeCSV === 'function') {
        return window.unescapeCSV(text);
    }
    if (!text) return '';
    return String(text).replace(/\\n/g, '\n').replace(/\\r/g, '\r');
}

// グローバル関数として公開
window.exportToCSV = exportToCSV;
window.importFromCSV = importFromCSV;
window.handleCSVImport = handleCSVImport;