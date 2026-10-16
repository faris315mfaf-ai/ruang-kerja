/**
 * Tulis TUGAS saat offline (keputusan pemilik 14 Okt 2026): buat tugas, pindah
 * status, ubah isian, dan komentar masuk antrean lokal lalu dikirim otomatis.
 *
 *  - Alur UI: `tulisBuatTugas` / `tulisUbahTugas` / `tulisPindahStatus` /
 *    `tulisKomentar`. Online & tak ada antrean untuk tugas itu → langsung ke
 *    server seperti sebelumnya; offline (atau tugas masih punya antrean) →
 *    antrean, dan layar menampilkan overlay lokal + chip "Menunggu sinkron".
 *  - Ubah isian berurutan digabung jadi SATU PATCH menunggu (nilai terakhir
 *    menang; nilai dasar pertama dipertahankan untuk deteksi bentrok). Pada
 *    tugas sementara yang pembuatannya belum dikirim, ubahan dilipat ke
 *    permintaan pembuatan itu sendiri.
 *  - Tugas sementara memakai id `tmp_<ulid>`; item di belakangnya (satu
 *    `urutanKunci`) ditulis ulang dengan id asli begitu pembuatan berhasil.
 *  - Server tidak punya prasyarat versi untuk tugas, jadi sebelum PATCH dikirim
 *    klien memeriksa nilai terbaru: field yang Anda ubah dan DIUBAH ORANG LAIN
 *    sejak itu → `konflik` (409) dengan pesan jelas; "Coba lagi" menimpa.
 *
 * Dokumen: docs/sesi/ponsel-b7-offline.md ("Penangan fitur").
 */
import { router } from 'expo-router';

import { ApiError, apiRequest } from '@/api/client';
import type {
  BodyBuatTugas,
  BodyKomentar,
  BodyUbahTugas,
  DetailTugasPenuh,
  KategoriStatus,
  KomentarTugas,
  LabelTugas,
  Orang,
  RefWorkspace,
} from '@/api/tugas';

import {
  cariItem,
  cobaLagi,
  daftarkanPenangan,
  enqueue,
  hapusItem,
  perbaruiItem,
  tulisUlangMenunggu,
  type ItemAntrean,
} from '../antrean';
import { buatUlid } from '../ulid';
import { PESAN_DISIMPAN_HP, cobaOnline, type HasilTulis } from './umum';
import {
  JENIS_TUGAS,
  LABEL_PRIORITAS_TUGAS,
  adaTertunda,
  cariPetaId,
  catatPascaBuat,
  catatPascaTampil,
  catatPetaId,
  eIdSementara,
  idSementaraBaru,
  itemTugas,
  kunciUrutan,
  metaTugas,
  tugasIdItem,
  type KomentarLokal,
  type MetaBuat,
  type MetaKomentar,
  type MetaStatus,
  type MetaUbah,
  type SnapshotBuat,
  type TampilBuat,
  type TampilTugas,
  type TujuanStatus,
} from './tugasBersama';

export { PESAN_DISIMPAN_HP };
export type { HasilTulis };

// ── Tampilan lokal dari isian ───────────────────────────────────────────────

export interface KonteksTampil {
  statuses?: { id: string; name: string; category: KategoriStatus }[];
  orang?: Orang[];
  labels?: LabelTugas[];
}

/** Nilai tugas saat ini (sebagian field cukup) untuk mencatat dasar deteksi bentrok. */
export interface SumberDasar {
  title?: string;
  description_text?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  priority?: { value: number };
  estimate_hours?: number | null;
  assignee_people?: { id: string }[];
  labels?: { id: string }[];
}

function ringkasKey(key: string): string {
  return key;
}

