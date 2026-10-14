// Uji cepat logika murni widget layar utama (keadaan, waktu, pemotongan baris, palet, pemicu).
// Jalankan: node scripts/cek-widget.mjs   (Node ≥ 22.18, type-stripping bawaan)
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  TAUTAN,
  antreAktif,
  barisHariIni,
  durasiKerja,
  hariSingkatWib,
  jamWib,
  kapasitasBaris,
  keadaanCheckIn,
  keadaanRapat,
  keadaanTugas,
  labelLagi,
  normalisasiSetelan,
  pilihRapat,
  potongBaris,
  widgetUntukJenisAntrean,
  widgetUntukMutasi,
  ymdWib,
  dalamJendelaGabung,
  SETELAN_BAWAAN,
} from '../src/widget/keadaan.ts';
import { buatPalet, campur, keHeks, redupkan, uraiWarna } from '../src/widget/palet.ts';
import { svgIkon } from '../src/widget/ikon.ts';

// ── Waktu (WIB) ──────────────────────────────────────────────────────────────
const t = (iso) => Date.parse(iso);
const SEKARANG = t('2026-10-13T01:05:00Z'); // Sel 13 Okt 2026 08.05 WIB
assert.equal(jamWib('2026-10-13T00:52:00Z'), '07.52');
assert.equal(jamWib(SEKARANG), '08.05');
assert.equal(jamWib('2026-10-13T17:30:00Z'), '00.30'); // lewat tengah malam WIB
assert.equal(jamWib(null), '—');
assert.equal(jamWib('bukan-tanggal'), '—');
assert.equal(ymdWib('2026-10-13T17:30:00Z'), '2026-10-14');
assert.equal(ymdWib(SEKARANG), '2026-10-13');
assert.equal(hariSingkatWib('2026-10-14T02:30:00Z'), 'Rab, 14 Okt');
assert.equal(durasiKerja(492), '8 j 12 m');
assert.equal(durasiKerja(60), '1 j 0 m');
assert.equal(labelLagi(30_000), 'sebentar lagi');
assert.equal(labelLagi(10 * 60_000), '10 menit lagi');
assert.equal(labelLagi(115 * 60_000), '2 jam lagi');
assert.equal(labelLagi(60 * 60_000), '1 jam lagi');

// ── Check-in ─────────────────────────────────────────────────────────────────
const jadwal = { workDate: '2026-10-13', isWorkday: true, isHoliday: false, holidayName: null, isOverride: false, shiftName: 'Reguler', hours: '08.00–17.00', start: '2026-10-13T01:00:00Z', end: '2026-10-13T10:00:00Z', checkInOpensAt: null, lateThreshold: null, workMode: 'office', workModeLabel: 'Kantor', allowsRemote: false };
const hari = (over = {}, state = null) => ({ today: { action: 'check_in', schedule: jadwal, day: null, locations: [], ...over }, serverTime: '2026-10-13T01:05:00Z', state, today2: undefined });
const masukanAbsen = (absen, ekstra = {}) => ({ sekarang: SEKARANG, adaSesi: true, absen, dariCache: false, cachedAt: null, antre: [], ...ekstra });

const belum = keadaanCheckIn(masukanAbsen(hari()));
assert.equal(belum.jenis, 'belum');
assert.equal(belum.judul, 'Belum masuk');
assert.equal(belum.sub, 'Mulai 08.00');
assert.equal(belum.ikon, 'log-in');
assert.ok(belum.menonjol && !belum.segarkan && !belum.bukaAplikasi);
assert.match(belum.label, /layar Absen/);

const masuk = keadaanCheckIn(masukanAbsen(hari({ action: 'check_out', day: { checkInAt: '2026-10-13T00:52:00Z', checkOutAt: null, lateMinutes: 0, workMinutes: null, statusLabel: 'Hadir' } })));
assert.equal(masuk.jenis, 'masuk');
assert.equal(masuk.judul, 'Masuk 07.52');
assert.equal(masuk.sub, 'Tepat waktu');
assert.equal(masuk.ikon, 'log-out');
assert.ok(!masuk.menonjol);

