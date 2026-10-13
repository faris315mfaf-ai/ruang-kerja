/**
 * Persetujuan UU PDP untuk absensi (Langkah 1 dari 2; langkah 2 = izin sistem
 * Android lokasi + kamera, diminta tepat saat dibutuhkan di layar Absen).
 * Memakai `GET/POST /persetujuan`. Mencabut persetujuan ada di Privasi & Data Saya.
 * Mockup: docs/mockups/android/screens/03-absensi/05-izin-persetujuan-pdp.html (1–2).
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { bacaPersetujuan, berikanPersetujuan, type Persetujuan } from '@/api/privasi';
import { absenStore } from '@/features/absensi/store';
import { Banner, Button, Card, Checkbox, ErrorState, Icon, Pressable, Screen, Skeleton, SubAppBar, Text, errorKindFromStatus, useSnackbar, type AnyIconName } from '@/ui';
import { useTheme } from '@/theme';

function Butir({ icon, judul, children }: { icon: AnyIconName; judul: string; children: React.ReactNode }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.linkSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={colors.link} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="title" weight={700}>
          {judul}
        </Text>
        {children}
      </View>
    </View>
  );
}

const T = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
    {children}
  </Text>
);

export default function LayarPersetujuan(): React.JSX.Element {
  const snackbar = useSnackbar();
  const [data, setData] = useState<Persetujuan | null>(null);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [setuju, setSetuju] = useState(false);
  const [mengirim, setMengirim] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    setGalat(null);
    try {
      setData(await bacaPersetujuan());
    } catch (err) {
      setGalat(err instanceof ApiError ? err : new ApiError({ status: -1, message: 'Persetujuan tidak dapat dimuat.' }));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat();
  }, [muat]);

  const simpan = async (): Promise<void> => {
    if (mengirim || !setuju) {
      return;
    }
    setMengirim(true);
    try {
      await berikanPersetujuan();
      absenStore.mintaSegarkanLokasi(true);
      snackbar.show({ message: 'Persetujuan disimpan. Anda bisa check-in dengan GPS + selfie.', variant: 'ok', anchor: 'bottom' });
      router.back();
    } catch (err) {
      snackbar.show({ message: err instanceof ApiError ? (err.status === 0 ? 'Tidak ada koneksi. Persetujuan belum tersimpan.' : (err.firstValidationError ?? err.message)) : 'Persetujuan gagal disimpan.', variant: 'bad', anchor: 'bottom' });
    } finally {
      setMengirim(false);
    }
  };

  const perbarui = data?.needs_renewal === true;
  const retensi = data?.retention_months ?? 12;

  return (
    <Screen
      header={<SubAppBar title="Persetujuan data" />}
      footer={
        data ? (
          <View style={{ flex: 1, gap: 6 }}>
            <Checkbox checked={setuju} onChange={setSetuju} label="Saya sudah membaca dan menyetujui" />
            <Button title="Setujui & lanjutkan" size="lg" disabled={!setuju} disabledReason="Centang persetujuan terlebih dulu" loading={mengirim} onPress={() => void simpan()} />
            <Pressable onPress={() => router.push('/privasi/kebijakan')} accessibilityRole="link" accessibilityLabel={`Baca kebijakan lengkap, versi ${data.policy_version}`} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="label" weight={700} tone="link">
                Baca kebijakan lengkap (versi {data.policy_version})
              </Text>
            </Pressable>
          </View>
        ) : undefined
      }
    >
      {galat && !data ? (
        <ErrorState kind={errorKindFromStatus(galat.status)} message={galat.status === 0 ? 'Periksa koneksi internet Anda lalu coba lagi.' : galat.message} onRetry={() => void muat()} />
      ) : !data ? (
        <>
          <Skeleton width="40%" height={14} radiusPx={7} />
          <Skeleton width="80%" height={30} />
          <Skeleton height={90} radiusPx={20} />
          <Skeleton height={90} radiusPx={20} />
        </>
      ) : (
        <>
          <View style={{ gap: 4 }}>
            <Text variant="overline">Langkah 1 dari 2</Text>
            <Text variant="h1" accessibilityRole="header">
              {perbarui ? 'Kebijakan privasi diperbarui' : 'Sebelum check-in pertama'}
            </Text>
          </View>
          {perbarui ? (
            <Banner tone="warn" icon="shield-alert" message={`Kebijakan berubah ke versi ${data.version}. Check-in GPS + selfie tidak bisa dilakukan sampai Anda menyetujui versi ini.`} />
          ) : null}
          <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
            Absensi memakai data pribadi Anda. Berikut yang kami kumpulkan dan alasannya, sesuai UU Pelindungan Data Pribadi.
          </Text>
          <Card style={{ gap: 18 }}>
            <Butir icon="map-pin" judul="Yang direkam">
              <T>Lokasi, hanya saat check-in & check-out</T>
              <T>Foto selfie saat absen</T>
              <T>Info perangkat (model, versi aplikasi)</T>
            </Butir>
            <Butir icon="clock" judul="Disimpan berapa lama">
              <T>Selfie disimpan {retensi} bulan, lalu dihapus otomatis.</T>
            </Butir>
            <Butir icon="eye" judul="Siapa yang bisa melihat">
              <T>HR dan atasan langsung Anda. Setiap akses tercatat di log audit.</T>
            </Butir>
            <Butir icon="shield-check" judul="Hak Anda">
              <T>Lihat dan ekspor data absensi sendiri kapan saja. Cabut persetujuan lewat Lainnya → Privasi & Data Saya.</T>
            </Butir>
          </Card>
          <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
            Langkah 2: Android akan meminta izin lokasi dan kamera secara terpisah, tepat saat dibutuhkan.
          </Text>
        </>
      )}
    </Screen>
  );
}
