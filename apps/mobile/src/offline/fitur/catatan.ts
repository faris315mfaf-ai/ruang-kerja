/**
 * Tulis CATATAN saat offline (keputusan pemilik 14 Okt 2026): catatan baru,
 * notulensi cepat, ubah judul, dan ubah isi (teks polos seperti di aplikasi
 * saat ini) masuk antrean lokal lalu dikirim otomatis.
 *
 *  - Isi: `PATCH catatan/{id} {body_html, updated_at}`. Simpanan berturutan
 *    digabung jadi SATU item menunggu (teks terakhir menang; `updated_at`
 *    dasar pertama dipertahankan). Setelah item berhasil, `updated_at` baru dari
 *    server ditulis ke item lain di belakangnya (judul/isi memajukan versi).
 *  - Prasyarat server = `updated_at`: catatan yang diubah orang lain sejak
 *    dasar → 409 → item `konflik` (pesan server). "Coba lagi" menimpa dengan
 *    versi HP (versi terbaru diambil dulu); "Ubah" membuka catatan dengan teks HP.
 *  - Catatan baru memakai id sementara `tmp_<ulid>`; judul diubah sebelum
 *    terkirim dilipat ke permintaan pembuatan; isi menyusul sebagai PATCH setelah
 *    id asli dikenal.
 *  - Catatan berformat lengkap tetap baca-saja di ponsel (aturan lama).
 */
import { router } from 'expo-router';

import { ApiError, apiRequest } from '@/api/client';
import { ubahIsi, ubahJudul, type CatatanDetail } from '@/api/catatan';

import {
  cariItem,
  daftarkanPenangan,
  enqueue,
  hapusItem,
  perbaruiItem,
  tulisUlangMenunggu,
  type GalatItem,
  type ItemAntrean,
} from '../antrean';
import { cariPetaId, catatPetaId, eIdSementara, idSementaraBaru, idSementaraDari } from './tugasBersama';
import { PESAN_DISIMPAN_HP, cobaOnline, type HasilTulis } from './umum';

export const JENIS_CATATAN = {
  buat: 'catatan.buat',
  notulensi: 'catatan.notulensi',
  isi: 'catatan.isi',
  judul: 'catatan.judul',
} as const;

export interface RuangCatatanRef {
  id: string;
  key: string;
  name: string;
  personal: boolean;
}

export interface SnapshotCatatan {
  workspace: RuangCatatanRef;
  parentId: string | null;
  title: string;
  preset: 'minutes' | null;
  bodyText: string;
}

export interface MetaBuatCatatan {
  tmpId: string;
  snapshot: SnapshotCatatan;
}

export interface MetaPatchCatatan {
  catatanId: string;
  judul: string;
  teks?: string;
}

type MetaCatatan = Partial<MetaBuatCatatan & MetaPatchCatatan>;

function meta(item: ItemAntrean): MetaCatatan {
  return item.meta as MetaCatatan;
}

/** Id catatan yang disentuh item (id sementara untuk item pembuatan). */
export function catatanIdItem(item: ItemAntrean): string | null {
  const m = meta(item);
  return (item.jenis === JENIS_CATATAN.buat || item.jenis === JENIS_CATATAN.notulensi ? m.tmpId : m.catatanId) ?? null;
}

export function itemCatatan(id: string): ItemAntrean[] {
  return cariItem((i) => i.jenis.startsWith('catatan.') && catatanIdItem(i) === id);
}

export function adaAntreanCatatan(id: string): boolean {
  return eIdSementara(id) ? true : itemCatatan(id).length > 0;
}

function kunciCatatan(id: string): string {
  const tmp = eIdSementara(id) ? id : idSementaraDari(id);
  if (tmp && cariItem((i) => i.urutanKunci === `catatan:${tmp}`).length > 0) {
    return `catatan:${tmp}`;
  }
  return `catatan:${id}`;
}

// ── Pembacaan antrean untuk editor / daftar ─────────────────────────────────

export interface AntreanCatatan {
  /** Teks yang menunggu dikirim (null bila tidak ada simpanan isi di antrean). */
  teks: string | null;
  /** Judul yang menunggu dikirim (null bila tidak ada). */
  judul: string | null;
  /** Item isi yang `konflik`/`gagal` (bila ada). */
  bermasalah: ItemAntrean[];
}

