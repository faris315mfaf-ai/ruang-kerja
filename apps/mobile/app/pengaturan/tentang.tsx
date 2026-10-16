/**
 * Tentang RuangKerja — versi & build, periksa pembaruan (`GET /konfigurasi`),
 * kebijakan privasi, lisensi sumber terbuka, kontak HR, dan info diagnostik.
 * Mockup: docs/mockups/android/screens/01-akses-akun/24-tentang.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import * as Application from 'expo-application';

import { konfigurasiApp } from '@/api/akun';
import { deviceIdHash } from '@/lib/device';
import { buildApp, versiApp } from '@/features/settings/appInfo';
import { bandingVersi, EMAIL_HR } from '@/features/settings/konstanta';
import { useTheme } from '@/theme';
import { Badge, Card, Gradient, Icon, ListRow, Screen, SubAppBar, Text, useSnackbar } from '@/ui';
import { bacaSalinanKebijakan } from '@/api/privasi';

type StatusUpdate = { jenis: 'memeriksa' } | { jenis: 'terbaru' } | { jenis: 'tersedia'; versi: string } | { jenis: 'gagal' };

export default function LayarTentang(): React.JSX.Element {
  const snackbar = useSnackbar();
  const { colors } = useTheme();
  const [status, setStatus] = useState<StatusUpdate>({ jenis: 'memeriksa' });
  const [idPerangkat, setIdPerangkat] = useState<string>('—');
  const versi = versiApp();
  const kebijakan = bacaSalinanKebijakan();

  const periksa = useCallback(async (): Promise<void> => {
    setStatus({ jenis: 'memeriksa' });
    try {
      const konfigurasi = await konfigurasiApp();
      setStatus(
        bandingVersi(konfigurasi.latest_app_version, versi) > 0
          ? { jenis: 'tersedia', versi: konfigurasi.latest_app_version }
          : { jenis: 'terbaru' },
      );
    } catch {
      setStatus({ jenis: 'gagal' });
    }
  }, [versi]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemeriksaan versi saat layar dibuka
    void periksa();
    void deviceIdHash().then((h) => setIdPerangkat(h.slice(0, 8)));
  }, [periksa]);

  const bagikanDiagnostik = async (): Promise<void> => {
    const info = [
      `RuangKerja ${versi} (build ${buildApp()}) · API v1`,
      `ID perangkat: ${idPerangkat}`,
      `Aplikasi: ${Application.applicationId ?? '—'}`,
    ].join('\n');
    try {
      await Share.share({ message: info, title: 'Info diagnostik RuangKerja' });
    } catch {
      snackbar.show({ message: 'Info diagnostik gagal dibagikan.', variant: 'bad' });
    }
  };

  const subjudulUpdate =
    status.jenis === 'memeriksa'
      ? 'Memeriksa pembaruan…'
      : status.jenis === 'terbaru'
        ? 'Aplikasi sudah versi terbaru'
        : status.jenis === 'tersedia'
          ? `Versi ${status.versi} tersedia · hubungi HR/IT untuk berkas pembaruan`
          : 'Gagal memeriksa. Ketuk untuk mencoba lagi';

  return (
    <Screen header={<SubAppBar title="Tentang RuangKerja" />}>
      <View style={s.logo}>
        <Gradient name="merek" style={s.ubinLogo}>
          <Icon name="layout-grid" size={36} color="#FFFFFF" />
        </Gradient>
        <Text variant="h2">RuangKerja</Text>
        <Text variant="meta">{`Versi ${versi} (build ${buildApp()}) · API v1`}</Text>
      </View>

      <Card variant="flat">
        <ListRow
          icon={status.jenis === 'tersedia' ? 'download' : 'refresh-cw'}
          iconTone={status.jenis === 'tersedia' ? 'teal' : 'neutral'}
          title="Periksa pembaruan"
          subtitle={subjudulUpdate}
          trailing={status.jenis === 'tersedia' ? <Badge tone="primary" dot={false}>Baru</Badge> : status.jenis === 'terbaru' ? <Icon name="circle-check" size={22} color={colors.success} /> : undefined}
          onPress={() => void periksa()}
        />
        <ListRow
          divider
          icon="file-text"
          title="Kebijakan privasi"
          subtitle={kebijakan ? `Versi ${kebijakan.version}` : undefined}
          onPress={() => router.push('/privasi/kebijakan' as never)}
        />
        <ListRow divider icon="scroll-text" title="Lisensi sumber terbuka" onPress={() => router.push('/pengaturan/lisensi' as never)} />
        <ListRow
          divider
          icon="mail"
          title="Hubungi HR"
          subtitle={EMAIL_HR}
          onPress={() => void Linking.openURL(`mailto:${EMAIL_HR}`).catch(() => undefined)}
        />
      </Card>

      <Card variant="flat">
        <ListRow icon="smartphone" title="ID perangkat" subtitle={idPerangkat} />
        <ListRow
          divider
          icon="share-2"
          title="Bagikan info diagnostik"
          subtitle="Untuk dikirim ke HR/IT bila ada masalah"
          onPress={() => void bagikanDiagnostik()}
        />
      </Card>

      <Text variant="meta" align="center">
        © 2026 SPKD · Dibuat untuk karyawan SPKD
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  logo: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  ubinLogo: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 6 },
});
