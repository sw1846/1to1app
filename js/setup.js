// ===== セットアップウィザード機能 =====

let currentStep = 1;
const totalSteps = 4;

// セットアップウィザード表示
function showSetupWizard(fromSettings = false) {
    document.getElementById('setupWizard').style.display = 'block';
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('mainContainer').style.display = 'none';
    
    // 設定画面からの場合は戻るボタンを表示
    document.getElementById('backToMainBtn').style.display = fromSettings ? 'block' : 'none';
    
    // 既存のクライアントIDがある場合は表示
    if (CLIENT_ID) {
        document.getElementById('clientIdInput').value = CLIENT_ID;
    }
    
    // 現在のURLを表示
    updateOriginUrl();
}

// 現在のオリジンURLを更新
function updateOriginUrl() {
    const originUrl = window.location.origin;
    const codeElement = document.getElementById('origin-url');
    if (codeElement) {
        codeElement.textContent = originUrl;
    }
}

// 次のステップへ
function nextStep() {
    if (currentStep < totalSteps) {
        // 現在のステップを非表示
        document.getElementById(`step${currentStep}`).classList.remove('active');
        document.getElementById(`step${currentStep}Dot`).classList.remove('active');
        document.getElementById(`step${currentStep}Dot`).classList.add('completed');
        
        // 次のステップを表示
        currentStep++;
        document.getElementById(`step${currentStep}`).classList.add('active');
        document.getElementById(`step${currentStep}Dot`).classList.add('active');
        
        // ステップ3の場合、Origin URLを更新
        if (currentStep === 3) {
            updateOriginUrl();
        }
    }
}

// 前のステップへ
function previousStep() {
    if (currentStep > 1) {
        // 現在のステップを非表示
        document.getElementById(`step${currentStep}`).classList.remove('active');
        document.getElementById(`step${currentStep}Dot`).classList.remove('active');
        
        // 前のステップを表示
        currentStep--;
        document.getElementById(`step${currentStep}`).classList.add('active');
        document.getElementById(`step${currentStep}Dot`).classList.remove('completed');
        document.getElementById(`step${currentStep}Dot`).classList.add('active');
    }
}

// クライアントIDの検証と次へ進む
function validateAndProceed() {
    const clientId = document.getElementById('clientIdInput').value.trim();
    
    if (!clientId) {
        showNotification('クライアントIDを入力してください', 'error');
        return;
    }
    
    // 基本的な形式チェック
    if (!clientId.includes('.apps.googleusercontent.com')) {
        showNotification('有効なクライアントIDを入力してください', 'error');
        return;
    }
    
    // 一時的に保存
    CLIENT_ID = clientId;
    
    // 最終確認画面に表示
    document.getElementById('final-config').textContent = `クライアントID: ${clientId}`;
    
    nextStep();
}

// セットアップ完了
async function completeSetup() {
    const clientId = CLIENT_ID;
    
    if (!clientId) {
        showNotification('エラー: クライアントIDが設定されていません', 'error');
        return;
    }
    
    // ローカルストレージに保存
    localStorage.setItem('googleClientId', clientId);
    
    // グローバル変数を更新
    CLIENT_ID = clientId;
    
    // セットアップウィザードを非表示
    document.getElementById('setupWizard').style.display = 'none';
    
    // Google APIを初期化
    if (typeof gisLoaded === 'function') {
        gisLoaded();
    }
    
    // 認証画面を表示
    document.getElementById('authContainer').style.display = 'block';
    
    showNotification('セットアップが完了しました。Googleアカウントでログインしてください。');
}

// セットアップ画面から戻る
function closeSetupAndReturn() {
    document.getElementById('setupWizard').style.display = 'none';
    if (CLIENT_ID && gapiInited && gisInited) {
        // 既にセットアップ済みでログイン済みの場合はメイン画面に戻る
        document.getElementById('mainContainer').style.display = 'block';
    } else if (CLIENT_ID) {
        // セットアップ済みだがログインしていない場合は認証画面へ
        document.getElementById('authContainer').style.display = 'block';
    } else {
        // セットアップが完了していない場合も認証画面へ
        document.getElementById('authContainer').style.display = 'block';
    }
}

// クリップボードにコピー（セットアップ画面用）
function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).textContent;
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('コピーしました');
        }).catch(err => {
            console.error('コピーに失敗しました:', err);
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification('コピーしました');
    } catch (err) {
        showNotification('コピーに失敗しました。手動でコピーしてください。', 'error');
    }
    
    document.body.removeChild(textArea);
}