/**
 * Memanaskan cache baca untuk form "Tugas baru" agar bisa dipakai saat offline:
 * daftar workspace + kolom/label/anggota workspace Pribadi. Cukup sekali per
 * proses aplikasi, hanya saat online (jawaban otomatis masuk cache offline).
 */
import { adalahOnline } from '@/offline';
import { anggotaUntukTugas, konteksWorkspace, workspaceUntukTugas } from '@/api/tugas';

let sudah = false;

export async function hangatkanFormTugas(): Promise<void> {
  if (sudah || !adalahOnline()) {
    return;
  }
  sudah = true;
  try {
    const grup = await workspaceUntukTugas();
    const pribadi = grup.flatMap((g) => g.items).find((w) => w.type === 'personal' && !w.arsip);
    if (pribadi) {
      await Promise.all([konteksWorkspace(pribadi.id), anggotaUntukTugas(pribadi.id)]);
    }
  } catch {
    sudah = false;
  }
}
