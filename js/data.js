/* data.js — Drive 読み込みと分散JSONの集約ラッパー */
(function (global) {
  const AppData = {
    state: {
      token: null,
      isRequestingToken: false,
      rootFolderId: null,
      currentFolderForPicker: null,
      caches: {
        idByPath: new Map(),
        fileMeta: new Map(),
        jsonById: new Map(),
        contactsIndex: null,
        meetingsIndex: null,
      },
      options: {},
      listeners: new Map(),
    },

    on(event, fn) {
      if (!this.state.listeners.has(event)) this.state.listeners.set(event, new Set());
      this.state.listeners.get(event).add(fn);
    },
    emit(event, payload) {
      const set = this.state.listeners.get(event);
      if (set) set.forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } });
    },

    // ===== 認証 =====
    async signin() {
      if (this.state.isRequestingToken) return;
      this.state.isRequestingToken = true;
      try {
        const tk = gapi.client.getToken();
        if (!tk || !tk.access_token) {
          await new Promise((resolve, reject) => {
            try {
              this._tokenClient = this._tokenClient || google.accounts.oauth2.initTokenClient({
                client_id: global.GIS_CLIENT_ID,
                scope: [
                  'https://www.googleapis.com/auth/drive.readonly',
                  'https://www.googleapis.com/auth/drive.appdata',
                ].join(' '),
                prompt: '',
                callback: (resp) => {
                  if (resp && resp.access_token) {
                    gapi.client.setToken({ access_token: resp.access_token });
                    this.state.token = resp.access_token;
                    console.log('[data] token resp', resp);
                    this.emit('token', resp);
                    resolve();
                  } else {
                    reject(new Error('No token'));
                  }
                },
              });
              this._tokenClient.requestAccessToken();
            } catch (e) { reject(e); }
          });
        } else {
          this.state.token = tk.access_token;
          this.emit('token', tk);
        }
      } finally {
        this.state.isRequestingToken = false;
      }
    },

    // ===== Drive 基本 I/F =====
    get authHeader() {
      const tk = gapi.client.getToken();
      const token = tk && tk.access_token ? tk.access_token : this.state.token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    },

    async _filesList(query, fields = 'files(id,name,mimeType,parents,size,md5Checksum,thumbnailLink,webViewLink,webContentLink,createdTime,modifiedTime),nextPageToken') {
      const res = await gapi.client.drive.files.list({
        q: query,
        fields,
        spaces: 'drive',
        pageSize: 1000,
        corpora: 'user',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        orderBy: 'folder,name_natural',
      });
      return res.result.files || [];
    },

    async _getById(fileId, opts = { alt: 'json' }) {
      if (opts.alt === 'media') {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const resp = await fetch(url, { headers: this.authHeader });
        const text = await resp.text();
        if (/^\s*<!doctype html|^\s*<html/i.test(text)) {
          throw new Error('HTML viewer content fetched instead of JSON/media');
        }
        return text;
      } else {
        const res = await gapi.client.drive.files.get({
          fileId,
          fields: 'id,name,mimeType,parents,size,md5Checksum,thumbnailLink,webViewLink,webContentLink',
          supportsAllDrives: true,
        });
        return res.result;
      }
    },

    async _readJsonById(fileId) {
      if (this.state.caches.jsonById.has(fileId)) return this.state.caches.jsonById.get(fileId);
      const txt = await this._getById(fileId, { alt: 'media' });
      let json;
      try {
        json = JSON.parse(txt);
      } catch (e) {
        const clean = txt.replace(/^\uFEFF/, '');
        json = JSON.parse(clean);
      }
      this.state.caches.jsonById.set(fileId, json);
      return json;
    },

    async _resolveByExactName(name, parentId) {
      const q = [
        `name = '${name.replace(/'/g, "\\'")}'`,
        parentId ? `'${parentId}' in parents` : null,
        "trashed = false",
      ].filter(Boolean).join(' and ');
      const files = await this._filesList(q);
      return files[0] || null;
    },

    async _resolvePath(path) {
      if (this.state.caches.idByPath.has(path)) return this.state.caches.idByPath.get(path);
      const parts = path.split('/');
      let parent = this.state.rootFolderId;
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i];
        const meta = await this._resolveByExactName(name, parent);
        if (!meta) throw new Error(`Not found by path: ${path}`);
        parent = meta.id;
        if (i === parts.length - 1) {
          this.state.caches.idByPath.set(path, meta.id);
          this.state.caches.fileMeta.set(meta.id, meta);
          return meta.id;
        }
      }
      throw new Error(`Path resolution failed: ${path}`);
    },

    async readJsonByPath(path) {
      if (!/\.json$/i.test(path)) throw new Error(`Refusing to read non-JSON: ${path}`);
      const id = await this._resolvePath(path);
      const meta = this.state.caches.fileMeta.get(id) || await this._getById(id);
      if (!/^application\/(json|octet-stream)$/i.test(meta.mimeType) && !/\.json$/i.test(meta.name)) {
        // Google Drive は application/octet-stream でJSONを返し得るため両方許容
        throw new Error(`Not a JSON file: ${meta.mimeType} ${meta.name}`);
      }
      return this._readJsonById(id);
    },

    async initRootFolder(rootFolderId) {
      this.state.rootFolderId = rootFolderId;
      localStorage.setItem('mm_rootFolderId', rootFolderId);
      this.emit('root:set', rootFolderId);
    },

    // ===== 分散JSON ロード =====
    async loadIndexes() {
      const [contactsIdx, meetingsIdx, options] = await Promise.all([
        this.readJsonByPath('contacts-index.json').catch(() => ({ contacts: [] })),
        this.readJsonByPath('meetings-index.json').catch(() => ({ meetings: [], byContact: {} })),
        this.readJsonByPath('options.json').catch(() => ({})),
      ]);
      this.state.caches.contactsIndex = contactsIdx;
      this.state.caches.meetingsIndex = meetingsIdx;
      this.state.options = options;
      return { contactsIdx, meetingsIdx, options };
    },

    getContactsFromIndex() {
      const idx = this.state.caches.contactsIndex;
      if (!idx) return [];
      const list = idx.contacts || idx || [];
      return Array.isArray(list) ? list : [];
    },

    async getContactDetail(contactId) {
      const path = `contacts/${contactId}.json`;
      return await this.readJsonByPath(path);
    },

    async getMeetingsForContact(contactId) {
      const idx = this.state.caches.meetingsIndex;
      if (idx && idx.byContact && idx.byContact[contactId]) {
        const ids = idx.byContact[contactId];
        const results = [];
        for (const name of ids) {
          const data = await this.readJsonByPath(`meetings/${contactId}/${name}`);
          results.push(data);
        }
        results.sort((a,b) => (b.date||'').localeCompare(a.date||''));
        return results;
      }
      try {
        const folderId = await this._resolvePath(`meetings/${contactId}`);
        const files = await this._filesList(`'${folderId}' in parents and trashed = false and name contains '.json'`);
        const out = [];
        for (const f of files) {
          const data = await this._readJsonById(f.id);
          out.push(data);
        }
        out.sort((a,b) => (b.date||'').localeCompare(a.date||''));
        return out;
      } catch (e) {
        return [];
      }
    },

    async getAvatarUrl(contactId, detail) {
      if (detail && detail.photoFileId) {
        const meta = await this._getById(detail.photoFileId);
        return meta.thumbnailLink || meta.webContentLink || await this._makeBlobUrl(detail.photoFileId);
      }
      try {
        const folderId = await this._resolvePath(`attachments/${contactId}`);
        const files = await this._filesList(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
          'files(id,name,mimeType,thumbnailLink,webContentLink),nextPageToken');
        const f = files[0];
        if (!f) return null;
        return f.thumbnailLink || f.webContentLink || await this._makeBlobUrl(f.id);
      } catch (e) {
        return null;
      }
    },

    async _makeBlobUrl(fileId) {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const resp = await fetch(url, { headers: this.authHeader });
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    },

    // ===== フォルダピッカー（簡易） =====
    async listChildFolders(parentId) {
      const q = [`'${parentId}' in parents`, "mimeType = 'application/vnd.google-apps.folder'", "trashed = false"].join(' and ');
      const files = await this._filesList(q);
      return files;
    },
    async getMeta(fileId) {
      const meta = await this._getById(fileId);
      this.state.caches.fileMeta.set(fileId, meta);
      return meta;
    }
  };

  global.AppData = AppData;
})(window);