export function bangunTampil(body: BodyUbahTugas, ctx: KonteksTampil): TampilTugas {
  const t: TampilTugas = {};
  if (body.title !== undefined) {
    t.title = body.title;
  }
  if (body.priority !== undefined) {
    t.priority = { value: body.priority, label: LABEL_PRIORITAS_TUGAS[body.priority] ?? 'Tanpa' };
  }
  if (body.due_date !== undefined) {
    t.due_date = body.due_date;
  }
  if (body.start_date !== undefined) {
    t.start_date = body.start_date;
  }
  if (body.estimate_hours !== undefined) {
    t.estimate_hours = body.estimate_hours;
  }
  if (body.description !== undefined) {
    t.description_text = body.description;
  }
  if (body.assignee_ids !== undefined) {
    t.assignee_people = body.assignee_ids.map((id) => ctx.orang?.find((o) => o.id === id) ?? { id, name: 'Orang', avatar: null });
  }
  if (body.label_ids !== undefined) {
    t.labels = body.label_ids.map((id) => ctx.labels?.find((l) => l.id === id) ?? { id, name: 'Label', color: 'gray' });
  }
  return t;
}

export function tampilStatus(statusId: string, ctx: KonteksTampil): TampilTugas | null {
  const s = ctx.statuses?.find((x) => x.id === statusId);
  return s ? { status: { id: s.id, name: s.name, category: s.category, is_done: s.category === 'done' } } : null;
}

const FIELD_UBAH: Record<string, string> = {
  title: 'judul',
  description: 'deskripsi',
  due_date: 'tenggat',
  start_date: 'tanggal mulai',
  priority: 'prioritas',
  estimate_hours: 'estimasi',
  assignee_ids: 'penanggung jawab',
  label_ids: 'label',
};

function daftarField(body: Record<string, unknown>): string {
  return Object.keys(body)
    .map((k) => FIELD_UBAH[k])
    .filter((x): x is string => Boolean(x))
    .join(', ');
}

function ambilDasar(src: SumberDasar | undefined, body: BodyUbahTugas): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  if (!src) {
    return d;
  }
  if ('title' in body && src.title !== undefined) d.title = src.title;
  if ('description' in body && src.description_text !== undefined) d.description = src.description_text;
  if ('due_date' in body && src.due_date !== undefined) d.due_date = src.due_date;
  if ('start_date' in body && src.start_date !== undefined) d.start_date = src.start_date;
  if ('priority' in body && src.priority !== undefined) d.priority = src.priority.value;
  if ('estimate_hours' in body && src.estimate_hours !== undefined) d.estimate_hours = src.estimate_hours;
  if ('assignee_ids' in body && src.assignee_people !== undefined) d.assignee_ids = src.assignee_people.map((o) => o.id).sort();
  if ('label_ids' in body && src.labels !== undefined) d.label_ids = src.labels.map((l) => l.id).sort();
  return d;
}

// ── Ubah isian ──────────────────────────────────────────────────────────────

export interface RefTugas {
  id: string;
  key: string;
}

/**
 * Ubah isian tugas. Mengembalikan `{antre:false, nilai: detail segar}` bila
 * langsung ke server, atau `{antre:true}` bila disimpan di antrean (layar
 * memakai overlay dan menampilkan "Disimpan di HP").
 */
export async function tulisUbahTugas(ref: RefTugas, body: BodyUbahTugas, ctx: KonteksTampil & { sumber?: SumberDasar } = {}): Promise<HasilTulis<DetailTugasPenuh>> {
  if (!eIdSementara(ref.id) && !adaTertunda(ref.id)) {
    const hasil = await cobaOnline(() => apiRequest<{ task: DetailTugasPenuh }>(`tugas/${ref.id}`, { method: 'PATCH', json: body, cache: false }));
    if (hasil?.nilai?.task) {
      return { antre: false, nilai: hasil.nilai.task };
    }
    if (hasil) {
      throw new ApiError({ status: 500, message: 'Jawaban server kosong. Coba lagi.' });
    }
  }
  await antreUbah(ref, body, ctx);
  return { antre: true };
}

function gabungBodyBuat(json: BodyBuatTugas, body: BodyUbahTugas): BodyBuatTugas {
  return { ...json, ...body };
}

function gabungTampilBuat(lama: TampilBuat, tampil: TampilTugas): TampilBuat {
  return { ...lama, ...Object.fromEntries(Object.entries(tampil).filter(([, v]) => v !== undefined)) } as TampilBuat;
}

