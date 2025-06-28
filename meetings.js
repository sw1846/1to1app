// meetings.js - ミーティング記録管理モジュール

class MeetingsManager {
    constructor(storageManager, contactsManager) {
        this.storage = storageManager;
        this.contactsManager = contactsManager;
        this.meetings = [];
        this.meetingTemplate = '';
        this.currentEditingId = null;
        this.draftData = null;
    }

    // 初期化
    async initialize() {
        try {
            // ミーティングデータの読み込み
            const meetingsData = await this.storage.loadJsonFile('meetings.json');
            if (meetingsData) {
                this.meetings = meetingsData;
            }

            // 設定の読み込み
            const settingsData = await this.storage.loadJsonFile('settings.json');
            if (settingsData && settingsData.meetingTemplate) {
                this.meetingTemplate = settingsData.meetingTemplate;
            }

            return true;
        } catch (error) {
            console.error('Meetings initialization error:', error);
            return false;
        }
    }

    // 全ミーティングの取得
    getAll() {
        return [...this.meetings];
    }

    // IDでミーティングを取得
    getById(id) {
        return this.meetings.find(m => m.id === id);
    }

    // 連絡先IDでミーティングを取得
    getByContactId(contactId) {
        return this.meetings.filter(m => m.contactId === contactId);
    }

    // ミーティングの検索
    search(query) {
        const searchTerm = query.toLowerCase();
        return this.meetings.filter(meeting => {
            // ミーティング内容で検索
            if (meeting.content && meeting.content.toLowerCase().includes(searchTerm)) {
                return true;
            }

            // ToDoで検索
            if (meeting.todos) {
                const hasTodoMatch = meeting.todos.some(todo => 
                    todo.task.toLowerCase().includes(searchTerm)
                );
                if (hasTodoMatch) {
                    return true;
                }
            }

            // 連絡先名で検索
            const contact = this.contactsManager.getById(meeting.contactId);
            if (contact && contact.name.toLowerCase().includes(searchTerm)) {
                return true;
            }

            return false;
        });
    }

    // 日付範囲でフィルタリング
    filterByDateRange(startDate, endDate) {
        return this.meetings.filter(meeting => {
            const meetingDate = new Date(meeting.date);
            return meetingDate >= startDate && meetingDate <= endDate;
        });
    }