export function bacaAntreanCatatan(id: string): AntreanCatatan | null {
  const daftar = itemCatatan(id);
  if (daftar.length === 0) {
    return null;
  }
  const isi = daftar.filter((i) => i.jenis === JENIS_CATATAN.isi).at(-1);
  const judul = daftar.filter((i) => i.jenis === JENIS_CATATAN.judul).at(-1);
  const buat = daftar.find((i) => i.jenis === JENIS_CATATAN.buat || i.jenis === JENIS_CATATAN.notulensi);
  return {
    teks: isi ? (meta(isi).teks ?? null) : null,
    judul: judul ? (meta(judul).judul ?? null) : buat ? ((meta(buat) as MetaBuatCatatan).snapshot?.title ?? null) : null,
    bermasalah: daftar.filter((i) => i.status === 'konflik' || i.status === 'gagal'),
  };
}

/** Detail lokal catatan baru (belum ada di server) dari antrean. */
export function detailLokalCatatan(tmpId: string): CatatanDetail | null {
  const buat = cariItem((i) => (i.jenis === JENIS_CATATAN.buat || i.jenis === JENIS_CATATAN.notulensi) && meta(i).tmpId === tmpId)[0];
  if (!buat) {
    return null;
  }
  const sn = (meta(buat) as MetaBuatCatatan).snapshot;
  const a = bacaAntreanCatatan(tmpId);
  const teks = a?.teks ?? sn.bodyText;
  return {
    id: tmpId,
    workspace_id: sn.workspace.id,
    parent_id: sn.parentId,
    kind: 'note',
    preset: sn.preset,
    title: a?.judul ?? sn.title,
    access: 'workspace',
    created_by: null,
    updated_by: null,
    position: 'a0',
    created_at: buat.dibuatPada,
    updated_at: buat.dibuatPada,
    penulis: null,
    penyunting: null,
    workspace_key: sn.workspace.key || null,
    workspace_type: sn.workspace.personal ? 'personal' : 'team',
    can_edit: true,
    can_share: false,
    can_delete: false,
    body_html: null,
    body_text: teks,
    mobile_editable: true,
  };
}

// ── Pendengar untuk sesi simpan editor ─────────────────────────────────────

export type PeristiwaCatatan =
  | { tipe: 'sukses'; id: string; jenis: 'isi' | 'judul'; note: CatatanDetail }
  | { tipe: 'dibuat'; tmpId: string; note: CatatanDetail }
  | { tipe: 'konflik'; id: string; jenis: string; galat: GalatItem }
  | { tipe: 'dibuang'; id: string };

const pendengar = new Set<(e: PeristiwaCatatan) => void>();

export function onCatatanAntrean(l: (e: PeristiwaCatatan) => void): () => void {
  pendengar.add(l);
  return () => {
    pendengar.delete(l);
  };
}

function siarkan(e: PeristiwaCatatan): void {
  pendengar.forEach((l) => {
    try {
      l(e);
    } catch {
      // pendengar tidak boleh mengganggu mesin
    }
  });
}

// ── Simpan isi / judul ──────────────────────────────────────────────────────

export async function simpanIsiCatatan(p: { id: string; bodyHtml: string; teks: string; dasar: string; judul: string }): Promise<HasilTulis<CatatanDetail>> {
  if (!eIdSementara(p.id) && !adaAntreanCatatan(p.id)) {
    const hasil = await cobaOnline(() => ubahIsi(p.id, p.bodyHtml, p.dasar));
    if (hasil) {
      return { antre: false, nilai: hasil.nilai };
    }
  }
  const menunggu = cariItem((i) => i.jenis === JENIS_CATATAN.isi && catatanIdItem(i) === p.id && i.status === 'menunggu').at(-1);
  if (menunggu) {
    const json = { ...(menunggu.json as { body_html: string; updated_at: string }), body_html: p.bodyHtml };
    const ok = await perbaruiItem(menunggu.id, { json, label: `Catatan: ${p.judul}`, meta: { ...meta(menunggu), teks: p.teks, judul: p.judul } as Record<string, unknown> });
    if (ok) {
      return { antre: true };
    }
  }
  await enqueue({
    jenis: JENIS_CATATAN.isi,
    label: `Catatan: ${p.judul}`,
    ringkas: 'Isi catatan',
    method: 'PATCH',
    path: `catatan/${p.id}`,
    json: { body_html: p.bodyHtml, updated_at: eIdSementara(p.id) ? '' : p.dasar },
    urutanKunci: kunciCatatan(p.id),
    meta: { catatanId: p.id, judul: p.judul, teks: p.teks } satisfies MetaPatchCatatan as unknown as Record<string, unknown>,
  });
  return { antre: true };
}

