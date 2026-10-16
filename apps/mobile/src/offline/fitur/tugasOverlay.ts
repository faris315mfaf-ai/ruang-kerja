/**
 * Overlay lokal TUGAS: perubahan yang masih menunggu di antrean (buat tugas,
 * ubah isian, pindah status, komentar) diterapkan di atas data yang dimuat
 * layar — daftar "Tugas saya", papan/list workspace, dan detail — sehingga
 * hasilnya langsung terlihat dengan chip "Menunggu sinkron".
 *
 * Overlay DITURUNKAN dari antrean (yang tersimpan di basis data terenkripsi),
 * jadi selamat dari proses yang dimatikan dan otomatis hilang saat item
 * terkirim/dibuang — tanpa penyimpanan tambahan yang bisa tidak sinkron.
 */
import { useMemo } from 'react';

import type { BarisTugas, DetailTugasPenuh, KategoriStatus, KelompokTenggat, KomentarTugas, Orang } from '@/api/tugas';
import type { KartuWorkspace, PapanData } from '@/api/workspace';

import { useAntrean, type ItemAntrean } from '../antrean';
import type { StatusSinkronUi } from '../ChipMenunggu';
import { useStore } from '../store';
import {
  JENIS_TUGAS,
  metaTugas,
  pascaStore,
  type KomentarLokal,
  type MetaBuat,
  type PascaSukses,
  type TampilTugas,
} from './tugasBersama';

export const AWALAN_KOMENTAR_LOKAL = 'lokal_';

export interface EntriTugas {
  tampil: TampilTugas;
  /** null = hanya sisa transisi (sudah diterima server). */
  sinkron: StatusSinkronUi | null;
  komentar: KomentarLokal[];
  pesanGagal: string | null;
  /** Ada komentar yang menunggu/gagal (terpisah dari status perubahan isian). */
  komentarSinkron: StatusSinkronUi | null;
}

export interface ItemBuat {
  tmpId: string;
  meta: MetaBuat;
  sinkron: StatusSinkronUi | null;
  pesanGagal: string | null;
  dibuat: string;
  realId: string | null;
}

export interface OverlayTugas {
  buat: ItemBuat[];
  per: Record<string, EntriTugas>;
  ada: boolean;
}

const KOSONG: OverlayTugas = { buat: [], per: {}, ada: false };
let memoItems: readonly ItemAntrean[] | null = null;
let memoPasca: PascaSukses | null = null;
let memoHasil: OverlayTugas = KOSONG;

export function hitungOverlay(items: readonly ItemAntrean[], pasca: PascaSukses): OverlayTugas {
  if (items === memoItems && pasca === memoPasca) {
    return memoHasil;
  }
  const per: Record<string, EntriTugas> = {};
  const buat: ItemBuat[] = [];
  const entri = (id: string): EntriTugas => {
    let e = per[id];
    if (!e) {
      e = { tampil: {}, sinkron: null, komentar: [], pesanGagal: null, komentarSinkron: null };
      per[id] = e;
    }
    return e;
  };
  for (const [id, tampil] of Object.entries(pasca.tampil)) {
    entri(id).tampil = { ...tampil };
  }
  for (const item of items) {
    if (!item.jenis.startsWith('tugas.')) {
      continue;
    }
    const m = metaTugas(item);
    const bermasalah = item.status === 'konflik' || item.status === 'gagal';
    const sink: StatusSinkronUi = bermasalah ? 'gagal' : 'menunggu';
    if (item.jenis === JENIS_TUGAS.buat) {
      if (m.tmpId && m.snapshot) {
        buat.push({ tmpId: m.tmpId, meta: m as MetaBuat, sinkron: sink, pesanGagal: bermasalah ? (item.galat?.pesan ?? null) : null, dibuat: item.dibuatPada, realId: null });
      }
      continue;
    }
    const id = m.tugasId;
    if (!id) {
      continue;
    }
    const e = entri(id);
    if (item.jenis === JENIS_TUGAS.ubah || item.jenis === JENIS_TUGAS.status) {
      e.tampil = { ...e.tampil, ...(m.tampil ?? {}) };
    } else if (item.jenis === JENIS_TUGAS.komentar && m.komentar) {
      e.komentar = [...e.komentar, m.komentar];
      e.komentarSinkron = bermasalah ? 'gagal' : e.komentarSinkron === 'gagal' ? 'gagal' : 'menunggu';
    }
    if (bermasalah) {
      e.sinkron = 'gagal';
      e.pesanGagal = item.galat?.pesan ?? e.pesanGagal;
    } else if (e.sinkron !== 'gagal') {
      e.sinkron = 'menunggu';
    }
  }
  for (const [tmpId, v] of Object.entries(pasca.buat)) {
    if (!buat.some((b) => b.tmpId === tmpId)) {
      buat.push({ tmpId, meta: v.meta, sinkron: null, pesanGagal: null, dibuat: '', realId: v.realId });
    }
  }
  const ada = buat.length > 0 || Object.keys(per).length > 0;
  memoItems = items;
  memoPasca = pasca;
  memoHasil = ada ? { buat, per, ada } : KOSONG;
  return memoHasil;
}

