// auth.js - Google認証とセッション管理

class AuthManager {
    constructor() {
        this.CLIENT_ID = 'YOUR_CLIENT_ID_HERE'; // 実際のClient IDに置き換えてください
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
        
        this.tokenClient = null;
        this.accessToken = null;
        this.onAuthSuccess = null;
        this.onAuthError = null;
    }

    // Google APIの初期化
    async initialize() {
        return new Promise((resolve, reject) => {
            // Google APIライブラリのロード
            if (typeof gapi === 'undefined') {
                reject(new Error('Google API not loaded'));
                return;
            }

            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        discoveryDocs: [this.DISCOVERY_DOC],
                    });
                    
                    // Google Identity Services の初期化
                    if (typeof google === 'undefined' || !google.accounts) {
                        reject(new Error('Google Identity Services not loaded'));
                        return;
                    }

                    this.tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: this.CLIENT_ID,
                        scope: this.SCOPES,
                        callback: (response) => this.handleAuthResponse(response),
                    });

                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    // ログイン処理
    login() {
        if (!this.tokenClient) {
            console.error('Token client not initialized');
            return;
        }

        if (gapi.client.getToken() === null) {
            // 初回認証
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            // トークンの更新
            this.tokenClient.requestAccessToken({ prompt: '' });
        }
    }

    // 認証レスポンスの処理
    async handleAuthResponse(response) {
        if (response.error) {
            console.error('Auth error:', response);
            if (this.onAuthError) {
                this.onAuthError(response.error);
            }
            return;
        }

        this.accessToken = response.access_token;
        this.saveSession(response);

        if (this.onAuthSuccess) {
            await this.onAuthSuccess(response);
        }
    }

    // セッションの保存
    saveSession(authResponse) {
        const sessionData = {
            accessToken: authResponse.access_token,
            expiresAt: Date.now() + (authResponse.expires_in * 1000),
            tokenType: authResponse.token_type,
            scope: authResponse.scope
        };

        sessionStorage.setItem('auth_session', JSON.stringify(sessionData));
        
        // gapi clientにトークンを設定
        gapi.client.setToken({
            access_token: authResponse.access_token
        });
    }

    // セッションの復元
    restoreSession() {
        const sessionStr = sessionStorage.getItem('auth_session');
        if (!sessionStr) {
            return false;
        }

        try {
            const session = JSON.parse(sessionStr);
            
            // トークンの有効期限をチェック
            if (Date.now() >= session.expiresAt) {
                this.clearSession();
                return false;
            }

            this.accessToken = session.accessToken;
            
            // gapi clientにトークンを設定
            if (gapi.client) {
                gapi.client.setToken({
                    access_token: session.accessToken
                });
            }

            return true;
        } catch (error) {
            console.error('Session restore error:', error);
            this.clearSession();
            return false;
        }
    }

    // セッションのクリア
    clearSession() {
        sessionStorage.removeItem('auth_session');
        this.accessToken = null;
        
        if (gapi.client) {
            gapi.client.setToken(null);
        }
    }

    // ログアウト処理
    logout() {
        if (this.accessToken) {
            // Googleアカウントからのログアウト
            google.accounts.oauth2.revoke(this.accessToken, () => {
                console.log('Access token revoked');
            });
        }
        
        this.clearSession();
        window.location.reload();
    }

    // トークンの有効性チェック
    async validateToken() {
        if (!this.accessToken) {
            return false;
        }

        try {
            // Drive APIの簡単な呼び出しでトークンの有効性を確認
            const response = await gapi.client.drive.about.get({
                fields: 'user'
            });
            
            return response.status === 200;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    // トークンのリフレッシュ
    refreshToken() {
        if (this.tokenClient) {
            this.tokenClient.requestAccessToken({ prompt: '' });
        }
    }

    // 現在のユーザー情報を取得
    async getCurrentUser() {
        try {
            const response = await gapi.client.drive.about.get({
                fields: 'user(displayName,emailAddress,photoLink)'
            });
            
            return response.result.user;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    // アクセストークンの取得
    getAccessToken() {
        return this.accessToken;
    }

    // 認証状態の確認
    isAuthenticated() {
        return !!this.accessToken && !!gapi.client.getToken();
    }

    // イベントハンドラーの設定
    setAuthSuccessHandler(handler) {
        this.onAuthSuccess = handler;
    }

    setAuthErrorHandler(handler) {
        this.onAuthError = handler;
    }
}

// エクスポート用のグローバル変数
window.AuthManager = AuthManager;