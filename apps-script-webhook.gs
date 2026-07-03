/**
 * AI 賦能健檢問卷 → Google Sheet 記錄 + Telegram 通知
 * 部署方式見 README（或 Justin Agent 對話紀錄）：
 * 1. 開一個新的 Google Sheet
 * 2. 上方選單「擴充功能」→「Apps Script」
 * 3. 把這個檔案內容整個貼進去，儲存
 * 4. 右上角「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *    - 執行身分：我 (justinxq110982@gmail.com)
 *    - 存取權限：任何人
 * 5. 部署後複製「網頁應用程式」網址，貼到 index.html 的 SHEET_WEBHOOK 常數
 */

const TG_TOKEN = '8813957664:AAHwFJ1Osaw1coRwgAYqA6wEGtLFQ-Wc4mQ'; // 沿用 tender-watcher Bot
const TG_CHAT_ID = '-1004349277813';

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // 第一次執行時如果是空白表，先補標題列
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['時間', '姓名', '手機', '公司統編', '公司規模', 'AI現況', '核心痛點', '資金需求']);
  }

  sheet.appendRow([
    new Date(),
    data.name || '',
    data.phone || '',
    data.taxId || '',
    labelSize(data.size),
    labelStage(data.stage),
    labelPain(data.pain),
    labelFunding(data.funding),
  ]);

  const urgent = data.funding === 'clear';
  const tag = urgent ? '🔥 高機會名單（有明確資金需求）' : '🔔 新名單進來了';

  const msg = [
    tag,
    `姓名：${data.name || ''}`,
    `手機：${data.phone || ''}`,
    `公司統編：${data.taxId || ''}`,
    `公司規模：${labelSize(data.size)}`,
    `AI 現況：${labelStage(data.stage)}`,
    `核心痛點：${labelPain(data.pain)}`,
    `資金需求：${labelFunding(data.funding)}`,
  ].join('\n');

  UrlFetchApp.fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg }),
  });

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function labelSize(v) {
  return { micro: '1–9人', small: '10–49人', medium: '50–99人', large: '100人以上' }[v] || v || '';
}
function labelStage(v) {
  return { none: '完全沒接觸過', low: '有訂閱但使用率低', scattered: '各部門各做各的', systematic: '已有初步流程' }[v] || v || '';
}
function labelPain(v) {
  return { direction: '不知道從哪開始', tools: '工具太多不知道選哪個', adoption: '買了沒人推動', knowledge: '老闆經驗傳承問題' }[v] || v || '';
}
function labelFunding(v) {
  return { clear: '有明確需求，金額抓得出來', maybe: '未來半年內可能會需要', none: '目前沒有' }[v] || v || '';
}
