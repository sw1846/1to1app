// auth.js - Google認証処理

// Google OAuth設定
const CLIENT_ID = '938239904261-vt7rego8tmo4vhhcjp3fadca25asuh73.apps.googleusercontent.com'; // 実際のClient IDに置き換えてください
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile';

// 認証状態管理
let tokenClient;
let accessToken = null;
let userInfo = null;

// 初期化
function initializeAuth() {
    // セッションストレージからトークンを復元
    const savedToken = sessionStorage.getItem('access_token');
    const savedUserInfo = sessionStorage.getItem('user_info');
    
    if (savedToken && savedUserInfo) {
        accessToken = savedToken;
        userInfo = JSON.parse(savedUserInfo);
        
        // トークンの有効性をチェック
        validateToken().then(isValid => {
            if (isValid) {
                onAuthSuccess();
            } else {
                showLoginScreen();
            }
        });
    } else {
        showLoginScreen();
    }
    
    // Google Identity Services の初期化
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleAuthResponse,
    });
}

// ログイン処理
function login() {
    tokenClient.requestAccessToken();
}

// 認証レスポンス処理
async function handleAuthResponse(response) {
    if (response.error) {
        utils.showNotification('ログインに失敗しました', 'error');
        return;
    }
    
    accessToken = response.access_token;
    sessionStorage.setItem('access_token', accessToken);
    
    // ユーザー情報取得
    try {
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!userResponse.ok) {
            throw new Error('Failed to get user info');
        }
        
        userInfo = await userResponse.json();
        sessionStorage.setItem('user_info', JSON.stringify(userInfo));
        
        onAuthSuccess();
    } catch (error) {
        console.error('Error getting user info:', error);
        utils.showNotification('ユーザー情報の取得に失敗しました', 'error');
    }
}

// 認証成功時の処理
async function onAuthSuccess() {
    // UI更新
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'block';
    document.getElementById('userName').textContent = userInfo.name;
    document.getElementById('userAvatar').src = userInfo.picture;
    
    utils.showLoading();
    
    try {
        // Google Driveの初期化とデータ読み込み
        await drive.initialize();
        await loadAllData();
        
        // UI初期化
        ui.initialize();
        
        utils.showNotification('ログインしました');
    } catch (error) {
        console.error('Initialization error:', error);
        utils.showNotification('データの読み込みに失敗しました', 'error');
    } finally {
        utils.hideLoading();
    }
}

// ログアウト処理
function logout() {
    // トークン無効化
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('Token revoked');
        });
    }
    
    // セッションクリア
    sessionStorage.clear();
    accessToken = null;
    userInfo = null;
    
    // ログイン画面に戻る
    showLoginScreen();
    utils.showNotification('ログアウトしました');
}

// ログイン画面表示
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainScreen').style.display = 'none';
}

// トークン検証
async function validateToken() {
    if (!accessToken) return false;
    
    try {
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
        
        if (!response.ok) {
            sessionStorage.removeItem('access_token');
            sessionStorage.removeItem('user_info');
            return false;
        }
        
        const tokenInfo = await response.json();
        
        // スコープチェック
        const requiredScopes = SCOPES.split(' ');
        const grantedScopes = tokenInfo.scope.split(' ');
        
        return requiredScopes.every(scope => grantedScopes.includes(scope));
    } catch (error) {
        console.error('Token validation error:', error);
        return false;
    }
}

// 認証ヘッダー取得
function getAuthHeaders() {
    if (!accessToken) {
        throw new Error('Not authenticated');
    }
    
    return {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    };
}

// トークンリフレッシュ（必要に応じて）
function refreshToken() {
    tokenClient.requestAccessToken();
}

// データ読み込み
async function loadAllData() {
    try {
        // 連絡先データ読み込み
        const contactsData = await drive.readFile('contacts.json');
        if (contactsData) {
            window.contacts = JSON.parse(contactsData);
        } else {
            window.contacts = [];
        }
        
        // ミーティングデータ読み込み
        const meetingsData = await drive.readFile('meetings.json');
        if (meetingsData) {
            window.meetings = JSON.parse(meetingsData);
        } else {
            window.meetings = [];
        }
        
        // オプションデータ読み込み
        const optionsData = await drive.readFile('options.json');
        if (optionsData) {
            window.options = JSON.parse(optionsData);
        } else {
            window.options = {
                types: [],
                affiliations: [],
                wantToConnect: [],
                goldenEgg: []
            };
        }
    } catch (error) {
        console.error('Error loading data:', error);
        throw error;
    }
}

// イベントリスナー設定
document.addEventListener('DOMContentLoaded', () => {
    // ログインボタン
    document.getElementById('loginButton').addEventListener('click', login);
    
    // ログアウトボタン
    document.getElementById('logoutButton').addEventListener('click', logout);
    
    // Google Identity Services ライブラリ読み込み後に初期化
    if (typeof google !== 'undefined') {
        initializeAuth();
    } else {
        // ライブラリ読み込み待ち
        window.addEventListener('load', initializeAuth);
    }
});

// エクスポート
window.auth = {
    getAuthHeaders,
    refreshToken,
    getUserInfo: () => userInfo,
    isAuthenticated: () => !!accessToken
};
