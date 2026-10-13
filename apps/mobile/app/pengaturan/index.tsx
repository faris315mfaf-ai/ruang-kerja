/**
 * Pengaturan — hub: Akun · Preferensi · Privasi & izin · Tentang.
 * Mockup: docs/mockups/android/screens/01-akses-akun/14-pengaturan
 * (biasa, izin notifikasi ditolak, offline).
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { ambilKebijakanPrivasi, bacaSalinanKebijakan, simpanSalinanKebijakan, type InfoKebijakan } from '@/api/privasi';
import { BATAS_PERANGKAT, daftarPerangkat } from '@/api/perangkat';
import { versiApp } from '@/features/settings/appInfo';
import { useIzinAplikasi } from '@/features/settings/izin';
import { tglPendekYMD } from '@/features/settings/konstanta';
import { DaftarMenu, GroupLabel, KartuIdentitas, type ItemMenu } from '@/features/settings/parts';
import { barisJabatan } from '@/features/settings/profile';
import { useProfilLengkap } from '@/features/settings/useProfilLengkap';
import { useTheme } from '@/theme';
import { Badge, OfflineBanner, Screen, SubAppBar } from '@/ui';

function labelTema(mode: string): string {
  return mode === 'light' ? 'Terang' : mode === 'dark' ? 'Gelap' : 'Ikuti sistem';
}

export default function LayarPengaturan(): React.JSX.Element {
  const { mode } = useTheme();
  const { profil } = useProfilLengkap();
  const izin = useIzinAplikasi();
  const [jumlahPerangkat, setJumlahPerangkat] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [kebijakan, setKebijakan] = useState<InfoKebijakan | null>(() => {
    const salinan = bacaSalinanKebijakan();
    return salinan ? { version: salinan.version, effective_date: salinan.effective_date } : null;
  });

  const muat = useCallback(async (): Promise<void> => {
    const [perangkat, kebijakanBaru] = await Promise.allSettled([daftarPerangkat(), ambilKebijakanPrivasi()]);
    if (perangkat.status === 'fulfilled') {
      setJumlahPerangkat(perangkat.value.devices.length);
      setOffline(false);
    } else {
      const err: unknown = perangkat.reason;
      setOffline(err instanceof ApiError && err.status === 0);
    }
    if (kebijakanBaru.status === 'fulfilled') {
      simpanSalinanKebijakan(kebijakanBaru.value);
      setKebijakan({ version: kebijakanBaru.value.version, effective_date: kebijakanBaru.value.effective_date });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  const notifMati = izin.notifikasi === 'ditolak' || izin.notifikasi === 'belum';
  const ke = (path: string) => (): void => router.push(path as never);

  const akun: ItemMenu[] = [
    { kunci: 'profil', judul: 'Profil', subjudul: 'Data kepegawaian', ikon: 'user', onPress: ke('/profil') },
    { kunci: 'keamanan', judul: 'Kata sandi & keamanan', subjudul: 'Ubah kata sandi, buka dengan sidik jari', ikon: 'key-round', onPress: ke('/pengaturan/keamanan') },
    {
      kunci: 'perangkat',
      judul: 'Perangkat saya',
      subjudul: jumlahPerangkat === null ? 'Perangkat yang masuk ke akun Anda' : `${jumlahPerangkat} dari ${BATAS_PERANGKAT} perangkat`,
      ikon: 'smartphone',
      onPress: ke('/pengaturan/perangkat'),
    },
    { kunci: 'google', judul: 'Akun Google', subjudul: 'Hubungkan lewat desktop', ikon: 'cloud-cog', onPress: ke('/pengaturan/akun-google') },
  ];

  const preferensi: ItemMenu[] = [
    {
      kunci: 'notifikasi',
      judul: 'Notifikasi',
      subjudul: notifMati ? 'Notifikasi dimatikan di Android' : 'Izin, jenis, dan ringkasan harian',
      ikon: 'bell',
      kanan: notifMati ? <Badge tone="warning">Perlu diaktifkan</Badge> : undefined,
      onPress: ke('/pengaturan/notifikasi'),
    },
    { kunci: 'tampilan', judul: 'Tampilan', subjudul: labelTema(mode), ikon: 'moon', onPress: ke('/pengaturan/tampilan') },
    { kunci: 'bahasa', judul: 'Bahasa', subjudul: 'Bahasa Indonesia', ikon: 'languages' },
  ];

  const privasi: ItemMenu[] = [
    { kunci: 'privasi', judul: 'Privasi & data saya', subjudul: 'Persetujuan, unduh data', ikon: 'shield-check', onPress: ke('/privasi') },
    {
      kunci: 'kebijakan',
      judul: 'Kebijakan privasi',
      subjudul: kebijakan ? `Versi ${kebijakan.version} · ${tglPendekYMD(kebijakan.effective_date)}` : 'Baca kebijakan privasi',
      ikon: 'file-text',
      onPress: ke('/privasi/kebijakan'),
    },
    { kunci: 'izin', judul: 'Izin aplikasi', subjudul: 'Kamera, lokasi, notifikasi', ikon: 'lock', onPress: ke('/pengaturan/izin') },
  ];

  const tentang: ItemMenu[] = [
    { kunci: 'tentang', judul: 'Tentang RuangKerja', subjudul: `Versi ${versiApp()} · cek pembaruan`, ikon: 'info', onPress: ke('/pengaturan/tentang') },
  ];

  return (
    <Screen header={<SubAppBar title="Pengaturan" />} onRefresh={() => void muat()}>
      {offline ? <OfflineBanner /> : null}
      <KartuIdentitas nama={profil.name} baris={barisJabatan(profil)} onPress={ke('/profil')} />
      <View style={{ gap: 8 }}>
        <GroupLabel>Akun</GroupLabel>
        <DaftarMenu items={akun} />
      </View>
      <View style={{ gap: 8 }}>
        <GroupLabel>Preferensi</GroupLabel>
        <DaftarMenu items={preferensi} />
      </View>
      <View style={{ gap: 8 }}>
        <GroupLabel>Privasi & izin</GroupLabel>
        <DaftarMenu items={privasi} />
      </View>
      <View style={{ gap: 8 }}>
        <GroupLabel>Tentang</GroupLabel>
        <DaftarMenu items={tentang} />
      </View>
    </Screen>
  );
}
