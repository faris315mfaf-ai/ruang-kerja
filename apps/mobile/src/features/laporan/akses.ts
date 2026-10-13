/**
 * Siapa yang melihat pintu "Laporan tim" (sisi pembaca). Peran: Kepala Divisi,
 * Direksi, HR, Super Admin, atau memimpin divisi (`led_division_ids`). Server
 * tetap penentu: bila `GET /laporan/tim` menjawab 403, pintu disembunyikan
 * untuk sisa sesi aplikasi.
 */
import { useSession } from '@/session/SessionProvider';
import { bacaProfil } from '@/features/settings/profile';
import type { UserProfile } from '@/api/types';

let ditolakServer: string | null = null;

export function tandaiLaporanTimDitolak(userId: string): void {
  ditolakServer = userId;
}

export function tandaiLaporanTimDiizinkan(userId: string): void {
  if (ditolakServer === userId) ditolakServer = null;
}

export function bolehLaporanTim(user: UserProfile | null): boolean {
  if (!user) return false;
  if (ditolakServer === user.id) return false;
  const p = bacaProfil(user);
  const peran = p.roles.some((r) => r === 'kepala_divisi' || r === 'direksi' || r === 'hr' || r === 'super_admin');
  return (peran && !p.isStaffOnly) || p.divisiDipimpin.length > 0;
}

export function useBolehLaporanTim(): boolean {
  const { user } = useSession();
  return bolehLaporanTim(user);
}