/** Hook: overlay seluruh tugas (referensi stabil selama antrean tak berubah). */
export function useOverlayTugas(): OverlayTugas {
  const items = useAntrean((s) => s.items);
  const pasca = useStore(pascaStore, (s) => s);
  return useMemo(() => hitungOverlay(items, pasca), [items, pasca]);
}

// ── Tenggat / pengelompokan ──────────────────────────────────────────────────

function ke0(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function akhirPekanIso(iso: string): string {
  const t = new Date(ke0(iso));
  const idx = (t.getUTCDay() + 6) % 7; // 0 = Senin
  const u = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + (6 - idx)));
  return `${u.getUTCFullYear()}-${String(u.getUTCMonth() + 1).padStart(2, '0')}-${String(u.getUTCDate()).padStart(2, '0')}`;
}

export function hitungGrup(due: string | null, status: { is_done: boolean; category: KategoriStatus }, hariIni: string): { group: KelompokTenggat; days_late: number } {
  if (status.is_done || status.category === 'done' || status.category === 'canceled') {
    return { group: 'selesai', days_late: 0 };
  }
  if (!due) {
    return { group: 'tanpa-tenggat', days_late: 0 };
  }
  if (due < hariIni) {
    return { group: 'terlambat', days_late: Math.max(1, Math.round((ke0(hariIni) - ke0(due)) / 86_400_000)) };
  }
  if (due === hariIni) {
    return { group: 'hari-ini', days_late: 0 };
  }
  return { group: due <= akhirPekanIso(hariIni) ? 'minggu-ini' : 'nanti', days_late: 0 };
}

const namaOrang = (daftar: Orang[]): string[] => daftar.map((o) => o.name);

// ── "Tugas saya" ────────────────────────────────────────────────────────────

export function terapkanBaris(b: BarisTugas, e: EntriTugas | undefined, hariIni: string): BarisTugas & { sinkron?: StatusSinkronUi } {
  if (!e) {
    return b;
  }
  const t = e.tampil;
  const status = t.status && t.status.id !== '' ? { id: t.status.id, name: t.status.name, category: t.status.category, is_done: t.status.is_done } : t.status ? { ...b.status, name: t.status.name, category: t.status.category, is_done: t.status.is_done } : b.status;
  const due = t.due_date !== undefined ? t.due_date : b.due_date;
  const grup = hitungGrup(due, status, hariIni);
  return {
    ...b,
    title: t.title ?? b.title,
    priority: t.priority ?? b.priority,
    due_date: due,
    start_date: t.start_date !== undefined ? t.start_date : b.start_date,
    status,
    assignee_people: t.assignee_people ?? b.assignee_people,
    assignees: t.assignee_people ? namaOrang(t.assignee_people) : b.assignees,
    labels: t.labels ?? b.labels,
    group: grup.group,
    days_late: grup.days_late,
    ...(e.sinkron ? { sinkron: e.sinkron } : {}),
  };
}