const telat = keadaanCheckIn(masukanAbsen(hari({ action: 'check_out', day: { checkInAt: '2026-10-13T01:12:00Z', checkOutAt: null, lateMinutes: 2, workMinutes: null, statusLabel: 'Terlambat' } })));
assert.equal(telat.sub, 'Terlambat 2 mnt');

const pulang = keadaanCheckIn(masukanAbsen(hari({ action: 'done', day: { checkInAt: '2026-10-13T00:52:00Z', checkOutAt: '2026-10-13T10:04:00Z', lateMinutes: 0, workMinutes: 492, statusLabel: 'Hadir' } })));
assert.equal(pulang.jenis, 'pulang');
assert.equal(pulang.judul, 'Selesai 17.04');
assert.equal(pulang.sub, 'Kerja 8 j 12 m');
assert.equal(pulang.ikon, 'check');

// A day without a schedule is not a holiday: check-in stays possible.
const tanpaJadwal = keadaanCheckIn(masukanAbsen(hari({ action: 'check_in', schedule: { ...jadwal, isWorkday: false, shiftName: null, start: null } })));
assert.equal(tanpaJadwal.jenis, 'belum');
assert.equal(tanpaJadwal.judul, 'Belum masuk');
assert.equal(tanpaJadwal.sub, 'Tanpa jadwal · tetap tercatat');
const libur = keadaanCheckIn(masukanAbsen(hari({ action: 'unavailable', schedule: { ...jadwal, isHoliday: true, holidayName: null } })));
assert.equal(libur.jenis, 'libur');
assert.equal(libur.judul, 'Hari libur');
const liburNasional = keadaanCheckIn(masukanAbsen(hari({ action: 'unavailable', schedule: { ...jadwal, isHoliday: true, holidayName: 'Maulid Nabi' } })));
assert.equal(liburNasional.sub, 'Maulid Nabi');

const antreMasuk = keadaanCheckIn(masukanAbsen(null, { antre: [{ arah: 'masuk', waktu: '2026-10-13T00:52:00Z' }], dariCache: true }));
assert.equal(antreMasuk.jenis, 'antre');
assert.equal(antreMasuk.judul, 'Masuk 07.52');
assert.equal(antreMasuk.sub, 'Menunggu sinyal');
assert.equal(antreMasuk.ikon, 'cloud-upload');
const antrePulang = keadaanCheckIn(masukanAbsen(hari(), { sekarang: t('2026-10-13T10:10:00Z'), antre: [{ arah: 'masuk', waktu: '2026-10-13T00:52:00Z' }, { arah: 'pulang', waktu: '2026-10-13T10:04:00Z' }] }));
assert.equal(antrePulang.judul, 'Selesai 17.04'); // pulang menang atas masuk
assert.equal(antreAktif([{ arah: 'masuk', waktu: '2026-10-12T00:00:00Z' }], SEKARANG), null); // > 20 jam: abaikan
assert.equal(antreAktif([{ arah: 'masuk', waktu: 'rusak' }], SEKARANG), null);

const lama = keadaanCheckIn(masukanAbsen(hari(), { dariCache: true, cachedAt: t('2026-10-13T00:10:00Z') }));
assert.equal(lama.jenis, 'lama');
assert.equal(lama.judul, 'Data lama');
assert.equal(lama.sub, 'Terakhir 07.10');
assert.ok(lama.segarkan);
assert.equal(keadaanCheckIn(masukanAbsen(null)).sub, 'Belum ada data');

const sesi = keadaanCheckIn(masukanAbsen(null, { adaSesi: false }));
assert.equal(sesi.jenis, 'sesi');
assert.equal(sesi.judul, 'Masuk dulu');
assert.equal(sesi.sub, 'Sesi berakhir');
assert.equal(sesi.ikon, 'lock');
assert.ok(sesi.bukaAplikasi && sesi.menonjol);
// Sesi berakhir mengalahkan antrean
assert.equal(keadaanCheckIn(masukanAbsen(null, { adaSesi: false, antre: [{ arah: 'masuk', waktu: '2026-10-13T00:52:00Z' }] })).jenis, 'sesi');

