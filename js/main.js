/* =========================================================
 * main.js（初期化＋進捗ログ＋メモリ監視）
 * 既存の main.js がある場合は、重複しないよう該当関数を統合してください。
 * ========================================================= */
(function(global){
  'use strict';
  if(global.__APP_MAIN_INITED__) return; // 二重初期化ガード
  global.__APP_MAIN_INITED__ = true;

  const MB = 1024*1024;

  function formatMem(){
    const perf = performance && performance.memory ? performance.memory : null;
    if(!perf) return null;
    return {
      usedMB: (perf.usedJSHeapSize/MB).toFixed(0),
      totalMB: (perf.totalJSHeapSize/MB).toFixed(0),
      limitMB: (perf.jsHeapSizeLimit/MB).toFixed(0)
    };
  }

  function monitorPerformance(){
    const m = formatMem();
    if(m){
      const used = Number(m.usedMB);
      if(used >= 450){
        console.warn(`メモリ使用量が多いです: ${m.usedMB}MB`);
      } else {
        console.log(`メモリ使用量: ${m.usedMB}MB`);
      }
    }
  }

  function attachProgressLogs(){
    if(!global.AppData || !AppData.setProgressHandler){
      console.warn('AppData が未ロードです。progressログを設定できません。');
      return;
    }
    AppData.setProgressHandler((phase, payload)=>{
      switch(phase){
        case 'contacts:list': console.log('連絡先リスト取得開始'); break;
        case 'contacts:download:start': console.log(`連絡先ダウンロード開始: total=${payload.total}`); break;
        case 'contacts:download:progress': console.log(`連絡先進捗: ${payload.done}/${payload.total}`); break;
        case 'contacts:download:done': console.log(`連絡先ダウンロード完了: total=${payload.total}`); break;
        case 'meetings:list': console.log('ミーティングリスト取得開始（再帰）'); break;
        case 'meetings:download:start': console.log(`ミーティングダウンロード開始: total=${payload.total}`); break;
        case 'meetings:download:progress': console.log(`ミーティング進捗: ${payload.done}/${payload.total}`); break;
        case 'meetings:download:done': console.log(`ミーティングダウンロード完了: total=${payload.total}`); break;
        case 'rebuild:start': console.log('インデックス再構築開始'); break;
        case 'rebuild:done': console.log(`インデックス再構築完了: contacts=${payload.contacts} meetings=${payload.meetings}`); break;
        case 'contacts:error': console.error('連絡先エラー:', payload.message); break;
        case 'meetings:error': console.error('ミーティングエラー:', payload.message); break;
      }
    });
  }

  async function boot(){
    console.log('DOM読み込み完了 - 分散ファイル構造システム初期化開始...');

    await AppData.initializeGoogleAPI();
    await AppData.initializeGIS();

    attachProgressLogs();

    console.log('イベントリスナー初期化開始...');
    // 既存UIのイベント設定をここに（必要なら）統合してください
    console.log('イベントリスナー初期化完了');

    console.log('分散ファイル構造システム初期化完了');
    console.log('システム状態:', AppData.STATE);

    console.log('ページ読み込み完了 - 追加初期化開始');
    // 認証・フォルダ選択後に以下を呼び出してください：
    // await AppData.selectExistingFolder({ root:'<ROOT>', index:'<INDEX>', contacts:'<CONTACTS>', meetings:'<MEETINGS>', attachments:'<ATTACH>' });
    // await AppData.loadAllData();

    setInterval(monitorPerformance, 3000);
    console.log('分散ファイル構造システム完全初期化完了');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window);
