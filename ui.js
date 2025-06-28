// ui.js - UIユーティリティとヘルパー関数

class UIManager {
    constructor(authManager, storageManager, contactsManager, meetingsManager) {
        this.auth = authManager;
        this.storage = storageManager;
        this.contacts = contactsManager;
        this.meetings = meetingsManager;
        
        this.currentView = 'card';
        this.currentTab = 'contacts';
        this.notificationTimeout = null;
    }

    // UI初期化
    initialize() {
        this.setupEventListeners();
        this.updateAuthUI();
        this.loadUserPreferences();
    }

    // イベントリスナーの設定
    setupEventListeners() {
        // 認証関連
        this.setupAuthListeners();
        
        // タブ切り替え
        this.setupTabListeners();
        
        // 連絡先関連
        this.setupContactListeners();
        
        // ミーティング関連
        this.setupMeetingListeners();
        
        // 共通UI
        this.setupCommonListeners();
        
        // ファイルアップロード
        this.setupFileUploadListeners();
        
        // モーダル外クリックで閉じる
        this.setupModalListeners();
    }

    // 認証関連のリスナー
    setupAuthListeners() {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.auth.login();
            });
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('ログアウトしますか？')) {
                    this.auth.logout();
                }
            });
        }
    }

    // タブ切り替えリスナー
    setupTabListeners() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    // 連絡先関連のリスナー
    setupContactListeners() {
        // 新規連絡先ボタン
        const addContactBtn = document.getElementById('addContactBtn');
        if (addContactBtn) {
            addContactBtn.addEventListener('click', () => {
                this.openContactModal();
            });
        }

        // 検索・フィルター
        const searchInput = document.getElementById('searchInput');
        const filterType = document.getElementById('filterType');
        const filterAffiliation = document.getElementById('filterAffiliation');
        
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterContacts());
        }
        if (filterType) {
            filterType.addEventListener('change', () => this.filterContacts());
        }
        if (filterAffiliation) {
            filterAffiliation.addEventListener('change', () => this.filterContacts());
        }

        // ビュー切り替え
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });

        // フォーム送信
        const contactForm = document.getElementById('contactForm');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => this.handleContactSubmit(e));
        }
    }

    // ミーティング関連のリスナー
    setupMeetingListeners() {
        // ミーティング検索
        const meetingSearchInput = document.getElementById('meetingSearchInput');
        if (meetingSearchInput) {
            meetingSearchInput.addEventListener('input', () => this.filterMeetings());
        }

        // 連絡先フィルター
        const meetingContactFilter = document.getElementById('meetingContactFilter');
        if (meetingContactFilter) {
            meetingContactFilter.addEventListener('change', () => this.filterMeetings());
        }

        // フォーム送信
        const meetingForm = document.getElementById('meetingForm');
        if (meetingForm) {
            meetingForm.addEventListener('submit', (e) => this.handleMeetingSubmit(e));
        }

        // 設定保存
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }
    }

    // 共通リスナー
    setupCommonListeners() {
        // 同期ボタン
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncData());
        }

        // インポート/エクスポート
        const importExportBtn = document.getElementById('importExportBtn');
        if (importExportBtn) {
            importExportBtn.addEventListener('click', () => {
                document.getElementById('importExportModal').style.display = 'block';
            });
        }

        // エクスポートボタン
        const exportBtn = document.querySelector('[onclick="exportData()"]');
        if (exportBtn) {
            exportBtn.removeAttribute('onclick');
            exportBtn.addEventListener('click', () => this.exportData());
        }
    }

    // ファイルアップロードリスナー
    setupFileUploadListeners() {
        this.setupFileUpload('photoUpload', 'photoInput', (e) => this.handlePhotoUpload(e));
        this.setupFileUpload('businessCardUpload', 'businessCardInput', (e) => this.handleBusinessCardUpload(e));
        this.setupFileUpload('attachmentsUpload', 'attachmentsInput', (e) => this.handleAttachmentsUpload(e));
        this.setupFileUpload('meetingAttachmentsUpload', 'meetingAttachmentsInput', (e) => this.handleMeetingAttachmentsUpload(e));
        this.setupFileUpload('importUpload', 'importInput', (e) => this.handleImportUpload(e));
    }

    // ファイルアップロード設定
    setupFileUpload(containerId, inputId, handler) {
        const container = document.getElementById(containerId);
        const input = document.getElementById(inputId);
        
        if (!container || !input) return;

        container.addEventListener('click', () => input.click());
        input.addEventListener('change', handler);
        
        // ドラッグ＆ドロップ
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('drag-over');
        });
        
        container.addEventListener('dragleave', () => {
            container.classList.remove('drag-over');
        });
        
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            input.files = files;
            handler({ target: { files } });
        });
    }

    // モーダルリスナー
    setupModalListeners() {
        // モーダル外クリックで閉じる
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // ESCキーで閉じる
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
            }
        });
    }

    // タブ切り替え
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // タブボタンの更新
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // コンテンツの表示切り替え
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        const targetTab = document.getElementById(`${tabName}Tab`);
        if (targetTab) {
            targetTab.style.display = 'block';
        }

        // タブ固有の初期化
        if (tabName === 'meetings') {
            this.renderMeetings();
            this.updateMeetingContactFilter();
        } else if (tabName === 'settings') {
            this.loadSettings();
        }
    }

    // ビュー切り替え
    switchView(viewType) {
        this.currentView = viewType;
        
        // ボタンの更新
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewType);
        });
        
        // 表示の更新
        this.renderContacts();
    }

    // 連絡先のレンダリング
    renderContacts() {
        const container = document.getElementById('contactsList');
        const contacts = this.getFilteredContacts();
        
        if (this.currentView === 'card') {
            container.className = 'contacts-grid';
            container.innerHTML = contacts.map(contact => this.createContactCard(contact)).join('');
        } else {
            container.className = 'contacts-list';
            container.innerHTML = this.createContactsList(contacts);
        }
    }

    // 連絡先カードの作成
    createContactCard(contact) {
        const photoHtml = contact.photoUrl 
            ? `<img src="${contact.photoUrl}" alt="${contact.name}">`
            : contact.name.charAt(0);
            
        const tagsHtml = [
            ...(contact.types || []),
            ...(contact.affiliations || [])
        ].map(tag => `<span class="tag">${tag}</span>`).join('');
        
        return `
            <div class="contact-card" onclick="window.uiManager.openContactModal('${contact.id}')">
                <div class="contact-header">
                    <div class="contact-photo">${photoHtml}</div>
                    <div class="contact-info">
                        <h3>${this.escapeHtml(contact.name)}</h3>
                        <p>${this.escapeHtml(contact.company || '会社名未設定')}</p>
                    </div>
                </div>
                ${contact.cutout ? `<p style="font-style: italic; color: var(--text-secondary);">"${this.escapeHtml(contact.cutout)}"</p>` : ''}
                <div class="tags">${tagsHtml}</div>
            </div>
        `;
    }

    // 連絡先リストの作成
    createContactsList(contacts) {
        const rows = contacts.map(contact => `
            <tr onclick="window.uiManager.openContactModal('${contact.id}')" style="cursor: pointer;">
                <td>${this.escapeHtml(contact.name)}</td>
                <td>${this.escapeHtml(contact.company || '')}</td>
                <td>${this.escapeHtml(contact.email || '')}</td>
                <td>${this.escapeHtml(contact.phone || '')}</td>
                <td>${new Date(contact.updatedAt || contact.createdAt).toLocaleDateString('ja-JP')}</td>
            </tr>
        `).join('');
        
        return `
            <table class="contacts-table">
                <thead>
                    <tr>
                        <th>氏名</th>
                        <th>会社名</th>
                        <th>メール</th>
                        <th>電話</th>
                        <th>更新日</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    // フィルタリングされた連絡先の取得
    getFilteredContacts() {
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        const typeFilter = document.getElementById('filterType')?.value || '';
        const affiliationFilter = document.getElementById('filterAffiliation')?.value || '';
        
        return this.contacts.getAll().filter(contact => {
            // 検索フィルター
            if (searchTerm) {
                const searchMatch = 
                    contact.name.toLowerCase().includes(searchTerm) ||
                    (contact.company && contact.company.toLowerCase().includes(searchTerm)) ||
                    (contact.email && contact.email.toLowerCase().includes(searchTerm));
                    
                if (!searchMatch) return false;
            }
            
            // 種別フィルター
            if (typeFilter && (!contact.types || !contact.types.includes(typeFilter))) {
                return false;
            }
            
            // 所属フィルター
            if (affiliationFilter && (!contact.affiliations || !contact.affiliations.includes(affiliationFilter))) {
                return false;
            }
            
            return true;
        });
    }

    // 連絡先のフィルタリング
    filterContacts() {
        this.renderContacts();
    }

    // ミーティングのレンダリング
    renderMeetings() {
        const container = document.getElementById('meetingsList');
        const meetings = this.getFilteredMeetings();
        
        // 日付でグループ化
        const groupedMeetings = this.groupMeetingsByMonth(meetings);
        
        let html = '';
        for (const [month, monthMeetings] of Object.entries(groupedMeetings)) {
            html += `<h3 style="margin: 2rem 0 1rem;">${month}</h3>`;
            html += monthMeetings.map(meeting => this.createMeetingItem(meeting)).join('');
        }
        
        container.innerHTML = html || '<p style="text-align: center; color: var(--text-secondary);">ミーティング記録がありません</p>';
    }

    // ミーティング項目の作成
    createMeetingItem(meeting) {
        const contact = this.contacts.getById(meeting.contactId);
        const meetingDate = new Date(meeting.date);
        
        const todosHtml = meeting.todos && meeting.todos.length > 0
            ? `<div class="todos-summary">ToDo: ${meeting.todos.filter(t => !t.completed).length}件</div>`
            : '';
            
        const attachmentsHtml = meeting.attachments && meeting.attachments.length > 0
            ? `<div class="attachments-summary">添付: ${meeting.attachments.length}件</div>`
            : '';
        
        return `
            <div class="meeting-item" onclick="window.uiManager.openMeetingModal('${meeting.id}')">
                <div class="meeting-header">
                    <div class="meeting-date">${meetingDate.toLocaleDateString('ja-JP')} ${meetingDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div class="meeting-contact">${contact ? this.escapeHtml(contact.name) : '不明な連絡先'}</div>
                </div>
                <div class="meeting-content">${this.escapeHtml(meeting.content).substring(0, 100)}...</div>
                <div class="meeting-meta">
                    ${todosHtml}
                    ${attachmentsHtml}
                </div>
            </div>
        `;
    }

    // 月別にミーティングをグループ化
    groupMeetingsByMonth(meetings) {
        const grouped = {};
        
        meetings.forEach(meeting => {
            const date = new Date(meeting.date);
            const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;
            
            if (!grouped[monthKey]) {
                grouped[monthKey] = [];
            }
            
            grouped[monthKey].push(meeting);
        });
        
        // 各月内で日付順にソート
        for (const month in grouped) {
            grouped[month].sort((a, b) => new Date(b.date) - new Date(a.date));
        }
        
        return grouped;
    }

    // フィルタリングされたミーティングの取得
    getFilteredMeetings() {
        const searchTerm = document.getElementById('meetingSearchInput')?.value.toLowerCase() || '';
        const contactFilter = document.getElementById('meetingContactFilter')?.value || '';
        
        let meetings = this.meetings.getAll();
        
        // 検索フィルター
        if (searchTerm) {
            meetings = this.meetings.search(searchTerm);
        }
        
        // 連絡先フィルター
        if (contactFilter) {
            meetings = meetings.filter(m => m.contactId === contactFilter);
        }
        
        // 日付順にソート
        meetings.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return meetings;
    }

    // ミーティングのフィルタリング
    filterMeetings() {
        this.renderMeetings();
    }

    // 連絡先モーダルを開く
    openContactModal(contactId = null) {
        const modal = document.getElementById('contactModal');
        const form = document.getElementById('contactForm');
        const title = document.getElementById('modalTitle');
        const initialMeetingSection = document.getElementById('initialMeetingSection');
        
        // フォームリセット
        form.reset();
        form.dataset.contactId = '';
        
        // プレビューをクリア
        document.getElementById('photoPreview').style.display = 'none';
        document.getElementById('attachmentsList').innerHTML = '';
        
        if (contactId) {
            // 編集モード
            const contact = this.contacts.getById(contactId);
            if (contact) {
                title.textContent = '連絡先を編集';
                initialMeetingSection.style.display = 'none';
                this.populateContactForm(contact);
            }
        } else {
            // 新規作成モード
            title.textContent = '新規連絡先';
            initialMeetingSection.style.display = 'block';
            document.getElementById('initialMeetingDate').value = new Date().toISOString().slice(0, 16);
            
            // ドラフトの確認
            const draft = this.contacts.loadDraft();
            if (draft) {
                if (confirm('保存されていない下書きがあります。復元しますか？')) {
                    this.populateContactForm(draft);
                } else {
                    this.contacts.clearDraft();
                }
            }
        }
        
        // オプションの更新
        this.updateFilterOptions();
        this.updateCheckboxGroups();
        
        modal.style.display = 'block';
    }

    // ミーティングモーダルを開く
    openMeetingModal(meetingId = null) {
        const modal = document.getElementById('meetingModal');
        const form = document.getElementById('meetingForm');
        
        // フォームリセット
        form.reset();
        form.dataset.meetingId = '';
        
        // 連絡先選択肢の更新
        this.updateMeetingContactSelect();
        
        if (meetingId) {
            // 編集モード
            const meeting = this.meetings.getById(meetingId);
            if (meeting) {
                this.populateMeetingForm(meeting);
            }
        } else {
            // 新規作成モード
            document.getElementById('meetingDate').value = new Date().toISOString().slice(0, 16);
            
            // テンプレートの適用
            const template = this.meetings.meetingTemplate;
            if (template) {
                document.getElementById('meetingContent').value = template;
            }
            
            // ドラフトの確認
            const draft = this.meetings.loadDraft();
            if (draft) {
                if (confirm('保存されていない下書きがあります。復元しますか？')) {
                    this.populateMeetingForm(draft);
                } else {
                    this.meetings.clearDraft();
                }
            }
        }
        
        modal.style.display = 'block';
    }

    // 連絡先フォームにデータを設定
    populateContactForm(contact) {
        const form = document.getElementById('contactForm');
        form.dataset.contactId = contact.id || '';
        
        // 基本情報
        document.getElementById('name').value = contact.name || '';
        document.getElementById('yomi').value = contact.yomi || '';
        document.getElementById('company').value = contact.company || '';
        document.getElementById('email').value = contact.email || '';
        document.getElementById('phone').value = contact.phone || '';
        document.getElementById('homepage').value = contact.homepage || '';
        document.getElementById('referredBy').value = contact.referredBy || '';
        document.getElementById('area').value = contact.area || '';
        document.getElementById('residence').value = contact.residence || '';
        document.getElementById('strengths').value = contact.strengths || '';
        document.getElementById('careerHistory').value = contact.careerHistory || '';
        document.getElementById('cutout').value = contact.cutout || '';
        
        // チェックボックス
        this.setCheckedValues('typesGroup', contact.types || []);
        this.setCheckedValues('affiliationsGroup', contact.affiliations || []);
        this.setCheckedValues('wantToConnectGroup', contact.wantToConnect || []);
        this.setCheckedValues('goldenEggGroup', contact.goldenEgg || []);
        
        // 写真プレビュー
        if (contact.photoUrl) {
            document.getElementById('photoPreview').style.display = 'block';
            document.getElementById('photoImg').src = contact.photoUrl;
        }
    }

    // ミーティングフォームにデータを設定
    populateMeetingForm(meeting) {
        const form = document.getElementById('meetingForm');
        form.dataset.meetingId = meeting.id || '';
        
        document.getElementById('meetingContactId').value = meeting.contactId || '';
        document.getElementById('meetingDate').value = meeting.date || '';
        document.getElementById('meetingContent').value = meeting.content || '';
        
        // ToDoリスト
        const todoList = document.getElementById('todoList');
        todoList.innerHTML = '';
        
        if (meeting.todos && meeting.todos.length > 0) {
            meeting.todos.forEach(todo => {
                this.addTodoItem(todo);
            });
        } else {
            this.addTodoItem();
        }
    }

    // ToDoアイテムの追加
    addTodoItem(todo = {}) {
        const todoList = document.getElementById('todoList');
        const todoItem = document.createElement('div');
        todoItem.className = 'todo-item';
        
        if (todo.completed) {
            todoItem.classList.add('completed');
        }
        
        todoItem.innerHTML = `
            <input type="checkbox" ${todo.completed ? 'checked' : ''} data-todo-id="${todo.id || ''}">
            <input type="text" placeholder="タスク内容" value="${this.escapeHtml(todo.task || '')}">
            <input type="date" placeholder="期限" value="${todo.dueDate || ''}">
            <button type="button" class="btn-secondary" onclick="window.uiManager.removeTodoItem(this)">削除</button>
        `;
        
        todoList.appendChild(todoItem);
    }

    // ToDoアイテムの削除
    removeTodoItem(button) {
        button.parentElement.remove();
    }

    // チェックボックスの値を設定
    setCheckedValues(groupId, values) {
        const checkboxes = document.querySelectorAll(`#${groupId} input[type="checkbox"]`);
        checkboxes.forEach(cb => {
            cb.checked = values.includes(cb.value);
        });
    }

    // チェックボックスの値を取得
    getCheckedValues(groupId) {
        const checkboxes = document.querySelectorAll(`#${groupId} input[type="checkbox"]:checked`);
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // フィルターオプションの更新
    updateFilterOptions() {
        const typeFilter = document.getElementById('filterType');
        const affiliationFilter = document.getElementById('filterAffiliation');
        
        if (typeFilter) {
            typeFilter.innerHTML = '<option value="">種別でフィルター</option>' +
                this.contacts.options.types.map(type => 
                    `<option value="${type}">${type}</option>`
                ).join('');
        }
        
        if (affiliationFilter) {
            affiliationFilter.innerHTML = '<option value="">所属でフィルター</option>' +
                this.contacts.options.affiliations.map(aff => 
                    `<option value="${aff}">${aff}</option>`
                ).join('');
        }
        
        // データリストの更新
        this.updateDatalist('referredByList', this.contacts.options.referredBy);
        this.updateDatalist('areaList', this.contacts.options.areas);
        this.updateDatalist('residenceList', this.contacts.options.residences);
    }

    // データリストの更新
    updateDatalist(listId, options) {
        const datalist = document.getElementById(listId);
        if (datalist) {
            datalist.innerHTML = options.map(opt => 
                `<option value="${opt}">`
            ).join('');
        }
    }

    // チェックボックスグループの更新
    updateCheckboxGroups() {
        this.updateCheckboxGroup('typesGroup', this.contacts.options.types);
        this.updateCheckboxGroup('affiliationsGroup', this.contacts.options.affiliations);
        this.updateCheckboxGroup('wantToConnectGroup', this.contacts.options.wantToConnect);
        this.updateCheckboxGroup('goldenEggGroup', this.contacts.options.goldenEgg);
    }

    // チェックボックスグループの更新
    updateCheckboxGroup(groupId, items) {
        const group = document.getElementById(groupId);
        if (group) {
            group.innerHTML = items.map(item => `
                <div class="checkbox-item">
                    <input type="checkbox" id="${groupId}_${item}" value="${item}">
                    <label for="${groupId}_${item}">${item}</label>
                </div>
            `).join('');
        }
    }

    // ミーティング連絡先選択の更新
    updateMeetingContactSelect() {
        const select = document.getElementById('meetingContactId');
        if (select) {
            const contacts = this.contacts.getAll().sort((a, b) => 
                a.name.localeCompare(b.name, 'ja')
            );
            
            select.innerHTML = '<option value="">選択してください</option>' +
                contacts.map(contact => 
                    `<option value="${contact.id}">${this.escapeHtml(contact.name)}</option>`
                ).join('');
        }
    }

    // ミーティング連絡先フィルターの更新
    updateMeetingContactFilter() {
        const filter = document.getElementById('meetingContactFilter');
        if (filter) {
            const contacts = this.contacts.getAll().sort((a, b) => 
                a.name.localeCompare(b.name, 'ja')
            );
            
            filter.innerHTML = '<option value="">全ての連絡先</option>' +
                contacts.map(contact => 
                    `<option value="${contact.id}">${this.escapeHtml(contact.name)}</option>`
                ).join('');
        }
    }

    // 連絡先フォームの送信処理
    async handleContactSubmit(e) {
        e.preventDefault();
        
        this.showLoading();
        
        try {
            const formData = this.collectContactFormData();
            const photoFile = document.getElementById('photoInput').files[0];
            const businessCardFile = document.getElementById('businessCardInput').files[0];
            const attachmentFiles = Array.from(document.getElementById('attachmentsInput').files);
            
            let contact;
            if (formData.id) {
                // 更新
                contact = await this.contacts.update(
                    formData.id, 
                    formData, 
                    photoFile, 
                    businessCardFile, 
                    attachmentFiles
                );
            } else {
                // 新規作成
                contact = await this.contacts.create(
                    formData, 
                    photoFile, 
                    businessCardFile, 
                    attachmentFiles
                );
                
                // 初回ミーティング記録
                const initialContent = document.getElementById('initialMeetingContent')?.value;
                if (initialContent) {
                    const initialDate = document.getElementById('initialMeetingDate').value;
                    await this.meetings.create({
                        contactId: contact.id,
                        date: initialDate,
                        content: initialContent,
                        todos: []
                    });
                }
            }
            
            this.contacts.clearDraft();
            document.getElementById('contactModal').style.display = 'none';
            this.renderContacts();
            this.updateFilterOptions();
            
            this.showNotification('連絡先を保存しました', 'success');
        } catch (error) {
            console.error('Contact save error:', error);
            this.showNotification('保存に失敗しました', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // ミーティングフォームの送信処理
    async handleMeetingSubmit(e) {
        e.preventDefault();
        
        this.showLoading();
        
        try {
            const formData = this.collectMeetingFormData();
            const attachmentFiles = Array.from(document.getElementById('meetingAttachmentsInput').files);
            
            if (formData.id) {
                // 更新
                await this.meetings.update(formData.id, formData, attachmentFiles);
            } else {
                // 新規作成
                await this.meetings.create(formData, attachmentFiles);
            }
            
            this.meetings.clearDraft();
            document.getElementById('meetingModal').style.display = 'none';
            this.renderMeetings();
            
            this.showNotification('ミーティング記録を保存しました', 'success');
        } catch (error) {
            console.error('Meeting save error:', error);
            this.showNotification('保存に失敗しました', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 連絡先フォームデータの収集
    collectContactFormData() {
        const form = document.getElementById('contactForm');
        
        const data = {
            name: document.getElementById('name').value,
            yomi: document.getElementById('yomi').value,
            company: document.getElementById('company').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            homepage: document.getElementById('homepage').value,
            referredBy: document.getElementById('referredBy').value,
            area: document.getElementById('area').value,
            residence: document.getElementById('residence').value,
            strengths: document.getElementById('strengths').value,
            careerHistory: document.getElementById('careerHistory').value,
            cutout: document.getElementById('cutout').value,
            types: this.getCheckedValues('typesGroup'),
            affiliations: this.getCheckedValues('affiliationsGroup'),
            wantToConnect: this.getCheckedValues('wantToConnectGroup'),
            goldenEgg: this.getCheckedValues('goldenEggGroup')
        };
        
        if (form.dataset.contactId) {
            data.id = form.dataset.contactId;
        }
        
        return data;
    }

    // ミーティングフォームデータの収集
    collectMeetingFormData() {
        const form = document.getElementById('meetingForm');
        
        const todos = [];
        document.querySelectorAll('#todoList .todo-item').forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const taskInput = item.querySelector('input[type="text"]');
            const dateInput = item.querySelector('input[type="date"]');
            
            if (taskInput.value) {
                todos.push({
                    id: checkbox.dataset.todoId || undefined,
                    task: taskInput.value,
                    dueDate: dateInput.value,
                    completed: checkbox.checked
                });
            }
        });
        
        const data = {
            contactId: document.getElementById('meetingContactId').value,
            date: document.getElementById('meetingDate').value,
            content: document.getElementById('meetingContent').value,
            todos: todos
        };
        
        if (form.dataset.meetingId) {
            data.id = form.dataset.meetingId;
        }
        
        return data;
    }

    // ファイルアップロードハンドラー
    handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('photoPreview').style.display = 'block';
                document.getElementById('photoImg').src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    handleBusinessCardUpload(e) {
        // プレビュー表示などの処理
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.showNotification('名刺画像を選択しました', 'success');
        }
    }

    handleAttachmentsUpload(e) {
        const files = Array.from(e.target.files);
        const list = document.getElementById('attachmentsList');
        
        list.innerHTML = files.map(file => `
            <div class="attachment-item">
                <span>${this.escapeHtml(file.name)}</span>
                <span>${this.formatFileSize(file.size)}</span>
            </div>
        `).join('');
    }

    handleMeetingAttachmentsUpload(e) {
        const files = Array.from(e.target.files);
        this.showNotification(`${files.length}個のファイルを選択しました`, 'success');
    }

    async handleImportUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        this.showLoading();
        
        try {
            const text = await this.readFileAsText(file);
            const data = JSON.parse(text);
            
            // データの検証
            if (!data.contacts && !data.meetings && !data.options) {
                throw new Error('無効なデータ形式です');
            }
            
            // インポート確認
            const counts = {
                contacts: data.contacts?.length || 0,
                meetings: data.meetings?.length || 0
            };
            
            const message = `以下のデータをインポートします：\n` +
                `連絡先: ${counts.contacts}件\n` +
                `ミーティング: ${counts.meetings}件\n\n` +
                `既存のデータは上書きされます。続行しますか？`;
            
            if (!confirm(message)) {
                return;
            }
            
            // インポート実行
            if (data.contacts || data.options) {
                await this.contacts.import(data);
            }
            if (data.meetings) {
                await this.meetings.import(data);
            }
            
            // UI更新
            this.renderContacts();
            this.updateFilterOptions();
            document.getElementById('importExportModal').style.display = 'none';
            
            this.showNotification('データをインポートしました', 'success');
        } catch (error) {
            console.error('Import error:', error);
            this.showNotification('インポートに失敗しました', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // データエクスポート
    exportData() {
        const data = {
            contacts: this.contacts.getAll(),
            meetings: this.meetings.getAll(),
            options: this.contacts.options,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `1to1_meeting_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.showNotification('データをエクスポートしました', 'success');
    }

    // データ同期
    async syncData() {
        this.showLoading();
        
        try {
            await this.contacts.initialize();
            await this.meetings.initialize();
            
            this.renderContacts();
            this.updateFilterOptions();
            
            this.showNotification('データを同期しました', 'success');
        } catch (error) {
            console.error('Sync error:', error);
            this.showNotification('同期に失敗しました', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 設定の読み込み
    async loadSettings() {
        const template = this.meetings.meetingTemplate;
        const templateInput = document.getElementById('meetingTemplate');
        if (templateInput) {
            templateInput.value = template;
        }
    }

    // 設定の保存
    async saveSettings() {
        this.showLoading();
        
        try {
            const template = document.getElementById('meetingTemplate').value;
            await this.meetings.updateTemplate(template);
            
            this.showNotification('設定を保存しました', 'success');
        } catch (error) {
            console.error('Settings save error:', error);
            this.showNotification('設定の保存に失敗しました', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // 認証UIの更新
    updateAuthUI() {
        const isAuthenticated = this.auth.isAuthenticated();
        
        document.getElementById('loginScreen').style.display = isAuthenticated ? 'none' : 'flex';
        document.getElementById('app').style.display = isAuthenticated ? 'block' : 'none';
    }

    // ユーザー設定の読み込み
    loadUserPreferences() {
        const prefs = localStorage.getItem('user_preferences');
        if (prefs) {
            try {
                const preferences = JSON.parse(prefs);
                this.currentView = preferences.view || 'card';
                // その他の設定を適用
            } catch (error) {
                console.error('Preferences load error:', error);
            }
        }
    }

    // ユーザー設定の保存
    saveUserPreferences() {
        const preferences = {
            view: this.currentView
        };
        
        localStorage.setItem('user_preferences', JSON.stringify(preferences));
    }

    // ローディング表示
    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    // ローディング非表示
    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    // 通知表示
    showNotification(message, type = 'success') {
        // 既存の通知を削除
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }
        
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // 新しい通知を作成
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // 自動削除
        this.notificationTimeout = setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // ユーティリティ関数
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
}

// エクスポート用のグローバル変数
window.UIManager = UIManager;