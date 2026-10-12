/**
 * Akun Google — status baca-saja (tersambung / belum). Menghubungkan atau
 * memutus tetap di desktop; login Google ditahan (aplikasi memakai email +
 * kata sandi). Status dari `GET /privasi/data-saya` (`profile.google_linked`).
 * Mockup: docs/mockups/android/screens/01-akses-akun/25-akun-google.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { dataSaya } from '@/api/privasi';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { Banner, Button, Card, DesktopOnlyBanner, ErrorState, IconTile, Screen, Skeleton, SubAppBar, Text, Badge } from '@/ui';

export default function LayarAkunGoogle(): React.JSX.Element {
  const { kirim, mengirim } = useKirimTautan();
  const [status, setStatus] = useState<{ tersambung: boolean; email: string } | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<{ pesan: string; offline: boolean } | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    try {
      const data = await dataSaya();
      setStatus({ tersambung: data.profile.google_linked, email: data.profile.email });
      setGalat(null);
    } catch (err) {
      const offline = err instanceof ApiError && err.status === 0;
      setGalat({ pesan: err instanceof ApiError ? err.message : 'Status akun Google gagal dimuat.', offline });
    } finally {
      setMemuat(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  return (
    <Screen header={<SubAppBar title="Akun Google" />} onRefresh={() => void muat()} refreshing={memuat && status !== null}>
      {memuat && status === null ? (
        <Card style={{ gap: 12 }}>
          <Skeleton height={44} width={44} />
          <Skeleton height={20} width="60%" />
          <Skeleton height={16} width="90%" />
        </Card>
      ) : galat && status === null ? (
        <ErrorState message={galat.pesan} kind={galat.offline ? 'offline' : 'umum'} onRetry={() => void muat()} />
      ) : status ? (
        <>
          <Card style={{ gap: 14 }}>
            <IconTile icon={status.tersambung ? 'cloud-cog' : 'cloud-off'} tone={status.tersambung ? 'ok' : 'neutral'} />
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text variant="h3">{status.tersambung ? 'Tersambung' : 'Belum tersambung'}</Text>
                <Badge tone={status.tersambung ? 'success' : 'neutral'}>{status.tersambung ? 'Aktif' : 'Belum'}</Badge>
              </View>
              {status.tersambung ? (
                <>
                  <Text variant="body" weight={600} selectable>
                    {status.email}
                  </Text>
                  <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
                    Dipakai untuk memilih file Drive sebagai lampiran.
                  </Text>
                </>
              ) : (
                <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
                  Hubungkan akun Google kantor untuk memilih file dari Drive sebagai lampiran. Login aplikasi tetap memakai email dan kata sandi.
                </Text>
              )}
            </View>
          </Card>

          <Banner tone="neutral" icon="info" message="Login dengan Google sedang ditahan. Aplikasi ini masuk memakai email dan kata sandi." />
          <DesktopOnlyBanner message={status.tersambung ? 'Menghubungkan atau memutus akun Google tersedia di desktop.' : 'Menghubungkan akun Google tersedia di desktop.'} />
          <Button title="Kirim tautan ke email saya" variant="outline" icon="mail" loading={mengirim} onPress={() => void kirim('/pengaturan/keamanan')} />
        </>
      ) : null}
    </Screen>
  );
}
