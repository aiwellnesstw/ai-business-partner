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
  rental: '租賃車',
};
const SHEET_HEADERS = {
  ai_health_check: ['時間', '姓名', '手機', '公司統編', '公司規模', 'AI現況', '核心痛點', '資金需求'],
  insurance: ['時間', '聯絡人姓名', '聯絡電話', '公司統編', '想了解的保險', '轉介員工編號'],
  loan: ['時間', '聯絡人姓名', '聯絡電話', '公司統編', '進貨付款習慣', '收款帳期', '擴充計畫', '資金需求'],
  rental: ['時間', '聯絡人姓名', '聯絡電話', '公司統編', '車輛取得方式', '保養感受', '汰換週期', '使用型態', '增購/汰換計畫'],
};

function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  if (data.event === 'step') {
    logProgress(data);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

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

// 多步驟 quiz 表單（貸款/租賃車）每進到新的一步就會 ping 這裡一次，
// 用來算漏斗流失率，不發 Telegram（每個訪客都會觸發，發了會洗版）。
const PROGRESS_SHEET_NAME = '填答進度';
const PROGRESS_HEADERS = ['時間', '表單', '步驟', '共幾步', '題目'];
const PROGRESS_FORM_LABELS = { loan: '企業貸款', rental: '長短期租賃車' };

function logProgress(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PROGRESS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PROGRESS_SHEET_NAME);
    sheet.appendRow(PROGRESS_HEADERS);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(PROGRESS_HEADERS);
  }
  sheet.appendRow([
    new Date(),
    PROGRESS_FORM_LABELS[data.source] || data.source || '',
    data.step || '',
    data.total || '',
    data.question || '',
  ]);
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
  } else if (source === 'rental') {
    sheet.appendRow([
      new Date(),
      data.contactName || '',
      data.contactPhone || '',
      data.taxId || '',
      labelAcquireMethod(data.acquireMethod),
      labelMaintenanceView(data.maintenanceView),
      labelReplaceCycle(data.replaceCycle),
      labelUsagePattern(data.usagePattern),
      labelRentalPlan(data.plan),
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
  if (source === 'rental') {
    const urgent = data.plan === 'clear';
    const tag = urgent ? '🔥 租賃車高機會名單（有明確計畫）' : '🚗 長短期租賃車健檢名單';
    return [
      tag,
      `聯絡人：${data.contactName || ''}`,
      `電話：${data.contactPhone || ''}`,
      `公司統編：${data.taxId || ''}`,
      `車輛取得方式：${labelAcquireMethod(data.acquireMethod)}`,
      `保養感受：${labelMaintenanceView(data.maintenanceView)}`,
      `汰換週期：${labelReplaceCycle(data.replaceCycle)}`,
      `使用型態：${labelUsagePattern(data.usagePattern)}`,
      `增購/汰換計畫：${labelRentalPlan(data.plan)}`,
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
function labelAcquireMethod(v) {
  return { cash_buy: '現金買斷', loan_buy: '貸款分期購入', rent_flexible: '用到多少台租多少台' }[v] || v || '';
}
function labelMaintenanceView(v) {
  return { troublesome: '蠻花心力，常常要喬保養／維修時間', manageable: '還好，已有固定配合保養廠', minimal: '車輛不多，沒特別感覺' }[v] || v || '';
}
function labelReplaceCycle(v) {
  return { short: '3年內', medium: '3-5年', long_none: '5年以上，或沒特別規劃' }[v] || v || '';
}
function labelUsagePattern(v) {
  return { long_term: '長期固定使用（業務車、公務車隊）', short_term: '短期專案需要（工程、展會、臨時調度）', both: '兩者都有' }[v] || v || '';
}
function labelRentalPlan(v) {
  return { clear: '有明確計畫', maybe: '半年內可能會', none: '目前沒有' }[v] || v || '';
}
