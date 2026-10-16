// Uji cepat logika tamu eksternal rapat video: identitas guest:*, validasi email/nama (cermin
// GuestNames server), status ruang tunggu, polling (jeda/backoff/henti), deteksi tamu baru, pesan galat,
// teks Bagikan, dan penjaga kebocoran tautan (token tidak boleh muncul di tampilan/pesan galat).
// Jalankan: node scripts/cek-rapat-tamu.mjs   (Node >= 22.18, type-stripping bawaan; tanpa React Native)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  JEDA_RUANG_TUNGGU_MAKS_MS,
  JEDA_RUANG_TUNGGU_MS,
  MAKS_TAMU,
  adalahIdentitasTamu,
  adalahPesertaTamu,
  bersihNamaTamu,
  bolehIzinkan,
  bolehPantau,
  bolehTolak,
  emailTamuValid,
  hentikanPantau,
  idTamuDariIdentitas,
  identitasDariIdTamu,
  jedaRuangTunggu,
  jumlahTamuDariPeserta,
  kemampuanTamu,
  labelStatusTamu,
  lamaMenunggu,
  metadataTamu,
  nadaStatusTamu,
  namaDepanTamu,
  namaTampilTamu,
  normalisasiEmailTamu,
  pastikanAkhiranTamu,
  pesanBagikanTautan,
  pesanGalatTamu,
  samarkanTautan,
  susunNamaTamuForm,
  tamuBaru,
  tanpaAkhiranTamu,
  tautanTamuSah,
  teksTamuBaru,
  validasiTamu,
} from '../src/features/rapat/tamu.ts';

const akar = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Identitas guest:* ────────────────────────────────────────────────────────
const ID = '01jbk3x9q8w2a4r6t7y8z9v0wz';
assert.equal(adalahIdentitasTamu(`guest:${ID}`), true);
assert.equal(adalahIdentitasTamu(`GUEST:${ID}`), true, 'awalan tidak peka huruf');
assert.equal(adalahIdentitasTamu('01JBK3X9Q8W2A4R6T7Y8U9V0WZ'), false, 'ULID karyawan bukan tamu');
assert.equal(adalahIdentitasTamu('rk-notulen'), false);
assert.equal(adalahIdentitasTamu(null), false);
assert.equal(adalahIdentitasTamu(undefined), false);
assert.equal(adalahIdentitasTamu(''), false);
assert.equal(idTamuDariIdentitas(`guest:${ID}`), ID);
assert.equal(idTamuDariIdentitas(`guest:${ID.toUpperCase()}`), ID, 'id dinormalkan huruf kecil');
assert.equal(idTamuDariIdentitas('guest:'), null, 'id kosong');
assert.equal(idTamuDariIdentitas('guest:../../etc'), null, 'id aneh tidak lolos');
assert.equal(idTamuDariIdentitas(ID), null, 'karyawan tidak pernah di-parse sebagai tamu');
assert.equal(identitasDariIdTamu(` ${ID.toUpperCase()} `), `guest:${ID}`);
assert.equal(metadataTamu('{"guest":true}'), true);
assert.equal(metadataTamu('{"guest":"true"}'), false);
assert.equal(metadataTamu('{bukan json'), false, 'metadata rusak tidak melempar');
assert.equal(metadataTamu(''), false);
assert.equal(metadataTamu(null), false);
assert.equal(metadataTamu('[1,2]'), false);
assert.equal(adalahPesertaTamu('01KARYAWAN', '{"guest":true}'), true, 'metadata.guest juga menandai tamu');
assert.equal(adalahPesertaTamu('01KARYAWAN', '{}'), false);

// Nama tampilan
assert.equal(tanpaAkhiranTamu('Budi Mitra (Tamu)'), 'Budi Mitra');
assert.equal(tanpaAkhiranTamu('Budi Mitra'), 'Budi Mitra');
assert.equal(pastikanAkhiranTamu('Budi Mitra'), 'Budi Mitra (Tamu)');
assert.equal(pastikanAkhiranTamu('Budi Mitra (Tamu)'), 'Budi Mitra (Tamu)', 'tidak digandakan');
assert.equal(pastikanAkhiranTamu(''), 'Tamu');
assert.equal(pastikanAkhiranTamu(null), 'Tamu');
assert.equal(namaDepanTamu('Budi Mitra (Tamu)'), 'Budi');

// ── Email & nama ─────────────────────────────────────────────────────────────
assert.equal(emailTamuValid('budi@mitra.test'), true);
assert.equal(emailTamuValid('  Budi@Mitra.Test '), true);
for (const salah of ['', 'budi', 'budi@', '@mitra.test', 'budi@mitra', 'bu di@mitra.test', `${'a'.repeat(200)}@mitra.test`]) {
  assert.equal(emailTamuValid(salah), false, `email salah: ${salah.slice(0, 20)}`);
}
assert.equal(normalisasiEmailTamu('  Budi@Mitra.TEST '), 'budi@mitra.test');

