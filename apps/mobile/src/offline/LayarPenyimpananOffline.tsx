/**
 * Pengaturan › Penyimpanan offline: ukuran data yang tersimpan di perangkat,
 * status enkripsi, waktu sinkron terakhir, dan "Hapus data offline".
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ListRow, Screen, SubAppBar, Text, useDialog, useSnackbar } from '@/ui';

import { useAntrean } from './antrean';
import { bersihSemuaBasi } from './basi';
import { hapusCache, ukuranCache } from './cache';
import { statusEnkripsi, ukuranBerkasDb, type StatusEnkripsi } from './db';
import { ukuranTeks, waktuRingkas } from './format';
import { terakhirOnline } from './jaringan';

interface Ukuran {
  cacheByte: number;
  cacheEntri: number;
  dbByte: number;
  enkripsi: StatusEnkripsi | null;
}

export function LayarPenyimpananOffline(): React.JSX.Element {
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const jumlahAntrean = useAntrean((s) => s.items.length);
  const terakhirSinkron = useAntrean((s) => s.terakhirSinkron);
  const [ukuran, setUkuran] = useState<Ukuran | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    const [c, d] = await Promise.all([ukuranCache(), ukuranBerkasDb()]);
    setUkuran({ cacheByte: c.byte, cacheEntri: c.entri, dbByte: d, enkripsi: statusEnkripsi() });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat ukuran saat layar dibuka
    void muat();
  }, [muat]);

  const hapus = async (): Promise<void> => {
    const setuju = await dialog.confirm({
      title: 'Hapus data offline?',
      message:
        jumlahAntrean > 0
          ? `Salinan data yang tersimpan untuk dibaca offline akan dihapus dan dimuat ulang saat online. ${jumlahAntrean} perubahan yang menunggu dikirim TIDAK dihapus.`
          : 'Salinan data yang tersimpan untuk dibaca offline akan dihapus dan dimuat ulang saat online.',
      confirmLabel: 'Hapus',
      cancelLabel: 'Batal',
      destructive: true,
    });
    if (!setuju) {
      return;
    }
    setMenghapus(true);
    try {
      await hapusCache();
      bersihSemuaBasi();
      snackbar.show({ message: 'Data offline dihapus.', variant: 'ok' });
      await muat();
    } catch {
      snackbar.show({ message: 'Data offline gagal dihapus. Coba lagi.', variant: 'bad' });
    } finally {
      setMenghapus(false);
    }
  };

  const online = terakhirOnline();
  const enkripsi = ukuran?.enkripsi;

  return (
    <Screen header={<SubAppBar title="Penyimpanan offline" />} onRefresh={() => void muat()}>
      <Text variant="body" tone="muted">
        RuangKerja menyimpan salinan data terakhir agar tetap bisa dibaca tanpa sinyal, dan menahan perubahan Anda sampai terkirim. Data ini hanya ada di perangkat ini dan terhapus saat Anda keluar.
      </Text>
      <Card variant="flat">
        <ListRow
          icon="hard-drive"
          title="Data baca offline"
          subtitle={ukuran ? `${ukuranTeks(ukuran.cacheByte)} · ${ukuran.cacheEntri} halaman` : 'Menghitung…'}
        />
        <ListRow
          divider
          icon="layers"
          title="Ukuran basis data"
          subtitle={ukuran ? ukuranTeks(ukuran.dbByte) : 'Menghitung…'}
        />
        <ListRow
          divider
          icon="shield-check"
          title="Enkripsi"
          subtitle={
            enkripsi === 'sqlcipher'
              ? 'Terenkripsi (SQLCipher, kunci di Keystore Android)'
              : enkripsi === 'polos'
                ? 'Disimpan di folder privat aplikasi (dienkripsi sistem Android)'
                : 'Belum dibuka'
          }
        />
        <ListRow
          divider
          icon="refresh-cw"
          title="Perubahan menunggu"
          subtitle={jumlahAntrean === 0 ? 'Tidak ada' : `${jumlahAntrean} menunggu atau perlu diperiksa`}
          onPress={() => router.push('/sinkron' as never)}
        />
        <ListRow
          divider
          icon="clock"
          title="Sinkron terakhir"
          subtitle={terakhirSinkron !== null ? waktuRingkas(terakhirSinkron) : online !== null ? `Terakhir terhubung ${waktuRingkas(online)}` : 'Belum ada sinkron pada sesi ini'}
        />
      </Card>
      <View style={{ gap: 8 }}>
        <Button title="Hapus data offline" variant="outline" icon="trash-2" loading={menghapus} onPress={() => void hapus()} />
        <Text variant="meta" align="center">
          Hanya menghapus salinan baca. Perubahan yang menunggu dikirim tetap tersimpan.
        </Text>
      </View>
    </Screen>
  );
}
