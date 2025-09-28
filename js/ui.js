/* ===== ui.js - UI描画と表示処理 - 修正版 ===== */

// ログ関数
function log() {
    try {
        console.log.apply(console, ['[ui]'].concat([].slice.call(arguments)));
    } catch (e) {}
}

// 連絡先一覧描画
function renderContacts() {
    try {
        const container = document.getElementById('contactsContainer');
        if (!container) {
            log('[error] contactsContainer not found');
            return;
        }

        // AppDataから連絡先データを取得
        const AppData = window.AppData ? window.AppData() : null;
        if (!AppData || !AppData.contacts) {
            container.innerHTML = '<div class="no-data">連絡先データがありません</div>';
            log('[ui] renderContacts count: 0');
            return;
        }

        let contacts = AppData.contacts.slice(); // コピーを作成
        log('[ui] renderContacts count: ' + contacts.length);

        // フィルター適用
        contacts = applyContactFilters(contacts);
        
        // 検索適用
        const searchQuery = window.viewState ? window.viewState.searchQuery : '';
        if (searchQuery) {
            contacts = applyContactSearch(contacts, searchQuery);
        }

        // ソート適用
        contacts = sortContacts(contacts);

        // HTML生成
        let html = '';
        contacts.forEach(contact => {
            html += generateContactCard(contact);
        });

        if (html === '') {
            html = '<div class="no-data">該当する連絡先が見つかりません</div>';
        }

        container.innerHTML = html;
        
    } catch (e) {
        log('[error] renderContacts failed:', e);
        const container = document.getElementById('contactsContainer');
        if (container) {
            container.innerHTML = '<div class="error">連絡先の表示中にエラーが発生しました</div>';
        }
    }
}

// フィルター適用
function applyContactFilters(contacts) {
    try {
        if (!window.viewState || !window.viewState.filters) {
            return contacts;
        }

        const filters = window.viewState.filters;
        let filtered = contacts.slice();

        // タイプフィルター
        if (filters.type && filters.type.trim()) {
            filtered = filtered.filter(contact => {
                return contact.type && contact.type.includes(filters.type);
            });
        }

        // 所属フィルター
        if (filters.affiliation && filters.affiliation.trim()) {
            filtered = filtered.filter(contact => {
                return contact.affiliation && contact.affiliation.includes(filters.affiliation);
            });
        }

        // 業種関心フィルター
        if (filters.business && filters.business.trim()) {
            filtered = filtered.filter(contact => {
                return (contact.business && contact.business.includes(filters.business)) ||
                       (contact.industryInterests && contact.industryInterests.includes(filters.business));
            });
        }

        // 居住地フィルター
        if (filters.residence && filters.residence.trim()) {
            filtered = filtered.filter(contact => {
                return contact.residence && contact.residence.includes(filters.residence);
            });
        }

        return filtered;
        
    } catch (e) {
        log('[error] applyContactFilters failed:', e);
        return contacts;
    }
}

// 検索適用
function applyContactSearch(contacts, query) {
    try {
        if (!query || !query.trim()) {
            return contacts;
        }

        const lowerQuery = query.toLowerCase();
        return contacts.filter(contact => {
            const searchFields = [
                contact.name,
                contact.yomi,
                contact.company,
                contact.affiliation,
                contact.email,
                contact.phone,
                contact.business,
                contact.industryInterests,
                contact.residence
            ];

            return searchFields.some(field => {
                return field && field.toLowerCase().includes(lowerQuery);
            });
        });
        
    } catch (e) {
        log('[error] applyContactSearch failed:', e);
        return contacts;
    }
}

// ソート適用
function sortContacts(contacts) {
    try {
        const sortBy = window.viewState ? window.viewState.sortBy : 'name';
        
        return contacts.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return (a.name || '').localeCompare(b.name || '', 'ja');
                case 'yomi':
                    return (a.yomi || '').localeCompare(b.yomi || '', 'ja');
                case 'company':
                    return (a.company || '').localeCompare(b.company || '', 'ja');
                case 'lastMeeting':
                    // 最新ミーティング日時でソート（実装を簡略化）
                    return (b.lastMeetingDate || 0) - (a.lastMeetingDate || 0);
                default:
                    return (a.name || '').localeCompare(b.name || '', 'ja');
            }
        });
        
    } catch (e) {
        log('[error] sortContacts failed:', e);
        return contacts;
    }
}