// state dari server (KeadaanAbsen) mengalahkan today.day
const stHoliday = { code: 'holiday', label: 'Libur', message: '', punctuality: null, lateMinutes: 0, isHoliday: true, holidayName: 'Hari Raya', isWorkday: false, checkedInAt: null, checkedOutAt: null, scheduledStart: null, request: null };
assert.equal(keadaanCheckIn(masukanAbsen(hari({}, stHoliday))).sub, 'Hari Raya');
const stRequest = { ...stHoliday, code: 'day_has_request', isHoliday: false, isWorkday: true, request: { statusLabel: 'Cuti disetujui' } };
assert.equal(keadaanCheckIn(masukanAbsen(hari({}, stRequest))).judul, 'Tidak masuk');
assert.equal(keadaanCheckIn(masukanAbsen(hari({}, stRequest))).sub, 'Cuti disetujui');
const stMasuk = { ...stHoliday, code: 'checked_in', isHoliday: false, isWorkday: true, punctuality: 'late', lateMinutes: 7, checkedInAt: '2026-10-13T01:07:00Z' };
assert.equal(keadaanCheckIn(masukanAbsen(hari({}, stMasuk))).sub, 'Terlambat 7 mnt');

// ── Tugas hari ini ───────────────────────────────────────────────────────────
const tg = (id, judul, over = {}) => ({ id, key: `PLQ-${id}`, title: judul, workspace: { key: 'PLQ', name: 'Pribadi' }, status: { name: 'Belum dikerjakan', category: 'todo', is_done: false }, priority: 'Sedang', assignees: [], source: 'manual', assigned_by_other: false, ...over });
const selesaiTg = (id, judul) => tg(id, judul, { status: { name: 'Selesai', category: 'done', is_done: true } });
const terlambatTg = (id, judul, hariTelat, tipe = 'personal') => ({ id, title: judul, days_late: hariTelat, workspace: { type: tipe }, status: { category: 'todo', is_done: false } });

const pribadi = [tg('1', 'Susun laporan stok gudang', { priority: 'Tinggi', status: { name: 'Dikerjakan', category: 'in_progress', is_done: false } }), tg('2', 'Cek kiriman supplier', { source: 'attendance' }), selesaiTg('3', 'Balas email vendor ATK')];
const hariApi = (over = {}) => ({ today: '2026-10-13', pribadi, tim: [tg('9', 'Rapikan gudang tim', { workspace: { key: 'GDG', name: 'Gudang' } })], semua: [...pribadi], counts: { pribadi: 3, tim: 1, semua: 4 }, ...over });
const masukanTugas = (over = {}) => ({ sekarang: SEKARANG, adaSesi: true, hari: hariApi(), terlambat: [], dariCache: false, cachedAt: null, setelan: SETELAN_BAWAAN, ...over });

const normal = keadaanTugas(masukanTugas(), 196);
assert.equal(normal.jenis, 'normal');
assert.equal(normal.segmenLabel, 'Pribadi');
assert.equal(normal.selesai, 1);
assert.equal(normal.total, 3);
assert.deepEqual(normal.baris.map((b) => b.id), ['1', '2', '3']); // terbuka dulu, selesai di bawah
assert.equal(normal.baris[0].meta, 'Tinggi');
assert.equal(normal.baris[0].cincin, 'peringatan');
assert.equal(normal.baris[1].meta, 'dari absen');
assert.equal(normal.baris[1].cincin, 'netral');
assert.equal(normal.baris[2].meta, 'selesai');
assert.equal(normal.baris[2].selesai, true);
assert.equal(normal.tersembunyi, 0);
assert.equal(normal.lama, null);

