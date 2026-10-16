// Uji cepat kontrak push: muatan FCM → tujuan, saluran, dan kelengkapan rute tujuan ketukan.
// Jalankan: node scripts/cek-push.mjs   (Node ≥ 22.18, type-stripping bawaan; tanpa React Native)
// Paritas dengan enum server (saluran) dikunci terpisah oleh
// tests/Unit/Notifications/MobilePushParityTest.php (Pest).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { KANAL_BAWAAN, KANAL_CADANGAN, gabungKanal, kanalDariServer } from '../src/features/notifikasi/push/kanal.ts';
import { bacaDataPush, idInboxDariPush, targetDariPush } from '../src/features/notifikasi/push/data.ts';

const akar = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(akar, '..', '..');

// ── Saluran ──────────────────────────────────────────────────────────────────
assert.equal(KANAL_BAWAAN.length, 10, '9 saluran pengguna + rk_sinkron');
assert.equal(new Set(KANAL_BAWAAN.map((k) => k.id)).size, 10, 'id saluran unik');
assert.ok(KANAL_BAWAAN.some((k) => k.id === KANAL_CADANGAN), 'saluran cadangan ada');
assert.equal(KANAL_BAWAAN.find((k) => k.id === 'rk_keamanan')?.mutable, false);
assert.equal(gabungKanal(null).length, 10);
assert.equal(gabungKanal([{ id: 'rk_baru', name: 'Baru', importance: 'low', lockscreen: 'public', mutable: true }]).length, 11, 'saluran baru dari server ikut');
assert.equal(gabungKanal([{ id: 'lain', name: 'x', importance: 'low', lockscreen: 'public', mutable: true }]).length, 10, 'id non rk_ diabaikan');
assert.equal(kanalDariServer([{ id: 'rk_x', name: 'X', importance: 'ultra', lockscreen: 'public', mutable: true }]).length, 0, 'nilai tak dikenal disaring');
assert.equal(kanalDariServer([{ id: 'rk_x', name: 'X', importance: 'high', lockscreen: 'private', mutable: true }])[0]?.importance, 'high');

// ── Muatan push → tujuan ─────────────────────────────────────────────────────
const tugas = bacaDataPush({
  type: 'task.commented', target: 'tugas', id: '01TASK', anchor: 'komentar-01C', params: '{}',
  android_channel: 'rk_tugas', notification_id: 'uuid-1', group_key: 'rk_tugas',
});
assert.ok(tugas);
assert.deepEqual(targetDariPush(tugas), { type: 'tugas', id: '01TASK', anchor: 'komentar-01C', params: {} });
assert.equal(idInboxDariPush(tugas), 'uuid-1');
assert.equal(tugas.lokal, '');

const rapat = bacaDataPush({ type: 'meeting.starting', target: 'rapat', id: '01M', anchor: '', params: '{"tanggal":"2026-10-14"}', notification_id: 'u2' });
assert.deepEqual(targetDariPush(rapat), { type: 'rapat', id: '01M', anchor: null, params: { tanggal: '2026-10-14' } });

// Tanpa layar tujuan: target "inbox" → lembar detail; id = id notifikasi.
const inbox = bacaDataPush({ type: 'system.announcement', target: 'inbox', id: 'uuid-3', anchor: '', params: '{}', notification_id: 'uuid-3' });
assert.equal(targetDariPush(inbox), null);
assert.equal(idInboxDariPush(inbox), 'uuid-3');
const inboxTanpaNotif = bacaDataPush({ type: 'x', target: 'inbox', id: 'uuid-4' });
assert.equal(idInboxDariPush(inboxTanpaNotif), 'uuid-4');

// Target tanpa id (absensi, laporan): id kosong → null.
assert.equal(targetDariPush(bacaDataPush({ type: 'attendance.check_in_reminder', target: 'absensi', id: '', anchor: 'hari-ini' })).id, null);

