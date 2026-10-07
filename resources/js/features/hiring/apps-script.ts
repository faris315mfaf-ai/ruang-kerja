/**
 * Google Apps Script that pushes Google Form responses to RuangKerja
 * (POST /api/hiring/form/{token}, HMAC-SHA256 signature). The same script
 * is printed in docs/fitur/hiring.md; keep both in sync.
 */
export const APPS_SCRIPT_TEMPLATE = `/**
 * RuangKerja · Hiring — kirim jawaban Google Form ke RuangKerja.
 * 1. Buka Google Form > titik tiga > Apps Script, hapus isi Code.gs, tempel skrip ini.
 * 2. Isi RK_URL dan RK_SECRET dari Pengaturan lowongan di RuangKerja.
 * 3. Simpan, pilih fungsi pasangPemicu, klik Jalankan, lalu izinkan akses.
 * Setiap jawaban baru otomatis masuk ke tahap "Masuk". Kiriman ulang aman (tidak dobel).
 */
const RK_URL = '__RK_URL__';
const RK_SECRET = '__RK_SECRET__';

/** Jalankan sekali: memasang pemicu "saat formulir dikirim". */
function pasangPemicu() {
  const form = FormApp.getActiveForm();
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) { return trigger.getHandlerFunction() === 'kirimKeRuangKerja'; })
    .forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('kirimKeRuangKerja').forForm(form).onFormSubmit().create();
}

/** Dipanggil pemicu setiap ada jawaban baru. */
function kirimKeRuangKerja(e) {
  kirim_(e.response);
}

/** Opsional: kirim semua jawaban yang sudah ada (aman diulang). */
function kirimUlangSemua() {
  FormApp.getActiveForm().getResponses().forEach(function (response) { kirim_(response); });
}

function kirim_(response) {
  const answers = [];
  const files = [];
  const email = response.getRespondentEmail();

  if (email) {
    answers.push({ question: 'Email', answer: email });
  }

  response.getItemResponses().forEach(function (itemResponse) {
    const item = itemResponse.getItem();
    const title = item.getTitle();
    const value = itemResponse.getResponse();

    if (item.getType() === FormApp.ItemType.FILE_UPLOAD) {
      (value || []).forEach(function (fileId) {
        files.push({ label: title, url: 'https://drive.google.com/open?id=' + fileId });
      });
      return;
    }

    let answer = value;
    if (Array.isArray(value)) {
      answer = value.map(function (part) { return Array.isArray(part) ? part.join(' / ') : part; }).join(', ');
    }
    answers.push({ question: title, answer: answer === null || answer === undefined ? '' : String(answer) });
  });

  // ASCII-only JSON: the signature is computed over exactly these bytes.
  const body = JSON.stringify({
    response_id: response.getId(),
    submitted_at: response.getTimestamp().toISOString(),
    answers: answers,
    files: files,
  }).replace(/[\\u007f-\\uffff]/g, function (c) {
    return '\\\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });

  const signature = Utilities.computeHmacSha256Signature(body, RK_SECRET, Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + (byte & 0xff).toString(16)).slice(-2); })
    .join('');

  const result = UrlFetchApp.fetch(RK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: body,
    headers: { 'X-RuangKerja-Signature': signature },
    muteHttpExceptions: true,
  });

  const code = result.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('RuangKerja menolak kiriman (' + code + '): ' + result.getContentText());
  }
}
`;

/** The script with the position's URL and (when just revealed) secret filled in. */
export function appsScript(url: string, secret: string | null): string {
    return APPS_SCRIPT_TEMPLATE.replace('__RK_URL__', url).replace(
        '__RK_SECRET__',
        secret ?? 'TEMPEL_SECRET_DI_SINI',
    );
}