// "3/7": 7 tugas jatuh tempo, 3 selesai
const tujuh = [tg('a', 'A', { priority: 'Urgent' }), tg('b', 'B'), tg('c', 'C'), tg('d', 'D'), selesaiTg('e', 'E'), selesaiTg('f', 'F'), selesaiTg('g', 'G')];
const k37 = keadaanTugas(masukanTugas({ hari: hariApi({ pribadi: tujuh, counts: { pribadi: 7, tim: 0, semua: 7 } }) }), 196);
assert.equal(`${k37.selesai}/${k37.total}`, '3/7');
assert.equal(k37.baris.length, 3); // 4×2 (196 dp) memuat 3 baris walau ada "+n lagi"
assert.equal(k37.tersembunyi, 4);
assert.deepEqual(k37.baris.map((b) => b.id), ['a', 'b', 'c']);
assert.equal(kapasitasBaris(196, false), 3);
assert.equal(kapasitasBaris(196, true), 3); // catatan data lama memakai bantalan bawah
assert.equal(kapasitasBaris(150, false), 2);
assert.equal(kapasitasBaris(80, false), 1); // minimal satu baris
assert.equal(kapasitasBaris(900, false), 6); // maksimal enam
assert.deepEqual(potongBaris([1, 2, 3], 196, false), { tampil: [1, 2, 3], tersembunyi: 0 });
assert.deepEqual(potongBaris([1, 2, 3, 4], 196, false), { tampil: [1, 2, 3], tersembunyi: 1 });
assert.deepEqual(potongBaris([1, 2, 3, 4], 150, false), { tampil: [1, 2], tersembunyi: 2 }); // 150 dp: 2 baris + "+n lagi"
assert.deepEqual(potongBaris([1, 2, 3], 100, false), { tampil: [1], tersembunyi: 2 }); // sangat pendek: 1 baris + "+n lagi"
assert.deepEqual(potongBaris([1, 2, 3, 4], 196, true), { tampil: [1, 2], tersembunyi: 2 }); // footer + "+n lagi"

// sembunyikan yang selesai
const tanpaSelesai = keadaanTugas(masukanTugas({ setelan: { ...SETELAN_BAWAAN, tampilkanSelesai: false } }), 196);
assert.deepEqual(tanpaSelesai.baris.map((b) => b.id), ['1', '2']);
assert.equal(tanpaSelesai.selesai, 1);

// semua selesai
const semuaSelesai = keadaanTugas(masukanTugas({ hari: hariApi({ pribadi: [selesaiTg('1', 'X'), selesaiTg('2', 'Y')], counts: { pribadi: 2, tim: 0, semua: 2 } }) }), 196);
assert.equal(semuaSelesai.jenis, 'semuaSelesai');
assert.equal(semuaSelesai.judul, 'Semua tugas hari ini selesai');
assert.equal(semuaSelesai.sub, 'Ketuk untuk melihat tugas besok');
assert.equal(`${semuaSelesai.selesai}/${semuaSelesai.total}`, '2/2');

// kosong
const kosong = keadaanTugas(masukanTugas({ hari: hariApi({ pribadi: [], counts: { pribadi: 0, tim: 1, semua: 1 } }) }), 196);
assert.equal(kosong.jenis, 'kosong');

