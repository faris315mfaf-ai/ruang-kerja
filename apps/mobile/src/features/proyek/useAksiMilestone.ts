/** Tandai selesai / buka kembali / hapus milestone (P10, P11). Hapus = jeda "Urungkan" (server tanpa urungkan). */
import { useState } from 'react';

import { hapusMilestone, selesaiMilestone, type MilestoneDetail } from '@/api/proyek';
import { useDialog, useSnackbar } from '@/ui';

import { pesanGalat, useTundaKirim } from './tunda';

export function useAksiMilestone(key: string, segarkan: () => void): {
  tersembunyi: Set<string>;
  tandai: (m: MilestoneDetail) => Promise<void>;
  hapus: (m: MilestoneDetail, sesudah?: () => void) => Promise<void>;
} {
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const tunda = useTundaKirim();
  const [tersembunyi, setTersembunyi] = useState<Set<string>>(new Set());

  const tandai = async (m: MilestoneDetail): Promise<void> => {
    const selesai = m.completed_at === null;
    try {
      const r = await selesaiMilestone(key, m.id, selesai);
      snackbar.show({ message: r.message, variant: 'ok' });
      segarkan();
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Milestone gagal diubah.'), variant: 'bad' });
    }
  };

  const hapus = async (m: MilestoneDetail, sesudah?: () => void): Promise<void> => {
    const ok = await dialog.confirm({
      title: 'Hapus milestone?',
      message: `"${m.name}" dihapus dari proyek. Tugas terkait tidak ikut terhapus.`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ok) return;
    setTersembunyi((s) => new Set(s).add(m.id));
    sesudah?.();
    tunda({
      pesan: 'Milestone dihapus.',
      kirim: () => hapusMilestone(key, m.id),
      pulihkan: () =>
        setTersembunyi((s) => {
          const b = new Set(s);
          b.delete(m.id);
          return b;
        }),
      selesai: segarkan,
    });
  };

  return { tersembunyi, tandai, hapus };
}
