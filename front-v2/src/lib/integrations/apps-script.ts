/**
 * Google Apps Script the merchant pastes into their sheet (Extensions → Apps Script) and deploys
 * as a web app. Each order event upserts one row by order number, so status changes update it.
 * Runs entirely in the merchant's Google account: no API key on our side.
 */
export const APPS_SCRIPT_CODE = `// طلبات متجرك وصفحات الهبوط ← Google Sheets
// كل طلب جديد بيتضاف كسطر، وتغيير الحالة بيحدّث نفس السطر.
var SHEET_NAME = 'الطلبات';
var HEADERS = ['رقم الطلب', 'التاريخ', 'الحالة', 'الاسم', 'الموبايل', 'موبايل تاني', 'المحافظة', 'المدينة', 'العنوان', 'المنتجات', 'الكمية', 'الخصم', 'الشحن', 'الإجمالي', 'ملاحظات', 'الصفحة', 'المصدر', 'من'];

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var order = body.data && body.data.order;
  if (!order) return reply({ ok: true, skipped: true });

  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }

  var c = order.customer || {};
  var items = (order.items || []).map(function (i) {
    var opts = (i.options || []).map(function (o) { return o.value; }).join('، ');
    return i.quantity + ' × ' + i.product + (opts ? ' (' + opts + ')' : '');
  }).join('\\n');
  var row = [
    order.number,
    order.created_at ? new Date(order.created_at) : new Date(),
    order.status_label,
    c.name,
    "'" + (c.phone || ''),
    c.phone2 ? "'" + c.phone2 : '',
    c.governorate || '',
    c.city || '',
    c.address || '',
    items,
    order.quantity,
    order.discount,
    order.shipping,
    order.total,
    c.notes || '',
    order.page ? order.page.title : '',
    (order.utm && order.utm.source) || '',
    order.source === 'store' ? 'المتجر' : 'صفحة هبوط',
  ];

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var last = sheet.getLastRow();
    var numbers = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues() : [];
    for (var r = 0; r < numbers.length; r++) {
      if (String(numbers[r][0]) === String(order.number)) {
        sheet.getRange(r + 2, 1, 1, row.length).setValues([row]);
        return reply({ ok: true, updated: true });
      }
    }
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

function reply(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
`;

/** Signature check a developer can copy (Node.js). */
export const SIGNATURE_SNIPPET = `const crypto = require("crypto");

function isValid(req, rawBody, secret) {
  const timestamp = req.headers["x-webhook-timestamp"];
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(timestamp + "." + rawBody).digest("hex");
  const given = req.headers["x-webhook-signature"] || "";
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}`;

export const SAMPLE_PAYLOAD = `{
  "id": "4b0d…",
  "event": "order.created",
  "sent_at": "2026-10-30T10:15:00Z",
  "store": "متجري",
  "data": {
    "order": {
      "number": 1024,
      "status": "new",
      "status_label": "جديد",
      "customer": { "name": "منى", "phone": "+201001234567", "governorate": "الجيزة", "address": "…" },
      "items": [{ "product": "ساعة ذكية", "quantity": 1, "unit_price": 850, "total": 850, "options": [] }],
      "shipping": 50,
      "total": 900,
      "page": { "title": "عرض الساعة", "slug": "watch" },
      "utm": { "source": "facebook" }
    }
  }
}`;
