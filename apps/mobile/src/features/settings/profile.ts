/**
 * Pembaca profil lengkap (`GET /auth/saya`): peran, flag fitur, tim, atasan…
 * Dibaca defensif dari objek mentah supaya sesi lama (hanya bidang ringkas)
 * tetap menghasilkan nilai aman: tanpa peran dikenal = diperlakukan sebagai
 * staf (tanpa saldo cuti, tanpa struktur organisasi).
 */
import type { UserProfile } from '@/api/types';

export type KodePeran = 'super_admin' | 'direksi' | 'hr' | 'kepala_divisi' | 'anggota';

export interface Rujukan {
  id: string;
  name: string;
}

export interface ProfilLengkap {
  id: string;
  name: string;
  email: string;
  jabatan: string | null;
  divisi: string | null;
  modeKerja: string | null;
  roles: string[];
  isStaffOnly: boolean;
  features: Record<string, boolean>;
  tim: Rujukan | null;
  atasan: Rujukan | null;
  noKaryawan: string | null;
  bergabung: string | null;
  divisiDipimpin: string[];
  dua2fa: boolean;
  /** Apakah bidang lengkap (peran) sudah ada — false bila sesi lama belum disegarkan. */
  lengkap: boolean;
}

const LABEL_PERAN: Record<KodePeran, string> = {
  super_admin: 'Super Admin',
  direksi: 'Direksi',
  hr: 'HR',
  kepala_divisi: 'Kepala Divisi',
  anggota: 'Anggota',
};

/** Urutan tampil lencana peran (paling berwenang dulu). */
const URUTAN_PERAN: KodePeran[] = ['super_admin', 'direksi', 'hr', 'kepala_divisi', 'anggota'];

function teks(nilai: unknown): string | null {
  return typeof nilai === 'string' && nilai !== '' ? nilai : null;
}

function rujukan(nilai: unknown): Rujukan | null {
  if (typeof nilai === 'object' && nilai !== null) {
    const o = nilai as Record<string, unknown>;
    if (typeof o.id === 'string' && typeof o.name === 'string') {
      return { id: o.id, name: o.name };
    }
  }
  return null;
}

export function bacaProfil(user: UserProfile | null): ProfilLengkap {
  const mentah = (user ?? {}) as unknown as Record<string, unknown>;
  const roles = Array.isArray(mentah.roles) ? mentah.roles.filter((r): r is string => typeof r === 'string') : [];
  const fitur: Record<string, boolean> = {};
  if (typeof mentah.features === 'object' && mentah.features !== null) {
    for (const [k, v] of Object.entries(mentah.features as Record<string, unknown>)) {
      fitur[k] = v === true;
    }
  }
  const modeKerja =
    typeof mentah.work_mode === 'object' && mentah.work_mode !== null
      ? teks((mentah.work_mode as Record<string, unknown>).label)
      : null;
  const diKenal = roles.some((r) => r in LABEL_PERAN);

  return {
    id: teks(mentah.id) ?? '',
    name: teks(mentah.name) ?? 'Pengguna',
    email: teks(mentah.email) ?? '',
    jabatan: teks(mentah.jabatan),
    divisi: teks(mentah.divisi) ?? rujukan(mentah.division)?.name ?? null,
    modeKerja,
    roles,
    isStaffOnly: mentah.is_staff_only === true || !diKenal || (roles.length === 1 && roles[0] === 'anggota'),
    features: fitur,
    tim: rujukan(mentah.team),
    atasan: rujukan(mentah.manager),
    noKaryawan: teks(mentah.employee_number),
    bergabung: teks(mentah.joined_at),
    divisiDipimpin: Array.isArray(mentah.led_division_ids) ? mentah.led_division_ids.filter((x): x is string => typeof x === 'string') : [],
    dua2fa: mentah.two_factor_enabled === true,
    lengkap: diKenal,
  };
}

export interface Peran {
  staf: boolean;
  kadiv: boolean;
  hr: boolean;
  direksi: boolean;
  admin: boolean;
  /** Peran selain staf: melihat Persetujuan, Organisasi, dst. */
  manajemen: boolean;
}

export function bacaPeran(profil: ProfilLengkap): Peran {
  const ada = (kode: KodePeran): boolean => profil.roles.includes(kode);
  const staf = profil.isStaffOnly;
  return {
    staf,
    kadiv: !staf && ada('kepala_divisi'),
    hr: !staf && ada('hr'),
    direksi: !staf && ada('direksi'),
    admin: !staf && ada('super_admin'),
    manajemen: !staf,
  };
}

export function labelPeran(kode: string): string {
  return kode in LABEL_PERAN ? LABEL_PERAN[kode as KodePeran] : kode;
}

/** Label peran terurut dari yang paling berwenang (untuk kode peran mentah). */
export function labelDariKode(roles: readonly string[]): string[] {
  return URUTAN_PERAN.filter((k) => roles.includes(k)).map(labelPeran);
}

/** Peran untuk lencana profil, terurut dari yang paling berwenang. */
export function daftarLabelPeran(profil: ProfilLengkap): string[] {
  return labelDariKode(profil.roles);
}

/** Flag server: bawaan `bawaan` bila server belum mengirim flag itu. */
export function fiturAktif(profil: ProfilLengkap, kunci: string, bawaan: boolean): boolean {
  return kunci in profil.features ? profil.features[kunci] === true : bawaan;
}

/** "Staf Gudang · Divisi Operasional" */
export function barisJabatan(profil: ProfilLengkap): string {
  return [profil.jabatan, profil.divisi].filter((x): x is string => x !== null).join(' · ');
}
