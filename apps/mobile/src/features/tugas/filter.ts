/** Status filter "Tugas saya" + konversi ke parameter API dan ke tampilan tersimpan. */
import type { FilterTersimpan, KategoriStatus, ParamTugasSaya } from '@/api/tugas';

import { LABEL_KATEGORI, LABEL_PRIORITAS } from './util';

export type TenggatFilter = 'overdue' | 'today' | 'week' | 'none';
export type KelompokPer = 'tenggat' | 'workspace' | 'prioritas' | 'status';

export interface FilterTugas {
  q: string;
  workspace: string[];
  prioritas: number[];
  status: KategoriStatus[];
  label: string[];
  /** `saya` atau id pengguna. */
  penanggung: string | null;
  tenggat: TenggatFilter | null;
}

export const FILTER_KOSONG: FilterTugas = { q: '', workspace: [], prioritas: [], status: [], label: [], penanggung: null, tenggat: null };

export function jumlahFilter(f: FilterTugas): number {
  return (
    (f.q.trim() ? 1 : 0) +
    f.workspace.length +
    f.prioritas.length +
    f.status.length +
    f.label.length +
    (f.penanggung ? 1 : 0) +
    (f.tenggat ? 1 : 0)
  );
}

export function keParam(f: FilterTugas): Partial<ParamTugasSaya> {
  return {
    q: f.q,
    workspace: f.workspace,
    prioritas: f.prioritas,
    status: f.status,
    label: f.label,
    penanggung: f.penanggung ?? undefined,
    tenggat: f.tenggat,
  };
}

export function keTampilan(f: FilterTugas): FilterTersimpan {
  return {
    q: f.q.trim(),
    workspaces: f.workspace,
    priorities: f.prioritas,
    statuses: f.status,
    labels: f.label,
    assignees: f.penanggung ? [f.penanggung === 'saya' ? 'me' : f.penanggung] : [],
    due: f.tenggat,
  };
}

export function dariTampilan(t: FilterTersimpan): FilterTugas {
  const orang = t.assignees?.[0];
  return {
    q: t.q ?? '',
    workspace: t.workspaces ?? [],
    prioritas: t.priorities ?? [],
    status: t.statuses ?? [],
    label: t.labels ?? [],
    penanggung: orang ? (orang === 'me' ? 'saya' : orang) : null,
    tenggat: t.due ?? null,
  };
}

const LABEL_TENGGAT: Record<TenggatFilter, string> = { overdue: 'Terlambat', today: 'Hari ini', week: 'Minggu ini', none: 'Tanpa tenggat' };
export { LABEL_TENGGAT };

export interface ChipFilter {
  kunci: string;
  label: string;
  hapus: (f: FilterTugas) => FilterTugas;
}

/** Chip filter aktif yang bisa dihapus satu per satu (mockup 03-3). */
export function daftarChip(f: FilterTugas, namaOrang: (id: string) => string, namaLabel: (id: string) => string): ChipFilter[] {
  const hasil: ChipFilter[] = [];
  if (f.q.trim()) {
    hasil.push({ kunci: 'q', label: `Cari: ${f.q.trim()}`, hapus: (x) => ({ ...x, q: '' }) });
  }
  for (const w of f.workspace) {
    hasil.push({ kunci: `w:${w}`, label: `Workspace: ${w}`, hapus: (x) => ({ ...x, workspace: x.workspace.filter((i) => i !== w) }) });
  }
  for (const p of f.prioritas) {
    hasil.push({ kunci: `p:${p}`, label: `Prioritas: ${LABEL_PRIORITAS[p] ?? p}`, hapus: (x) => ({ ...x, prioritas: x.prioritas.filter((i) => i !== p) }) });
  }
  for (const s of f.status) {
    hasil.push({ kunci: `s:${s}`, label: `Status: ${LABEL_KATEGORI[s]}`, hapus: (x) => ({ ...x, status: x.status.filter((i) => i !== s) }) });
  }
  for (const l of f.label) {
    hasil.push({ kunci: `l:${l}`, label: `Label: ${namaLabel(l)}`, hapus: (x) => ({ ...x, label: x.label.filter((i) => i !== l) }) });
  }
  if (f.penanggung) {
    hasil.push({ kunci: 'pg', label: `Penanggung: ${f.penanggung === 'saya' ? 'Saya' : namaOrang(f.penanggung)}`, hapus: (x) => ({ ...x, penanggung: null }) });
  }
  if (f.tenggat) {
    const t = f.tenggat;
    hasil.push({ kunci: 't', label: `Tenggat: ${LABEL_TENGGAT[t]}`, hapus: (x) => ({ ...x, tenggat: null }) });
  }
  return hasil;
}