// terlambat tampil paling atas dan mengalahkan "semua selesai"
const dgTelat = keadaanTugas(masukanTugas({ terlambat: [terlambatTg('t1', 'Kirim rekap stok ke Maya', 1), terlambatTg('t2', 'Urusan tim', 3, 'team')] }), 196);
assert.equal(dgTelat.jenis, 'normal');
assert.equal(dgTelat.terlambat, 1); // segmen Pribadi hanya workspace pribadi
assert.equal(dgTelat.baris[0].id, 't1');
assert.equal(dgTelat.baris[0].meta, 'terlambat 1 hari');
assert.equal(dgTelat.baris[0].nadaMeta, 'bahaya');
assert.equal(dgTelat.baris[0].cincin, 'bahaya');
const telatSaja = keadaanTugas(masukanTugas({ hari: hariApi({ pribadi: [selesaiTg('1', 'X')], counts: { pribadi: 1, tim: 0, semua: 1 } }), terlambat: [terlambatTg('t1', 'T', 2)] }), 196);
assert.equal(telatSaja.jenis, 'normal');
assert.equal(telatSaja.baris[0].meta, 'terlambat 2 hari');
const segTim = keadaanTugas(masukanTugas({ setelan: { ...SETELAN_BAWAAN, segmen: 'tim' }, terlambat: [terlambatTg('t1', 'T', 1), terlambatTg('t2', 'U', 4, 'team')] }), 196);
assert.deepEqual(segTim.baris.map((b) => b.id), ['t2', '9']);
const segSemua = keadaanTugas(masukanTugas({ setelan: { ...SETELAN_BAWAAN, segmen: 'semua' }, terlambat: [terlambatTg('t1', 'T', 1), terlambatTg('t2', 'U', 4, 'team')] }), 300);
assert.deepEqual(segSemua.baris.map((b) => b.id).slice(0, 2), ['t1', 't2']);
assert.equal(segSemua.segmenLabel, 'Semua');

// data lama: baris cache + jam data
const tugasLama = keadaanTugas(masukanTugas({ dariCache: true, cachedAt: t('2026-10-13T00:10:00Z') }), 196);
assert.equal(tugasLama.jenis, 'normal');
assert.deepEqual(tugasLama.lama, { ts: t('2026-10-13T00:10:00Z') });
assert.match(tugasLama.label, /Data lama, terakhir 07\.10/);
// salinan lama dari HARI SEBELUMNYA tidak boleh tampil sebagai "tugas hari ini"
const kemarin = keadaanTugas(masukanTugas({ hari: hariApi({ today: '2026-10-12' }), dariCache: true, cachedAt: t('2026-10-12T09:00:00Z') }), 196);
assert.equal(kemarin.jenis, 'tanpaData');
assert.equal(kemarin.baris.length, 0);
assert.match(kemarin.sub, /hari sebelumnya/);
assert.equal(keadaanTugas(masukanTugas({ hari: null }), 196).jenis, 'tanpaData');
assert.equal(keadaanTugas(masukanTugas({ hari: null }), 196).lama.ts, null);

// sesi berakhir
const tugasSesi = keadaanTugas(masukanTugas({ adaSesi: false }), 196);
assert.equal(tugasSesi.jenis, 'sesi');
assert.equal(tugasSesi.judul, 'Masuk dulu untuk melihat tugas');
assert.equal(tugasSesi.baris.length, 0);

// meta: dari atasan, status
assert.equal(barisHariIni(tg('x', 'X', { assigned_by_other: true })).meta, 'dari atasan');
assert.equal(barisHariIni(tg('x', 'X')).meta, 'Belum dikerjakan');
assert.equal(barisHariIni(tg('x', 'X', { status: { name: 'Review', category: 'review', is_done: false } })).cincin, 'netral');

// setelan: nilai rusak jatuh ke bawaan
assert.deepEqual(normalisasiSetelan(null), SETELAN_BAWAAN);
assert.deepEqual(normalisasiSetelan({ segmen: 'x', tampilkanSelesai: 'ya', transparan: 1 }), SETELAN_BAWAAN);
assert.deepEqual(normalisasiSetelan({ segmen: 'tim', tampilkanSelesai: false, transparan: true }), { segmen: 'tim', tampilkanSelesai: false, transparan: true });

// ── Rapat ────────────────────────────────────────────────────────────────────
const rp = (id, mulai, akhir, over = {}) => ({ id, key: id, occurrence_date: '2026-10-13', title: `Rapat ${id}`, starts_at: mulai, ends_at: akhir, platform: 'video', platform_label: 'Video RuangKerja', location: null, join_url: null, organizer: { id: 'o', name: 'O' }, workspace: null, peserta_count: 3, rsvp_saya: 'yes', terjadi_hari_ini: true, dapat_diedit: false, recurrence: 'none', recurrence_until: null, canceled: false, minutes_status: 'none', ...over });
const masukanRapat = (over = {}) => ({ sekarang: SEKARANG, adaSesi: true, hariIni: [], akanDatang: null, fiturMati: false, dariCache: false, cachedAt: null, ...over });