export function barisDariBuat(b: ItemBuat, hariIni: string): BarisTugas & { sinkron?: StatusSinkronUi } {
  const sn = b.meta.snapshot;
  const t = sn.tampil;
  const grup = hitungGrup(t.due_date, t.status, hariIni);
  return {
    id: b.tmpId,
    key: `${sn.workspace.key}-…`,
    number: 0,
    title: t.title,
    workspace: sn.workspace,
    status: { ...t.status },
    priority: t.priority,
    due_date: t.due_date,
    start_date: t.start_date,
    completed_at: null,
    assignees: namaOrang(t.assignee_people),
    assignee_people: t.assignee_people,
    labels: t.labels,
    checklist: sn.checklist.length > 0 ? { done: 0, total: sn.checklist.length } : null,
    days_late: grup.days_late,
    group: grup.group,
    plan: { bucket: null, lane: 'later' },
    source: 'manual',
    ...(b.sinkron ? { sinkron: b.sinkron } : {}),
  };
}

/**
 * Terapkan overlay ke daftar "Tugas saya". Tugas yang baru dibuat di HP ikut
 * tampil bila `sertakanBuat` (daftar tanpa filter) dan ia memenuhi lingkup.
 */
export function terapkanDaftarBaris(
  tasks: BarisTugas[],
  ov: OverlayTugas,
  opsi: { hariIni: string; sertakanBuat: boolean; idSaya: string | null; lingkup: 'ditugaskan' | 'saya-amati' | 'saya-buat'; tampilSelesai: boolean },
): (BarisTugas & { sinkron?: StatusSinkronUi })[] {
  if (!ov.ada) {
    return tasks;
  }
  const ada = new Set(tasks.map((t) => t.id));
  const hasil: (BarisTugas & { sinkron?: StatusSinkronUi })[] = tasks.map((t) => terapkanBaris(t, ov.per[t.id], opsi.hariIni));
  if (opsi.sertakanBuat) {
    for (const b of ov.buat) {
      if (b.realId && ada.has(b.realId)) {
        continue;
      }
      const baris = barisDariBuat(b, opsi.hariIni);
      const milikSaya = baris.assignee_people.some((o) => o.id === opsi.idSaya);
      const cocok = opsi.lingkup === 'ditugaskan' ? milikSaya : true;
      if (cocok && (opsi.tampilSelesai || !baris.status.is_done)) {
        hasil.unshift(baris);
      }
    }
  }
  return hasil.filter((t) => (opsi.tampilSelesai ? true : !(t.status.is_done && ov.per[t.id]?.tampil.status)));
}

// ── Papan / daftar workspace ────────────────────────────────────────────────

export function terapkanKartu(k: KartuWorkspace, e: EntriTugas | undefined): KartuWorkspace {
  if (!e) {
    return k;
  }
  const t = e.tampil;
  const hasil: KartuWorkspace = { ...k };
  if (t.title !== undefined) hasil.title = t.title;
  if (t.priority) hasil.priority = t.priority.value;
  if (t.due_date !== undefined) hasil.due_date = t.due_date;
  if (t.start_date !== undefined) hasil.start_date = t.start_date;
  if (t.estimate_hours !== undefined) hasil.estimate_hours = t.estimate_hours;
  if (t.description_text !== undefined) hasil.description_text = t.description_text;
  if (t.assignee_people) {
    hasil.assignee_ids = t.assignee_people.map((o) => o.id);
    hasil.assignees = t.assignee_people.map((o) => ({ id: o.id, nama: o.name }));
  }
  if (t.labels) hasil.label_ids = t.labels.map((l) => l.id);
  if (t.status) {
    hasil.status_category = t.status.category;
    if (t.status.id !== '') {
      hasil.status_id = t.status.id;
      hasil.status = { id: t.status.id, name: t.status.name, kategori: t.status.category, color: k.status?.color ?? 'gray' };
    }
  }
  if (e.sinkron) hasil.sinkron = e.sinkron;
  return hasil;
}