export async function simpanJudulCatatan(p: { id: string; judul: string }): Promise<HasilTulis<CatatanDetail>> {
  if (!eIdSementara(p.id) && !adaAntreanCatatan(p.id)) {
    const hasil = await cobaOnline(() => ubahJudul(p.id, p.judul));
    if (hasil) {
      return { antre: false, nilai: hasil.nilai };
    }
  }
  // Catatan baru yang pembuatannya belum dikirim: lipat judul ke permintaan pembuatan.
  if (eIdSementara(p.id)) {
    const buat = cariItem((i) => (i.jenis === JENIS_CATATAN.buat || i.jenis === JENIS_CATATAN.notulensi) && meta(i).tmpId === p.id && i.status !== 'mengirim')[0];
    if (buat && buat.jenis === JENIS_CATATAN.buat) {
      const m = meta(buat) as MetaBuatCatatan;
      const json = { ...(buat.json as Record<string, unknown>), title: p.judul };
      const ok = await perbaruiItem(buat.id, { json, label: `Catatan baru: ${p.judul}`, meta: { ...m, snapshot: { ...m.snapshot, title: p.judul } } as unknown as Record<string, unknown> });
      if (ok) {
        return { antre: true };
      }
    }
  }
  const menunggu = cariItem((i) => i.jenis === JENIS_CATATAN.judul && catatanIdItem(i) === p.id && i.status === 'menunggu').at(-1);
  if (menunggu) {
    const ok = await perbaruiItem(menunggu.id, { json: { title: p.judul }, label: `Judul catatan: ${p.judul}`, meta: { ...meta(menunggu), judul: p.judul } as Record<string, unknown> });
    if (ok) {
      return { antre: true };
    }
  }
  await enqueue({
    jenis: JENIS_CATATAN.judul,
    label: `Judul catatan: ${p.judul}`,
    method: 'PATCH',
    path: `catatan/${p.id}`,
    json: { title: p.judul },
    urutanKunci: kunciCatatan(p.id),
    meta: { catatanId: p.id, judul: p.judul } satisfies MetaPatchCatatan as unknown as Record<string, unknown>,
  });
  return { antre: true };
}

// ── Catatan baru & notulensi cepat ──────────────────────────────────────────

export interface HasilBuatCatatan {
  id: string;
  title: string;
  antre: boolean;
  note: CatatanDetail | null;
}

export async function tulisBuatCatatan(input: { title: string; workspace: RuangCatatanRef; parentId: string | null }): Promise<HasilBuatCatatan> {
  const { tmpId, ulid } = idSementaraBaru();
  const body = { title: input.title, workspace_id: input.workspace.id, parent_id: input.parentId, kind: 'note' };
  const hasil = await cobaOnline(() => apiRequest<{ note: CatatanDetail }>('catatan', { method: 'POST', json: body, idempotencyKey: ulid, cache: false }));
  if (hasil) {
    const note = hasil.nilai?.note;
    if (!note) {
      throw new ApiError({ status: 500, message: 'Jawaban server kosong. Coba lagi.' });
    }
    return { id: note.id, title: note.title, antre: false, note };
  }
  const snapshot: SnapshotCatatan = { workspace: input.workspace, parentId: input.parentId, title: input.title, preset: null, bodyText: '' };
  await enqueue({
    jenis: JENIS_CATATAN.buat,
    label: `Catatan baru: ${input.title}`,
    ringkas: input.workspace.personal ? 'Pribadi' : input.workspace.name,
    method: 'POST',
    path: 'catatan',
    json: body,
    clientId: ulid,
    urutanKunci: `catatan:${tmpId}`,
    meta: { tmpId, snapshot } satisfies MetaBuatCatatan as unknown as Record<string, unknown>,
  });
  return { id: tmpId, title: input.title, antre: true, note: null };
}

const FORMAT_HARI = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });
const FORMAT_TGL = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' });

