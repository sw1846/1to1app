// ===== グローバル設定と定数 =====

// Google API設定
let CLIENT_ID = localStorage.getItem('google_client_id') || '';
// セキュリティ改善: drive.fileスコープのみに限定（アプリが作成したファイルのみアクセス可能）
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const APP_FOLDER_NAME = '1to1MeetingManager';
const ATTACHMENTS_FOLDER_NAME = 'attachments';

// グローバル変数
let tokenClient = null;
let gapiInited = false;
let gisInited = false;
let accessToken = null;

// セキュリティ改善: トークン有効期限管理
let tokenExpiresAt = null;

// データ管理
let contacts = [];
let meetings = [];
let dropdownOptions = {
    types: [],
    affiliations: [],
    goldenEgg: [],
    wantToConnect: [],
    referredBy: []
};

// UI状態管理
let currentEditingContactId = null;
let currentEditingMeetingId = null;
let selectedFiles = [];
let selectedMeetingFiles = [];
let currentPhotoFile = null;
let currentCardImageFile = null;
let deletedAttachments = [];
let deletedMeetingAttachments = [];
let currentSortOrder = 'meeting-desc';
let viewMode = localStorage.getItem('viewMode') || 'card';
let filterVisible = localStorage.getItem('filterVisible') === 'true';
let appFolderId = null;
let attachmentsFolderId = null;

// ドラフト管理
let draftSaveTimer = null;
let hasUnsavedDraft = false;

// 初回ミーティング管理
let selectedFirstMeetingFiles = [];
let hasFirstMeeting = {};

// ユーザー設定
let userSettings = {
    viewMode: 'card',
    filterVisible: false,
    meetingTemplate: ''
};

// セットアップ完了フラグ
let isSetupCompleted = false;

// セットアップウィザード
let currentStep = 1;

// SearchableSelectインスタンス保持用
window.searchableSelects = {};