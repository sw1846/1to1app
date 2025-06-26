// ===== Google認証機能 =====

// Google API初期化
async function initializeGapiClient() {
    await gapi.client.init({
        discoveryDocs: DISCOVERY_DOCS,
    });
    gapiInited = true;
    maybeEnableButtons();
}

// Google Identity Services初期化
function initializeGisClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
            if (response.error !== undefined) {
                throw (response);
            }
            // セキュリティ改善: トークンの有効期限を管理
            accessToken = response.access_token;
            const expiresIn = response.expires_in || 3600; // デフォルト1時間
            tokenExpiresAt = Date.now() + (expiresIn * 1000);
            
            // セッションストレージに保存（ブラウザを閉じると削除される）
            sessionStorage.setItem('google_access_token', accessToken);
            sessionStorage.setItem('token_expires_at', tokenExpiresAt);
            
            handleAuthSuccess();
        },
    });
    gisInited = true;
    maybeEnableButtons();
}

// 初期化完了チェック
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        // セキュリティ改善: セッションストレージから取得
        const savedToken = sessionStorage.getItem('google_access_token');
        const expiresAt = sessionStorage.getItem('token_expires_at');
        
        if (savedToken && expiresAt && Date.now() < parseInt(expiresAt)) {
            gapi.client.setToken({ access_token: savedToken });
            accessToken = savedToken;
            tokenExpiresAt = parseInt(expiresAt);
            validateTokenAndInitialize();
        } else {
            // 期限切れまたは無効なトークンをクリア
            clearTokens();
            showAuthScreen();
        }
    }
}

// トークンをクリア
function clearTokens() {
    sessionStorage.removeItem('google_access_token');
    sessionStorage.removeItem('token_expires_at');
    accessToken = null;
    tokenExpiresAt = null;
}

// トークンの有効性をチェック
function isTokenValid() {
    return accessToken && tokenExpiresAt && Date.now() < tokenExpiresAt;
}

// トークン検証
async function validateTokenAndInitialize() {
    try {
        await gapi.client.drive.about.get({ fields: 'user' });
        handleAuthSuccess();
    } catch (error) {
        console.error('Token validation failed:', error);
        clearTokens();
        showAuthScreen();
    }
}

// Google認証実行
function authenticateGoogle() {
    if (!CLIENT_ID) {
        showNotification('先にセットアップを完了してください', 'error');
        showSetupWizard();
        return;
    }
    
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        showNotification('認証の初期化に失敗しました。ページを再読み込みしてください。', 'error');
    }
}

// 認証画面表示
function showAuthScreen() {
    const authContainer = document.getElementById('authContainer');
    const mainContainer = document.getElementById('mainContainer');
    
    if (authContainer) {
        authContainer.style.display = 'block';
    }
    
    if (mainContainer) {
        mainContainer.style.display = 'none';
    }
    
    updateConnectionStatus();
}

// 認証成功時の処理
async function handleAuthSuccess() {
    try {
        showLoading();
        
        await ensureAppFolder();
        await loadData();
        
        // migratePhotoUrlsはdata-manager.jsで定義されているはず
        if (typeof migratePhotoUrls === 'function') {
            migratePhotoUrls();
        }
        
        const authContainer = document.getElementById('authContainer');
        const mainContainer = document.getElementById('mainContainer');
        
        if (authContainer) {
            authContainer.style.display = 'none';
        }
        
        if (mainContainer) {
            mainContainer.style.display = 'block';
        }
        
        initializeViewMode();
        initializeFilterVisibility();
        
        updateConnectionStatus();
        updateDropdownOptions();
        renderContactList();
        renderOutstandingActions();
        updateContactCount();
        
        // セキュリティ改善: トークン自動更新の設定
        scheduleTokenRefresh();
        
        hideLoading();
        showNotification('ログインしました');
    } catch (error) {
        console.error('Initialization error:', error);
        hideLoading();
        showNotification('初期化エラーが発生しました', 'error');
    }
}

// トークン自動更新のスケジュール
function scheduleTokenRefresh() {
    if (!tokenExpiresAt) return;
    
    // 有効期限の5分前に更新
    const refreshTime = tokenExpiresAt - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
        setTimeout(() => {
            if (tokenClient) {
                showNotification('認証を更新しています...', 'info');
                tokenClient.requestAccessToken({ prompt: '' });
            }
        }, refreshTime);
    }
}

// API呼び出し前のトークンチェック
async function ensureValidToken() {
    if (!isTokenValid()) {
        throw new Error('認証の有効期限が切れています。再度ログインしてください。');
    }
}

// ログアウト
function logout() {
    closeModal('settingsModal');
    
    if (tokenClient && accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('Token revoked');
        });
    }
    
    clearTokens();
    gapi.client.setToken(null);
    
    window.location.reload();
}

// 接続状態の更新
function updateConnectionStatus() {
    const dot = document.getElementById('connectionDot');
    const tooltip = document.getElementById('connectionTooltip');
    
    if (!dot || !tooltip) {
        return;
    }
    
    if (isTokenValid()) {
        dot.classList.add('connected');
        dot.classList.remove('disconnected');
        tooltip.textContent = '接続済み';
    } else {
        dot.classList.remove('connected');
        dot.classList.add('disconnected');
        tooltip.textContent = '未接続';
    }
}