/** "Selasa, 13/10/2026 14.05" (jam kantor), sama dengan judul buatan server. */
export function kapanNotulensi(d: Date = new Date()): string {
  const bagian = Object.fromEntries(FORMAT_TGL.formatToParts(d).map((x) => [x.type, x.value]));
  return `${FORMAT_HARI.format(d)}, ${bagian.day}/${bagian.month}/${bagian.year} ${bagian.hour}.${bagian.minute}`;
}

/** Templat notulensi polos (padanan `StartQuickMinutes::plainTemplate`). */
export function templatNotulensiPolos(kapan: string): string {
  const baris = [`Tanggal & jam: ${kapan}`];
  for (const label of ['Peserta:', 'Agenda:', 'Pembahasan:', 'Keputusan:', 'Tindak lanjut:']) {
    baris.push('', label, '');
  }
  return baris.join('\n');
}

export async function tulisMulaiNotulensi(): Promise<{ id: string; mode: string; antre: boolean }> {
  const { tmpId, ulid } = idSementaraBaru();
  const hasil = await cobaOnline(() => apiRequest<{ note: CatatanDetail; mode: string }>('catatan/notulensi', { method: 'POST', json: { polos: true }, idempotencyKey: ulid, cache: false }));
  if (hasil) {
    const h = hasil.nilai;
    if (!h?.note) {
      throw new ApiError({ status: 500, message: 'Jawaban server kosong. Coba lagi.' });
    }
    return { id: h.note.id, mode: h.mode, antre: false };
  }
  const kapan = kapanNotulensi();
  const snapshot: SnapshotCatatan = {
    workspace: { id: '', key: '', name: 'Pribadi', personal: true },
    parentId: null,
    title: `Notulensi · ${kapan}`,
    preset: 'minutes',
    bodyText: templatNotulensiPolos(kapan),
  };
  await enqueue({
    jenis: JENIS_CATATAN.notulensi,
    label: snapshot.title,
    ringkas: 'Notulensi cepat · Pribadi',
    method: 'POST',
    path: 'catatan/notulensi',
    json: { polos: true },
    clientId: ulid,
    urutanKunci: `catatan:${tmpId}`,
    meta: { tmpId, snapshot } satisfies MetaBuatCatatan as unknown as Record<string, unknown>,
  });
  return { id: tmpId, mode: 'catat', antre: true };
}

// ── Penangan antrean ────────────────────────────────────────────────────────

async function idUntukKirim(item: ItemAntrean): Promise<{ id: string; path: string }> {
  const id = catatanIdItem(item) ?? '';
  if (eIdSementara(id)) {
    const real = await cariPetaId(id);
    if (!real) {
      throw new ApiError({ status: 404, code: 'catatan_sementara', message: 'Catatan baru ini belum dibuat di server atau sudah dibuang. Hapus perubahan ini lalu ulangi.' });
    }
    return { id: real, path: item.path.split(id).join(real) };
  }
  return { id, path: item.path };
}

function sengajaMenimpa(item: ItemAntrean): boolean {
  return item.kunciIdem !== item.id;
}

function bukaCatatan(item: ItemAntrean): void {
  const id = catatanIdItem(item);
  if (id) {
    router.push(`/catatan/${id}` as never);
  }
}

async function sesudahPatch(item: ItemAntrean, respons: unknown, jenis: 'isi' | 'judul'): Promise<void> {
  const note = (respons as { note?: CatatanDetail } | null)?.note;
  const id = catatanIdItem(item);
  if (!note || !id) {
    return;
  }
  // Setiap perubahan memajukan updated_at: item isi lain di belakang memakai versi baru.
  await tulisUlangMenunggu(
    (i) => i.jenis === JENIS_CATATAN.isi && catatanIdItem(i) === id,
    (i) => ({ json: { ...(i.json as object), updated_at: note.updated_at } }),
  );
  siarkan({ tipe: 'sukses', id, jenis, note });
}

let terdaftar = false;

