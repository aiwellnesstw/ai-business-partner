/**
 * 共用名單收集後台：AI 賦能健檢 + 中租保險諮詢 + 企業貸款健檢
 * 三個表單共用同一個 Google 表單檔案（不同工作表分頁）+ 同一支 Telegram Bot。
 *
 * 部署方式（已部署過的話，改完程式碼要重新走一次「新版本」步驟才會生效）：
 * 1. 開啟這個 Google Sheet → 擴充功能 → Apps Script
 * 2. 把這個檔案內容整個貼進去，取代舊的，儲存
 * 3. 右上角「部署」→「管理部署作業」→ 點編輯（鉛筆圖示）
 *    → 版本選「新版本」→ 部署（網址不會變，三個表單都不用改）
 * 4. 第一次部署才需要：「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *    - 執行身分：我 (justinxq110982@gmail.com)
 *    - 存取權限：任何人
 *    部署後複製「網頁應用程式」網址，貼到三個表單頁面的 SHEET_WEBHOOK 常數
 */

const TG_TOKEN = '8813957664:AAHwFJ1Osaw1coRwgAYqA6wEGtLFQ-Wc4mQ'; // 沿用 tender-watcher Bot
const TG_CHAT_ID = '-1004349277813';

const SHEET_NAMES = {
  ai_health_check: 'AI健檢',
  insurance: '保險',
  loan: '貸款',
};
const SHEET_HEADERS = {
  ai_health_check: ['時間', '姓名', '手機', '公司統編', '公司規模', 'AI現況', '核心痛點', '資金需求'],
  insurance: ['時間', '聯絡人姓名', '聯絡電話', '公司統編', '想了解的保險', '轉介員工編號'],
  loan: ['時間', '聯絡人姓名', '聯絡電話', '公司統編', '進貨付款習慣', '收款帳期', '擴充計畫', '資金需求'],
};

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const source = data.source || 'ai_health_check'; // 舊版 AI 健檢表單沒有帶 source 欄位，預設當作 AI健檢

  const sheet = getOrCreateSheet(source);
  appendRow(sheet, source, data);

  const msg = buildTelegramMessage(source, data);
  UrlFetchApp.fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: TG_CHAT_ID, text: msg }),
  });

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(source) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = SHEET_NAMES[source] || SHEET_NAMES.ai_health_check;
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(SHEET_HEADERS[source] || SHEET_HEADERS.ai_health_check);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS[source] || SHEET_HEADERS.ai_health_check);
  }
  return sheet;
}

function appendRow(sheet, source, data) {
  if (source === 'insurance') {
    sheet.appendRow([
      new Date(),
      data.contactName || '',
      data.contactPhone || '',
      data.taxId || '',
      data.types || '',
      data.employeeId || '',
    ]);
  } else if (source === 'loan') {
    sheet.appendRow([
      new Date(),
      data.contactName || '',
      data.contactPhone || '',
      data.taxId || '',
      labelPaymentTerm(data.paymentTerm),
      labelReceivableDays(data.receivableDays),
      labelExpansionPlan(data.expansionPlan),
      labelFunding(data.funding),
    ]);
  } else {
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
  }
}

function buildTelegramMessage(source, data) {
  if (source === 'insurance') {
    return [
      '🛡️ 中租保險諮詢名單',
      `聯絡人：${data.contactName || ''}`,
      `電話：${data.contactPhone || ''}`,
      `公司統編：${data.taxId || ''}`,
      `想了解：${data.types || ''}`,
    ].join('\n');
  }
  if (source === 'loan') {
    const urgent = data.funding === 'clear';
    const tag = urgent ? '🔥 企業貸款高機會名單（有明確資金需求）' : '💰 企業貸款健檢名單';
    return [
      tag,
      `聯絡人：${data.contactName || ''}`,
      `電話：${data.contactPhone || ''}`,
      `公司統編：${data.taxId || ''}`,
      `進貨付款習慣：${labelPaymentTerm(data.paymentTerm)}`,
      `收款帳期：${labelReceivableDays(data.receivableDays)}`,
      `擴充計畫：${labelExpansionPlan(data.expansionPlan)}`,
      `資金需求：${labelFunding(data.funding)}`,
    ].join('\n');
  }
  const urgent = data.funding === 'clear';
  const tag = urgent ? '🔥 高機會名單（有明確資金需求）' : '🔔 新名單進來了';
  return [
    tag,
    `姓名：${data.name || ''}`,
    `手機：${data.phone || ''}`,
    `公司統編：${data.taxId || ''}`,
    `公司規模：${labelSize(data.size)}`,
    `AI 現況：${labelStage(data.stage)}`,
    `核心痛點：${labelPain(data.pain)}`,
    `資金需求：${labelFunding(data.funding)}`,
  ].join('\n');
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
function labelPaymentTerm(v) {
  return { cash_discount: '一定選現金拿折扣', depends: '看資金狀況決定', term_default: '一律月結，沒特別算過' }[v] || v || '';
}
function labelReceivableDays(v) {
  return { fast: '即時或30天內', medium: '30-60天', slow: '60天以上' }[v] || v || '';
}
function labelExpansionPlan(v) {
  return { planned: '有明確計畫', evaluating: '評估中', none: '沒有' }[v] || v || '';
}