    // ミーティングの作成
    async create(meetingData, attachmentFiles = []) {
        try {
            const contact = this.contactsManager.getById(meetingData.contactId);
            if (!contact) {
                throw new Error('Contact not found');
            }

            // ID生成
            const meeting = {
                ...meetingData,
                id: this.generateId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // テンプレートの適用
            if (!meeting.content && this.meetingTemplate) {
                meeting.content = this.meetingTemplate;
            }

            // ToDoの初期化
            if (!meeting.todos) {
                meeting.todos = [];
            }

            // ToDoのID生成と初期化
            meeting.todos = meeting.todos.map(todo => ({
                ...todo,
                id: this.generateId(),
                completed: false,
                createdAt: new Date().toISOString()
            }));

            // 添付ファイルのアップロード
            if (attachmentFiles.length > 0) {
                meeting.attachments = [];
                for (const file of attachmentFiles) {
                    const attachResult = await this.storage.uploadFile(
                        file, 
                        contact.name
                    );
                    meeting.attachments.push({
                        id: attachResult.id,
                        name: attachResult.name,
                        url: attachResult.url,
                        mimeType: attachResult.mimeType,
                        size: attachResult.size,
                        uploadedAt: new Date().toISOString()
                    });
                }
            }

            // ミーティングを追加
            this.meetings.push(meeting);

            // 保存
            await this.save();

            return meeting;
        } catch (error) {
            console.error('Meeting creation error:', error);
            throw error;
        }
    }

    // ミーティングの更新
    async update(id, updateData, newAttachmentFiles = []) {
        try {
            const index = this.meetings.findIndex(m => m.id === id);
            if (index === -1) {
                throw new Error('Meeting not found');
            }

            const existingMeeting = this.meetings[index];
            const contact = this.contactsManager.getById(existingMeeting.contactId);

            const updatedMeeting = {
                ...existingMeeting,
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            // ToDoの更新処理
            if (updateData.todos) {
                updatedMeeting.todos = updateData.todos.map(todo => {
                    if (todo.id) {
                        // 既存のToDo
                        const existingTodo = existingMeeting.todos?.find(t => t.id === todo.id);
                        return {
                            ...existingTodo,
                            ...todo,
                            updatedAt: new Date().toISOString()
                        };
                    } else {
                        // 新規ToDo
                        return {
                            ...todo,
                            id: this.generateId(),
                            completed: false,
                            createdAt: new Date().toISOString()
                        };
                    }
                });
            }

            // 新しい添付ファイルの追加
            if (newAttachmentFiles.length > 0) {
                if (!updatedMeeting.attachments) {
                    updatedMeeting.attachments = [];
                }

                for (const file of newAttachmentFiles) {
                    const attachResult = await this.storage.uploadFile(
                        file, 
                        contact.name
                    );
                    updatedMeeting.attachments.push({
                        id: attachResult.id,
                        name: attachResult.name,
                        url: attachResult.url,
                        mimeType: attachResult.mimeType,
                        size: attachResult.size,
                        uploadedAt: new Date().toISOString()
                    });
                }
            }

            // 更新
            this.meetings[index] = updatedMeeting;

            // 保存
            await this.save();

            return updatedMeeting;
        } catch (error) {
            console.error('Meeting update error:', error);
            throw error;
        }
    }

    // ミーティングの削除
    async delete(id) {
        try {
            const meeting = this.getById(id);
            if (!meeting) {
                throw new Error('Meeting not found');
            }

            // 添付ファイルの削除
            if (meeting.attachments) {
                for (const attachment of meeting.attachments) {
                    await this.storage.deleteFile(attachment.id);
                }
            }

            // ミーティングを削除
            this.meetings = this.meetings.filter(m => m.id !== id);

            // 保存
            await this.save();

            return true;
        } catch (error) {
            console.error('Meeting deletion error:', error);
            return false;
        }
    }

    // ToDoの更新
    async updateTodo(meetingId, todoId, todoData) {
        try {
            const meeting = this.getById(meetingId);
            if (!meeting) {
                throw new Error('Meeting not found');
            }

            const todoIndex = meeting.todos.findIndex(t => t.id === todoId);
            if (todoIndex === -1) {
                throw new Error('Todo not found');
            }

            meeting.todos[todoIndex] = {
                ...meeting.todos[todoIndex],
                ...todoData,
                updatedAt: new Date().toISOString()
            };

            return await this.update(meetingId, { todos: meeting.todos });
        } catch (error) {
            console.error('Todo update error:', error);
            throw error;
        }
    }

    // ToDoの完了状態切り替え
    async toggleTodoComplete(meetingId, todoId) {
        const meeting = this.getById(meetingId);
        if (!meeting) {
            throw new Error('Meeting not found');
        }

        const todo = meeting.todos.find(t => t.id === todoId);
        if (!todo) {
            throw new Error('Todo not found');
        }

        return await this.updateTodo(meetingId, todoId, {
            completed: !todo.completed,
            completedAt: !todo.completed ? new Date().toISOString() : null
        });
    }

    // ドラフトの保存（ローカルストレージ）
    saveDraft(meetingData) {
        this.draftData = meetingData;
        localStorage.setItem('meeting_draft', JSON.stringify({
            data: meetingData,
            savedAt: new Date().toISOString()
        }));
    }

    // ドラフトの読み込み
    loadDraft() {
        const draftStr = localStorage.getItem('meeting_draft');
        if (!draftStr) {
            return null;
        }

        try {
            const draft = JSON.parse(draftStr);
            // 24時間以内のドラフトのみ有効
            const savedTime = new Date(draft.savedAt);
            const now = new Date();
            const hoursDiff = (now - savedTime) / (1000 * 60 * 60);
            
            if (hoursDiff < 24) {
                return draft.data;
            } else {
                this.clearDraft();
                return null;
            }
        } catch (error) {
            console.error('Draft load error:', error);
            return null;
        }
    }

    // ドラフトのクリア
    clearDraft() {
        this.draftData = null;
        localStorage.removeItem('meeting_draft');
    }

    // テンプレートの更新
    async updateTemplate(template) {
        this.meetingTemplate = template;
        
        const settings = {
            meetingTemplate: template,
            updatedAt: new Date().toISOString()
        };
        
        await this.storage.saveJsonFile('settings.json', settings);
    }

    // データの保存
    async save() {
        try {
            await this.storage.saveJsonFile('meetings.json', this.meetings);
            return true;
        } catch (error) {
            console.error('Save error:', error);
            throw error;
        }
    }

    // 統計情報の取得
    getStatistics() {
        const stats = {
            total: this.meetings.length,
            byContact: {},
            byMonth: {},
            upcomingTodos: [],
            overdueTodos: [],
            completedTodos: 0,
            totalTodos: 0,
            recentMeetings: []
        };

        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        this.meetings.forEach(meeting => {
            // 連絡先別統計
            const contact = this.contactsManager.getById(meeting.contactId);
            if (contact) {
                const contactName = contact.name;
                stats.byContact[contactName] = (stats.byContact[contactName] || 0) + 1;
            }

            // 月別統計
            const meetingDate = new Date(meeting.date);
            const monthKey = `${meetingDate.getFullYear()}-${String(meetingDate.getMonth() + 1).padStart(2, '0')}`;
            stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;

            // 最近のミーティング
            if (meetingDate > weekAgo) {
                stats.recentMeetings.push({
                    ...meeting,
                    contactName: contact?.name || 'Unknown'
                });
            }

            // ToDo統計
            if (meeting.todos) {
                meeting.todos.forEach(todo => {
                    stats.totalTodos++;
                    
                    if (todo.completed) {
                        stats.completedTodos++;
                    } else if (todo.dueDate) {
                        const dueDate = new Date(todo.dueDate);
                        if (dueDate < now) {
                            stats.overdueTodos.push({
                                ...todo,
                                meetingId: meeting.id,
                                contactName: contact?.name || 'Unknown'
                            });
                        } else if (dueDate < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
                            stats.upcomingTodos.push({
                                ...todo,
                                meetingId: meeting.id,
                                contactName: contact?.name || 'Unknown'
                            });
                        }
                    }
                });
            }
        });

        // ソート
        stats.recentMeetings.sort((a, b) => new Date(b.date) - new Date(a.date));
        stats.upcomingTodos.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        stats.overdueTodos.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

        return stats;
    }

    // カレンダー用データの取得
    getCalendarData(year, month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const meetings = this.filterByDateRange(startDate, endDate);
        
        return meetings.map(meeting => {
            const contact = this.contactsManager.getById(meeting.contactId);
            return {
                id: meeting.id,
                date: meeting.date,
                contactName: contact?.name || 'Unknown',
                contactId: meeting.contactId,
                hasTodos: meeting.todos?.length > 0,
                hasAttachments: meeting.attachments?.length > 0
            };
        });
    }

    // ID生成
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // インポート
    async import(data) {
        try {
            if (data.meetings) {
                this.meetings = data.meetings;
                await this.save();
            }
            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    }

    // エクスポート
    export() {
        return {
            meetings: this.meetings,
            meetingTemplate: this.meetingTemplate
        };
    }
}

// エクスポート用のグローバル変数
window.MeetingsManager = MeetingsManager;