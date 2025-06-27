// content.js - Chrome拡張機能用のコンテンツスクリプト
// このファイルはChrome拡張機能として使用する場合のみ必要です
// 通常のウェブアプリケーションとして使用する場合は不要です

// メッセージリスナーを設定
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        if (request.action === 'ping') {
            // 接続確認
            sendResponse({ status: 'alive' });
            return true;
        }
        
        if (request.action === 'getData') {
            // データ取得リクエスト
            const data = {
                contacts: window.contacts || [],
                meetings: window.meetings || []
            };
            sendResponse({ status: 'success', data: data });
            return true;
        }
        
        if (request.action === 'setData') {
            // データ設定リクエスト
            if (request.data) {
                if (request.data.contacts) {
                    window.contacts = request.data.contacts;
                }
                if (request.data.meetings) {
                    window.meetings = request.data.meetings;
                }
                sendResponse({ status: 'success' });
            } else {
                sendResponse({ status: 'error', message: 'No data provided' });
            }
            return true;
        }
        
        // 未知のアクションの場合
        sendResponse({ status: 'error', message: 'Unknown action' });
        return true;
        
    } catch (error) {
        // エラーハンドリング
        console.error('Content script error:', error);
        sendResponse({ status: 'error', message: error.message });
        return true;
    }
});

// ページ読み込み完了時の処理
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContentScript);
} else {
    initContentScript();
}

function initContentScript() {
    // 拡張機能として動作していることを示すフラグを設定
    window.isExtension = true;
    
    // バックグラウンドスクリプトに準備完了を通知
    if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'contentScriptReady' }, (response) => {
            if (chrome.runtime.lastError) {
                // エラーが発生してもアプリケーションの動作に影響しないようにする
                console.log('Background script not available:', chrome.runtime.lastError.message);
            }
        });
    }
}

// ページアンロード時のクリーンアップ
window.addEventListener('beforeunload', () => {
    // 必要に応じてクリーンアップ処理を追加
    if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'contentScriptUnloading' }, () => {
            // レスポンスを待たずに処理を続行
        });
    }
});