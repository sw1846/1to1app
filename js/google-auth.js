// ===== Google認証機能 =====

// Google API初期化
async function initializeGapiClient() {
    try {
        await gapi.client.init({
            discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        console.log('GAPI初期化完了');
        maybeEnableButtons();
    } catch (error) {
        console.error('GAPI初期化エラー:', error);
        showNotification('Google APIの初期化に失敗しました', 'error');
    }
}

// Google Identity Services初期化
function initializeGisClient() {
    try {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (response) => {
                if (response.error !== undefined) {
                    console.error('認証エラー:', response);
                    showNotification('認証に失敗しました', 'error');
                    return;
                }
                // トークンの有効期限を管理
                accessToken = response.access_token;
                const expiresIn = response.expires_in || 3600; // デフォルト1時間
                tokenExpiresAt = Date.now() + (expiresIn * 1000);
                
                // ローカルストレージに保存（より長期的な保存）
                localStorage.setItem('google_access_token', accessToken);
                localStorage.setItem('token_expires_at', tokenExpiresAt);
                
                handleAuthSuccess();
            },
        });
        gisInited = true;
        console.log('GIS初期化完了');
        maybeEnableButtons();
    } catch (error) {
        console.error('GIS初期化エラー:', error);
        showNotification('認証サービスの初期化に失敗しました', 'error');
    }
}

// 初期化完了チェック
function maybeEnableButtons() {
    console.log('初期化状態確認 - GAPI:', gapiInited, 'GIS:', gisInited);
    
    if (gapiInited && gisInited) {
        // ローカルストレージから取得（永続化）
        const savedToken = localStorage.getItem('google_access_token');
        const expiresAt = localStorage.getItem('token_expires_at');
        
        if (savedToken && expiresAt && Date.now() < parseInt(expiresAt)) {
            console.log('保存済みトークンを使用');
            gapi.client.setToken({ access_token: savedToken });
            accessToken = savedToken;
            tokenExpiresAt = parseInt(expiresAt);
            validateTokenAndInitialize();
        } else {
            // 期限切れまたは無効なトークンをクリア
            console.log('認証画面を表示');
            clearTokens();
            showAuthScreen();
        }
    }
}

// トークンをクリア
function clearTokens() {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('token_expires_at');
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
        console.log('トークン検証中...');
        await gapi.client.drive.about.get({ fields: 'user' });
        console.log('トークン有効');
        handleAuthSuccess();
    } catch (error) {
        console.error('Token validation failed:', error);
        // エラー時は再認証を試みる
        if (tokenClient) {
            console.log('サイレント再認証を試行');
            tokenClient.requestAccessToken({ prompt: '' });
        } else {
            clearTokens();
            showAuthScreen();
        }
    }
}

// Google認証実行
function authenticateGoogle() {
    console.log('Google認証開始');
    
    if (!CLIENT_ID) {
        showNotification('先にセットアップを完了してください', 'error');
        showSetupWizard();
        return;
    }
    
    if (tokenClient) {
        // promptを空にして、可能な限りサイレント認証を試みる
        tokenClient.requestAccessToken({ prompt: '' });
    } else {
        showNotification('認証の初期化に失敗しました。ページを再読み込みしてください。', 'error');
    }
}

// 認証画面表示
function showAuthScreen() {
    console.log('認証画面を表示');
    
    const authContainer = document.getElementById('authContainer');
    const mainContainer = document.getElementById('mainContainer');
    const setupWizard = document.getElementById('setupWizard');
    
    if (setupWizard) {
        setupWizard.style.display = 'none';
    }
    
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
    console.log('認証成功 - データ読み込み開始');
    
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
        
        // トークン自動更新の設定
        scheduleTokenRefresh();
        
        hideLoading();
        showNotification('ログインしました');
    } catch (error) {
        console.error('Initialization error:', error);
        hideLoading();
        showNotification('初期化エラーが発生しました', 'error');
    }
}

// トークン自動更新のスケジュール（改善版）
function scheduleTokenRefresh() {
    if (!tokenExpiresAt) return;
    
    // 有効期限の10分前に更新（余裕を持たせる）
    const refreshTime = tokenExpiresAt - Date.now() - (10 * 60 * 1000);
    
    if (refreshTime > 0) {
        setTimeout(() => {
            if (tokenClient) {
                // サイレント更新を試みる
                tokenClient.requestAccessToken({ prompt: '' });
            }
        }, refreshTime);
    } else {
        // すでに期限が近い場合は即座に更新
        if (tokenClient) {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    }
}

// API呼び出し前のトークンチェック
async function ensureValidToken() {
    if (!isTokenValid()) {
        // トークンが無効な場合、サイレント更新を試みる
        if (tokenClient) {
            return new Promise((resolve, reject) => {
                const originalCallback = tokenClient.callback;
                tokenClient.callback = (response) => {
                    originalCallback(response);
                    if (response.error) {
                        reject(new Error('認証の更新に失敗しました'));
                    } else {
                        resolve();
                    }
                };
                tokenClient.requestAccessToken({ prompt: '' });
            });
        } else {
            throw new Error('認証の有効期限が切れています。再度ログインしてください。');
        }
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

// 必要な関数のスタブ（他のJSファイルが読み込まれるまでの仮実装）
if (typeof showLoading === 'undefined') {
    window.showLoading = function() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'flex';
    };
}

if (typeof hideLoading === 'undefined') {
    window.hideLoading = function() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    };
}

if (typeof showNotification === 'undefined') {
    window.showNotification = function(message, type = 'success') {
        console.log(`[${type}] ${message}`);
    };
}

if (typeof ensureAppFolder === 'undefined') {
    window.ensureAppFolder = async function() {
        console.log('ensureAppFolder - stub');
    };
}

if (typeof loadData === 'undefined') {
    window.loadData = async function() {
        console.log('loadData - stub');
    };
}

if (typeof initializeViewMode === 'undefined') {
    window.initializeViewMode = function() {
        console.log('initializeViewMode - stub');
    };
}

if (typeof initializeFilterVisibility === 'undefined') {
    window.initializeFilterVisibility = function() {
        console.log('initializeFilterVisibility - stub');
    };
}

if (typeof updateDropdownOptions === 'undefined') {
    window.updateDropdownOptions = function() {
        console.log('updateDropdownOptions - stub');
    };
}

if (typeof renderContactList === 'undefined') {
    window.renderContactList = function() {
        console.log('renderContactList - stub');
    };
}

if (typeof renderOutstandingActions === 'undefined') {
    window.renderOutstandingActions = function() {
        console.log('renderOutstandingActions - stub');
    };
}

if (typeof updateContactCount === 'undefined') {
    window.updateContactCount = function() {
        console.log('updateContactCount - stub');
    };
}