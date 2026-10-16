/**
 * Pengajuan offline (docs/sesi/ponsel-b7-offline.md › "Penangan fitur: absen/pengajuan").
 *
 * Yang diantre: (1) pengajuan BARU (`POST pengajuan` — membuat sekaligus mengirim; lampiran ikut
 * dalam satu multipart sebagai BLOB ≤ 5 MB), dan (2) pengiriman DRAF server yang sudah punya id
 * (`POST pengajuan/{id}/lampiran` lalu `POST pengajuan/{id}/kirim`, satu `urutanKunci`).
 * Tetap ONLINE-SAJA: batal, ubah/hapus, kirim ulang revisi, dan persetujuan.
 *
 * Id sementara = `Idempotency-Key` item (ULID). Kartu "Pengajuan saya" dan layar detail untuk id itu
 * dibangun dari salinan lokal (`meta.semu`) sampai server menjawab; saat tersinkron, id sementara
 * dipetakan ke id asli (`idAsli`) supaya layar yang masih terbuka berpindah ke detail sebenarnya.
 *
 * Dimuat saat aplikasi dibuka (penanganFitur): tetap ringan — tanpa komponen/layar.
 */
import { useMemo } from 'react';

import type { DaftarJenis, IsianKirim, ItemPengajuan, JenisForm, PayloadPengajuan } from '@/api/pengajuan';
import { jam, ymdHariIni } from '@/lib/format';
import { adalahOnline, daftarkanPenangan, enqueue, useAntrean, type ItemAntrean, type Penangan, type StatusItem } from '@/offline';

import { isoDariYmd, jamTampil } from './format';
import type { NilaiForm } from './nilaiForm';
import { tandaiDaftarBerubah } from './simpanan';

export const JENIS_PENGAJUAN = {
  baru: 'pengajuan.kirim',
  lampiran: 'pengajuan.lampiran',
  draf: 'pengajuan.kirimDraf',
} as const;

export const JENIS_PENGAJUAN_DAFTAR: readonly string[] = [JENIS_PENGAJUAN.baru, JENIS_PENGAJUAN.draf];

/** Berkas lokal yang akan dibawa antrean (sama dengan `BerkasLokal` form). */
export interface BerkasAntre {
  uri: string;
  name: string;
  mime: string;
  size: number;
}

export interface PenggunaAntre {
  id: string;
  name: string;
}

function kunciPengajuan(id: string): string {
  return `pengajuan:${id}`;
}

// ── Peta id & peristiwa ──────────────────────────────────────────────────────

const peta = new Map<string, string>();

/** Id asli untuk id sementara yang sudah tersinkron (hanya selama proses hidup). */
export function idAsli(idSementara: string): string | null {
  return peta.get(idSementara) ?? null;
}

const pendengar = new Set<() => void>();

/** Dengar perubahan hasil sinkron pengajuan (sukses/konflik/dibuang). */
export function onPengajuanBerubah(cb: () => void): () => void {
  pendengar.add(cb);
  return () => {
    pendengar.delete(cb);
  };
}

function umumkan(): void {
  tandaiDaftarBerubah();
  pendengar.forEach((cb) => {
    try {
      cb();
    } catch {
      // Pendengar tidak boleh mengganggu mesin antrean.
    }
  });
}

// ── Salinan lokal pengajuan (untuk kartu & detail sementara) ─────────────────

function waktuIso(ymd: string | null | undefined, hhmm: string | null | undefined, awalHari: boolean): string {
  if (!ymd) {
    return new Date().toISOString();
  }
  return hhmm ? `${ymd}T${hhmm.slice(0, 5)}:00+07:00` : awalHari ? isoDariYmd(ymd) : `${ymd}T10:00:00Z`;
}

