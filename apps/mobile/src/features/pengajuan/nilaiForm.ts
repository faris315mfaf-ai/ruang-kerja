/**
 * Model isian form pengajuan + konversi ke isian server (nama kunci sama
 * dengan form web) + validasi cepat di klien (pesan mengikuti server).
 * Durasi, benturan, saldo, alur, dan aturan bisnis tetap dihitung server.
 */
import type { IsianKirim, JenisForm, KategoriPengajuan, ModeIzin, NilaiFormServer } from '@/api/pengajuan';

export interface NilaiForm {
  mode: ModeIzin;
  start_date: string;
  end_date: string;
  half_day: boolean;
  date: string;
  start_time: string;
  end_time: string;
  check_in: string;
  check_out: string;
  destination: string;
  item_name: string;
  /** Teks digit. */
  quantity: string;
  unit: string;
  /** Teks digit (tanpa titik ribuan). */
  unit_price: string;
  reference_url: string;
  urgency: 'biasa' | 'mendesak';
  substitute_id: string;
  substitute_name: string;
  reason: string;
}

export function nilaiKosong(tanggalAwal = ''): NilaiForm {
  return {
    mode: 'days',
    start_date: tanggalAwal,
    end_date: tanggalAwal,
    half_day: false,
    date: tanggalAwal,
    start_time: '',
    end_time: '',
    check_in: '',
    check_out: '',
    destination: '',
    item_name: '',
    quantity: '1',
    unit: '',
    unit_price: '',
    reference_url: '',
    urgency: 'biasa',
    substitute_id: '',
    substitute_name: '',
    reason: '',
  };
}

export function nilaiDariServer(form: NilaiFormServer, substituteName: string | null): NilaiForm {
  const s = (v: string | null | undefined): string => v ?? '';
  return {
    mode: form.mode ?? (form.start_time && !form.start_date ? 'hours' : 'days'),
    start_date: s(form.start_date),
    end_date: s(form.end_date),
    half_day: form.half_day,
    date: s(form.date),
    start_time: s(form.start_time).slice(0, 5),
    end_time: s(form.end_time).slice(0, 5),
    check_in: s(form.check_in).slice(0, 5),
    check_out: s(form.check_out).slice(0, 5),
    destination: s(form.destination),
    item_name: s(form.item_name),
    quantity: form.quantity === null ? '' : String(form.quantity),
    unit: s(form.unit),
    unit_price: form.unit_price === null ? '' : String(form.unit_price),
    reference_url: s(form.reference_url),
    urgency: form.urgency ?? 'biasa',
    substitute_id: s(form.substitute_id),
    substitute_name: substituteName ?? '',
    reason: s(form.reason),
  };
}

/** Daftar isian yang berlaku untuk jenis + mode (dari `fields` server). */
export function isianAktif(jenis: JenisForm, mode: ModeIzin): string[] {
  const f = jenis.fields;
  if (Array.isArray(f)) {
    return f;
  }
  return f[mode] ?? f.days ?? [];
}

const null_ = (v: string): string | null => (v.trim() === '' ? null : v.trim());

/** Isian server untuk jenis terpilih (hanya kunci yang berlaku). */
export function keIsianServer(jenis: JenisForm, n: NilaiForm): IsianKirim {
  const aktif = new Set(isianAktif(jenis, n.mode));
  const isian: IsianKirim = { leave_type_id: jenis.id, reason: n.reason.trim() };
  if (jenis.modes) {
    isian.mode = n.mode;
  }
  const pakai = (k: keyof NilaiForm, nilai: string | number | boolean | null): void => {
    if (aktif.has(k)) {
      isian[k] = nilai;
    }
  };
  pakai('start_date', null_(n.start_date));
  // Tanggal selesai kosong = satu hari (dinas "Kosongkan bila satu hari").
  pakai('end_date', null_(n.end_date) ?? null_(n.start_date));
  pakai('half_day', n.half_day && (n.end_date === '' || n.end_date === n.start_date));
  pakai('date', null_(n.date));
  pakai('start_time', null_(n.start_time));
  pakai('end_time', null_(n.end_time));
  pakai('check_in', null_(n.check_in));
  pakai('check_out', null_(n.check_out));
  pakai('destination', null_(n.destination));
  pakai('item_name', null_(n.item_name));
  pakai('quantity', n.quantity.trim() === '' ? null : Number(n.quantity));
  pakai('unit', null_(n.unit));
  pakai('unit_price', n.unit_price.trim() === '' ? null : Number(n.unit_price));
  pakai('reference_url', null_(n.reference_url));
  pakai('urgency', n.urgency);
  pakai('substitute_id', null_(n.substitute_id));
  return isian;
}

