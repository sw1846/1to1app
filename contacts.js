// contacts.js - 連絡先管理モジュール

class ContactsManager {
    constructor(storageManager) {
        this.storage = storageManager;
        this.contacts = [];
        this.options = {
            types: ['ビジネスパートナー', '顧客', '仕入先', '協力会社', 'その他'],
            affiliations: ['東京支部', '大阪支部', '名古屋支部', '福岡支部', 'その他'],
            wantToConnect: ['IT企業', '製造業', 'サービス業', '小売業', 'その他'],
            goldenEgg: ['紹介多数', 'キーパーソン', '意思決定者', 'インフルエンサー'],
            areas: [],
            residences: [],
            referredBy: []
        };
        this.currentEditingId = null;
        this.draftData = null;
    }

    // 初期化
    async initialize() {
        try {
            // 連絡先データの読み込み
            const contactsData = await this.storage.loadJsonFile('contacts.json');
            if (contactsData) {
                this.contacts = contactsData;
            }

            // オプションデータの読み込み
            const optionsData = await this.storage.loadJsonFile('options.json');
            if (optionsData) {
                this.options = { ...this.options, ...optionsData };
            }

            return true;
        } catch (error) {
            console.error('Contacts initialization error:', error);
            return false;
        }
    }

    // 連絡先の取得
    getAll() {
        return [...this.contacts];
    }

    // IDで連絡先を取得
    getById(id) {
        return this.contacts.find(c => c.id === id);
    }

    // 連絡先の検索
    search(query) {
        const searchTerm = query.toLowerCase();
        return this.contacts.filter(contact => {
            return (
                contact.name.toLowerCase().includes(searchTerm) ||
                (contact.company && contact.company.toLowerCase().includes(searchTerm)) ||
                (contact.email && contact.email.toLowerCase().includes(searchTerm)) ||
                (contact.cutout && contact.cutout.toLowerCase().includes(searchTerm))
            );
        });
    }

    // フィルタリング
    filter(criteria) {
        return this.contacts.filter(contact => {
            // 種別フィルター
            if (criteria.type && contact.types) {
                if (!contact.types.includes(criteria.type)) {
                    return false;
                }
            }

            // 所属フィルター
            if (criteria.affiliation && contact.affiliations) {
                if (!contact.affiliations.includes(criteria.affiliation)) {
                    return false;
                }
            }

            // 繋がりたい人フィルター
            if (criteria.wantToConnect && contact.wantToConnect) {
                const hasMatch = contact.wantToConnect.some(w => 
                    criteria.wantToConnect.includes(w)
                );
                if (!hasMatch) {
                    return false;
                }
            }

            // 金の卵フィルター
            if (criteria.goldenEgg && contact.goldenEgg) {
                const hasMatch = contact.goldenEgg.some(g => 
                    criteria.goldenEgg.includes(g)
                );
                if (!hasMatch) {
                    return false;
                }
            }

            return true;
        });
    }