const teks = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const angka = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Bangun `ItemPengajuan` sementara dari isian form (hanya untuk tampilan "Menunggu sinkron"). */
export function susunSemu(jenis: JenisForm, isian: IsianKirim, id: string, pengguna: PenggunaAntre): ItemPengajuan {
  const mulai = teks(isian.start_date) ?? teks(isian.date);
  const selesai = teks(isian.end_date) ?? mulai;
  const jamMulai = teks(isian.start_time);
  const jamSelesai = teks(isian.end_time);
  const jumlah = angka(isian.quantity);
  const harga = angka(isian.unit_price);
  const payload: PayloadPengajuan = {};
  if (jenis.modes && (isian.mode === 'days' || isian.mode === 'hours')) payload.mode = isian.mode;
  if (isian.half_day === true) payload.half_day = true;
  if (teks(isian.date)) payload.date = teks(isian.date) as string;
  if (jamMulai) payload.start_time = jamMulai;
  if (jamSelesai) payload.end_time = jamSelesai;
  if (teks(isian.check_in)) payload.check_in = teks(isian.check_in);
  if (teks(isian.check_out)) payload.check_out = teks(isian.check_out);
  if (teks(isian.destination)) payload.destination = teks(isian.destination) as string;
  if (teks(isian.item_name)) payload.item_name = teks(isian.item_name) as string;
  if (jumlah !== null) payload.quantity = jumlah;
  if (teks(isian.unit)) payload.unit = teks(isian.unit);
  if (harga !== null) payload.unit_price = harga;
  if (jumlah !== null && harga !== null) payload.total = jumlah * harga;
  if (teks(isian.reference_url)) payload.reference_url = teks(isian.reference_url);
  if (isian.urgency === 'biasa' || isian.urgency === 'mendesak') payload.urgency = isian.urgency;
  const sekarang = new Date().toISOString();
  return {
    id,
    number: null,
    status: 'pending',
    status_label: 'Menunggu sinkron',
    type: {
      id: jenis.id,
      code: jenis.code,
      name: jenis.name,
      category: jenis.category,
      category_label: jenis.category_label,
      description: jenis.description,
      annual_quota_days: jenis.annual_quota_days,
      requires_attachment_after_days: jenis.requires_attachment_after_days,
      allow_half_day: jenis.allow_half_day,
      max_backdate_days: jenis.max_backdate_days,
      is_paid: jenis.is_paid,
      counts_calendar_days: jenis.counts_calendar_days,
      max_days_per_request: jenis.max_days_per_request,
      day_unit: jenis.day_unit,
      is_provisional_default: jenis.is_provisional_default,
      locked: jenis.locked,
      locked_reason: jenis.locked_reason,
    },
    user: { id: pengguna.id, name: pengguna.name, avatar: null, position: null, division: null },
    start_at: waktuIso(mulai, jenis.category === 'permit' || jenis.category === 'overtime' ? jamMulai : null, true),
    end_at: waktuIso(selesai, jenis.category === 'permit' || jenis.category === 'overtime' ? jamSelesai : null, false),
    days: null,
    minutes: null,
    payload,
    round: 1,
    step_position: null,
    step_count: 0,
    waiting: null,
    decision_note: null,
    submitted_at: null,
    created_at: sekarang,
    updated_at: sekarang,
    decided_at: null,
  };
}

// ── Antre ────────────────────────────────────────────────────────────────────

function keFields(isian: IsianKirim): Record<string, string> {
  const f: Record<string, string> = {};
  for (const [k, v] of Object.entries(isian)) {
    if (v === null || v === undefined) {
      continue;
    }
    f[k] = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  }
  return f;
}

function ringkasJenis(jenis: JenisForm, berkas: BerkasAntre[]): string {
  const bagian: string[] = [];
  if (jenis.category === 'sick' || jenis.category === 'permit') {
    bagian.push('Dinilai saat terkirim');
  }
  if (berkas.length > 0) {
    bagian.push(`${berkas.length} lampiran`);
  }
  return bagian.join(' · ');
}

interface DasarPengajuan {
  uid: string;
  namaPengguna: string;
  jenis: JenisForm;
  isian: IsianKirim;
  nilai: NilaiForm;
  berkas: BerkasAntre[];
  /** Id sementara = `Idempotency-Key` (juga dipakai percobaan online). */
  kunci: string;
}

function labelPengajuan(jenis: JenisForm): string {
  return `Pengajuan ${jenis.name.toLowerCase()}`;
}