// 連絡先カードHTML生成
function generateContactCard(contact) {
    try {
        const photoUrl = resolveContactPhoto(contact);
        const lastMeetingInfo = getLastMeetingInfo(contact);
        
        return `
            <div class="contact-card" onclick="showContactDetail('${contact.id}')">
                <div class="contact-photo">
                    ${photoUrl ? 
                        `<img src="${photoUrl}" alt="${contact.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                        ''
                    }
                    <div class="contact-initials" ${photoUrl ? 'style="display:none"' : ''}>
                        ${generateInitials(contact.name)}
                    </div>
                </div>
                <div class="contact-info">
                    <div class="contact-name">${escapeHtml(contact.name || '')}</div>
                    <div class="contact-yomi">${escapeHtml(contact.yomi || '')}</div>
                    <div class="contact-company">${escapeHtml(contact.company || '')}</div>
                    <div class="contact-affiliation">${escapeHtml(contact.affiliation || '')}</div>
                    <div class="contact-meta">
                        ${contact.type ? `<span class="badge">${escapeHtml(contact.type)}</span>` : ''}
                        ${lastMeetingInfo ? `<span class="last-meeting">${lastMeetingInfo}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
        
    } catch (e) {
        log('[error] generateContactCard failed:', e);
        return `<div class="contact-card error">カード生成エラー</div>`;
    }
}

// 連絡先写真のURL解決
function resolveContactPhoto(contact) {
    try {
        if (!contact.photo) return null;
        
        // Base64データの場合
        if (contact.photo.startsWith('data:')) {
            return contact.photo;
        }
        
        // Google DriveのファイルIDの場合
        if (contact.photo.match(/^[a-zA-Z0-9_-]+$/)) {
            return `https://drive.google.com/thumbnail?id=${contact.photo}&sz=w100-h100-c`;
        }
        
        // URLの場合
        if (contact.photo.startsWith('http')) {
            return contact.photo;
        }
        
        return null;
        
    } catch (e) {
        log('[error] resolveContactPhoto failed:', e);
        return null;
    }
}

