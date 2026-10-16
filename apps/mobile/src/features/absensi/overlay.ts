/**
 * Keadaan hari absen di perangkat saat offline / ada absen yang menunggu sinkron
 * (docs/sesi/ponsel-b7-offline.md › "Penangan fitur: absen/pengajuan").
 *
 * - `susunAntreAbsen`: ringkasan item antrean `absensi.*` milik pengguna.
 * - `keadaanEfektif`: `state` dari `GET absensi/hari-ini` (bisa salinan cache) disesuaikan
 *   dengan jam PERANGKAT (jendela jam absen perusahaan, hari berganti) dan lapisan optimistis
 *   (setelah absen masuk diantre → "Sudah check-in · menunggu sinkron", setelah pulang →
 *   "Selesai · menunggu sinkron"). Server tetap hakim: semua hitungan di sini hanya
 *   tampilan; item yang ditolak server menjadi `konflik` dan lapisan ini dicabut.
 * - Penyimpanan kecil "terkonfirmasi" supaya Beranda/tab bar tidak kembali ke keadaan lama
 *   di antara item tersinkron dan pemuatan ulang data hari ini.
 *
 * Ringan dimuat: hanya `@/offline` (sudah di memori sejak aplikasi dibuka), format & tipe.
 */
import { useMemo } from 'react';

import type { KeadaanAbsen, RentangJam } from '@/api/absensi';
import { jam, ymdJakarta } from '@/lib/format';
import { useAntrean, type ItemAntrean, type StatusItem } from '@/offline';
import { buatStore, useStore } from '@/offline/store';

import { jamTeks } from './jendela';

export type ArahAbsen = 'masuk' | 'pulang';
export type MetodeAbsen = 'gps' | 'qr' | 'wfh';

/** Jenis item antrean absen. */
export const JENIS_ABSEN = {
  masuk: 'absensi.masuk',
  pulang: 'absensi.pulang',
  masukQr: 'absensi.masuk.qr',
  pulangQr: 'absensi.pulang.qr',
} as const;

/** Item antrean absen paling lama dikirim dalam jam ini sejak tombol ditekan (kontrak server). */
export const BATAS_JAM_OFFLINE = 72;
/** Peringatan "hampir kedaluwarsa" di layar Antrean. */
export const AMBANG_PERINGATAN_JAM = 60;

export function adalahItemAbsen(jenis: string): boolean {
  return jenis.startsWith('absensi.');
}

export function kunciUrutanAbsen(uid: string): string {
  return `absen:${uid}`;
}

// ── Ringkasan antrean ────────────────────────────────────────────────────────

export interface ItemAbsen {
  id: string;
  arah: ArahAbsen;
  metode: MetodeAbsen;
  /** ISO waktu tombol ditekan (jam perangkat). */
  waktu: string;
  /** "07.52" */
  jam: string;
  status: StatusItem;
  galat: string | null;
  kode: string | null;
  lokasi: string | null;
  rencana: string[];
  laporan: string[];
}

export interface AntreAbsen {
  /** Absen masuk hari ini yang masih menunggu/dikirim. */
  masuk: ItemAbsen | null;
  /** Absen pulang hari ini yang masih menunggu/dikirim. */
  pulang: ItemAbsen | null;
  /** Item absen berstatus konflik/gagal (menahan antrean absen sampai diperiksa). */
  bermasalah: ItemAbsen[];
}

export const ANTRE_KOSONG: AntreAbsen = { masuk: null, pulang: null, bermasalah: [] };

function teksArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function keItemAbsen(i: ItemAntrean): ItemAbsen {
  const m = i.meta;
  const arah: ArahAbsen = m.arah === 'pulang' || i.jenis === JENIS_ABSEN.pulang || i.jenis === JENIS_ABSEN.pulangQr ? 'pulang' : 'masuk';
  const metode = m.metode === 'qr' || m.metode === 'wfh' ? m.metode : 'gps';
  return {
    id: i.id,
    arah,
    metode,
    waktu: i.dibuatPada,
    jam: jam(i.dibuatPada).replace(':', '.'),
    status: i.status,
    galat: i.galat?.pesan ?? null,
    kode: i.galat?.kode ?? null,
    lokasi: typeof m.lokasi === 'string' ? m.lokasi : null,
    rencana: teksArray(m.rencana),
    laporan: teksArray(m.laporan),
  };
}

const JAM20 = 20 * 3_600_000;

