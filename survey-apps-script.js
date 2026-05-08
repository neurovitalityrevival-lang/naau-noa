// ============================================
// Na'au Noa セッション前アンケート
// Google Apps Script — スプレッドシート書き込み
// ============================================
//
// 【設定手順】
// 1. Google スプレッドシートを新規作成
// 2. スプレッドシートのURLから ID をコピー
//    例: https://docs.google.com/spreadsheets/d/【ここがID】/edit
// 3. 下の SPREADSHEET_ID に貼り付ける
// 4. Apps Script エディタで「デプロイ」→「新しいデプロイ」
//    - 種類: ウェブアプリ
//    - 次のユーザーとして実行: 自分
//    - アクセスできるユーザー: 全員
// 5. 発行された URL を survey.html の APPS_SCRIPT_URL に貼り付ける
// ============================================

const SPREADSHEET_ID = 'ここにスプレッドシートのIDを入れる';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getActiveSheet();

    // 1行目にヘッダーがなければ追加
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['受信日時', 'お名前', 'Q1：今の悩み', 'Q2：悩んでいる期間', 'Q3：理想の未来']);
      sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#1a3a3a').setFontColor('#b8976a');
    }

    // データを追記
    sheet.appendRow([
      data.timestamp || new Date().toLocaleString('ja-JP'),
      data.name || '未記入',
      data.q1   || '',
      data.q2   || '',
      data.q3   || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
