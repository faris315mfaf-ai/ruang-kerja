/**
 * Bagian bersama penanganan offline TUGAS: jenis antrean, bentuk `meta` item,
 * peta id sementara → id asli (persisten), dan penanda "baru saja berhasil"
 * agar tampilan tidak berkedip antara antrean kosong dan data segar server.
 *
 * Aman diimpor saat aplikasi dibuka (tanpa komponen UI / pustaka berat).
 */
import type { BodyBuatTugas, BodyUbahTugas, KategoriStatus, LabelTugas, OpsiStatus, Orang, RefWorkspace } from '@/api/tugas';

import { cariItem, type ItemAntrean } from '../antrean';
import { denganDb } from '../db';
import { buatStore, useStore } from '../store';
import { buatUlid } from '../ulid';

// ── Jenis & id sementara ─────────────────────────────────────────────────────

export const JENIS_TUGAS = {
  buat: 'tugas.buat',
  ubah: 'tugas.ubah',
  status: 'tugas.status',
  komentar: 'tugas.komentar',
  checklist: 'tugas.checklist',
} as const;

export const AWALAN_TMP = 'tmp_';

export const LABEL_PRIORITAS_TUGAS: Record<number, string> = { 0: 'Tanpa', 1: 'Urgent', 2: 'Tinggi', 3: 'Sedang', 4: 'Rendah' };

export function eIdSementara(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(AWALAN_TMP);
}

export function idSementaraBaru(): { tmpId: string; ulid: string } {
  const ulid = buatUlid();
  return { tmpId: `${AWALAN_TMP}${ulid}`, ulid };
}

// ── Bentuk data ──────────────────────────────────────────────────────────────

/** Tampilan lokal sebuah tugas yang ditimpa perubahan yang masih menunggu. */
export interface TampilTugas {
  title?: string;
  priority?: { value: number; label: string };
  due_date?: string | null;
  start_date?: string | null;
  estimate_hours?: number | null;
  description_text?: string | null;
  assignee_people?: Orang[];
  labels?: LabelTugas[];
  status?: { id: string; name: string; category: KategoriStatus; is_done: boolean };
}

export interface TampilBuat extends TampilTugas {
  title: string;
  priority: { value: number; label: string };
  due_date: string | null;
  start_date: string | null;
  estimate_hours: number | null;
  description_text: string | null;
  assignee_people: Orang[];
  labels: LabelTugas[];
  status: { id: string; name: string; category: KategoriStatus; is_done: boolean };
}

export interface SnapshotBuat {
  workspace: RefWorkspace;
  creator: Orang | null;
  statuses: OpsiStatus[];
  workspace_labels: LabelTugas[];
  tampil: TampilBuat;
  checklist: string[];
  parent_id: string | null;
}

export interface MetaBuat {
  tmpId: string;
  workspaceId: string;
  snapshot: SnapshotBuat;
}

export interface MetaUbah {
  tugasId: string;
  key: string;
  tampil: TampilTugas;
  /** Nilai field saat pertama diubah di HP (untuk mendeteksi perubahan orang lain). */
  dasar: Record<string, unknown>;
}

export type TujuanStatus = { status_id: string } | { done: boolean };

export interface MetaStatus {
  tugasId: string;
  key: string;
  tampil: TampilTugas;
  dasarStatusId: string | null;
  tujuan: TujuanStatus;
}

export interface KomentarLokal {
  clientId: string;
  tugasId: string;
  teks: string;
  dibuat: string;
  penulis: Orang | null;
}

export interface MetaKomentar {
  tugasId: string;
  key: string;
  komentar: KomentarLokal;
}

export interface MetaChecklist {
  tugasId: string;
  key: string;
}

export type SumberMetaTugas = Partial<MetaBuat & MetaUbah & MetaStatus & MetaKomentar>;

export function metaTugas(item: ItemAntrean): SumberMetaTugas {
  return item.meta as SumberMetaTugas;
}

/** Id tugas yang disentuh item (id sementara untuk `tugas.buat`). */
export function tugasIdItem(item: ItemAntrean): string | null {
  const m = metaTugas(item);
  return (item.jenis === JENIS_TUGAS.buat ? m.tmpId : m.tugasId) ?? null;
}

export type BodyBuatMentah = BodyBuatTugas;
export type BodyUbahMentah = BodyUbahTugas;

// ── Peta id sementara → id asli ──────────────────────────────────────────────

const petaStore = buatStore<Readonly<Record<string, string>>>({});