function metaDasar(a: DasarPengajuan, semu: ItemPengajuan): Record<string, unknown> {
  return {
    uid: a.uid,
    tmpId: a.kunci,
    typeId: a.jenis.id,
    typeName: a.jenis.name,
    kategori: a.jenis.category,
    cutoff: a.jenis.category === 'sick' || a.jenis.category === 'permit' ? (a.jenis.submit_cutoff_time ?? null) : null,
    nilai: a.nilai,
    alasan: typeof a.isian.reason === 'string' ? a.isian.reason : '',
    semu,
    lampiranNama: a.berkas.map((b) => b.name),
  };
}

function berkasMasuk(berkas: BerkasAntre[]): { field: string; nama: string; mime: string; uri: string }[] {
  return berkas.map((b) => ({ field: 'attachments[]', nama: b.name, mime: b.mime, uri: b.uri }));
}

/** Antre pengajuan baru (create + kirim dalam satu permintaan). */
export async function antreKirimBaru(a: DasarPengajuan): Promise<ItemPengajuan> {
  const semu = susunSemu(a.jenis, a.isian, a.kunci, { id: a.uid, name: a.namaPengguna });
  await enqueue({
    jenis: JENIS_PENGAJUAN.baru,
    label: labelPengajuan(a.jenis),
    ringkas: ringkasJenis(a.jenis, a.berkas),
    method: 'POST',
    path: 'pengajuan',
    ...(a.berkas.length > 0 ? { formFields: keFields(a.isian), berkas: berkasMasuk(a.berkas) } : { json: a.isian }),
    clientId: a.kunci,
    urutanKunci: kunciPengajuan(a.kunci),
    meta: metaDasar(a, semu),
  });
  return semu;
}

/** Antre pengiriman draf server: unggah lampiran lokal (bila ada) lalu kirim. */
export async function antreKirimDraf(a: DasarPengajuan & { requestId: string }): Promise<ItemPengajuan> {
  const semu = susunSemu(a.jenis, a.isian, a.requestId, { id: a.uid, name: a.namaPengguna });
  const urutan = kunciPengajuan(a.requestId);
  if (a.berkas.length > 0) {
    await enqueue({
      jenis: JENIS_PENGAJUAN.lampiran,
      label: `Lampiran ${labelPengajuan(a.jenis).toLowerCase()}`,
      ringkas: `${a.berkas.length} lampiran`,
      method: 'POST',
      path: `pengajuan/${a.requestId}/lampiran`,
      formFields: {},
      berkas: berkasMasuk(a.berkas),
      urutanKunci: urutan,
      meta: { uid: a.uid, requestId: a.requestId },
    });
  }
  await enqueue({
    jenis: JENIS_PENGAJUAN.draf,
    label: labelPengajuan(a.jenis),
    ringkas: ringkasJenis(a.jenis, a.berkas),
    method: 'POST',
    path: `pengajuan/${a.requestId}/kirim`,
    json: a.isian,
    clientId: a.kunci,
    urutanKunci: urutan,
    meta: { ...metaDasar(a, semu), requestId: a.requestId },
  });
  return semu;
}

// ── Baca antrean ─────────────────────────────────────────────────────────────

export interface PengajuanAntre {
  /** Id yang dipakai UI/rute: id sementara (pengajuan baru) atau id draf server. */
  id: string;
  itemId: string;
  jenis: string;
  status: StatusItem;
  galat: string | null;
  semu: ItemPengajuan;
  kategori: string;
  /** Batas hari-H sakit/izin "HH:MM", bila berlaku. */
  cutoff: string | null;
  /** Draf server yang dikirim (bukan pengajuan baru). */
  requestId: string | null;
  lampiranNama: string[];
  alasan: string;
}

function keAntre(i: ItemAntrean): PengajuanAntre | null {
  const m = i.meta;
  const semu = m.semu as ItemPengajuan | undefined;
  if (!semu || typeof m.tmpId !== 'string') {
    return null;
  }
  return {
    id: typeof m.requestId === 'string' ? m.requestId : m.tmpId,
    itemId: i.id,
    jenis: i.jenis,
    status: i.status,
    galat: i.galat?.pesan ?? null,
    semu,
    kategori: typeof m.kategori === 'string' ? m.kategori : '',
    cutoff: typeof m.cutoff === 'string' ? m.cutoff : null,
    requestId: typeof m.requestId === 'string' ? m.requestId : null,
    lampiranNama: Array.isArray(m.lampiranNama) ? m.lampiranNama.filter((x): x is string => typeof x === 'string') : [],
    alasan: typeof m.alasan === 'string' ? m.alasan : '',
  };
}