/** Kunci isian yang cukup untuk meminta pratinjau. */
export function siapPratinjau(kategori: KategoriPengajuan, jenis: JenisForm, n: NilaiForm): boolean {
  const aktif = isianAktif(jenis, n.mode);
  if (kategori === 'procurement') {
    return true;
  }
  if (aktif.includes('start_date')) {
    return n.start_date !== '';
  }
  if (aktif.includes('start_time')) {
    return n.date !== '' && /^\d{2}:\d{2}$/.test(n.start_time) && /^\d{2}:\d{2}$/.test(n.end_time);
  }
  if (aktif.includes('date')) {
    return n.date !== '';
  }
  return true;
}

const URL_VALID = /^https?:\/\/[^\s]+\.[^\s]+$/i;

/** Validasi cepat sebelum kirim. `wajibLampiran` dari pratinjau server. */
export function periksaNilai(
  jenis: JenisForm,
  n: NilaiForm,
  opsi: { wajibLampiran: boolean; jumlahLampiran: number; hariIni: string },
): Record<string, string> {
  const g: Record<string, string> = {};
  const aktif = new Set(isianAktif(jenis, n.mode));
  const k = jenis.category;

  if (aktif.has('start_date') && n.start_date === '') {
    g.start_date = 'Tanggal mulai wajib diisi.';
  }
  if (aktif.has('end_date') && n.end_date !== '' && n.start_date !== '' && n.end_date < n.start_date) {
    g.end_date = 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
  }
  if (aktif.has('date') && n.date === '') {
    g.date = k === 'correction' ? 'Tanggal yang dikoreksi wajib diisi.' : 'Tanggal wajib diisi.';
  }
  if (aktif.has('start_time') && n.start_time === '') {
    g.start_time = 'Jam mulai wajib diisi.';
  }
  if (aktif.has('end_time') && n.end_time === '') {
    g.end_time = 'Jam selesai wajib diisi.';
  }
  if (k === 'permit' && n.mode === 'hours' && n.start_time !== '' && n.end_time !== '' && n.end_time <= n.start_time) {
    g.end_time = 'Jam selesai harus setelah jam mulai.';
  }
  if (k === 'correction') {
    if (n.check_in === '' && n.check_out === '') {
      g.check_out = 'Isi jam masuk atau jam pulang yang benar.';
    }
    if (n.date !== '' && n.date > opsi.hariIni) {
      g.date = 'Koreksi hanya untuk hari ini atau sebelumnya.';
    }
  }
  if (aktif.has('destination') && n.destination.trim() === '') {
    g.destination = 'Tujuan dinas wajib diisi.';
  }
  if (k === 'procurement') {
    if (n.item_name.trim() === '') {
      g.item_name = 'Nama barang wajib diisi.';
    }
    const q = Number(n.quantity);
    if (n.quantity.trim() === '' || !Number.isInteger(q) || q < 1) {
      g.quantity = 'Jumlah minimal 1.';
    }
    if (n.reference_url.trim() !== '' && !URL_VALID.test(n.reference_url.trim())) {
      g.reference_url = 'Tautan harus diawali http:// atau https://.';
    }
  }
  if (n.reason.trim() === '') {
    g.reason = 'Alasan wajib diisi.';
  }
  if (opsi.wajibLampiran && opsi.jumlahLampiran === 0) {
    g.attachments = k === 'sick' ? 'Lampirkan surat dokter untuk sakit lebih dari 1 hari.' : 'Lampiran wajib untuk pengajuan ini.';
  }
  return g;
}

/** Galat 422 server → pesan per isian (kunci form). */
export function galatServer(errors: Record<string, string[]>): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const [k, pesan] of Object.entries(errors)) {
    const kunci = k.startsWith('attachments') ? 'attachments' : k === 'type' ? 'leave_type_id' : k;
    if (!hasil[kunci] && pesan[0]) {
      hasil[kunci] = pesan[0];
    }
  }
  return hasil;
}

/** Ada isian yang sudah diketik pengguna (untuk sheet "Keluar dari form?"). */
export function adaIsian(n: NilaiForm, awal: NilaiForm): boolean {
  return (Object.keys(n) as (keyof NilaiForm)[]).some((k) => n[k] !== awal[k]);
}
