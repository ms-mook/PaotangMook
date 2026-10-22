/**
 * เป๋าตังค์ — Apps Script backend
 *
 * วิธีติดตั้ง:
 * 1. สร้าง Google Sheet ใหม่ → เมนู ส่วนขยาย (Extensions) → Apps Script
 * 2. ลบโค้ดเดิม แล้ววางไฟล์นี้ทั้งหมด
 * 3. แก้ค่า SECRET ด้านล่างเป็นข้อความสุ่มยาว ๆ (ค่าเดียวกับ APPS_SCRIPT_SECRET ใน Vercel)
 * 4. ทำให้ใช้งานได้ (Deploy) → การทำให้ใช้งานได้รายการใหม่ → ประเภท: เว็บแอป
 *      - ดำเนินการในฐานะ: ฉัน (Me)
 *      - ผู้มีสิทธิ์เข้าถึง: ทุกคน (Anyone)
 * 5. กดอนุญาตสิทธิ์ (ถ้าขึ้น "unverified" ให้กด Advanced → Go to ... (unsafe) → Allow)
 * 6. คัดลอก URL ของเว็บแอป (ลงท้ายด้วย /exec) ไปใส่ APPS_SCRIPT_URL ใน Vercel
 *
 * ถ้าแก้โค้ดนี้ภายหลัง: Deploy → Manage deployments → แก้ไข (✏️) → Version: New version → Deploy
 * (URL เดิมยังใช้ได้)
 */

const SECRET = 'CHANGE-ME-to-a-long-random-string';

const TAB = 'รายการ';
const FOLDER_NAME = 'เป๋าตังค์ - สลิป';
const HEADERS = ['id', 'createdAt', 'date', 'type', 'amount', 'category', 'note', 'bank', 'transRef', 'slipFileId'];

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ error: 'bad request' });
  }
  if (!req || req.secret !== SECRET || SECRET.indexOf('CHANGE-ME') === 0) {
    return json_({ error: 'unauthorized' });
  }
  try {
    switch (req.action) {
      case 'ping':
        return json_({ ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getUrl(), folder: folder_().getUrl() });
      case 'list':
        return json_({ items: list_() });
      case 'add':
        return json_(add_(req.tx, req.slip));
      case 'delete':
        return json_(delete_(req.id));
      case 'slip':
        return json_(slip_(req.id));
      default:
        return json_({ error: 'unknown action' });
    }
  } catch (err) {
    return json_({ error: String(err && err.message ? err.message : err) });
  }
}

// เปิด URL ด้วยเบราว์เซอร์เพื่อเช็คว่าสคริปต์ทำงาน
function doGet() {
  return json_({ ok: true, app: 'เป๋าตังค์' });
}

// ---------- helpers ----------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB, 0);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try {
      const f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (err) {}
  }
  const f = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

function rowToTx_(r) {
  return {
    id: String(r[0]),
    createdAt: String(r[1]),
    date: String(r[2]),
    type: r[3] === 'income' ? 'income' : 'expense',
    amount: Number(String(r[4]).replace(/,/g, '')) || 0,
    category: String(r[5]),
    note: String(r[6]),
    bank: String(r[7]),
    transRef: String(r[8]),
    slipFileId: String(r[9]),
  };
}

function rows_() {
  const sh = sheet_();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  // display values keep dates as the text we wrote
  return sh.getRange(2, 1, n, HEADERS.length).getDisplayValues();
}

// ---------- actions ----------

function list_() {
  return rows_().filter(function (r) { return r[0]; }).map(rowToTx_);
}

function add_(tx, slip) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (tx.transRef) {
      const dup = rows_().filter(function (r) { return r[8] === tx.transRef; })[0];
      if (dup) {
        const d = rowToTx_(dup);
        return { error: 'สลิปนี้บันทึกไปแล้ว (' + d.date + ', ' + d.amount + ' บาท)', duplicate: true };
      }
    }

    let slipFileId = '';
    if (slip && slip.data) {
      const blob = Utilities.newBlob(Utilities.base64Decode(slip.data), slip.mime || 'image/jpeg', slip.name || 'slip.jpg');
      slipFileId = folder_().createFile(blob).getId();
    }

    const sh = sheet_();
    const row = sh.getLastRow() + 1;
    // text columns stay text (no auto date conversion); amount stays a number for SUM()
    sh.getRange(row, 1, 1, 4).setNumberFormat('@');
    sh.getRange(row, 6, 1, 5).setNumberFormat('@');
    sh.getRange(row, 5).setNumberFormat('#,##0.00');
    const values = [[
      tx.id, tx.createdAt, tx.date, tx.type, Number(tx.amount),
      tx.category || '', tx.note || '', tx.bank || '', tx.transRef || '', slipFileId,
    ]];
    sh.getRange(row, 1, 1, HEADERS.length).setValues(values);

    tx.slipFileId = slipFileId;
    return { item: tx };
  } finally {
    lock.releaseLock();
  }
}

function delete_(id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const rows = rows_();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === id) {
        const fileId = rows[i][9];
        sheet_().deleteRow(i + 2);
        if (fileId) {
          try { DriveApp.getFileById(fileId).setTrashed(true); } catch (err) {}
        }
        return { ok: true };
      }
    }
    return { error: 'ไม่พบรายการ' };
  } finally {
    lock.releaseLock();
  }
}

function slip_(fileId) {
  const file = DriveApp.getFileById(fileId);
  // only serve files that live in our slip folder
  const parents = file.getParents();
  const folderId = folder_().getId();
  let ok = false;
  while (parents.hasNext()) if (parents.next().getId() === folderId) ok = true;
  if (!ok) return { error: 'not found' };
  const blob = file.getBlob();
  return { mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}
