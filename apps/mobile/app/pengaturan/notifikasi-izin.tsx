/**
 * Notifikasi — izin notifikasi Android: pra-izin (rationale) sebelum dialog
 * sistem, keadaan ditolak (arahkan ke Setelan), dan diizinkan. Pengaturan per
 * jenis notifikasi menyusul bersama modul notifikasi/push.
 * Mockup: docs/mockups/android/screens/01-akses-akun/19-izin-aplikasi (1–3).
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useIzinAplikasi } from '@/features/settings/izin';
import { useTheme } from '@/theme';
import { Banner, Button, Card, Gradient, Icon, Loading, Screen, SubAppBar, Text, useSnackbar } from '@/ui';

const MANFAAT = [
  'Persetujuan yang menunggu Anda',
  'Tugas baru dan tenggat besok',
  'Rapat yang akan dimulai',
  'Pengingat check-in dan check-out',
];

export default function LayarNotifikasiIzin(): React.JSX.Element {
  const izin = useIzinAplikasi();
  const snackbar = useSnackbar();
  const { colors } = useTheme();

  const aktifkan = async (): Promise<void> => {
    const ok = await izin.mintaNotifikasi();
    if (ok) {
      snackbar.show({ message: 'Notifikasi diaktifkan', variant: 'ok' });
    }
  };

  return (
    <Screen header={<SubAppBar title="Notifikasi" />}>
      {izin.notifikasi === 'memeriksa' ? (
        <Loading />
      ) : izin.notifikasi === 'belum' ? (
        <>
          <Card style={{ alignItems: 'center', gap: 14 }}>
            <Gradient name="soft" style={s.ubin}>
              <Icon name="bell-ring" size={32} color={colors.link} />
            </Gradient>
            <Text variant="h3" align="center">
              Jangan ketinggalan yang penting
            </Text>
            <View style={{ gap: 10, alignSelf: 'stretch' }}>
              {MANFAAT.map((m) => (
                <View key={m} style={s.butir}>
                  <Icon name="circle-check" size={20} color={colors.success} />
                  <Text variant="body" style={{ flex: 1, fontSize: 16 }}>
                    {m}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
          <Button title="Aktifkan notifikasi" icon="bell" onPress={() => void aktifkan()} />
          <Button title="Nanti saja" variant="quiet" onPress={() => router.back()} />
        </>
      ) : izin.notifikasi === 'ditolak' ? (
        <>
          <Banner
            tone="bad"
            icon="bell-off"
            title="Notifikasi dimatikan di Android."
            message="Anda tidak akan menerima pengingat persetujuan, tugas, dan rapat."
          />
          <Button title="Buka Setelan" icon="settings" onPress={izin.bukaSetelan} />
        </>
      ) : (
        <>
          <Banner tone="ok" icon="bell-ring" title="Notifikasi diizinkan." message="Pengingat persetujuan, tugas, dan rapat akan masuk ke perangkat ini." />
          <Banner tone="info" message="Pengaturan per jenis notifikasi dan jam tenang akan hadir bersama modul notifikasi." />
          <Button title="Buka Setelan Android" variant="outline" icon="settings" onPress={izin.bukaSetelan} />
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  ubin: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  butir: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
