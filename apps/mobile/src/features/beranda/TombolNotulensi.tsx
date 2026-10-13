/**
 * "Mulai notulensi" (Beranda & dashboard): membuat catatan baru di workspace
 * pribadi memakai endpoint Catatan yang sudah ada (`POST workspace/{id}/catatan`),
 * lalu membuka editornya. Hanya tampil bila fitur Catatan aktif.
 */
import { router } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '@/api/client';
import { buatCatatan, daftarWorkspace } from '@/api/endpoints';
import { tanggalPanjang } from '@/lib/format';
import { Button, useSnackbar } from '@/ui';

export function TombolNotulensi(): React.JSX.Element {
  const snackbar = useSnackbar();
  const [memuat, setMemuat] = useState(false);

  const mulai = async (): Promise<void> => {
    if (memuat) {
      return;
    }
    setMemuat(true);
    try {
      const grup = await daftarWorkspace();
      const pribadi = grup.groups.find((g) => g.jenis === 'pribadi')?.items[0];
      if (!pribadi) {
        throw new Error('Workspace pribadi tidak ditemukan.');
      }
      const catatan = await buatCatatan(pribadi.id, `Notulensi · ${tanggalPanjang(new Date())}`);
      router.push({ pathname: '/catatan/[id]', params: { id: catatan.id } });
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiError ? err.message : 'Notulensi belum bisa dibuat. Coba lagi.',
        variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad',
      });
    } finally {
      setMemuat(false);
    }
  };

  return <Button title="Mulai notulensi" variant="tonal" icon="notebook-pen" loading={memuat} loadingTitle="Membuat catatan…" onPress={() => void mulai()} />;
}
