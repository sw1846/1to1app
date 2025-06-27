// ===== 検索・フィルター機能 =====

// フィルター条件を保持する変数
let currentFilters = {
    searchName: '',
    type: '',
    affiliation: '',
    wantToConnect: '',
    goldenEgg: '',
    referredBy: '',
    area: '',
    residence: ''
};

// 連絡先のフィルタリング
function filterContacts() {
    // 検索条件を収集
    currentFilters.searchName = document.getElementById('searchName')?.value || '';
    
    // SearchableSelectの値を取得
    const filterWrappers = [
        { id: 'filterTypeWrapper', key: 'type' },
        { id: 'filterAffiliationWrapper', key: 'affiliation' },
        { id: 'filterWantToConnectWrapper', key: 'wantToConnect' },
        { id: 'filterGoldenEggWrapper', key: 'goldenEgg' },
        { id: 'filterReferredByWrapper', key: 'referredBy' },
        { id: 'filterAreaWrapper', key: 'area' },
        { id: 'filterResidenceWrapper', key: 'residence' }
    ];
    
    filterWrappers.forEach(wrapper => {
        const element = document.getElementById(wrapper.id);
        if (element && element.searchableSelect) {
            currentFilters[wrapper.key] = element.searchableSelect.getValue();
        }
    });
    
    renderContactList();
}

// フィルターとソートを適用
function filterAndSortContacts() {
    let filtered = [...contacts];
    
    // フリーワード検索
    if (currentFilters.searchName) {
        const searchLower = currentFilters.searchName.toLowerCase();
        filtered = filtered.filter(contact => {
            // 名前、よみ、会社名で検索
            if (contact.name?.toLowerCase().includes(searchLower)) return true;
            if (contact.yomi?.toLowerCase().includes(searchLower)) return true;
            if (contact.company?.toLowerCase().includes(searchLower)) return true;
            
            // メールアドレスで検索
            if (contact.email?.toLowerCase().includes(searchLower)) return true;
            if (contact.emails?.some(email => email.toLowerCase().includes(searchLower))) return true;
            
            // タグで検索
            if (contact.types?.some(type => type.toLowerCase().includes(searchLower))) return true;
            if (contact.affiliations?.some(aff => aff.toLowerCase().includes(searchLower))) return true;
            if (contact.wantToConnect?.some(want => want.toLowerCase().includes(searchLower))) return true;
            if (contact.goldenEgg?.some(egg => egg.toLowerCase().includes(searchLower))) return true;
            
            // その他のフィールドで検索
            if (contact.area?.toLowerCase().includes(searchLower)) return true;
            if (contact.residence?.toLowerCase().includes(searchLower)) return true;
            if (contact.referredBy?.toLowerCase().includes(searchLower)) return true;
            if (contact.strengths?.toLowerCase().includes(searchLower)) return true;
            if (contact.careerHistory?.toLowerCase().includes(searchLower)) return true;
            
            // ミーティング内容で検索
            const contactMeetings = meetings.filter(m => m.contactId === contact.id);
            if (contactMeetings.some(meeting => 
                meeting.content?.toLowerCase().includes(searchLower) ||
                meeting.tasks?.some(task => task.text.toLowerCase().includes(searchLower))
            )) return true;
            
            return false;
        });
    }
    
    // 種別フィルター
    if (currentFilters.type) {
        filtered = filtered.filter(contact => 
            contact.types && contact.types.includes(currentFilters.type)
        );
    }
    
    // 所属・チャプターフィルター
    if (currentFilters.affiliation) {
        filtered = filtered.filter(contact => 
            contact.affiliations && contact.affiliations.includes(currentFilters.affiliation)
        );
    }
    
    // 繋がりたい人・業種フィルター
    if (currentFilters.wantToConnect) {
        filtered = filtered.filter(contact => 
            contact.wantToConnect && contact.wantToConnect.includes(currentFilters.wantToConnect)
        );
    }
    
    // 金の卵フィルター
    if (currentFilters.goldenEgg) {
        filtered = filtered.filter(contact => 
            contact.goldenEgg && contact.goldenEgg.includes(currentFilters.goldenEgg)
        );
    }
    
    // 紹介元フィルター
    if (currentFilters.referredBy) {
        filtered = filtered.filter(contact => 
            contact.referredBy === currentFilters.referredBy
        );
    }
    
    // エリアフィルター
    if (currentFilters.area) {
        filtered = filtered.filter(contact => 
            contact.area === currentFilters.area
        );
    }
    
    // 居住地フィルター
    if (currentFilters.residence) {
        filtered = filtered.filter(contact => 
            contact.residence === currentFilters.residence
        );
    }
    
    // ソート適用
    return sortContacts(filtered);
}