async function antreUbah(ref: RefTugas, body: BodyUbahTugas, ctx: KonteksTampil & { sumber?: SumberDasar }): Promise<void> {
  const tampil = bangunTampil(body, ctx);

  // Tugas sementara yang pembuatannya belum dikirim: lipat ke permintaan pembuatan.
  if (eIdSementara(ref.id)) {
    const buat = cariItem((i) => i.jenis === JENIS_TUGAS.buat && metaTugas(i).tmpId === ref.id && i.status !== 'mengirim')[0];
    if (buat) {
      const m = metaTugas(buat) as MetaBuat;
      const snapshot: SnapshotBuat = { ...m.snapshot, tampil: gabungTampilBuat(m.snapshot.tampil, tampil) };
      const json = gabungBodyBuat(buat.json as BodyBuatTugas, body);
      if (await perbaruiItem(buat.id, { json, label: `Tugas baru: ${snapshot.tampil.title}`, meta: { ...m, snapshot } })) {
        return;
      }
    }
  }

  // Gabung ke PATCH yang masih menunggu untuk tugas yang sama.
  const menunggu = cariItem((i) => i.jenis === JENIS_TUGAS.ubah && tugasIdItem(i) === ref.id && i.status === 'menunggu').at(-1);
  if (menunggu) {
    const m = metaTugas(menunggu) as MetaUbah;
    const json = { ...(menunggu.json as BodyUbahTugas), ...body };
    const dasar = { ...ambilDasar(ctx.sumber, body), ...m.dasar }; // dasar pertama menang
    const ok = await perbaruiItem(menunggu.id, {
      json,
      label: `Ubah ${ringkasKey(ref.key)}`,
      ringkas: daftarField(json as Record<string, unknown>),
      meta: { ...m, tampil: { ...m.tampil, ...tampil }, dasar },
    });
    if (ok) {
      return;
    }
  }

  const meta: MetaUbah = { tugasId: ref.id, key: ref.key, tampil, dasar: ambilDasar(ctx.sumber, body) };
  await enqueue({
    jenis: JENIS_TUGAS.ubah,
    label: `Ubah ${ringkasKey(ref.key)}`,
    ringkas: daftarField(body as Record<string, unknown>),
    method: 'PATCH',
    path: `tugas/${ref.id}`,
    json: body,
    urutanKunci: kunciUrutan(ref.id),
    meta: meta as unknown as Record<string, unknown>,
  });
}

// ── Pindah status ───────────────────────────────────────────────────────────

export async function tulisPindahStatus(
  ref: RefTugas,
  tujuan: TujuanStatus,
  ctx: KonteksTampil & { statusSekarangId?: string | null; jenisWorkspace?: RefWorkspace['type'] } = {},
): Promise<HasilTulis<{ status: { id: string; name: string; category: KategoriStatus; is_done: boolean } }>> {
  if (!eIdSementara(ref.id) && !adaTertunda(ref.id)) {
    const hasil = await cobaOnline(() =>
      apiRequest<{ task: { status: { id: string; name: string; category: KategoriStatus; is_done: boolean } } }>(`tugas/${ref.id}/status`, { method: 'PATCH', json: tujuan, cache: false }),
    );
    if (hasil?.nilai?.task) {
      return { antre: false, nilai: hasil.nilai.task };
    }
    if (hasil) {
      throw new ApiError({ status: 500, message: 'Jawaban server kosong. Coba lagi.' });
    }
  }
  await antreStatus(ref, tujuan, ctx);
  return { antre: true };
}

/** Kolom perkiraan untuk "tandai selesai": pribadi → Selesai, tim → Review (aturan server). */
function perkiraanSelesai(ctx: KonteksTampil & { jenisWorkspace?: RefWorkspace['type'] }): TampilTugas['status'] | undefined {
  const kat: KategoriStatus = ctx.jenisWorkspace === 'personal' || ctx.jenisWorkspace === undefined ? 'done' : 'review';
  const s = ctx.statuses?.find((x) => x.category === kat);
  if (s) {
    return { id: s.id, name: s.name, category: s.category, is_done: s.category === 'done' };
  }
  return { id: '', name: kat === 'done' ? 'Selesai' : 'Review', category: kat, is_done: kat === 'done' };
}