/** Id asli bila `id` sementara sudah dibuat di server; selain itu `id` itu sendiri. */
export function idNyata(id: string): string {
  return petaStore.get()[id] ?? id;
}

export function adalahSudahDipetakan(tmpId: string): boolean {
  return petaStore.get()[tmpId] !== undefined;
}

/** Id sementara yang sudah diganti `real` (bila ada). */
export function idSementaraDari(real: string): string | null {
  for (const [tmp, r] of Object.entries(petaStore.get())) {
    if (r === real) {
      return tmp;
    }
  }
  return null;
}

/** Hook: id asli untuk id sementara (undefined bila belum dibuat di server). */
export function useIdNyata(id: string | undefined): string | undefined {
  const peta = useStore(petaStore, (s) => (id ? s[id] : undefined));
  return peta;
}

/** Catat pasangan id (juga ke basis data supaya selamat dari proses yang dimatikan). */
export async function catatPetaId(tmpId: string, real: string): Promise<void> {
  petaStore.set((lama) => ({ ...lama, [tmpId]: real }));
  await denganDb((db) => db.runAsync('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)', `idtugas:${tmpId}`, real)).catch(() => undefined);
}

/** Cari pasangan id (memori, lalu basis data). */
export async function cariPetaId(tmpId: string): Promise<string | null> {
  const ada = petaStore.get()[tmpId];
  if (ada) {
    return ada;
  }
  try {
    const baris = await denganDb((db) => db.getFirstAsync<{ v: string }>('SELECT v FROM meta WHERE k = ?', `idtugas:${tmpId}`));
    if (baris?.v) {
      petaStore.set((lama) => ({ ...lama, [tmpId]: baris.v }));
      return baris.v;
    }
  } catch {
    // basis data tak terbaca — anggap belum ada
  }
  return null;
}

// ── Penyusunan kunci urutan ─────────────────────────────────────────────────

/** Item antrean (menunggu/konflik/gagal) yang menyentuh tugas ini. */
export function itemTugas(id: string): ItemAntrean[] {
  return cariItem((i) => i.jenis.startsWith('tugas.') && tugasIdItem(i) === id);
}

export function adaTertunda(id: string): boolean {
  return eIdSementara(id) || itemTugas(id).length > 0;
}

/**
 * Kunci urutan antrean untuk sebuah tugas. Item yang menunggu di belakang
 * pembuatan tugas sementara tetap memakai kunci `tugas:<tmp>` meski id-nya sudah
 * diganti, jadi item baru harus ikut kunci itu agar urutan tidak terbalik.
 */
export function kunciUrutan(id: string): string {
  const tmp = eIdSementara(id) ? id : idSementaraDari(id);
  if (tmp && cariItem((i) => i.urutanKunci === `tugas:${tmp}`).length > 0) {
    return `tugas:${tmp}`;
  }
  return `tugas:${id}`;
}

// ── "Baru saja berhasil": halus­kan transisi ───────────────────────────────

export interface PascaSukses {
  /** Tampilan yang sudah diterima server (dipertahankan sebentar sampai data segar dimuat). */
  tampil: Record<string, TampilTugas>;
  /** Pembuatan yang baru berhasil: id sementara → ringkasan (disembunyikan bila id asli sudah ada di daftar). */
  buat: Record<string, { realId: string; meta: MetaBuat }>;
}

const KOSONG_PASCA: PascaSukses = { tampil: {}, buat: {} };
export const pascaStore = buatStore<PascaSukses>(KOSONG_PASCA);
const MASA_PASCA_MS = 5000;

function jadwalkanBersih(ambil: (p: PascaSukses) => PascaSukses): void {
  setTimeout(() => {
    pascaStore.set((lama) => ambil(lama));
  }, MASA_PASCA_MS);
}

export function catatPascaTampil(id: string, tampil: TampilTugas): void {
  pascaStore.set((lama) => ({ ...lama, tampil: { ...lama.tampil, [id]: { ...(lama.tampil[id] ?? {}), ...tampil } } }));
  jadwalkanBersih((lama) => {
    const { [id]: _hapus, ...sisa } = lama.tampil;
    return { ...lama, tampil: sisa };
  });
}

export function catatPascaBuat(tmpId: string, realId: string, meta: MetaBuat): void {
  pascaStore.set((lama) => ({ ...lama, buat: { ...lama.buat, [tmpId]: { realId, meta } } }));
  jadwalkanBersih((lama) => {
    const { [tmpId]: _hapus, ...sisa } = lama.buat;
    return { ...lama, buat: sisa };
  });
}