    // 連絡先の作成
    async create(contactData, photoFile = null, businessCardFile = null, attachmentFiles = []) {
        try {
            // ID生成
            const contact = {
                ...contactData,
                id: this.generateId(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // 写真のアップロード
            if (photoFile) {
                const photoResult = await this.storage.uploadFile(
                    photoFile, 
                    contact.name, 
                    true
                );
                contact.photoUrl = photoResult.url;
                contact.photoId = photoResult.id;
            }

            // 名刺のアップロード
            if (businessCardFile) {
                const cardResult = await this.storage.uploadFile(
                    businessCardFile, 
                    contact.name, 
                    false, 
                    true
                );
                contact.businessCardUrl = cardResult.url;
                contact.businessCardId = cardResult.id;
            }

            // 添付ファイルのアップロード
            if (attachmentFiles.length > 0) {
                contact.attachments = [];
                for (const file of attachmentFiles) {
                    const attachResult = await this.storage.uploadFile(
                        file, 
                        contact.name
                    );
                    contact.attachments.push({
                        id: attachResult.id,
                        name: attachResult.name,
                        url: attachResult.url,
                        mimeType: attachResult.mimeType,
                        size: attachResult.size,
                        uploadedAt: new Date().toISOString()
                    });
                }
            }

            // 連絡先を追加
            this.contacts.push(contact);

            // オプションを更新
            this.updateOptions(contact);

            // 保存
            await this.save();

            return contact;
        } catch (error) {
            console.error('Contact creation error:', error);
            throw error;
        }
    }

    // 連絡先の更新
    async update(id, updateData, photoFile = null, businessCardFile = null, newAttachmentFiles = []) {
        try {
            const index = this.contacts.findIndex(c => c.id === id);
            if (index === -1) {
                throw new Error('Contact not found');
            }

            const existingContact = this.contacts[index];
            const updatedContact = {
                ...existingContact,
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            // 写真の更新
            if (photoFile) {
                // 既存の写真を削除
                if (existingContact.photoId) {
                    await this.storage.deleteFile(existingContact.photoId);
                }

                const photoResult = await this.storage.uploadFile(
                    photoFile, 
                    updatedContact.name, 
                    true
                );
                updatedContact.photoUrl = photoResult.url;
                updatedContact.photoId = photoResult.id;
            }

            // 名刺の更新
            if (businessCardFile) {
                // 既存の名刺を削除
                if (existingContact.businessCardId) {
                    await this.storage.deleteFile(existingContact.businessCardId);
                }

                const cardResult = await this.storage.uploadFile(
                    businessCardFile, 
                    updatedContact.name, 
                    false, 
                    true
                );
                updatedContact.businessCardUrl = cardResult.url;
                updatedContact.businessCardId = cardResult.id;
            }

            // 新しい添付ファイルの追加
            if (newAttachmentFiles.length > 0) {
                if (!updatedContact.attachments) {
                    updatedContact.attachments = [];
                }

                for (const file of newAttachmentFiles) {
                    const attachResult = await this.storage.uploadFile(
                        file, 
                        updatedContact.name
                    );
                    updatedContact.attachments.push({
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
            this.contacts[index] = updatedContact;

            // オプションを更新
            this.updateOptions(updatedContact);

            // 保存
            await this.save();

            return updatedContact;
        } catch (error) {
            console.error('Contact update error:', error);
            throw error;
        }
    }

    // 連絡先の削除
    async delete(id) {
        try {
            const contact = this.getById(id);
            if (!contact) {
                throw new Error('Contact not found');
            }

            // 関連ファイルの削除
            if (contact.photoId) {
                await this.storage.deleteFile(contact.photoId);
            }
            if (contact.businessCardId) {
                await this.storage.deleteFile(contact.businessCardId);
            }
            if (contact.attachments) {
                for (const attachment of contact.attachments) {
                    await this.storage.deleteFile(attachment.id);
                }
            }

            // 連絡先を削除
            this.contacts = this.contacts.filter(c => c.id !== id);

            // 保存
            await this.save();

            return true;
        } catch (error) {
            console.error('Contact deletion error:', error);
            return false;
        }
    }

    // ドラフトの保存（ローカルストレージ）
    saveDraft(contactData) {
        this.draftData = contactData;
        localStorage.setItem('contact_draft', JSON.stringify({
            data: contactData,
            savedAt: new Date().toISOString()
        }));
    }

    // ドラフトの読み込み
    loadDraft() {
        const draftStr = localStorage.getItem('contact_draft');
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
        localStorage.removeItem('contact_draft');
    }

    // オプションの更新
    updateOptions(contact) {
        // 紹介者
        if (contact.referredBy && !this.options.referredBy.includes(contact.referredBy)) {
            this.options.referredBy.push(contact.referredBy);
        }

        // エリア
        if (contact.area && !this.options.areas.includes(contact.area)) {
            this.options.areas.push(contact.area);
        }

        // 居住地
        if (contact.residence && !this.options.residences.includes(contact.residence)) {
            this.options.residences.push(contact.residence);
        }

        // 動的に追加された種別
        if (contact.types) {
            contact.types.forEach(type => {
                if (!this.options.types.includes(type)) {
                    this.options.types.push(type);
                }
            });
        }

        // 動的に追加された所属
        if (contact.affiliations) {
            contact.affiliations.forEach(aff => {
                if (!this.options.affiliations.includes(aff)) {
                    this.options.affiliations.push(aff);
                }
            });
        }

        // 動的に追加された繋がりたい人
        if (contact.wantToConnect) {
            contact.wantToConnect.forEach(want => {
                if (!this.options.wantToConnect.includes(want)) {
                    this.options.wantToConnect.push(want);
                }
            });
        }

        // 動的に追加された金の卵
        if (contact.goldenEgg) {
            contact.goldenEgg.forEach(egg => {
                if (!this.options.goldenEgg.includes(egg)) {
                    this.options.goldenEgg.push(egg);
                }
            });
        }
    }

    // データの保存
    async save() {
        try {
            await this.storage.saveJsonFile('contacts.json', this.contacts);
            await this.storage.saveJsonFile('options.json', this.options);
            return true;
        } catch (error) {
            console.error('Save error:', error);
            throw error;
        }
    }

    // インポート
    async import(data) {
        try {
            if (data.contacts) {
                this.contacts = data.contacts;
            }
            if (data.options) {
                this.options = { ...this.options, ...data.options };
            }
            
            await this.save();
            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    }

    // エクスポート
    export() {
        return {
            contacts: this.contacts,
            options: this.options,
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
    }

    // 統計情報の取得
    getStatistics() {
        const stats = {
            total: this.contacts.length,
            byType: {},
            byAffiliation: {},
            byGoldenEgg: {},
            recentlyAdded: 0,
            recentlyUpdated: 0
        };

        const now = new Date();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        this.contacts.forEach(contact => {
            // 種別統計
            if (contact.types) {
                contact.types.forEach(type => {
                    stats.byType[type] = (stats.byType[type] || 0) + 1;
                });
            }

            // 所属統計
            if (contact.affiliations) {
                contact.affiliations.forEach(aff => {
                    stats.byAffiliation[aff] = (stats.byAffiliation[aff] || 0) + 1;
                });
            }

            // 金の卵統計
            if (contact.goldenEgg) {
                contact.goldenEgg.forEach(egg => {
                    stats.byGoldenEgg[egg] = (stats.byGoldenEgg[egg] || 0) + 1;
                });
            }

            // 最近の追加・更新
            if (new Date(contact.createdAt) > weekAgo) {
                stats.recentlyAdded++;
            }
            if (new Date(contact.updatedAt) > weekAgo) {
                stats.recentlyUpdated++;
            }
        });

        return stats;
    }

    // ID生成
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// エクスポート用のグローバル変数
window.ContactsManager = ContactsManager;