// 連絡先のソート
function sortContacts(contactList) {
    const sortOrder = document.getElementById('sortOrder')?.value || 'meeting-desc';
    
    return contactList.sort((a, b) => {
        switch (sortOrder) {
            case 'meeting-desc':
                const lastMeetingA = getLastMeetingDate(a.id);
                const lastMeetingB = getLastMeetingDate(b.id);
                if (!lastMeetingA && !lastMeetingB) return 0;
                if (!lastMeetingA) return 1;
                if (!lastMeetingB) return -1;
                return lastMeetingB - lastMeetingA;
                
            case 'meeting-asc':
                const lastMeetingA2 = getLastMeetingDate(a.id);
                const lastMeetingB2 = getLastMeetingDate(b.id);
                if (!lastMeetingA2 && !lastMeetingB2) return 0;
                if (!lastMeetingA2) return -1;
                if (!lastMeetingB2) return 1;
                return lastMeetingA2 - lastMeetingB2;
                
            case 'name-asc':
                return a.name.localeCompare(b.name, 'ja');
                
            case 'name-desc':
                return b.name.localeCompare(a.name, 'ja');
                
            case 'yomi-asc':
                const yomiA = a.yomi || a.name;
                const yomiB = b.yomi || b.name;
                return yomiA.localeCompare(yomiB, 'ja');
                
            case 'yomi-desc':
                const yomiA2 = a.yomi || a.name;
                const yomiB2 = b.yomi || b.name;
                return yomiB2.localeCompare(yomiA2, 'ja');
                
            default:
                return 0;
        }
    });
}

// ソート適用
function applySorting() {
    renderContactList();
}

// フィルターのリセット
function resetFilters() {
    // 検索フィールドをクリア
    document.getElementById('searchName').value = '';
    
    // SearchableSelectをリセット
    const filterWrappers = [
        'filterTypeWrapper',
        'filterAffiliationWrapper',
        'filterWantToConnectWrapper',
        'filterGoldenEggWrapper',
        'filterReferredByWrapper',
        'filterAreaWrapper',
        'filterResidenceWrapper'
    ];
    
    filterWrappers.forEach(wrapperId => {
        const element = document.getElementById(wrapperId);
        if (element && element.searchableSelect) {
            element.searchableSelect.setValue('');
        }
    });
    
    // フィルター条件をリセット
    currentFilters = {
        searchName: '',
        type: '',
        affiliation: '',
        wantToConnect: '',
        goldenEgg: '',
        referredBy: '',
        area: '',
        residence: ''
    };
    
    renderContactList();
}

// 検索結果の件数を表示
function updateSearchResultCount() {
    const filtered = filterAndSortContacts();
    const countInfo = document.getElementById('contactCountInfo');
    
    if (countInfo) {
        if (Object.values(currentFilters).some(v => v)) {
            countInfo.innerHTML = `検索結果：<span style="color: #4c8bf5;">${filtered.length}</span>件 / 全<span id="contactCount">${contacts.length}</span>件`;
        } else {
            countInfo.innerHTML = `登録済み連絡先：<span id="contactCount">${contacts.length}</span>件`;
        }
    }
}

// SearchableSelectの拡張
SearchableSelect.prototype.getValue = function() {
    return this.value;
};

SearchableSelect.prototype.setValue = function(value) {
    this.value = value;
    this.input.textContent = value || 'すべて';
    if (this.onChange) {
        this.onChange(value);
    }
};