assert.equal(bersihNamaTamu('  Budi   Mitra '), 'Budi Mitra');
assert.equal(bersihNamaTamu('<b>Budi</b> <script>x</script>Mitra'), 'Budi xMitra', 'tag dibuang');
assert.equal(bersihNamaTamu('Direktur Utama (Tamu)'), 'Direktur Utama', 'penanda (Tamu) tidak bisa ditiru');
assert.equal(bersihNamaTamu('Dir (TAMU) ektur'), 'Dir ektur');
assert.equal(bersihNamaTamu('A'), null, 'minimal 2 karakter');
assert.equal(bersihNamaTamu('   '), null);
assert.equal(bersihNamaTamu('(Tamu)'), null);
assert.equal(bersihNamaTamu(null), null);
assert.equal(bersihNamaTamu(42), null);
assert.equal(bersihNamaTamu('Bu\u0000di​x\nMit ra'), 'Bu di​x Mit ra', 'karakter kontrol & pemisah baris jadi spasi');
assert.equal(Array.from(bersihNamaTamu('x'.repeat(100))).length, 60, 'dipotong 60');
assert.equal(Array.from(bersihNamaTamu('😀'.repeat(70))).length, 60, 'emoji dihitung per titik kode, tidak terpotong separuh');

const v1 = validasiTamu('Budi@Mitra.test', '  Budi Mitra ', 0);
assert.deepEqual(v1, { email: 'budi@mitra.test', nama: 'Budi Mitra', galatEmail: null, galatNama: null, valid: true });
assert.equal(validasiTamu('', '', 0).galatEmail, 'Isi alamat email tamu.');
assert.equal(validasiTamu('salah', '', 0).galatEmail, 'Alamat email tidak valid.');
assert.equal(validasiTamu('a@b.co', 'x', 0).galatNama, 'Nama minimal 2 karakter.');
assert.equal(validasiTamu('a@b.co', '', 0).valid, true, 'nama opsional');
assert.equal(validasiTamu('a@b.co', '', MAKS_TAMU - 1).valid, true);
assert.match(validasiTamu('a@b.co', '', MAKS_TAMU).galatEmail ?? '', /Maksimal 30 tamu/);

// guest_names formulir: hanya email yang masih ada dan bernama
assert.deepEqual(susunNamaTamuForm(['a@x.co', 'b@x.co'], { 'a@x.co': ' Ani  Putri ', 'b@x.co': 'x', 'c@x.co': 'Cici' }), { 'a@x.co': 'Ani Putri' });
assert.deepEqual(susunNamaTamuForm(['A@X.co'], { 'a@x.co': 'Ani' }), { 'a@x.co': 'Ani' }, 'email dinormalkan');
assert.deepEqual(susunNamaTamuForm([], { 'a@x.co': 'Ani' }), {});
assert.deepEqual(susunNamaTamuForm(['a@x.co'], {}), {}, 'tanpa nama tidak dikirim (server tidak menimpa)');

// ── Status ruang tunggu ──────────────────────────────────────────────────────
assert.equal(labelStatusTamu('waiting'), 'Menunggu');
assert.equal(labelStatusTamu('admitted'), 'Diizinkan');
assert.equal(labelStatusTamu('denied'), 'Ditolak');
assert.equal(labelStatusTamu('removed'), 'Dikeluarkan');
assert.equal(labelStatusTamu('none'), 'Belum masuk');
assert.equal(labelStatusTamu('baru_dari_server', 'Label Server'), 'Label Server', 'status baru: pakai label server');
assert.equal(labelStatusTamu('baru_dari_server'), 'Belum masuk');
assert.equal(nadaStatusTamu('waiting'), 'warning');
assert.equal(nadaStatusTamu('admitted'), 'success');
assert.equal(nadaStatusTamu('removed'), 'danger');
assert.equal(nadaStatusTamu('???'), 'neutral');
assert.deepEqual(['none', 'waiting', 'admitted', 'denied', 'removed'].map(bolehIzinkan), [false, true, false, true, true], 'izinkan: menunggu/ditolak/dikeluarkan (kontrak 4.3)');
assert.deepEqual(['none', 'waiting', 'admitted', 'denied', 'removed'].map(bolehTolak), [false, true, false, false, false], 'tolak: hanya menunggu');

