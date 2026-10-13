/** Label & nada untuk modul 06 (proyek, portofolio, manajemen, OKR). */
import type { Kesehatan, LevelRisiko, PenandaSistem, StatusMilestone, StatusProyek } from '@/api/proyek';
import type { Tone } from '@/ui';

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;

export function pecahYmd(ymd: string | null | undefined): { y: number; m: number; d: number } | null {
  const c = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  return c ? { y: Number(c[1]), m: Number(c[2]), d: Number(c[3]) } : null;
}

/** Nomor hari (UTC) dari `YYYY-MM-DD` — untuk selisih & skala grafik. */
export function nomorHari(ymd: string | null | undefined): number | null {
  const p = pecahYmd(ymd);
  return p ? Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000) : null;
}

/** "Rab, 14 Okt" */
export function hariTanggal(ymd: string | null | undefined): string {
  const p = pecahYmd(ymd);
  if (!p) return '—';
  const hari = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return `${HARI[hari]}, ${p.d} ${BULAN[p.m - 1]}`;
}

/** "14 Okt" */
export function tglBulan(ymd: string | null | undefined): string {
  const p = pecahYmd(ymd);
  return p ? `${p.d} ${BULAN[p.m - 1]}` : '—';
}

/** "1 Sep 2026" */
export function tglLengkap(ymd: string | null | undefined): string {
  const p = pecahYmd(ymd);
  return p ? `${p.d} ${BULAN[p.m - 1]} ${p.y}` : '—';
}

/** "3 hari lalu" dari jumlah hari. */
export function hariLalu(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'belum ada update';
  if (n <= 0) return 'hari ini';
  if (n === 1) return 'kemarin';
  return `${n} hari lalu`;
}

/** Bilangan id-ID: 1.250 · 3,5 */
export function angka(n: number | null | undefined, desimal = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: desimal, minimumFractionDigits: 0 }).format(n);
}

/** "58%" dari 0–100; null → "—". */
export function persen(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${Math.round(n)}%`;
}

/** "+3 poin" / "−17 poin" */
export function poin(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const r = Math.round(n);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)} poin`;
}

export const LABEL_KESEHATAN: Record<Kesehatan, string> = { on_track: 'Sesuai jalur', at_risk: 'Berisiko', off_track: 'Bermasalah' };

export function nadaKesehatan(h: Kesehatan | null | undefined): Tone {
  return h === 'on_track' ? 'success' : h === 'at_risk' ? 'warning' : h === 'off_track' ? 'danger' : 'neutral';
}

export function labelKesehatan(h: Kesehatan | null | undefined): string {
  return h ? LABEL_KESEHATAN[h] : 'Belum ada update';
}

export function labelPenanda(f: PenandaSistem, variance: number | null): string {
  if (f === 'behind') return variance !== null ? `Tertinggal ${Math.abs(Math.round(variance))} poin` : 'Tertinggal';
  if (f === 'missed_milestone') return 'Milestone terlewat';
  return 'Update kedaluwarsa';
}

export const LABEL_STATUS_PROYEK: Record<StatusProyek, string> = {
  planned: 'Direncanakan',
  active: 'Aktif',
  on_hold: 'Ditunda',
  completed: 'Selesai',
  canceled: 'Dibatalkan',
};

export const LABEL_MILESTONE: Record<StatusMilestone, string> = {
  not_started: 'Akan datang',
  in_progress: 'Berjalan',
  completed: 'Selesai',
  completed_late: 'Selesai terlambat',
  missed: 'Terlewat',
};

export function nadaMilestone(s: StatusMilestone): Tone {
  switch (s) {
    case 'completed':
      return 'success';
    case 'completed_late':
      return 'warning';
    case 'missed':
      return 'danger';
    case 'in_progress':
      return 'info';
    default:
      return 'neutral';
  }
}

export const LABEL_LEVEL: Record<LevelRisiko, string> = { high: 'Tinggi', medium: 'Sedang', low: 'Rendah' };

export function nadaLevel(l: LevelRisiko): Tone {
  return l === 'high' ? 'danger' : l === 'medium' ? 'warning' : 'neutral';
}

export const LABEL_KATEGORI: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'Dikerjakan',
  review: 'Review',
  done: 'Selesai',
  canceled: 'Batal',
};