/** Hook: pengajuan yang menunggu sinkron (urut masuk antrean). */
export function usePengajuanAntre(): PengajuanAntre[] {
  const items = useAntrean((s) => s.items);
  return useMemo(() => items.filter((i) => JENIS_PENGAJUAN_DAFTAR.includes(i.jenis)).flatMap((i) => keAntre(i) ?? []), [items]);
}

/** Hook: satu pengajuan antre menurut id UI; `siap` = antrean sudah dimuat dari basis data. */
export function usePengajuanAntreById(id: string | undefined): { item: PengajuanAntre | null; siap: boolean } {
  const daftar = usePengajuanAntre();
  const siap = useAntrean((s) => s.siap);
  return { item: id ? (daftar.find((p) => p.id === id) ?? null) : null, siap };
}

/** Kalimat catatan untuk sakit/izin yang diantre. */
export function catatanCutoff(cutoff: string | null): string | null {
  return cutoff ? `Offline: pengajuan dinilai saat terkirim (batas hari-H pukul ${jamTampil(cutoff)})` : null;
}

/**
 * Saat offline, "hari ini" dan status batas sakit/izin dari salinan `pengajuan/jenis` bisa basi:
 * hitung ulang dari jam HP. Online: data server apa adanya.
 */
export function sesuaikanJenisLokal(data: DaftarJenis): DaftarJenis {
  if (adalahOnline()) {
    return data;
  }
  const [h, m] = jam(new Date()).split('.');
  const menit = Number(h) * 60 + Number(m);
  return {
    ...data,
    today: ymdHariIni(),
    categories: data.categories.map((c) => ({
      ...c,
      types: c.types.map((t) => {
        if (!t.submit_cutoff_time) {
          return t;
        }
        const [ch, cm] = t.submit_cutoff_time.split(':');
        return { ...t, submit_closed_today: menit >= Number(ch) * 60 + Number(cm) };
      }),
    })),
  };
}

// ── Penangan ─────────────────────────────────────────────────────────────────

function idDariRespons(respons: unknown): string | null {
  if (respons !== null && typeof respons === 'object') {
    const r = (respons as { request?: { id?: unknown } }).request;
    if (r && typeof r.id === 'string') {
      return r.id;
    }
  }
  return null;
}

const dasar: Penangan = {
  sesudahKonflik: () => umumkan(),
  sesudahDibuang: () => umumkan(),
  pesanSukses(item) {
    const nama = typeof item.meta.typeName === 'string' ? item.meta.typeName.toLowerCase() : '';
    return nama ? `Pengajuan ${nama} tersinkron` : 'Pengajuan tersinkron';
  },
  catatan(item) {
    if (item.status === 'konflik' || item.status === 'gagal') {
      return null;
    }
    const c = catatanCutoff(typeof item.meta.cutoff === 'string' ? item.meta.cutoff : null);
    return c ? { teks: c, nada: 'info' } : null;
  },
};

daftarkanPenangan(JENIS_PENGAJUAN.baru, {
  ...dasar,
  sesudahSukses(item, respons) {
    const asli = idDariRespons(respons);
    if (asli && typeof item.meta.tmpId === 'string') {
      peta.set(item.meta.tmpId, asli);
    }
    umumkan();
  },
  ubah(item) {
    void import('expo-router').then((m) => m.router.push({ pathname: '/pengajuan/form', params: { antre: item.id } }));
  },
});

daftarkanPenangan(JENIS_PENGAJUAN.draf, {
  ...dasar,
  sesudahSukses: () => umumkan(),
});

daftarkanPenangan(JENIS_PENGAJUAN.lampiran, {
  sesudahKonflik: () => umumkan(),
  sesudahDibuang: () => umumkan(),
});
