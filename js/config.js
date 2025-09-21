// config.js - グローバル変数と設定

// グローバル変数
let directoryHandle = null;
let contacts = [];
let meetings = [];
let options = {
    types: ['顧客候補', '顧客', '取次店・販売店'],
    affiliations: [],
    industryInterests: [],
    statuses: ['新規', '接触中', '提案中', '商談中', '成約', '失注', '保留']
};

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