// 最新ミーティング情報取得
function getLastMeetingInfo(contact) {
    try {
        const AppData = window.AppData ? window.AppData() : null;
        if (!AppData || !AppData.meetings) return null;
        
        // 該当連絡先のミーティングを検索
        const contactMeetings = AppData.meetings.filter(meeting => 
            meeting.contactId === contact.id
        );
        
        if (contactMeetings.length === 0) return null;
        
        // 最新のミーティングを取得
        const latestMeeting = contactMeetings.sort((a, b) => 
            new Date(b.date || 0) - new Date(a.date || 0)
        )[0];
        
        if (!latestMeeting.date) return null;
        
        const meetingDate = new Date(latestMeeting.date);
        const now = new Date();
        const diffDays = Math.floor((now - meetingDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return '今日';
        if (diffDays === 1) return '昨日';
        if (diffDays < 7) return `${diffDays}日前`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
        return `${Math.floor(diffDays / 365)}年前`;
        
    } catch (e) {
        log('[error] getLastMeetingInfo failed:', e);
        return null;
    }
}

// イニシャル生成
function generateInitials(name) {
    try {
        if (!name || typeof name !== 'string') return '?';
        
        const trimmed = name.trim();
        if (!trimmed) return '?';
        
        // 日本語名の場合（ひらがな、カタカナ、漢字）
        if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(trimmed)) {
            // 最初の2文字を取得
            return trimmed.substring(0, 2);
        }
        
        // 英語名の場合
        const words = trimmed.split(/\s+/);
        if (words.length === 1) {
            return words[0].charAt(0).toUpperCase();
        }
        return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
        
    } catch (e) {
        log('[error] generateInitials failed:', e);
        return '?';
    }
}

// HTML エスケープ
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ミーティング一覧描画
function renderMeetings() {
    try {
        const container = document.getElementById('meetingsContainer');
        if (!container) {
            log('[error] meetingsContainer not found');
            return;
        }

        const AppData = window.AppData ? window.AppData() : null;
        if (!AppData || !AppData.meetings) {
            container.innerHTML = '<div class="no-data">ミーティングデータがありません</div>';
            return;
        }

        let meetings = AppData.meetings.slice();
        
        // 検索適用
        const searchQuery = window.viewState ? window.viewState.searchQuery : '';
        if (searchQuery) {
            meetings = applyMeetingSearch(meetings, searchQuery);
        }

        // 日付でソート（新しい順）
        meetings = meetings.sort((a, b) => 
            new Date(b.date || 0) - new Date(a.date || 0)
        );

        // HTML生成
        let html = '';
        meetings.forEach(meeting => {
            html += generateMeetingCard(meeting);
        });

        if (html === '') {
            html = '<div class="no-data">該当するミーティングが見つかりません</div>';
        }

        container.innerHTML = html;
        
    } catch (e) {
        log('[error] renderMeetings failed:', e);
        const container = document.getElementById('meetingsContainer');
        if (container) {
            container.innerHTML = '<div class="error">ミーティングの表示中にエラーが発生しました</div>';
        }
    }
}

// ミーティング検索適用
function applyMeetingSearch(meetings, query) {
    try {
        if (!query || !query.trim()) {
            return meetings;
        }

        const lowerQuery = query.toLowerCase();
        return meetings.filter(meeting => {
            const searchFields = [
                meeting.title,
                meeting.content,
                meeting.location,
                meeting.attendees
            ];

            return searchFields.some(field => {
                return field && field.toLowerCase().includes(lowerQuery);
            });
        });
        
    } catch (e) {
        log('[error] applyMeetingSearch failed:', e);
        return meetings;
    }
}

// ミーティングカードHTML生成
function generateMeetingCard(meeting) {
    try {
        const contactName = getContactName(meeting.contactId);
        const meetingDate = meeting.date ? new Date(meeting.date).toLocaleDateString('ja-JP') : '';
        
        return `
            <div class="meeting-card" onclick="showMeetingDetail('${meeting.id}')">
                <div class="meeting-header">
                    <div class="meeting-title">${escapeHtml(meeting.title || 'タイトルなし')}</div>
                    <div class="meeting-date">${meetingDate}</div>
                </div>
                <div class="meeting-contact">${escapeHtml(contactName)}</div>
                <div class="meeting-content">${escapeHtml((meeting.content || '').substring(0, 100))}${meeting.content && meeting.content.length > 100 ? '...' : ''}</div>
                <div class="meeting-location">${escapeHtml(meeting.location || '')}</div>
            </div>
        `;
        
    } catch (e) {
        log('[error] generateMeetingCard failed:', e);
        return `<div class="meeting-card error">カード生成エラー</div>`;
    }
}

// 連絡先名取得
function getContactName(contactId) {
    try {
        if (!contactId) return '不明な連絡先';
        
        const AppData = window.AppData ? window.AppData() : null;
        if (!AppData || !AppData.contacts) return '不明な連絡先';
        
        const contact = AppData.contacts.find(c => c.id === contactId);
        return contact ? contact.name : '不明な連絡先';
        
    } catch (e) {
        log('[error] getContactName failed:', e);
        return '不明な連絡先';
    }
}

// 連絡先詳細表示
function showContactDetail(contactId) {
    try {
        const AppData = window.AppData ? window.AppData() : null;
        if (!AppData || !AppData.contacts) return;
        
        const contact = AppData.contacts.find(c => c.id === contactId);
        if (!contact) {
            log('[error] contact not found:', contactId);
            return;
        }
        
        // 連絡先詳細モーダルを表示
        if (window.showContactDetailModal) {
            window.showContactDetailModal(contact);
        }
        
    } catch (e) {
        log('[error] showContactDetail failed:', e);
    }
}

// ミーティング詳細表示
function showMeetingDetail(meetingId) {
    try {
        const AppData = window.AppData ? window.AppData() : null;
        if (!AppData || !AppData.meetings) return;
        
        const meeting = AppData.meetings.find(m => m.id === meetingId);
        if (!meeting) {
            log('[error] meeting not found:', meetingId);
            return;
        }
        
        // ミーティング詳細モーダルを表示
        if (window.showMeetingDetailModal) {
            window.showMeetingDetailModal(meeting);
        }
        
    } catch (e) {
        log('[error] showMeetingDetail failed:', e);
    }
}

// グローバル関数エクスポート
window.renderContacts = renderContacts;
window.renderMeetings = renderMeetings;
window.showContactDetail = showContactDetail;
window.showMeetingDetail = showMeetingDetail;