async function antreStatus(ref: RefTugas, tujuan: TujuanStatus, ctx: KonteksTampil & { statusSekarangId?: string | null; jenisWorkspace?: RefWorkspace['type'] }): Promise<void> {
  let status: TampilTugas['status'] | undefined;
  if ('status_id' in tujuan) {
    status = tampilStatus(tujuan.status_id, ctx)?.status;
  } else if (tujuan.done) {
    status = perkiraanSelesai(ctx);
  } else {
    const kat: KategoriStatus = 'todo';
    const s = ctx.statuses?.find((x) => x.category === kat);
    status = s ? { id: s.id, name: s.name, category: s.category, is_done: false } : { id: '', name: 'Todo', category: kat, is_done: false };
  }
  const tampil: TampilTugas = status ? { status } : {};

  // Pembuatan belum terkirim dan kolomnya diketahui: lipat sebagai status awal.
  if (eIdSementara(ref.id) && status && status.id !== '') {
    const buat = cariItem((i) => i.jenis === JENIS_TUGAS.buat && metaTugas(i).tmpId === ref.id && i.status !== 'mengirim')[0];
    if (buat) {
      const m = metaTugas(buat) as MetaBuat;
      const snapshot: SnapshotBuat = { ...m.snapshot, tampil: gabungTampilBuat(m.snapshot.tampil, tampil) };
      const json = { ...(buat.json as BodyBuatTugas), status_id: status.id };
      if (await perbaruiItem(buat.id, { json, meta: { ...m, snapshot } })) {
        return;
      }
    }
  }

  const label = status ? `Pindah ${ref.key} → ${status.name}` : `Pindah status ${ref.key}`;
  const meta: MetaStatus = { tugasId: ref.id, key: ref.key, tampil, dasarStatusId: ctx.statusSekarangId ?? null, tujuan };
  await enqueue({
    jenis: JENIS_TUGAS.status,
    label,
    method: 'PATCH',
    path: `tugas/${ref.id}/status`,
    json: tujuan,
    urutanKunci: kunciUrutan(ref.id),
    dedupeKunci: `tugas:${ref.id}:status`,
    meta: meta as unknown as Record<string, unknown>,
  });
}

// ── Komentar ────────────────────────────────────────────────────────────────

export async function tulisKomentar(ref: RefTugas, body: BodyKomentar, penulis: Orang | null): Promise<HasilTulis<KomentarTugas>> {
  const ulid = buatUlid();
  if (!eIdSementara(ref.id) && !adaTertunda(ref.id)) {
    // Kunci idempotensi yang sama dipakai bila kirim langsung gagal di tengah jalan lalu diantrekan.
    const hasil = await cobaOnline(() => apiRequest<{ comment: KomentarTugas }>(`tugas/${ref.id}/komentar`, { method: 'POST', json: body, idempotencyKey: ulid, cache: false }));
    if (hasil?.nilai?.comment) {
      return { antre: false, nilai: hasil.nilai.comment };
    }
    if (hasil) {
      throw new ApiError({ status: 500, message: 'Jawaban server kosong. Coba lagi.' });
    }
  }
  const komentar: KomentarLokal = { clientId: ulid, tugasId: ref.id, teks: body.body, dibuat: new Date().toISOString(), penulis };
  const meta: MetaKomentar = { tugasId: ref.id, key: ref.key, komentar };
  await enqueue({
    jenis: JENIS_TUGAS.komentar,
    label: `Komentar di ${ref.key}`,
    ringkas: body.body.length > 90 ? `${body.body.slice(0, 89)}…` : body.body,
    method: 'POST',
    path: `tugas/${ref.id}/komentar`,
    json: body,
    clientId: ulid,
    urutanKunci: kunciUrutan(ref.id),
    meta: meta as unknown as Record<string, unknown>,
  });
  return { antre: true };
}

// ── Buat tugas ──────────────────────────────────────────────────────────────

export interface KonteksBuat {
  workspace: RefWorkspace;
  statuses: { id: string; name: string; category: KategoriStatus; color: string }[];
  labels: LabelTugas[];
  orang: Orang[];
  creator: Orang | null;
  checklist: string[];
}