// ── Kemampuan dari peran di rapat (detail API belum mengirim manage_guests/manage_lobby) ──
const rapat = (o) => ({ platform: 'video', canceled: false, penyelenggara: false, terundang: true, ...o });
assert.deepEqual(kemampuanTamu(rapat({ penyelenggara: true })), { kelola: true, ruangTunggu: true }, 'penyelenggara');
assert.deepEqual(kemampuanTamu(rapat({})), { kelola: false, ruangTunggu: true }, 'notulis/peserta internal: hanya ruang tunggu');
assert.deepEqual(kemampuanTamu(rapat({ terundang: false })), { kelola: false, ruangTunggu: false }, 'pengamat rapat pimpinan');
assert.deepEqual(kemampuanTamu(rapat({ penyelenggara: true, canceled: true })), { kelola: false, ruangTunggu: false }, 'dibatalkan');
assert.deepEqual(kemampuanTamu(rapat({ platform: 'meet', penyelenggara: true })), { kelola: false, ruangTunggu: false }, 'bukan video');
assert.equal(
  jumlahTamuDariPeserta([
    { user_id: '01A', email: null },
    { user_id: null, email: 'a@x.co' },
    { user_id: null, email: '' },
    { user_id: null, email: 'b@x.co' },
  ]),
  2,
);

// ── Polling ──────────────────────────────────────────────────────────────────
assert.equal(JEDA_RUANG_TUNGGU_MS, 4000);
assert.equal(jedaRuangTunggu(0), 4000);
assert.equal(jedaRuangTunggu(-3), 4000);
assert.equal(jedaRuangTunggu(Number.NaN), 4000);
assert.deepEqual([1, 2, 3, 4].map(jedaRuangTunggu), [8000, 16000, 30000, 30000], 'backoff berlipat dua, maks 30 dtk');
assert.equal(jedaRuangTunggu(100), JEDA_RUANG_TUNGGU_MAKS_MS);
assert.deepEqual([403, 404, 410, 500, 0, 429, 409].map(hentikanPantau), [true, true, true, false, false, false, false]);
assert.equal(bolehPantau({ aktif: true, berwenang: true, appAktif: true }), true);
assert.equal(bolehPantau({ aktif: true, berwenang: true, appAktif: false }), false, 'latar belakang: berhenti');
assert.equal(bolehPantau({ aktif: false, berwenang: true, appAktif: true }), false, 'keluar ruang: berhenti');
assert.equal(bolehPantau({ aktif: true, berwenang: false, appAktif: true }), false, '403: berhenti');

// Tamu baru: yang sama tidak diumumkan dua kali; yang pergi lalu kembali diumumkan lagi
let tercatat = new Set();
let r = tamuBaru(tercatat, [{ id: 'g1' }, { id: 'g2' }]);
assert.deepEqual(r.baru.map((x) => x.id), ['g1', 'g2'], 'yang sudah menunggu saat pertama dimuat ikut diumumkan');
tercatat = r.tercatat;
r = tamuBaru(tercatat, [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }]);
assert.deepEqual(r.baru.map((x) => x.id), ['g3']);
tercatat = r.tercatat;
r = tamuBaru(tercatat, [{ id: 'g3' }]);
assert.deepEqual(r.baru, [], 'g1/g2 diizinkan: tidak ada yang baru');
tercatat = r.tercatat;
r = tamuBaru(tercatat, [{ id: 'g1' }, { id: 'g3' }]);
assert.deepEqual(r.baru.map((x) => x.id), ['g1'], 'g1 minta masuk lagi → diumumkan lagi');

assert.equal(teksTamuBaru([]), '');
assert.equal(teksTamuBaru(['Budi Mitra (Tamu)']), 'Budi Mitra menunggu masuk');
assert.equal(teksTamuBaru(['Budi', null]), 'Budi dan Tamu menunggu masuk');
assert.equal(teksTamuBaru(['A', 'B', 'C']), '3 tamu menunggu masuk');

const T0 = Date.parse('2026-10-05T03:00:00Z');
assert.equal(lamaMenunggu('2026-10-05T02:59:40Z', T0), 'Baru saja');
assert.equal(lamaMenunggu('2026-10-05T02:57:00Z', T0), 'Menunggu 3 mnt');
assert.equal(lamaMenunggu('2026-10-05T00:30:00Z', T0), 'Menunggu 2 jam');
assert.equal(lamaMenunggu('2026-10-05T03:10:00Z', T0), 'Baru saja', 'jam server di depan HP tidak negatif');
assert.equal(lamaMenunggu(null, T0), null);
assert.equal(lamaMenunggu('bukan tanggal', T0), null);

