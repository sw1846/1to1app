// === Google OAuth 設定（必ず自分の Client ID を設定してください） ===
window.APP_CONFIG = window.APP_CONFIG || {};
window.APP_CONFIG.GOOGLE_CLIENT_ID = window.APP_CONFIG.GOOGLE_CLIENT_ID || '38239904261-vt7rego8tmo4vhhcjp3fadca25asuh73.apps.googleusercontent.com';
window.APP_CONFIG.GOOGLE_SCOPES = window.APP_CONFIG.GOOGLE_SCOPES || 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata';

// config.js - 分散ファイル構造対応のグローバル変数と設定

// グローバル変数
let directoryHandle = null; // File System Access API用（使用されない）
let contacts = [];
let meetings = [];
let options = {
    types: ['顧客候補', '顧客', '取次店・販売店'],
    affiliations: [],
    industryInterests: [],
    statuses: ['新規', '接触中', '提案中', '商談中', '成約', '失注', '保留']
};

// 分散ファイル構造用のグローバル変数
let folderStructure = {
    root: null,           // ルートフォルダ（1to1meeting）
    index: null,          // インデックスフォルダ
    contacts: null,       // 連絡先フォルダ
    meetings: null,       // ミーティングフォルダ
    attachments: null,    // 添付ファイルフォルダ
    attachmentsContacts: null,  // 連絡先添付ファイルフォルダ
    attachmentsMeetings: null   // ミーティング添付ファイルフォルダ
};

// インデックス管理
let contactsIndex = {};    // 連絡先インデックス
let meetingsIndex = {};    // ミーティングインデックス  
let searchIndex = {};      // 検索インデックス

// メタデータ管理
let metadata = {
    version: '2.0',
    lastUpdated: null,
    totalContacts: 0,
    totalMeetings: 0,
    nextContactId: 1,
    nextMeetingId: 1,
    migrationFrom: null,  // 移行元の形式（legacy/v1など）
    createdAt: null
};

// Google Drive API関連（data.jsで定義・初期化）
// 注意: ここでは再宣言しない。data.js 側の window.* を利用する。
if (typeof window !== 'undefined') {
    window.tokenClient = window.tokenClient || null;
    window.gapiInited = window.gapiInited || false;
    window.gisInited = window.gisInited || false;
    window.currentFolderId = window.currentFolderId || null;
    // Also expose as global var for non-module scripts
    var currentFolderId = window.currentFolderId;
    window.accessToken = window.accessToken || null;
}

// UI状態

let currentContactId = null;
let currentMeetingId = null;
let currentView = 'card';
let currentTab = 'contacts';
let currentSort = 'meeting-desc';
let modalMouseDownTarget = null;

// 選択されたオプション
let selectedOptions = {
    type: [],
    affiliation: [],
    industryInterests: []
};

// フィルター状態
let referrerFilter = null;
let multiSelectSearchQueries = {
    type: '',
    affiliation: '',
    industryInterests: ''
};

// 検索フィルター用の変数
let filterValues = {
    affiliation: '',
    business: '',
    industryInterests: '',
    residence: ''
};

// システム設定
let systemConfig = {
    autoSaveInterval: 5 * 60 * 1000, // 5分
    maxFileSize: 10 * 1024 * 1024,   // 10MB
    supportedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    supportedFileTypes: ['*'],
    batchSaveSize: 50,  // バッチ処理のサイズ
    enableIndexing: true,
    enableSearchIndex: true,
    enableMetadata: true
};

// パフォーマンス監視用
let performanceMetrics = {
    lastSaveTime: null,
    saveCount: 0,
    loadTime: null,
    contactCount: 0,
    meetingCount: 0,
    memoryUsage: 0
};

// エラー管理
let errorLog = [];
let maxErrorLogSize = 100;

// キャッシュ管理（必要に応じて）
let fileCache = new Map();
let imageCacheSize = 0;
let maxImageCacheSize = 50 * 1024 * 1024; // 50MB

// 分散ファイル構造の設定
const FILE_STRUCTURE = {
    INDEX_FOLDER: 'index',
    CONTACTS_FOLDER: 'contacts',
    MEETINGS_FOLDER: 'meetings',
    ATTACHMENTS_FOLDER: 'attachments',
    ATTACHMENTS_CONTACTS_FOLDER: 'contacts',
    ATTACHMENTS_MEETINGS_FOLDER: 'meetings',
    
    // ファイル名パターン
    CONTACT_FILE_PATTERN: 'contact-{id}.json',
    MEETING_FILE_PATTERN: 'contact-{id}-meetings.json',
    CONTACTS_INDEX_FILE: 'contacts-index.json',
    MEETINGS_INDEX_FILE: 'meetings-index.json',
    SEARCH_INDEX_FILE: 'search-index.json',
    METADATA_FILE: 'metadata.json',
    OPTIONS_FILE: 'options.json'
};