export interface HasilBuat {
  id: string;
  key: string;
  title: string;
  /** `true` = masih di antrean (id sementara). */
  antre: boolean;
}

function snapshotBuat(body: BodyBuatTugas, k: KonteksBuat): SnapshotBuat {
  const statusId = body.status_id ?? (k.statuses.find((s) => s.category === 'todo') ?? k.statuses[0])?.id ?? '';
  const st = k.statuses.find((s) => s.id === statusId);
  const prioritas = body.priority ?? 3;
  return {
    workspace: k.workspace,
    creator: k.creator,
    statuses: k.statuses.map((s, i) => ({ id: s.id, name: s.name, category: s.category, color: s.color, position: String(i) })),
    workspace_labels: k.labels,
    parent_id: body.parent_id ?? null,
    checklist: k.checklist,
    tampil: {
      title: body.title,
      priority: { value: prioritas, label: LABEL_PRIORITAS_TUGAS[prioritas] ?? 'Sedang' },
      due_date: body.due_date ?? null,
      start_date: body.start_date ?? null,
      estimate_hours: body.estimate_hours ?? null,
      description_text: body.description ?? null,
      assignee_people: (body.assignee_ids ?? []).map((id) => k.orang.find((o) => o.id === id) ?? { id, name: 'Orang', avatar: null }),
      labels: (body.label_ids ?? []).map((id) => k.labels.find((l) => l.id === id) ?? { id, name: 'Label', color: 'gray' }),
      status: st ? { id: st.id, name: st.name, category: st.category, is_done: st.category === 'done' } : { id: '', name: 'Todo', category: 'todo', is_done: false },
    },
  };
}

/**
 * Buat tugas: langsung ke server bila online; offline → antrean dengan id
 * sementara. Kunci idempotensi sama di kedua jalur, jadi permintaan yang
 * sempat sampai tetapi jawabannya hilang tidak berujung tugas ganda.
 */
export async function tulisBuatTugas(body: BodyBuatTugas, k: KonteksBuat): Promise<HasilBuat> {
  const { tmpId, ulid } = idSementaraBaru();
  const hasil = await cobaOnline(() => apiRequest<{ task: DetailTugasPenuh }>('tugas', { method: 'POST', json: body, idempotencyKey: ulid, cache: false }));
  if (hasil) {
    const tugas = hasil.nilai?.task;
    if (!tugas) {
      throw new ApiError({ status: 500, message: 'Jawaban server kosong. Coba lagi.' });
    }
    for (const butir of k.checklist) {
      try {
        await apiRequest(`tugas/${tugas.id}/checklist`, { method: 'POST', json: { title: butir }, cache: false });
      } catch {
        // Checklist awal bersifat pelengkap; sisanya bisa ditambah dari detail.
      }
    }
    return { id: tugas.id, key: tugas.key, title: tugas.title, antre: false };
  }

  const snapshot = snapshotBuat(body, k);
  const meta: MetaBuat = { tmpId, workspaceId: body.workspace_id, snapshot };
  await enqueue({
    jenis: JENIS_TUGAS.buat,
    label: `Tugas baru: ${body.title}`,
    ringkas: k.workspace.type === 'personal' ? 'Pribadi' : k.workspace.name,
    method: 'POST',
    path: 'tugas',
    json: body,
    clientId: ulid,
    urutanKunci: `tugas:${tmpId}`,
    meta: meta as unknown as Record<string, unknown>,
  });
  for (const butir of k.checklist) {
    await enqueue({
      jenis: JENIS_TUGAS.checklist,
      label: `Checklist awal: ${butir}`,
      method: 'POST',
      path: `tugas/${tmpId}/checklist`,
      json: { title: butir },
      urutanKunci: `tugas:${tmpId}`,
      meta: { tugasId: tmpId, key: `${k.workspace.key}-…` },
    });
  }
  return { id: tmpId, key: `${k.workspace.key}-…`, title: body.title, antre: true };
}

// ── Kelola perubahan yang gagal ─────────────────────────────────────────────

/** Item antrean tugas ini yang `konflik`/`gagal`. */
export function itemBermasalah(id: string): ItemAntrean[] {
  return itemTugas(id).filter((i) => i.status === 'konflik' || i.status === 'gagal');
}

