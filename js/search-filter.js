// ===== 検索・フィルター機能 =====

// 連絡先フィルタリング
function filterContacts() {
    const searchText = document.getElementById('searchName').value.toLowerCase();
    const typeFilter = window.searchableSelects?.filterType?.getValue() || '';
    const affiliationFilter = window.searchableSelects?.filterAffiliation?.getValue() || '';
    const wantToConnectFilter = window.searchableSelects?.filterWantToConnect?.getValue() || '';
    const goldenEggFilter = window.searchableSelects?.filterGoldenEgg?.getValue() || '';
    const referredByFilter = window.searchableSelects?.filterReferredBy?.getValue() || '';
    const areaFilter = window.searchableSelects?.filterArea?.getValue() || '';
    const residenceFilter = window.searchableSelects?.filterResidence?.getValue() || '';

    renderContactList(contact => {
        if (searchText) {
            const searchableText = [
                contact.name,
                contact.yomi,
                contact.company,
                contact.email,
                contact.phone,
                contact.homepage,
                contact.strengths,
                contact.referredBy,
                contact.careerHistory,
                contact.cutout,
                contact.area,
                contact.residence,
                ...(contact.types || []),
                ...(contact.affiliations || []),
                ...(contact.goldenEgg || []),
                ...(contact.wantToConnect || [])
            ].filter(Boolean).join(' ').toLowerCase();
            
            const contactMeetings = meetings.filter(m => m.contactId === contact.id);
            const meetingText = contactMeetings.map(m => {
                const taskTexts = m.tasks ? m.tasks.map(t => t.text).join(' ') : '';
                return [m.content, taskTexts].filter(Boolean).join(' ');
            }).join(' ').toLowerCase();
            
            const fullText = searchableText + ' ' + meetingText;
            
            if (!fullText.includes(searchText)) return false;
        }
        
        if (typeFilter && !(contact.types || []).includes(typeFilter)) return false;
        if (affiliationFilter && !(contact.affiliations || []).includes(affiliationFilter)) return false;
        if (wantToConnectFilter && !(contact.wantToConnect || []).includes(wantToConnectFilter)) return false;
        if (goldenEggFilter && !(contact.goldenEgg || []).includes(goldenEggFilter)) return false;
        if (referredByFilter && contact.referredBy !== referredByFilter) return false;
        if (areaFilter && contact.area !== areaFilter) return false;
        if (residenceFilter && contact.residence !== residenceFilter) return false;
        
        return true;
    });
}

// ソート適用
function applySorting() {
    currentSortOrder = document.getElementById('sortOrder').value;
    renderContactList();
}

// 連絡先ソート
function sortContacts(contactList) {
    const sorted = [...contactList];
    
    switch (currentSortOrder) {
        case 'meeting-desc':
            sorted.sort((a, b) => {
                const dateA = getLastMeetingDate(a.id);
                const dateB = getLastMeetingDate(b.id);
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB - dateA;
            });
            break;
        case 'meeting-asc':
            sorted.sort((a, b) => {
                const dateA = getLastMeetingDate(a.id);
                const dateB = getLastMeetingDate(b.id);
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateA - dateB;
            });
            break;
        case 'name-asc':
            sorted.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            break;
        case 'name-desc':
            sorted.sort((a, b) => b.name.localeCompare(a.name, 'ja'));
            break;
        case 'yomi-asc':
            sorted.sort((a, b) => {
                const yomiA = a.yomi || a.name;
                const yomiB = b.yomi || b.name;
                return yomiA.localeCompare(yomiB, 'ja');
            });
            break;
        case 'yomi-desc':
            sorted.sort((a, b) => {
                const yomiA = a.yomi || a.name;
                const yomiB = b.yomi || b.name;
                return yomiB.localeCompare(yomiA, 'ja');
            });
            break;
    }
    
    return sorted;
}