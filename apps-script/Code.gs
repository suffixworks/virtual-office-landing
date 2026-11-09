/**
 * Google Apps Script for the waitlist Sheet.
 * Bind it to the Sheet: Extensions > Apps Script, paste this file, run setup() once,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 *
 * Script Properties (Project Settings > Script Properties):
 *   SHARED_SECRET      same value as APPS_SCRIPT_SECRET on Vercel (required)
 */

var LEADS_SHEET = 'Leads';
var SUMMARY_SHEET = 'Summary';

// Column order in the Leads sheet. Keep in sync with api/lead.js toSheetRow().
var FIELDS = [
  'name', 'phone', 'email', 'company_status', 'package', 'start_timeline', 'addons', 'pdpa_consent',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'referrer', 'landing_page'
];
var HEADERS = ['timestamp'].concat(FIELDS);

var PACKAGE_LABELS = ['Address', 'VAT-ready', 'VAT-ready + AI'];
var WITHIN_ONE_MONTH = 'ภายใน 1 เดือน';

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'bad_json' });
  }

  var secret = props.getProperty('SHARED_SECRET');
  if (!secret || body.secret !== secret) return out({ ok: false, error: 'unauthorized' });

  var lead = body.lead || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = ensureLeadsSheet();
    var row = [new Date()].concat(FIELDS.map(function (f) {
      var v = safe(lead[f]);
      // Force phone to text so the leading 0 is kept.
      return f === 'phone' && v && v.charAt(0) !== "'" ? "'" + v : v;
    }));
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return out({ ok: true });
}

function doGet() {
  return out({ ok: true, service: 'waitlist' });
}

/** Run once from the editor to create the Leads and Summary sheets. */
function setup() {
  ensureLeadsSheet();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sum = ss.getSheetByName(SUMMARY_SHEET) || ss.insertSheet(SUMMARY_SHEET);
  sum.clear();
  sum.getRange(1, 1, 1, 4).setValues([['แพ็กเกจ', 'ลีดทั้งหมด', 'เริ่มใช้ภายใน 1 เดือน', 'สัดส่วนภายใน 1 เดือน']]).setFontWeight('bold');
  var pkgCol = 'Leads!' + colLetter(HEADERS.indexOf('package') + 1) + ':' + colLetter(HEADERS.indexOf('package') + 1);
  var tlCol = 'Leads!' + colLetter(HEADERS.indexOf('start_timeline') + 1) + ':' + colLetter(HEADERS.indexOf('start_timeline') + 1);
  PACKAGE_LABELS.forEach(function (p, i) {
    var r = i + 2;
    sum.getRange(r, 1).setValue(p);
    sum.getRange(r, 2).setFormula('=COUNTIF(' + pkgCol + ',A' + r + ')');
    sum.getRange(r, 3).setFormula('=COUNTIFS(' + pkgCol + ',A' + r + ',' + tlCol + ',"' + WITHIN_ONE_MONTH + '")');
    sum.getRange(r, 4).setFormula('=IF(B' + r + '=0,0,C' + r + '/B' + r + ')');
  });
  var total = PACKAGE_LABELS.length + 2;
  sum.getRange(total, 1).setValue('รวม').setFontWeight('bold');
  sum.getRange(total, 2).setFormula('=SUM(B2:B' + (total - 1) + ')');
  sum.getRange(total, 3).setFormula('=SUM(C2:C' + (total - 1) + ')');
  sum.getRange(total, 4).setFormula('=IF(B' + total + '=0,0,C' + total + '/B' + total + ')');
  sum.getRange(2, 4, PACKAGE_LABELS.length + 1, 1).setNumberFormat('0%');
  sum.autoResizeColumns(1, 4);
}

function ensureLeadsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LEADS_SHEET);
  if (!sheet) sheet = ss.insertSheet(LEADS_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Plain text only, and block formula injection (=, +, -, @ at the start).
function safe(v) {
  var s = v === undefined || v === null ? '' : String(v).slice(0, 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function colLetter(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