export function daftarkanPenanganCatatan(): void {
  if (terdaftar) {
    return;
  }
  terdaftar = true;

  const buat = {
    sesudahSukses: async (item: ItemAntrean, respons: unknown): Promise<void> => {
      const m = meta(item) as MetaBuatCatatan;
      const note = (respons as { note?: CatatanDetail } | null)?.note;
      if (!note?.id) {
        return;
      }
      await tulisUlangMenunggu(
        (i) => catatanIdItem(i) === m.tmpId && i.id !== item.id,
        (i) => ({
          path: i.path.split(m.tmpId).join(note.id),
          json: i.jenis === JENIS_CATATAN.isi ? { ...(i.json as object), updated_at: note.updated_at } : i.json,
          meta: { ...i.meta, catatanId: note.id },
        }),
      );
      // Peta id terakhir: editor yang membuka id sementara baru berpindah ke id asli setelah item di belakangnya ditulis ulang.
      await catatPetaId(m.tmpId, note.id);
      siarkan({ tipe: 'dibuat', tmpId: m.tmpId, note });
    },
    sesudahKonflik: (item: ItemAntrean, galat: GalatItem): void => {
      const id = catatanIdItem(item);
      if (id) {
        siarkan({ tipe: 'konflik', id, jenis: item.jenis, galat });
      }
    },
    sesudahDibuang: async (item: ItemAntrean): Promise<void> => {
      const id = catatanIdItem(item);
      if (!id) {
        return;
      }
      if (item.jenis === JENIS_CATATAN.buat || item.jenis === JENIS_CATATAN.notulensi) {
        // Catatan baru dibuang: perubahan di belakangnya tidak punya sasaran lagi.
        for (const i of itemCatatan(id)) {
          if (i.id !== item.id && i.status !== 'mengirim') {
            await hapusItem(i.id);
          }
        }
      }
      siarkan({ tipe: 'dibuang', id });
    },
    pesanSukses: (item: ItemAntrean): string | null => (item.jenis === JENIS_CATATAN.notulensi ? 'Notulensi tersinkron' : `Catatan “${(meta(item) as MetaBuatCatatan).snapshot?.title ?? ''}” dibuat`),
    ubah: bukaCatatan,
  };
  daftarkanPenangan(JENIS_CATATAN.buat, buat);
  daftarkanPenangan(JENIS_CATATAN.notulensi, buat);

  daftarkanPenangan(JENIS_CATATAN.isi, {
    bangunPermintaan: async (item) => {
      const { id, path } = await idUntukKirim(item);
      const json = item.json as { body_html: string; updated_at: string };
      if (json.updated_at === '' || sengajaMenimpa(item)) {
        // Dasar belum diketahui, atau pengguna memilih menimpa: pakai versi server terbaru.
        const h = await apiRequest<{ note: CatatanDetail }>(`catatan/${id}`, { cache: false });
        if (!h?.note) {
          throw new ApiError({ status: 500, message: 'Jawaban server kosong.' });
        }
        return { path, json: { ...json, updated_at: h.note.updated_at } };
      }
      return { path };
    },
    sesudahSukses: (item, respons) => sesudahPatch(item, respons, 'isi'),
    sesudahKonflik: (item, galat) => {
      const id = catatanIdItem(item);
      if (id) {
        siarkan({ tipe: 'konflik', id, jenis: item.jenis, galat });
      }
    },
    sesudahDibuang: (item) => {
      const id = catatanIdItem(item);
      if (id) {
        siarkan({ tipe: 'dibuang', id });
      }
    },
    catatan: (item) =>
      item.status === 'konflik' && item.galat?.status === 409 && item.galat.kode !== 'rich_note'
        ? { teks: 'Catatan berubah di server. “Coba lagi” menimpa dengan teks HP; “Ubah” membuka catatan dengan teks HP.', nada: 'warn' }
        : null,
    pesanSukses: () => null,
    ubah: bukaCatatan,
  });

  daftarkanPenangan(JENIS_CATATAN.judul, {
    bangunPermintaan: async (item) => ({ path: (await idUntukKirim(item)).path }),
    sesudahSukses: (item, respons) => sesudahPatch(item, respons, 'judul'),
    sesudahKonflik: (item, galat) => {
      const id = catatanIdItem(item);
      if (id) {
        siarkan({ tipe: 'konflik', id, jenis: item.jenis, galat });
      }
    },
    sesudahDibuang: (item) => {
      const id = catatanIdItem(item);
      if (id) {
        siarkan({ tipe: 'dibuang', id });
      }
    },
    pesanSukses: () => null,
    ubah: bukaCatatan,
  });
}

daftarkanPenanganCatatan();

export { PESAN_DISIMPAN_HP };