// params rusak / bukan objek → {} (tidak melempar)
assert.deepEqual(targetDariPush(bacaDataPush({ type: 'a', target: 'rapat', id: '1', params: '{bukan json' })).params, {});
assert.deepEqual(targetDariPush(bacaDataPush({ type: 'a', target: 'rapat', id: '1', params: '[1,2]' })).params, {});

// Bukan push RuangKerja
assert.equal(bacaDataPush(null), null);
assert.equal(bacaDataPush({}), null);
assert.equal(bacaDataPush({ foo: 'bar' }), null);
assert.equal(bacaDataPush({ type: 'system.test', target: 'inbox', lokal: '1' })?.lokal, '1');

// ── Kelengkapan tujuan ketukan ───────────────────────────────────────────────
const sumberTarget = readFileSync(join(akar, 'src/features/inbox/target.ts'), 'utf8');
const kasusDikenal = new Set([...sumberTarget.matchAll(/case '([a-z-]+)':/g)].map((m) => m[1]));

// Jenis target yang bisa dikirim server (NotificationTarget::make('…')).
const sumberServer = readFileSync(join(repo, 'app/Domain/Notifications/Services/NotificationTarget.php'), 'utf8');
const jenisServer = new Set([...sumberServer.matchAll(/make\('([a-z]+)'/g)].map((m) => m[1]));
assert.ok(jenisServer.size >= 12, `jenis target server terbaca (${jenisServer.size})`);
for (const jenis of jenisServer) {
  assert.ok(kasusDikenal.has(jenis), `target "${jenis}" dikirim server tetapi tidak dikenal resolveTarget`);
}

// Rute app yang ada: dari berkas di app/ (grup "(x)" transparan, index = folder).
function berkasRute(dir) {
  const hasil = [];
  for (const nama of readdirSync(dir)) {
    const penuh = join(dir, nama);
    if (statSync(penuh).isDirectory()) {
      hasil.push(...berkasRute(penuh));
    } else if (/\.tsx?$/.test(nama) && !nama.startsWith('_')) {
      hasil.push(penuh);
    }
  }
  return hasil;
}
const pola = berkasRute(join(akar, 'app')).map((berkas) => {
  const bagian = relative(join(akar, 'app'), berkas).replace(/\.tsx?$/, '').split(sep).filter((b) => !/^\(.*\)$/.test(b));
  if (bagian.at(-1) === 'index') bagian.pop();
  return bagian;
});
const dinamis = (b) => /^\[.*\]$/.test(b);
function ruteAda(path) {
  const calon = path.split('?')[0].split('/').filter(Boolean);
  return pola.some((p) => p.length === calon.length && p.every((b, i) => dinamis(b) || dinamis(calon[i]) || b === calon[i]));
}
const ruteDipakai = [];
for (const baris of sumberTarget.split('\n')) {
  if (!/(rute\(|router\.push\(|bukaSegera)/.test(baris) || /tautan:/.test(baris)) continue;
  for (const m of baris.matchAll(/[`'](\/[a-z][^`']*)[`']/g)) {
    ruteDipakai.push(m[1].replace(/\$\{[^}]*\}/g, '[param]'));
  }
}
assert.ok(ruteDipakai.length >= 12, `rute tujuan terbaca (${ruteDipakai.length})`);
for (const rute of ruteDipakai) {
  assert.ok(ruteAda(rute), `rute tujuan "${rute}" tidak ada di app/`);
}

// Saluran punya tampilan di layar "Notifikasi di ponsel ini".
const sumberSaluran = readFileSync(join(akar, 'src/features/notifikasi/saluran.ts'), 'utf8');
for (const k of KANAL_BAWAAN.filter((x) => x.id !== 'rk_sinkron')) {
  assert.ok(sumberSaluran.includes(`${k.id}:`), `saluran ${k.id} belum punya ikon/deskripsi di saluran.ts`);
}

console.log(`push: semua pemeriksaan lolos (${jenisServer.size} jenis target server, ${ruteDipakai.length} rute tujuan)`);
