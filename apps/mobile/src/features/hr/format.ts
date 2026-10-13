/** Format & label modul HR (Bahasa Indonesia, id-ID). */
import { jam } from '@/lib/format';
import type { Tone } from '@/ui';

const angkaFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

/** 1.250 · 9,5 */
export function angka(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : angkaFmt.format(n);
}

export function persen(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${angkaFmt.format(n)}%`;
}

/** +1,5 hari / −0,5 hari */
export function deltaHari(n: number): string {
  return `${n > 0 ? '+' : '−'}${angkaFmt.format(Math.abs(n))} hari`;
}

/** Jam "08.02" atau "—". */
export function jamAtau(value: string | null | undefined, kosong = '—'): string {
  return value ? jam(value) : kosong;
}

const LABEL_MODE: Record<string, string> = { office: 'Kantor', hybrid: 'Hybrid', wfh: 'WFH', field: 'Lapangan' };
export function labelModeKerja(mode: string | null | undefined): string {
  return mode ? (LABEL_MODE[mode] ?? mode) : '—';
}

const LABEL_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Aktif', tone: 'success' },
  inactive: { label: 'Nonaktif', tone: 'neutral' },
  resigned: { label: 'Mengundurkan diri', tone: 'warning' },
};
export function statusKaryawan(status: string): { label: string; tone: Tone } {
  return LABEL_STATUS[status] ?? { label: status, tone: 'neutral' };
}

/** "Sel, 13 Okt" dari YYYY-MM-DD tanpa geser zona. */
export function hariPendek(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 4)));
}

/** "Selasa, 13 Okt 2026" dari YYYY-MM-DD. */
export function hariPanjang(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 4)));
}

/** "Oktober 2026" dari YYYY-MM. */
export function labelBulan(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 15)));
}

/** n bulan terakhir (YYYY-MM), terbaru dulu, dari bulan acuan. */
export function bulanTerakhir(acuan: string, jumlah = 13): string[] {
  const [y, m] = acuan.split('-').map(Number);
  if (!y || !m) return [acuan];
  const hasil: string[] = [];
  for (let i = 0; i < jumlah; i++) {
    const t = new Date(Date.UTC(y, m - 1 - i, 15));
    hasil.push(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return hasil;
}

const LABEL_AUDIT: Record<string, string> = {
  'user.created': 'Karyawan ditambahkan',
  'employee.imported': 'Karyawan diimpor',
  'user.updated': 'Data diubah',
  'employee_profile.updated': 'Data pribadi diubah',
  'user.roles_changed': 'Peran diubah',
  'user.deactivated': 'Akun dinonaktifkan',
  'user.reactivated': 'Akun diaktifkan kembali',
  'user.password_set_by_hr': 'Kata sandi diatur HR',
  'user.password_changed': 'Kata sandi diganti karyawan',
  'user.password_reset_approved': 'Permintaan reset sandi disetujui',
  'user.password_reset_rejected': 'Permintaan reset sandi ditolak',
  'user.password_reset_completed': 'Kata sandi baru dibuat',
  'user.password_reset_to_default': 'Kata sandi direset ke bawaan',
};

const LABEL_KOLOM: Record<string, string> = {
  name: 'nama',
  email: 'email',
  division_id: 'divisi',
  team_id: 'tim',
  position_id: 'jabatan',
  manager_id: 'atasan',
  work_mode: 'mode kerja',
  status: 'status',
  joined_at: 'tanggal bergabung',
  roles: 'peran',
  phone: 'telepon',
  employee_number: 'nomor karyawan',
  nik: 'NIK',
  birth_date: 'tanggal lahir',
  address: 'alamat',
  emergency_contact: 'kontak darurat',
  password_change_required: 'wajib ganti sandi',
};

/** "Data diubah: tim, mode kerja" */
export function labelAudit(action: string, fields: string[]): string {
  const dasar = LABEL_AUDIT[action] ?? action;
  const kolom = fields.map((f) => LABEL_KOLOM[f]).filter((x): x is string => !!x);
  return kolom.length > 0 && (action === 'user.updated' || action === 'employee_profile.updated') ? `${dasar}: ${[...new Set(kolom)].join(', ')}` : dasar;
}