const berlangsung = keadaanRapat(masukanRapat({ hariIni: [rp('R1', '2026-10-13T00:00:00Z', '2026-10-13T02:00:00Z', { title: 'Review arsitektur KMB' })] }));
assert.equal(berlangsung.jenis, 'berlangsung');
assert.equal(berlangsung.chip, 'Berlangsung sekarang');
assert.equal(berlangsung.judul, 'Review arsitektur KMB');
assert.equal(berlangsung.sub, '07.00–09.00 · Video RuangKerja');
assert.equal(berlangsung.aksi.label, 'Gabung');
assert.equal(berlangsung.aksi.tautan, 'ruangkerja://rapat/R1/video/pra-gabung?tanggal=2026-10-13');
assert.equal(berlangsung.tautanKartu, 'ruangkerja://rapat/R1?tanggal=2026-10-13');

const belumMulai = keadaanRapat(masukanRapat({ hariIni: [rp('R2', '2026-10-13T07:00:00Z', '2026-10-13T08:00:00Z')] }));
assert.equal(belumMulai.jenis, 'berikutnya');
assert.equal(belumMulai.overline, 'Rapat berikutnya');
assert.equal(belumMulai.sub, '14.00–15.00 · Video RuangKerja · 6 jam lagi');
assert.equal(belumMulai.aksi.label, 'Detail'); // jendela gabung belum terbuka (15 menit sebelum mulai)
assert.ok(!belumMulai.aksi.menonjol);

const hampir = keadaanRapat(masukanRapat({ hariIni: [rp('R3', '2026-10-13T01:15:00Z', '2026-10-13T02:00:00Z')] }));
assert.equal(hampir.jenis, 'berikutnya');
assert.equal(hampir.aksi.label, 'Gabung'); // 10 menit sebelum mulai: jendela terbuka
assert.equal(hampir.sub.endsWith('10 menit lagi'), true);

const tatapMuka = keadaanRapat(masukanRapat({ hariIni: [rp('R4', '2026-10-13T00:00:00Z', '2026-10-13T02:00:00Z', { platform: 'room', platform_label: 'Tatap muka' })] }));
assert.equal(tatapMuka.aksi.label, 'Detail'); // tombol Gabung hanya untuk video RuangKerja

assert.equal(dalamJendelaGabung(t('2026-10-13T02:00:00Z'), t('2026-10-13T01:45:00Z')), true);
assert.equal(dalamJendelaGabung(t('2026-10-13T02:00:00Z'), t('2026-10-13T01:44:59Z')), false);
assert.equal(dalamJendelaGabung(t('2026-10-13T02:00:00Z'), t('2026-10-13T04:00:00Z')), true);
assert.equal(dalamJendelaGabung(t('2026-10-13T02:00:00Z'), t('2026-10-13T04:00:01Z')), false);

// dibatalkan dan sudah berakhir diabaikan; urut waktu mulai
const urut = pilihRapat([rp('Z', '2026-10-13T09:00:00Z', '2026-10-13T10:00:00Z'), rp('Batal', '2026-10-13T03:00:00Z', '2026-10-13T04:00:00Z', { canceled: true }), rp('Lewat', '2026-10-13T00:00:00Z', '2026-10-13T01:00:00Z'), rp('A', '2026-10-13T05:00:00Z', '2026-10-13T06:00:00Z')], SEKARANG);
assert.equal(urut.id, 'A');