/** Ringkas item antrean absen. Murni (tanpa hook) supaya mudah dipakai di mana saja. */
export function susunAntreAbsen(items: readonly ItemAntrean[], sekarang: Date): AntreAbsen {
  const semua = items.filter((i) => adalahItemAbsen(i.jenis)).map(keItemAbsen);
  if (semua.length === 0) {
    return ANTRE_KOSONG;
  }
  const hari = ymdJakarta(sekarang);
  const msSekarang = sekarang.getTime();
  const berjalan = (a: ItemAbsen): boolean => a.status === 'menunggu' || a.status === 'mengirim';
  const masukAll = semua.filter((a) => a.arah === 'masuk' && berjalan(a));
  const pulangAll = semua.filter((a) => a.arah === 'pulang' && berjalan(a));
  // Masuk aktif: hari ini, atau < 20 jam lalu (shift lintas tengah malam) selama belum ada pulang sesudahnya.
  const masuk =
    [...masukAll]
      .reverse()
      .find((a) => ymdJakarta(a.waktu) === hari || (msSekarang - Date.parse(a.waktu) < JAM20 && !pulangAll.some((p) => Date.parse(p.waktu) > Date.parse(a.waktu)))) ?? null;
  const pulang =
    [...pulangAll].reverse().find((a) => ymdJakarta(a.waktu) === hari || (masuk !== null && Date.parse(a.waktu) > Date.parse(masuk.waktu))) ?? null;
  const bermasalah = semua.filter((a) => a.status === 'konflik' || a.status === 'gagal');
  if (masuk === null && pulang === null && bermasalah.length === 0) {
    return ANTRE_KOSONG;
  }
  return { masuk, pulang, bermasalah };
}

/** Hook: ringkasan antrean absen. Menghitung ulang hanya saat antrean berubah. */
export function useAntreAbsen(): AntreAbsen {
  const items = useAntrean((s) => s.items);
  return useMemo(() => susunAntreAbsen(items, new Date()), [items]);
}

// ── Terkonfirmasi & bus perubahan ────────────────────────────────────────────

export interface Terkonfirmasi {
  uid: string;
  tanggal: string;
  masuk: string | null;
  pulang: string | null;
}

const konfirmasi = buatStore<Terkonfirmasi | null>(null);

/** Catat absen yang baru diterima server (dari antrean). */
export function catatTersinkron(uid: string, arah: ArahAbsen, waktuIso: string): void {
  const tanggal = ymdJakarta(waktuIso);
  konfirmasi.set((lama) => {
    const dasar: Terkonfirmasi = lama && lama.uid === uid && lama.tanggal === tanggal ? lama : { uid, tanggal, masuk: null, pulang: null };
    return arah === 'masuk' ? { ...dasar, masuk: waktuIso } : { ...dasar, pulang: waktuIso };
  });
}

/** Hook: absen tersinkron hari ini untuk pengguna `uid` (null bila tidak ada). */
export function useTerkonfirmasi(uid: string | null | undefined): Terkonfirmasi | null {
  const nilai = useStore(konfirmasi, (s) => s);
  return nilai !== null && uid && nilai.uid === uid && nilai.tanggal === ymdJakarta(new Date()) ? nilai : null;
}

const pendengar = new Set<() => void>();

/** Dengar perubahan hasil sinkron absen (sukses/konflik) — layar memuat ulang hari-ini. */
export function onAbsenBerubah(cb: () => void): () => void {
  pendengar.add(cb);
  return () => {
    pendengar.delete(cb);
  };
}

export function umumkanAbsenBerubah(): void {
  pendengar.forEach((cb) => {
    try {
      cb();
    } catch {
      // Pendengar tidak boleh mengganggu mesin antrean.
    }
  });
}

// ── Jam & jendela di perangkat ───────────────────────────────────────────────