export function kartuDariBuat(b: ItemBuat): KartuWorkspace {
  const sn = b.meta.snapshot;
  const t = sn.tampil;
  return {
    id: b.tmpId,
    workspace_id: b.meta.workspaceId,
    number: 0,
    key: `${sn.workspace.key}-…`,
    title: t.title,
    description_text: t.description_text,
    status_id: t.status.id,
    status_category: t.status.category,
    priority: t.priority.value,
    position: 0,
    start_date: t.start_date,
    due_date: t.due_date,
    estimate_hours: t.estimate_hours,
    parent_id: sn.parent_id,
    parent_key: null,
    assignee_ids: t.assignee_people.map((o) => o.id),
    assignees: t.assignee_people.map((o) => ({ id: o.id, nama: o.name })),
    label_ids: t.labels.map((l) => l.id),
    checklist: sn.checklist.length > 0 ? { done: 0, total: sn.checklist.length } : null,
    created_by: sn.creator?.id ?? '',
    created_at: b.dibuat || null,
    completed_at: null,
    comments: { count: 0, unread: false },
    ...(b.sinkron ? { sinkron: b.sinkron } : {}),
  };
}

type KolomRef = { id: string; kategori: KategoriStatus };

function kolomUntuk<K extends KolomRef>(kolom: K[], status: { id: string; category: KategoriStatus }): K | undefined {
  return (status.id !== '' ? kolom.find((c) => c.id === status.id) : undefined) ?? kolom.find((c) => c.kategori === status.category) ?? kolom.find((c) => c.kategori === 'todo') ?? kolom[0];
}

export function terapkanPapan(data: PapanData, ov: OverlayTugas, wsId: string): PapanData {
  const buat = ov.buat.filter((b) => b.meta.workspaceId === wsId);
  const adaDiPapan = data.columns.some((c) => c.tasks.some((t) => ov.per[t.id]));
  if (!adaDiPapan && buat.length === 0) {
    return data;
  }
  const masuk: Record<string, KartuWorkspace[]> = {};
  const kolomSisa = data.columns.map((c) => {
    const tasks = c.tasks.flatMap((t) => {
      const e = ov.per[t.id];
      if (!e) {
        return [t];
      }
      const baru = terapkanKartu(t, e);
      const target = e.tampil.status ? kolomUntuk(data.columns, e.tampil.status) : undefined;
      if (target && target.id !== c.id) {
        (masuk[target.id] ??= []).push(baru);
        return [];
      }
      return [baru];
    });
    return { ...c, tasks };
  });
  const semuaId = new Set(data.columns.flatMap((c) => c.tasks.map((t) => t.id)));
  for (const b of buat) {
    if (b.realId && semuaId.has(b.realId)) {
      continue;
    }
    const target = kolomUntuk(data.columns, b.meta.snapshot.tampil.status);
    if (target) {
      (masuk[target.id] ??= []).push(kartuDariBuat(b));
    }
  }
  return { ...data, columns: kolomSisa.map((c) => ({ ...c, tasks: [...(masuk[c.id] ?? []), ...c.tasks] })) };
}

/** List workspace: tugas bertanda + (bila tanpa filter) tugas baru dari HP. */
export function terapkanDaftarKartu(tugas: KartuWorkspace[], ov: OverlayTugas, wsId: string, sertakanBuat: boolean): KartuWorkspace[] {
  if (!ov.ada) {
    return tugas;
  }
  const hasil = tugas.map((t) => terapkanKartu(t, ov.per[t.id]));
  if (sertakanBuat) {
    const ada = new Set(tugas.map((t) => t.id));
    for (const b of ov.buat) {
      if (b.meta.workspaceId === wsId && !(b.realId && ada.has(b.realId))) {
        hasil.unshift(kartuDariBuat(b));
      }
    }
  }
  return hasil;
}

// ── Detail ──────────────────────────────────────────────────────────────────

export function komentarLokalKeTugas(k: KomentarLokal, sinkron: StatusSinkronUi): KomentarTugas & { sinkron: StatusSinkronUi } {
  return {
    kind: 'comment',
    id: `${AWALAN_KOMENTAR_LOKAL}${k.clientId}`,
    task_id: k.tugasId,
    author: k.penulis,
    body: null,
    body_text: k.teks,
    body_html: null,
    created_at: k.dibuat,
    edited_at: null,
    deleted: false,
    reactions: [],
    attachments: [],
    mine: true,
    my_reactions: [],
    can: { edit: false, delete: false, react: false },
    sinkron,
  };
}