// ── Pesan galat ──────────────────────────────────────────────────────────────
assert.match(pesanGalatTamu('tambah', { status: 0 }), /^Butuh koneksi/);
assert.match(pesanGalatTamu('cabut', { status: 0 }), /mencabut tamu/);
assert.match(pesanGalatTamu('memuat', { status: 403 }), /penyelenggara/);
assert.match(pesanGalatTamu('izinkan', { status: 403 }), /ruang tunggu/);
assert.match(pesanGalatTamu('putar', { status: 404 }), /tidak ditemukan/);
assert.match(pesanGalatTamu('tambah', { status: 429 }), /Terlalu banyak/);
assert.equal(pesanGalatTamu('tambah', { status: 422, code: 'terlalu_banyak_tamu', message: 'x' }), 'Maksimal 30 tamu per rapat.');
assert.match(pesanGalatTamu('izinkan', { status: 409, code: 'status_berubah' }), /sudah berubah/);
assert.match(pesanGalatTamu('izinkan', { status: 409, code: 'belum_meminta' }), /belum meminta/);
assert.match(pesanGalatTamu('izinkan', { status: 410, code: 'ditutup' }), /selesai atau dibatalkan/);
assert.match(pesanGalatTamu('izinkan', { status: 410, code: 'kedaluwarsa' }), /kedaluwarsa/);
assert.equal(pesanGalatTamu('tambah', { status: 422, message: 'Alamat email tidak valid.' }), 'Alamat email tidak valid.');
assert.equal(pesanGalatTamu('tambah', { status: 500, message: '  ' }), 'Gagal menambah tamu. Coba lagi.');

// ── Tautan rahasia ───────────────────────────────────────────────────────────
const TOKEN = `${ID}${'AbC_-9'.repeat(5)}Zz`; // 26 + 32 karakter
assert.equal(TOKEN.length, 58);
const URL = `https://ruangkerja.test/tamu/${TOKEN}`;
assert.equal(tautanTamuSah(URL), true);
assert.equal(tautanTamuSah(`${URL}x`), false);
assert.equal(tautanTamuSah('https://ruangkerja.test/tamu/pendek'), false);
assert.equal(tautanTamuSah('javascript:alert(1)'), false);
assert.equal(tautanTamuSah(null), false);
assert.equal(samarkanTautan(URL), 'ruangkerja.test/tamu/…');
assert.ok(!samarkanTautan(URL).includes(TOKEN), 'tampilan UI tidak memuat token');
assert.equal(samarkanTautan(undefined), '');

const pesan = pesanBagikanTautan({ judul: 'Sinkron mitra', waktu: 'Sen, 5 Okt · 10.00–11.00 WIB', namaTamu: 'Budi', url: URL });
assert.ok(pesan.includes(URL), 'tautan penuh ikut di teks Bagikan');
assert.match(pesan, /untuk Budi/);
assert.match(pesanBagikanTautan({ judul: 'R', waktu: '', namaTamu: null, url: URL }), /^Undangan rapat video "R"\nTautan masuk pribadi \(jangan diteruskan/);
// Pesan galat dan tampilan daftar tidak pernah memuat token.
for (const g of [pesanGalatTamu('putar', { status: 404 }), samarkanTautan(URL), namaTampilTamu({ name: null, email: 'budi@mitra.test' })]) {
  assert.ok(!g.includes(TOKEN));
}
assert.equal(namaTampilTamu({ name: ' Budi ', email: 'b@x.co' }), 'Budi');
assert.equal(namaTampilTamu({ name: null, email: 'b@x.co' }), 'b@x.co');
assert.equal(namaTampilTamu({ name: null, email: null }), 'Tamu');

// ── Penjaga struktur (tanpa menjalankan React Native) ────────────────────────
const baca = (p) => readFileSync(join(akar, p), 'utf8');
const rapatTamuApi = baca('src/api/rapatTamu.ts');
const panggilan = rapatTamuApi
  .split('apiRequest')
  .slice(1)
  .filter((potong) => !potong.startsWith("'") && !potong.startsWith(' }'))
  .map((potong) => potong.slice(0, potong.indexOf(';')));
assert.equal(panggilan.length, 7, 'tujuh panggilan API tamu');
for (const p of panggilan) {
  assert.match(p, /cache: false/, `panggilan tamu harus cache: false -> ${p.slice(0, 60)}`);
}
assert.match(baca('src/offline/cache.ts'), /TOLAK_PENGGALAN[^\n]*'\/tamu'/, '/tamu masuk daftar tolak cache offline');
assert.ok(!/console\.(log|info|debug|warn|error)/.test(rapatTamuApi + baca('src/features/rapat/KartuTamu.tsx') + baca('src/features/rapat/useTamuRapat.ts') + baca('src/features/rapat/useRuangTunggu.ts')), 'tidak ada console.* di modul tamu (tautan rahasia)');

console.log('cek-rapat-tamu: semua pemeriksaan lulus');