function menitSejak(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/** Menit sejak 00.00 waktu kantor. */
export function menitKantor(d: Date): number {
  const [h, m] = jam(d).split('.');
  return Number(h) * 60 + Number(m);
}

/** "Absen masuk dibuka pukul 06.00 dan ditutup pukul 12.00." (mengikuti teks server). */
export function pesanJendela(nama: 'Absen masuk' | 'Absen pulang', r: RentangJam | null | undefined): string {
  if (r?.from && r.until) {
    return `${nama} dibuka pukul ${jamTeks(r.from)} dan ditutup pukul ${jamTeks(r.until)}.`;
  }
  if (r?.from) {
    return `${nama} dibuka pukul ${jamTeks(r.from)}.`;
  }
  if (r?.until) {
    return `${nama} ditutup pukul ${jamTeks(r.until)}.`;
  }
  return '';
}

export type FaseJendela = 'sebelum' | 'dalam' | 'sesudah';

/** Posisi `sekarang` terhadap rentang jam (inklusif per menit, seperti server). */
export function fase(r: RentangJam | null | undefined, sekarang: Date): FaseJendela {
  const m = menitKantor(sekarang);
  if (r?.from && m < menitSejak(r.from)) {
    return 'sebelum';
  }
  if (r?.until && m > menitSejak(r.until)) {
    return 'sesudah';
  }
  return 'dalam';
}

export interface KonteksEfektif {
  /** Jam perangkat sekarang. */
  sekarang: Date;
  /** Perangkat tidak online (data hari-ini kemungkinan salinan lama). */
  offline: boolean;
  /** `today.windowsApply` (false = shift lintas tengah malam: jam absen perusahaan tak berlaku). */
  windowsApply: boolean;
  antre: AntreAbsen;
  konfirm: Terkonfirmasi | null;
}

export interface KeadaanEfektif extends KeadaanAbsen {
  /** Absen masuk/pulang di keadaan ini masih menunggu sinkron. */
  menungguMasuk?: boolean;
  menungguPulang?: boolean;
}

function hariBaru(s: KeadaanAbsen, hari: string): KeadaanAbsen {
  // Salinan cache dari hari lain: jadwal, hari libur, dan pengajuan hari ini tidak bisa dipastikan tanpa server.
  return {
    ...s,
    code: 'not_checked_in',
    label: 'Belum check-in',
    message: 'Offline: jadwal hari ini belum bisa dipastikan. Absen tetap bisa disimpan; server yang menilai saat sinkron.',
    punctuality: null,
    lateMinutes: 0,
    officeDate: hari,
    workDate: hari,
    isHoliday: false,
    holidayName: null,
    request: null,
    scheduledStart: null,
    scheduledEnd: null,
    windowOpensAt: null,
    lateThreshold: null,
    checkedInAt: null,
    checkedOutAt: null,
    canCheckIn: true,
    canCheckOut: false,
    checkOutBlockedReason: null,
    leaveShortcut: null,
  };
}

function setelanMasuk(s: KeadaanAbsen, sekarang: Date, windowsApply: boolean): KeadaanAbsen {
  if (s.code !== 'not_checked_in' && s.code !== 'too_early' && s.code !== 'window_closed') {
    return s;
  }
  const w = s.windows?.checkIn ?? null;
  const hari = ymdJakarta(sekarang);
  if (windowsApply) {
    const f = fase(w, sekarang);
    if (f === 'sebelum' && w?.from) {
      return {
        ...s,
        code: 'too_early',
        label: 'Check-in belum dibuka',
        message: pesanJendela('Absen masuk', w),
        canCheckIn: false,
        windowOpensAt: new Date(`${hari}T${w.from}:00+07:00`).toISOString(),
      };
    }
    if (f === 'sesudah') {
      return { ...s, code: 'window_closed', label: 'Check-in sudah ditutup', message: pesanJendela('Absen masuk', w), canCheckIn: false };
    }
  }
  if (s.code === 'too_early' || s.code === 'window_closed') {
    // Jendela perusahaan terpenuhi; tinggal aturan "dibuka X menit sebelum masuk" milik shift (dari data tersimpan).
    const belumBuka = !(windowsApply && w?.from) && s.windowOpensAt !== null && Date.parse(s.windowOpensAt) > sekarang.getTime();
    if (s.code === 'too_early' && belumBuka) {
      return s;
    }
    return { ...s, code: 'not_checked_in', label: 'Belum check-in', message: '', canCheckIn: true };
  }
  return s;
}

function setelanPulang(s: KeadaanAbsen, sekarang: Date, windowsApply: boolean): KeadaanAbsen {
  if (s.code !== 'checked_in' || !windowsApply) {
    return s;
  }
  const w = s.windows?.checkOut ?? null;
  const f = fase(w, sekarang);
  if (f === 'dalam') {
    return { ...s, canCheckOut: true, checkOutBlockedReason: null };
  }
  return { ...s, canCheckOut: false, checkOutBlockedReason: pesanJendela('Absen pulang', w) };
}

/**
 * `state` hari ini yang disesuaikan dengan jam perangkat dan antrean. Saat online tanpa antrean
 * mengembalikan `state` apa adanya (jalur online tidak berubah).
 */
export function keadaanEfektif(state: KeadaanAbsen, k: KonteksEfektif): KeadaanEfektif {
  const { sekarang, offline, antre, konfirm } = k;
  const ada = antre.masuk !== null || antre.pulang !== null || antre.bermasalah.length > 0 || konfirm !== null;
  if (!offline && !ada) {
    return state;
  }
  const hari = ymdJakarta(sekarang);
  let s: KeadaanAbsen = state;

  if (offline) {
    if (state.officeDate !== hari && state.code !== 'checked_in') {
      s = hariBaru(s, hari);
    }
    s = setelanMasuk(s, sekarang, k.windowsApply);
  }

  // Lapisan absen yang menunggu sinkron (atau baru tersinkron tetapi data hari-ini belum dimuat ulang).
  const masukWaktu = s.checkedInAt === null ? (antre.masuk?.waktu ?? konfirm?.masuk ?? null) : null;
  const pulangWaktu = s.checkedOutAt === null ? (antre.pulang?.waktu ?? konfirm?.pulang ?? null) : null;
  const menungguMasuk = masukWaktu !== null && antre.masuk !== null;
  const menungguPulang = pulangWaktu !== null && antre.pulang !== null;

  if (masukWaktu !== null && s.code !== 'checked_in' && s.code !== 'checked_out') {
    s = {
      ...s,
      code: 'checked_in',
      label: menungguMasuk ? 'Sudah check-in · menunggu sinkron' : 'Sudah check-in',
      message: menungguMasuk ? `Absen masuk ${jam(masukWaktu).replace(':', '.')} tersimpan di HP dan menunggu sinkron.` : '',
      checkedInAt: masukWaktu,
      locationName: antre.masuk?.lokasi ?? s.locationName,
      canCheckIn: false,
      punctuality: null,
      lateMinutes: 0,
      canCheckOut: true,
      checkOutBlockedReason: null,
    };
    s = setelanPulang(s, sekarang, k.windowsApply);
  } else {
    s = setelanPulang(s, sekarang, k.windowsApply);
  }

  if (pulangWaktu !== null && s.code === 'checked_in') {
    s = {
      ...s,
      code: 'checked_out',
      label: menungguPulang ? 'Selesai · menunggu sinkron' : 'Selesai',
      message: menungguPulang ? `Absen pulang ${jam(pulangWaktu).replace(':', '.')} tersimpan di HP dan menunggu sinkron.` : '',
      checkedOutAt: pulangWaktu,
      canCheckIn: false,
      canCheckOut: false,
      checkOutBlockedReason: null,
    };
  }

  // Ada item absen yang ditolak/gagal: antrean absen tertahan, jangan antre absen baru sebelum diperiksa.
  if (antre.bermasalah.length > 0) {
    s = { ...s, canCheckIn: false, canCheckOut: false };
  }

  return { ...s, menungguMasuk, menungguPulang };
}

/** Hook: `keadaanEfektif` yang dihitung ulang saat input berubah. */
export function useKeadaanEfektif(state: KeadaanAbsen | null, k: KonteksEfektif): KeadaanEfektif | null {
  const { sekarang, offline, windowsApply, antre, konfirm } = k;
  // `sekarang` berganti tiap 15 detik di pemanggil; hasilnya cukup bergantung pada menitnya.
  const menit = Math.floor(sekarang.getTime() / 60_000);
  return useMemo(
    () => (state === null ? null : keadaanEfektif(state, { sekarang: new Date(menit * 60_000 + 30_000), offline, windowsApply, antre, konfirm })),
    [state, menit, offline, windowsApply, antre, konfirm],
  );
}

// ── Hero Beranda ─────────────────────────────────────────────────────────────

/** Bagian `GET beranda` › `attendance_status` yang dipakai lapisan ini. */
export interface StatusHeroMin {
  action: 'check_in' | 'check_out' | 'done' | 'unavailable';
  checkInAt: string | null;
  checkOutAt: string | null;
}

/** Terapkan absen yang menunggu sinkron / baru tersinkron ke ringkasan absen Beranda. */
export function terapkanKeHero<T extends StatusHeroMin>(status: T, antre: AntreAbsen, konfirm: Terkonfirmasi | null): { status: T; menungguMasuk: boolean; menungguPulang: boolean } {
  if (status.action !== 'check_in' && status.action !== 'check_out') {
    return { status, menungguMasuk: false, menungguPulang: false };
  }
  let s = status;
  const masukWaktu = s.checkInAt === null ? (antre.masuk?.waktu ?? konfirm?.masuk ?? null) : null;
  const menungguMasuk = masukWaktu !== null && antre.masuk !== null;
  if (s.action === 'check_in' && masukWaktu !== null) {
    s = { ...s, action: 'check_out', checkInAt: masukWaktu };
  }
  const pulangWaktu = s.action === 'check_out' && s.checkOutAt === null ? (antre.pulang?.waktu ?? konfirm?.pulang ?? null) : null;
  const menungguPulang = pulangWaktu !== null && antre.pulang !== null;
  if (pulangWaktu !== null) {
    s = { ...s, action: 'done', checkOutAt: pulangWaktu };
  }
  return { status: s, menungguMasuk, menungguPulang };
}
