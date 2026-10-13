/**
 * Fungsi murni untuk layar workspace: label tenggat, filter klien (papan &
 * kalender), tanggal pekan/bulan. Tanggal selalu string `YYYY-MM-DD`.
 */
import type { FilterTugas, KartuWorkspace } from '@/api/workspace';
import { ymdHariIni } from '@/lib/format';
import { NAMA_BULAN, NAMA_HARI_SINGKAT, hariKe, parseIso, toIso, type Ymd } from '@/ui/tanggal';

export const LABEL_PRIORITAS: Record<number, string> = { 0: 'Tanpa', 1: 'Urgent', 2: 'Tinggi', 3: 'Sedang', 4: 'Rendah' };

/** Tambah hari ke tanggal ISO (tanpa pergeseran zona). */
export function tambahHari(iso: string, delta: number): string {
  const p = parseIso(iso);
  if (!p) {
    return iso;
  }
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + delta));
  return toIso({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

export function selisihHari(dari: string, ke: string): number {
  const a = parseIso(dari);
  const b = parseIso(ke);
  if (!a || !b) {
    return 0;
  }
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** Senin pada pekan tanggal itu. */
export function awalPekan(iso: string): string {
  const p = parseIso(iso);
  if (!p) {
    return iso;
  }
  return tambahHari(iso, -((hariKe(p) + 6) % 7));
}

/** "Jum, 16 Okt" */
export function hariSingkat(iso: string): string {
  const p = parseIso(iso);
  if (!p) {
    return '';
  }
  const urutan = (hariKe(p) + 6) % 7;
  return `${NAMA_HARI_SINGKAT[urutan] ?? ''}, ${p.d} ${(NAMA_BULAN[p.m - 1] ?? '').slice(0, 3)}`;
}

/** "12–18 Okt 2026" untuk pekan yang dimulai `senin`. */
export function rentangPekan(senin: string): string {
  const a = parseIso(senin);
  const b = parseIso(tambahHari(senin, 6));
  if (!a || !b) {
    return '';
  }
  const bulan = (n: Ymd): string => (NAMA_BULAN[n.m - 1] ?? '').slice(0, 3);
  return a.m === b.m ? `${a.d}–${b.d} ${bulan(b)} ${b.y}` : `${a.d} ${bulan(a)} – ${b.d} ${bulan(b)} ${b.y}`;
}

export interface LabelTenggat {
  teks: string;
  nada: 'danger' | 'warning' | 'muted';
  terlambat: boolean;
}

/** Label tenggat kartu: "Besok", "Hari ini", "Terlambat 2 hari", "Jum, 16 Okt". */
export function labelTenggat(due: string | null, selesai: boolean, hariIni: string = ymdHariIni()): LabelTenggat | null {
  if (!due) {
    return null;
  }
  const beda = selisihHari(hariIni, due);
  if (selesai) {
    return { teks: hariSingkat(due), nada: 'muted', terlambat: false };
  }
  if (beda < 0) {
    return { teks: `Terlambat ${-beda} hari`, nada: 'danger', terlambat: true };
  }
  if (beda === 0) {
    return { teks: 'Hari ini', nada: 'warning', terlambat: false };
  }
  if (beda === 1) {
    return { teks: 'Besok', nada: 'warning', terlambat: false };
  }
  return { teks: hariSingkat(due), nada: 'muted', terlambat: false };
}

export function tugasTerbuka(t: KartuWorkspace): boolean {
  return t.status_category !== 'done' && t.status_category !== 'canceled';
}

/** Apakah kartu lolos filter (dipakai papan & kalender; list memakai filter server). */
export function lolosFilter(t: KartuWorkspace, f: FilterTugas, meId: string | null, hariIni: string = ymdHariIni()): boolean {
  const q = f.q.trim().toLowerCase();
  if (q !== '' && !`${t.title} ${t.key} ${t.description_text ?? ''}`.toLowerCase().includes(q)) {
    return false;
  }
  if (f.assignee === 'none' && t.assignee_ids.length > 0) {
    return false;
  }
  if (f.assignee === 'me' && (meId === null || !t.assignee_ids.includes(meId))) {
    return false;
  }
  if (f.assignee !== '' && f.assignee !== 'me' && f.assignee !== 'none' && !t.assignee_ids.includes(f.assignee)) {
    return false;
  }
  if (f.prioritas.length > 0 && !f.prioritas.includes(t.priority)) {
    return false;
  }
  if (f.label.length > 0 && !f.label.some((id) => t.label_ids.includes(id))) {
    return false;
  }
  if (f.tenggat !== '') {
    const due = t.due_date;
    switch (f.tenggat) {
      case 'none':
        if (due !== null) {
          return false;
        }
        break;
      case 'overdue':
        if (due === null || due >= hariIni || !tugasTerbuka(t)) {
          return false;
        }
        break;
      case 'today':
        if (due !== hariIni) {
          return false;
        }
        break;
      case 'week': {
        const akhir = tambahHari(awalPekan(hariIni), 6);
        if (due === null || due < hariIni || due > akhir) {
          return false;
        }
        break;
      }
    }
  }
  return true;
}

export function jumlahFilterAktif(f: FilterTugas): number {
  return (
    (f.q.trim() !== '' ? 1 : 0) +
    (f.assignee !== '' ? 1 : 0) +
    (f.prioritas.length > 0 ? 1 : 0) +
    (f.label.length > 0 ? 1 : 0) +
    (f.tenggat !== '' ? 1 : 0)
  );
}

/** Urut kartu dalam kolom: prioritas (urgent dulu, tanpa terakhir), lalu tenggat, lalu nomor. */
export function urutPrioritas(a: KartuWorkspace, b: KartuWorkspace): number {
  const pa = a.priority === 0 ? 9 : a.priority;
  const pb = b.priority === 0 ? 9 : b.priority;
  if (pa !== pb) {
    return pa - pb;
  }
  const da = a.due_date ?? '9999-12-31';
  const db = b.due_date ?? '9999-12-31';
  return da === db ? a.number - b.number : da < db ? -1 : 1;
}

/** Awal bulan 'YYYY-MM' dari tanggal. */
export function bulanDari(iso: string): string {
  return iso.slice(0, 7);
}

export function geserBulanStr(bulan: string, delta: number): string {
  const [y, m] = bulan.split('-').map(Number);
  const total = (y ?? 0) * 12 + ((m ?? 1) - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function namaBulan(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number);
  return `${NAMA_BULAN[(m ?? 1) - 1] ?? ''} ${y ?? ''}`;
}

/** Sel kalender (pekan mulai Senin) untuk bulan YYYY-MM: selalu kelipatan 7. */
export function selBulan(bulan: string): string[] {
  const [y, m] = bulan.split('-').map(Number);
  if (!y || !m) {
    return [];
  }
  const awal = toIso({ y, m, d: 1 });
  const mulai = awalPekan(awal);
  const akhirBulan = toIso({ y, m, d: new Date(Date.UTC(y, m, 0)).getUTCDate() });
  const jumlah = Math.ceil((selisihHari(mulai, akhirBulan) + 1) / 7) * 7;
  return Array.from({ length: jumlah }, (_, i) => tambahHari(mulai, i));
}

export function ukuranBerkas(byte: number | null): string {
  if (byte === null) {
    return '';
  }
  if (byte < 1024) {
    return `${byte} B`;
  }
  if (byte < 1024 * 1024) {
    return `${(byte / 1024).toFixed(0)} KB`;
  }
  return `${(byte / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