// ファイル操作の設定
const FILE_CONFIG = {
    ENCODING: 'utf-8',
    JSON_INDENT: 2,
    BACKUP_SUFFIX: '.backup',
    TEMP_SUFFIX: '.tmp',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

// Google Drive API設定
const GOOGLE_DRIVE_CONFIG = {
    CLIENT_ID: '938239904261-vt7rego8tmo4vhhcjp3fadca25asuh73.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/drive.file',
    DISCOVERY_DOCS: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    ROOT_FOLDER_NAME: '1to1meeting'
};

// ユーティリティ関数
function generateContactId() {
    if (metadata && metadata.nextContactId) {
        const newId = String(metadata.nextContactId).padStart(6, '0');
        metadata.nextContactId++;
        return newId;
    }
    
    // フォールバック
    let maxId = 0;
    contacts.forEach(contact => {
        const id = parseInt(contact.id) || 0;
        if (id > maxId) {
            maxId = id;
        }
    });
    
    const newId = String(maxId + 1).padStart(6, '0');
    if (metadata) {
        metadata.nextContactId = maxId + 2;
    }
    return newId;
}

function generateMeetingId() {
    if (metadata && metadata.nextMeetingId) {
        const newId = String(metadata.nextMeetingId).padStart(6, '0');
        metadata.nextMeetingId++;
        return newId;
    }
    
    // フォールバック
    let maxId = 0;
    meetings.forEach(meeting => {
        const id = parseInt(meeting.id) || 0;
        if (id > maxId) {
            maxId = id;
        }
    });
    
    const newId = String(maxId + 1).padStart(6, '0');
    if (metadata) {
        metadata.nextMeetingId = maxId + 2;
    }
    return newId;
}

function formatContactFileName(contactId) {
    return FILE_STRUCTURE.CONTACT_FILE_PATTERN.replace('{id}', String(contactId).padStart(6, '0'));
}

function formatMeetingFileName(contactId) {
    return FILE_STRUCTURE.MEETING_FILE_PATTERN.replace('{id}', String(contactId).padStart(6, '0'));
}

// エラーログ記録
function logError(error, context = '') {
    const errorEntry = {
        timestamp: new Date().toISOString(),
        error: error.toString(),
        context: context,
        stack: error.stack || ''
    };
    
    errorLog.push(errorEntry);
    
    // ログサイズを制限
    if (errorLog.length > maxErrorLogSize) {
        errorLog = errorLog.slice(-maxErrorLogSize);
    }
    
    console.error(`[${context}]`, error);
}

// パフォーマンス記録
function updatePerformanceMetrics() {
    performanceMetrics.contactCount = contacts.length;
    performanceMetrics.meetingCount = meetings.length;
    
    if (performance && performance.memory) {
        performanceMetrics.memoryUsage = performance.memory.usedJSHeapSize;
    }
}

// システム状態の取得
function getSystemStatus() {
    return {
        isAuthenticated: !!(gapi && gapi.client && gapi.client.getToken()),
        folderSelected: !!currentFolderId,
        folderStructureInitialized: !!(folderStructure.root && folderStructure.contacts && folderStructure.meetings),
        dataLoaded: contacts.length > 0 || meetings.length > 0,
        indexesBuilt: Object.keys(contactsIndex).length > 0,
        lastSave: performanceMetrics.lastSaveTime,
        version: metadata.version,
        totalContacts: metadata.totalContacts,
        totalMeetings: metadata.totalMeetings
    };
}

// デバッグ情報の取得
function getDebugInfo() {
    return {
        metadata: metadata,
        folderStructure: folderStructure,
        performanceMetrics: performanceMetrics,
        systemConfig: systemConfig,
        indexSizes: {
            contacts: Object.keys(contactsIndex).length,
            meetings: Object.keys(meetingsIndex).length,
            search: Object.keys(searchIndex).length
        },
        errorLog: errorLog.slice(-10), // 最新の10件
        cacheInfo: {
            fileCache: fileCache.size,
            imageCacheSize: imageCacheSize
        }
    };
}

// 設定の保存（ローカルストレージ）
function saveSystemConfig() {
    try {
        localStorage.setItem('1to1meeting_config', JSON.stringify(systemConfig));
        localStorage.setItem('1to1meeting_folder_id', currentFolderId || '');
    } catch (error) {
        console.warn('設定の保存に失敗しました:', error);
    }
}

// 設定の読み込み（ローカルストレージ）
function loadSystemConfig() {
    try {
        const savedConfig = localStorage.getItem('1to1meeting_config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            systemConfig = { ...systemConfig, ...parsed };
        }
        
        const savedFolderId = localStorage.getItem('1to1meeting_folder_id');
        if (savedFolderId) {
            currentFolderId = savedFolderId;
        }
    } catch (error) {
        console.warn('設定の読み込みに失敗しました:', error);
    }
}

// 初期化時に設定を読み込む
loadSystemConfig();
// --- 自動同期: APP_CONFIG が未設定なら DRIVE_CONFIG から補完 ---
(function(){
  try{
    if (window.DRIVE_CONFIG && window.DRIVE_CONFIG.CLIENT_ID) {
      if (!window.APP_CONFIG) window.APP_CONFIG = {};
      if (!window.APP_CONFIG.GOOGLE_CLIENT_ID || window.APP_CONFIG.GOOGLE_CLIENT_ID.includes('<<PUT_YOUR_GIS_CLIENT_ID_HERE>>')) {
        window.APP_CONFIG.GOOGLE_CLIENT_ID = window.DRIVE_CONFIG.CLIENT_ID;
      }
      if (!window.APP_CONFIG.GOOGLE_SCOPES) {
        window.APP_CONFIG.GOOGLE_SCOPES = (window.DRIVE_CONFIG.SCOPES || 'https://www.googleapis.com/auth/drive.file') + ' https://www.googleapis.com/auth/drive.appdata';
      } else if (!window.APP_CONFIG.GOOGLE_SCOPES.includes('drive.appdata')) {
        window.APP_CONFIG.GOOGLE_SCOPES += ' https://www.googleapis.com/auth/drive.appdata';
      }
    }
  }catch(e){}
})(); // SYNC_APP_CONFIG_FROM_DRIVE_CONFIG