/** Kirim ulang item bermasalah (urut): mengosongkan penahan agar sisanya jalan. */
export async function kirimUlangTugas(id: string): Promise<void> {
  for (const i of itemBermasalah(id)) {
    await cobaLagi(i.id);
  }
}

/** Buang semua perubahan lokal tugas ini (kembali ke data server). */
export async function buangPerubahanTugas(id: string): Promise<void> {
  const daftar = itemTugas(id)
    .filter((i) => i.status !== 'mengirim')
    .sort((a, b) => b.seq - a.seq);
  for (const i of daftar) {
    await hapusItem(i.id);
  }
}

// ── Pemeriksaan bentrok sebelum kirim ───────────────────────────────────────

function norm(kunci: string, v: unknown): string {
  if (v === null || v === undefined) {
    return '';
  }
  if (Array.isArray(v)) {
    return JSON.stringify([...v].map(String).sort());
  }
  if (kunci === 'estimate_hours') {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : '';
  }
  return typeof v === 'string' ? v.trim() : String(v);
}

function nilaiServer(s: DetailTugasPenuh, kunci: string): unknown {
  switch (kunci) {
    case 'title':
      return s.title;
    case 'description':
      return s.description_text;
    case 'due_date':
      return s.due_date;
    case 'start_date':
      return s.start_date;
    case 'priority':
      return s.priority.value;
    case 'estimate_hours':
      return s.estimate_hours;
    case 'assignee_ids':
      return s.assignee_people.map((o) => o.id);
    case 'label_ids':
      return s.labels.map((l) => l.id);
    default:
      return undefined;
  }
}

async function ambilServer(id: string): Promise<DetailTugasPenuh> {
  const h = await apiRequest<{ task: DetailTugasPenuh }>(`tugas/${id}`, { cache: false });
  if (!h?.task) {
    throw new ApiError({ status: 500, message: 'Jawaban server kosong.' });
  }
  return h.task;
}

function bentrok(pesan: string): ApiError {
  return new ApiError({ status: 409, code: 'berubah_di_server', message: pesan });
}

/** Menimpa hanya bila pengguna menekan "Coba lagi" pada item `konflik` (kunci idempotensi diganti). */
function sengajaMenimpa(item: ItemAntrean): boolean {
  return item.kunciIdem !== item.id;
}

async function periksaBentrokUbah(item: ItemAntrean, id: string): Promise<void> {
  const m = metaTugas(item) as MetaUbah;
  const dasar = m.dasar ?? {};
  if (Object.keys(dasar).length === 0 || sengajaMenimpa(item)) {
    return;
  }
  const server = await ambilServer(id);
  const baru = (item.json ?? {}) as Record<string, unknown>;
  const berubah: string[] = [];
  for (const kunci of Object.keys(dasar)) {
    const sv = norm(kunci, nilaiServer(server, kunci));
    if (sv !== norm(kunci, dasar[kunci]) && sv !== norm(kunci, baru[kunci])) {
      berubah.push(FIELD_UBAH[kunci] ?? kunci);
    }
  }
  if (berubah.length > 0) {
    throw bentrok(`${server.key}: ${berubah.join(', ')} sudah diubah orang lain di server setelah Anda mengubahnya di HP. "Coba lagi" menimpa dengan perubahan HP; "Hapus" membuang perubahan HP.`);
  }
}

async function periksaBentrokStatus(item: ItemAntrean, id: string): Promise<void> {
  const m = metaTugas(item) as MetaStatus;
  if (!m.dasarStatusId || sengajaMenimpa(item)) {
    return;
  }
  const server = await ambilServer(id);
  const tujuan = m.tujuan;
  const sudahSama = 'status_id' in tujuan ? server.status_id === tujuan.status_id : tujuan.done ? server.status.is_done || server.status.category === 'review' : false;
  if (server.status_id !== m.dasarStatusId && !sudahSama) {
    throw bentrok(`${server.key}: status sudah dipindah orang lain ke “${server.status.name}” setelah Anda mengubahnya di HP. "Coba lagi" menimpa; "Hapus" membuang perubahan HP.`);
  }
}

// ── Penangan antrean ────────────────────────────────────────────────────────

