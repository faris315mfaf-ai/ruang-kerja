/** Peran penonton untuk modul HR (dibaca dari profil `GET /auth/saya`). Izin aksi tetap dari bendera `can` server. */
import { bacaPeran, bacaProfil, type Peran } from '@/features/settings/profile';
import { useSession } from '@/session/SessionProvider';

export interface PeranHr extends Peran {
  email: string;
  /** HR, Direksi, atau Super Admin: cakupan seluruh perusahaan. */
  perusahaan: boolean;
}

export function usePeranHr(): PeranHr {
  const { user } = useSession();
  const profil = bacaProfil(user);
  const p = bacaPeran(profil);
  return { ...p, email: profil.email, perusahaan: p.hr || p.direksi || p.admin };
}
