/* ui.js — 連絡先リスト＆詳細ビュー + フォルダ選択UI */
(function (global) {
  const UI = {
    els: {},
    init() {
      this.els.list = document.querySelector('#contact-list');
      this.els.detail = document.querySelector('#contact-detail');
      // folder modal
      this.els.modal = document.querySelector('#folder-modal');
      this.els.folderList = document.querySelector('#folder-list');
      this.els.crumbs = document.querySelector('#crumbs');
      this.els.upBtn = document.querySelector('#up-btn');
      this.els.useHereBtn = document.querySelector('#use-here-btn');

      this.els.upBtn.addEventListener('click', async () => {
        const cur = AppData.state.currentFolderForPicker || 'root';
        if (cur === 'root') return;
        const meta = await AppData.getMeta(cur);
        const parent = (meta.parents && meta.parents[0]) ? meta.parents[0] : 'root';
        await this.showFolder(parent);
      });
      this.els.useHereBtn.addEventListener('click', async () => {
        const cur = AppData.state.currentFolderForPicker || 'root';
        await AppData.initRootFolder(cur);
        this.closeFolder();
        // ルート選択後、即時データ読み込み（認証済み前提）
        document.dispatchEvent(new CustomEvent('mm:rootSelected'));
      });
    },

    renderContacts(contacts) {
      console.log('[ui] renderContacts count:', contacts.length);
      if (!this.els.list) return;
      this.els.list.innerHTML = '';
      const frag = document.createDocumentFragment();
      contacts.forEach((c) => {
        const li = document.createElement('li');
        li.className = 'contact-item';
        li.dataset.id = c.id;
        li.textContent = c.name || c.displayName || c.company || '(no name)';
        li.addEventListener('click', () => this.onSelectContact(c.id));
        frag.appendChild(li);
      });
      this.els.list.appendChild(frag);
    },

    async onSelectContact(contactId) {
      this.els.detail.innerHTML = '<div class="loading">読み込み中...</div>';
      try {
        const detail = await AppData.getContactDetail(contactId);
        const meetings = await AppData.getMeetingsForContact(contactId);
        const avatarUrl = await AppData.getAvatarUrl(contactId, detail);
        this.renderContactDetail(detail, meetings, avatarUrl);
      } catch (e) {
        console.error(e);
        this.els.detail.innerHTML = `<div class="error">詳細の読込に失敗しました: ${e.message}</div>`;
      }
    },

    renderContactDetail(detail, meetings, avatarUrl) {
      const d = detail || {};
      const html = `
        <div class="contact-header">
          <div class="avatar">${avatarUrl ? `<img src="${avatarUrl}" alt="avatar">` : '<div class="no-avatar">No Photo</div>'}</div>
          <div class="meta">
            <h2>${d.name || d.displayName || '(no name)'}</h2>
            <div class="sub">${[d.org, d.title, (d.tags||[]).join(', ')].filter(Boolean).join(' / ')}</div>
            <div class="contacts">
              ${d.email ? `<div>Email: <a href="mailto:${d.email}">${d.email}</a></div>` : ''}
              ${d.phone ? `<div>Phone: <a href="tel:${d.phone}">${d.phone}</a></div>` : ''}
              ${d.address ? `<div>Address: ${d.address}</div>` : ''}
            </div>
          </div>
        </div>
        <div class="section">
          <h3>メモ</h3>
          <div class="note">${(d.note || '').replace(/\n/g, '<br>')}</div>
        </div>
        <div class="section">
          <h3>ミーティング</h3>
          ${this._renderMeetings(meetings)}
        </div>
      `;
      this.els.detail.innerHTML = html;
    },

    _renderMeetings(meetings) {
      if (!meetings || !meetings.length) return '<div class="empty">ミーティング履歴はありません</div>';
      const rows = meetings.map(m => {
        const title = m.title || m.topic || '（無題）';
        const date = m.date || m.createdAt || '';
        const body = (m.note || m.summary || '').replace(/\n/g, '<br>');
        const actions = (m.actions && m.actions.length)
          ? `<ul class="actions">${m.actions.map(a => `<li>${a}</li>`).join('')}</ul>`
          : '';
        return `
          <div class="meeting">
            <div class="meeting-head"><span class="date">${date}</span><span class="title">${title}</span></div>
            <div class="meeting-body">${body}</div>
            ${actions}
          </div>`;
      });
      return `<div class="meeting-list">${rows.join('')}</div>`;
    },

    // ===== folder modal =====
    async showFolder(folderId) {
      this.els.modal.style.display = 'flex';
      AppData.state.currentFolderForPicker = folderId || 'root';
      if (AppData.state.currentFolderForPicker !== 'root') {
        const meta = await AppData.getMeta(AppData.state.currentFolderForPicker);
        const parent = (meta.parents && meta.parents[0]) ? meta.parents[0] : 'root';
        this.els.crumbs.innerHTML = `
          <span>root</span> / <span>${parent === 'root' ? '' : ''}</span>
          <strong>${meta.name}</strong>`;
      } else {
        this.els.crumbs.textContent = 'root';
      }
      const children = await AppData.listChildFolders(AppData.state.currentFolderForPicker);
      this.els.folderList.innerHTML = '';
      children.forEach(f => {
        const div = document.createElement('div');
        div.className = 'folder';
        div.innerHTML = `<div>📁 ${f.name}</div><div style="font-size:12px;color:#888">${f.id}</div>`;
        div.addEventListener('click', () => this.showFolder(f.id));
        this.els.folderList.appendChild(div);
      });
    },
    closeFolder() {
      this.els.modal.style.display = 'none';
    }
  };

  global.UI = UI;
  global.openFolderModal = async function () {
    await UI.showFolder('root');
  };
  global.closeFolderModal = function () {
    UI.closeFolder();
  };
})(window);