export function terapkanDetail(t: DetailTugasPenuh, e: EntriTugas | undefined): DetailTugasPenuh {
  if (!e) {
    return t;
  }
  const p = e.tampil;
  const status = p.status ? (p.status.id !== '' ? p.status : { ...t.status, name: p.status.name, category: p.status.category, is_done: p.status.is_done }) : undefined;
  return {
    ...t,
    title: p.title ?? t.title,
    priority: p.priority ?? t.priority,
    due_date: p.due_date !== undefined ? p.due_date : t.due_date,
    start_date: p.start_date !== undefined ? p.start_date : t.start_date,
    estimate_hours: p.estimate_hours !== undefined ? p.estimate_hours : t.estimate_hours,
    description_text: p.description_text !== undefined ? p.description_text : t.description_text,
    description_html: p.description_text !== undefined ? null : t.description_html,
    description_plain: p.description_text !== undefined ? true : t.description_plain,
    assignee_people: p.assignee_people ?? t.assignee_people,
    assignees: p.assignee_people ? namaOrang(p.assignee_people) : t.assignees,
    labels: p.labels ?? t.labels,
    status: status ? { id: status.id, name: status.name, category: status.category, is_done: status.is_done } : t.status,
    status_id: status && status.id !== '' ? status.id : t.status_id,
    comments: { ...t.comments, count: t.comments.count + e.komentar.length },
  };
}

export function detailDariBuat(b: ItemBuat, e: EntriTugas | undefined): DetailTugasPenuh {
  const sn = b.meta.snapshot;
  const dasar = { ...sn.tampil };
  const t: TampilTugas = { ...dasar, ...(e?.tampil ?? {}) };
  const status = t.status ?? dasar.status;
  const assignee = t.assignee_people ?? dasar.assignee_people;
  const kunci = `${sn.workspace.key}-…`;
  const terkunciOnline = 'Butuh koneksi — tersedia setelah tugas ini terkirim.';
  return {
    id: b.tmpId,
    key: kunci,
    number: 0,
    title: t.title ?? dasar.title,
    url: '',
    workspace: { ...sn.workspace, archived: false },
    status: { id: status.id, name: status.name, category: status.category, is_done: status.is_done },
    status_id: status.id,
    statuses: sn.statuses,
    priority: t.priority ?? dasar.priority,
    due_date: t.due_date !== undefined ? t.due_date : dasar.due_date,
    start_date: t.start_date !== undefined ? t.start_date : dasar.start_date,
    estimate_hours: t.estimate_hours !== undefined ? t.estimate_hours : dasar.estimate_hours,
    created_at: b.dibuat || null,
    started_at: null,
    completed_at: null,
    updated_at: null,
    source: 'manual',
    creator: sn.creator,
    parent: null,
    assignees: namaOrang(assignee),
    assignee_people: assignee,
    labels: t.labels ?? dasar.labels,
    workspace_labels: sn.workspace_labels,
    description_text: t.description_text !== undefined ? t.description_text : dasar.description_text,
    description_html: null,
    description_plain: true,
    checklist: sn.checklist.length > 0 ? { done: 0, total: sn.checklist.length } : null,
    checklist_items: sn.checklist.map((judul, i) => ({ id: `lokal_${i}`, title: judul, is_done: false, position: String(i), done_by: null, done_at: null })),
    subtasks: [],
    attachments: [],
    attachments_can_edit: false,
    drive: { enabled: false, fake: false, picker_enabled: false, max_upload_bytes: 0, chunk_bytes: 0 },
    watchers: [],
    am_watching: false,
    activity_preview: [],
    comments: { count: e?.komentar.length ?? 0, unread: false },
    plan: { bucket: null, planned_for: null },
    view_only: false,
    can: { edit: true, delete: false, comment: true, work: false, plan: false, move: true, watch: false, track_reads: false, moderate: false },
    locked_reason: { edit: null, delete: terkunciOnline, comment: null, work: terkunciOnline, plan: terkunciOnline, move: null, watch: terkunciOnline, track_reads: null, moderate: null },
    banner: null,
  };
}