async function idUntukKirim(item: ItemAntrean): Promise<{ id: string; path: string }> {
  const tugasId = tugasIdItem(item);
  if (tugasId && eIdSementara(tugasId)) {
    const real = await cariPetaId(tugasId);
    if (!real) {
      throw new ApiError({ status: 404, code: 'tugas_sementara', message: 'Tugas baru ini belum dibuat di server atau sudah dibuang. Hapus perubahan ini lalu ulangi.' });
    }
    return { id: real, path: item.path.split(tugasId).join(real) };
  }
  return { id: tugasId ?? '', path: item.path };
}

function bersihkanBuat(json: BodyBuatTugas): Record<string, unknown> {
  const hasil: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json)) {
    if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) {
      continue;
    }
    hasil[k] = v;
  }
  return hasil;
}

function bukaTugas(item: ItemAntrean): void {
  const id = tugasIdItem(item);
  if (id) {
    router.push(`/tugas/${id}` as never);
  }
}

let terdaftar = false;

export function daftarkanPenanganTugas(): void {
  if (terdaftar) {
    return;
  }
  terdaftar = true;

  daftarkanPenangan(JENIS_TUGAS.buat, {
    bangunPermintaan: (item) => ({ json: bersihkanBuat(item.json as BodyBuatTugas) }),
    sesudahSukses: async (item, respons) => {
      const m = metaTugas(item) as MetaBuat;
      const tugas = (respons as { task?: DetailTugasPenuh } | null)?.task;
      if (!tugas?.id) {
        return;
      }
      await tulisUlangMenunggu(
        (i) => tugasIdItem(i) === m.tmpId && i.id !== item.id,
        (i) => {
          const meta = { ...i.meta, tugasId: tugas.id, key: tugas.key } as Record<string, unknown>;
          const kom = meta.komentar as KomentarLokal | undefined;
          if (kom) {
            meta.komentar = { ...kom, tugasId: tugas.id };
          }
          return { path: i.path.split(m.tmpId).join(tugas.id), meta };
        },
      );
      // Peta id terakhir: layar yang menampilkan id sementara baru berpindah ke id asli setelah item di belakangnya ditulis ulang.
      await catatPetaId(m.tmpId, tugas.id);
      catatPascaBuat(m.tmpId, tugas.id, m);
    },
    sesudahDibuang: async (item) => {
      const m = metaTugas(item) as MetaBuat;
      for (const i of itemTugas(m.tmpId)) {
        if (i.id !== item.id && i.status !== 'mengirim') {
          await hapusItem(i.id);
        }
      }
    },
    ubah: bukaTugas,
  });

  daftarkanPenangan(JENIS_TUGAS.ubah, {
    bangunPermintaan: async (item) => {
      const { id, path } = await idUntukKirim(item);
      await periksaBentrokUbah(item, id);
      return { path };
    },
    sesudahSukses: (item) => {
      const m = metaTugas(item) as MetaUbah;
      const id = tugasIdItem(item);
      if (id) {
        catatPascaTampil(id, m.tampil);
      }
    },
    ubah: bukaTugas,
  });

  daftarkanPenangan(JENIS_TUGAS.status, {
    bangunPermintaan: async (item) => {
      const { id, path } = await idUntukKirim(item);
      await periksaBentrokStatus(item, id);
      return { path };
    },
    sesudahSukses: (item) => {
      const m = metaTugas(item) as MetaStatus;
      const id = tugasIdItem(item);
      if (id) {
        catatPascaTampil(id, m.tampil);
      }
    },
    ubah: bukaTugas,
  });

  daftarkanPenangan(JENIS_TUGAS.komentar, {
    bangunPermintaan: async (item) => ({ path: (await idUntukKirim(item)).path }),
    ubah: bukaTugas,
  });

  daftarkanPenangan(JENIS_TUGAS.checklist, {
    bangunPermintaan: async (item) => ({ path: (await idUntukKirim(item)).path }),
    ubah: bukaTugas,
  });
}

// Daftar saat modul dimuat (`penanganFitur.ts` mengimpor modul ini saat aplikasi dibuka).
daftarkanPenanganTugas();