const tidakAda = keadaanRapat(masukanRapat({ hariIni: [rp('Lewat', '2026-10-13T00:00:00Z', '2026-10-13T01:00:00Z')], akanDatang: [rp('B', '2026-10-14T02:30:00Z', '2026-10-14T03:30:00Z', { title: 'Sinkron harian', occurrence_date: '2026-10-14' })] }));
assert.equal(tidakAda.jenis, 'tidakAda');
assert.equal(tidakAda.judul, 'Tidak ada rapat lagi hari ini');
assert.equal(tidakAda.sub, 'Rapat berikut: Rab, 14 Okt 09.30 · Sinkron harian');
assert.equal(tidakAda.aksi, null);
assert.equal(tidakAda.tautanKartu, 'ruangkerja://rapat/B?tanggal=2026-10-14');
assert.equal(keadaanRapat(masukanRapat({ hariIni: [] })).sub, 'Tidak ada rapat terjadwal');
assert.equal(keadaanRapat(masukanRapat({ hariIni: [] })).tautanKartu, TAUTAN.daftarRapat);

const rapatLama = keadaanRapat(masukanRapat({ dariCache: true, cachedAt: t('2026-10-13T00:10:00Z') }));
assert.equal(rapatLama.jenis, 'lama');
assert.equal(rapatLama.judul, 'Belum diperbarui');
assert.equal(rapatLama.sub, 'Terakhir 07.10 · ketuk untuk menyegarkan');
assert.equal(rapatLama.aksi.label, 'Segarkan');
assert.ok(rapatLama.aksi.segarkan && rapatLama.segarkanKartu);
assert.equal(keadaanRapat(masukanRapat({ hariIni: null })).jenis, 'lama');

assert.equal(keadaanRapat(masukanRapat({ adaSesi: false })).jenis, 'sesi');
assert.ok(keadaanRapat(masukanRapat({ adaSesi: false })).bukaAplikasi);
assert.equal(keadaanRapat(masukanRapat({ fiturMati: true })).jenis, 'mati');
assert.equal(keadaanRapat(masukanRapat({ fiturMati: true })).aksi, null);

// ── Tautan & pemicu ──────────────────────────────────────────────────────────
assert.equal(TAUTAN.absen, 'ruangkerja://absen');
assert.equal(TAUTAN.tabTugas, 'ruangkerja://tugas');
assert.equal(TAUTAN.detailTugas('01ABC'), 'ruangkerja://tugas/01ABC');
assert.equal(TAUTAN.detailTugas('a b'), 'ruangkerja://tugas/a%20b');
assert.deepEqual(widgetUntukJenisAntrean('absensi.masuk.qr'), ['CheckIn', 'TugasHariIni']);
assert.deepEqual(widgetUntukJenisAntrean('tugas.status'), ['TugasHariIni']);
assert.deepEqual(widgetUntukJenisAntrean('catatan.isi'), []);
assert.deepEqual(widgetUntukMutasi('absensi/check-in'), ['CheckIn', 'TugasHariIni']);
assert.deepEqual(widgetUntukMutasi('/absensi/check-out/qr'), ['CheckIn', 'TugasHariIni']);
assert.deepEqual(widgetUntukMutasi('tugas/01ABC/status'), ['TugasHariIni']);
assert.deepEqual(widgetUntukMutasi('tugas'), ['TugasHariIni']);
assert.deepEqual(widgetUntukMutasi('rapat/R1/kehadiran'), ['RapatBerikutnya']);
assert.deepEqual(widgetUntukMutasi('tugasan'), []); // bukan awalan segmen penuh
assert.deepEqual(widgetUntukMutasi('obrolan/kanal/1/pesan'), []);

// ── Palet (diturunkan dari token tema) ───────────────────────────────────────
assert.deepEqual(uraiWarna('#0B7F86'), { r: 11, g: 127, b: 134, a: 1 });
assert.deepEqual(uraiWarna('rgba(20,184,166,0.4)'), { r: 20, g: 184, b: 166, a: 0.4 });
assert.equal(uraiWarna('merah'), null);
assert.equal(keHeks('#0b7f86'), '#0B7F86');
assert.equal(keHeks('#FFFFFF', 0.5), '#FFFFFF80');
assert.equal(keHeks('rgba(11,26,43,0.08)'), '#0B1A2B14');
assert.equal(campur('#000000', '#FFFFFF', 0.5), '#808080');

// tokens.ts diimpor lewat salinan terkupas tipe dengan Easing reanimated diganti stub
const tmp = mkdtempSync(join(tmpdir(), 'rk-token-'));
const sumber = readFileSync(new URL('../src/theme/tokens.ts', import.meta.url), 'utf8').replace(/^import \{ Easing \} from 'react-native-reanimated';$/m, 'const Easing = { bezier: () => 0 };');
assert.ok(sumber.includes('const Easing = { bezier'), 'impor Easing di tokens.ts berubah — perbarui uji');
writeFileSync(join(tmp, 'tokens.mjs'), stripTypeScriptTypes(sumber));
const tokens = await import(pathToFileURL(join(tmp, 'tokens.mjs')).href);

const terang = buatPalet(tokens.lightColors, tokens.lightGradients.aksi, { onAksi: tokens.lightColors.primaryFg });
const malam = buatPalet(tokens.darkColors, tokens.darkGradients.aksi, { onAksi: tokens.lightColors.primaryFg });
assert.equal(terang.kartu, tokens.lightColors.surface.toUpperCase());
assert.equal(terang.teks, tokens.lightColors.text.toUpperCase());
assert.equal(terang.tautan, tokens.lightColors.link.toUpperCase());
assert.equal(terang.bahaya, tokens.lightColors.danger.toUpperCase());
assert.equal(terang.sukses, tokens.lightColors.success.toUpperCase());
assert.equal(terang.peringatan, tokens.lightColors.warning.toUpperCase());
assert.deepEqual(terang.aksi, [tokens.lightGradients.aksi[0].toUpperCase(), tokens.lightGradients.aksi[1].toUpperCase()]);
assert.equal(malam.kartu, tokens.darkColors.surface.toUpperCase());
assert.equal(malam.teks, tokens.darkColors.text.toUpperCase());
assert.equal(malam.bahaya, tokens.darkColors.danger.toUpperCase());
assert.notEqual(terang.kartu, malam.kartu);
assert.notEqual(terang.teks, malam.teks);
assert.equal(terang.onAksi, '#FFFFFF');
assert.equal(malam.onAksi, '#FFFFFF'); // gradien aksi memakai isi putih di kedua tema (mockup)
// Seluruh nilai palet adalah hex valid (primitif widget tidak menerima nama warna)
for (const palet of [terang, malam]) {
  for (const [kunci, nilai] of Object.entries(palet)) {
    for (const w of Array.isArray(nilai) ? nilai : [nilai]) {
      assert.match(w, /^#[0-9A-F]{6}([0-9A-F]{2})?$/, `palet.${kunci} bukan hex: ${w}`);
    }
  }
}
// Latar transparan: hanya kartu/garis tembus, teks tetap buram
const bening = buatPalet(tokens.lightColors, tokens.lightGradients.aksi, { transparan: true, onAksi: '#FFFFFF' });
assert.match(bening.kartu, /^#FFFFFF9E$/); // 0,62 × 255 ≈ 158 = 0x9E
assert.equal(bening.teks, terang.teks);
// Redup untuk data lama: lebih dekat ke warna kartu, tetap berbeda dari kartu
const redup = redupkan(terang);
assert.notEqual(redup.teks, terang.teks);
assert.notEqual(redup.teks, terang.kartu);
assert.equal(redup.kartu, terang.kartu);

// ── Ikon SVG ─────────────────────────────────────────────────────────────────
const svg = svgIkon('log-in', '#0B7F86FF');
assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="24" height="24"/);
assert.ok(svg.includes('stroke="#0B7F86"'));
assert.ok(svgIkon('lock', 'bukan-warna').includes('stroke="#000000"'));

console.log('widget: semua pemeriksaan lolos');
