/**
 * Izin aplikasi — status kamera, lokasi, notifikasi + pintasan ke Setelan
 * Android. Izin hanya dipakai saat check-in/out; lokasi tidak dilacak terus.
 * Mockup: docs/mockups/android/screens/01-akses-akun/19-izin-aplikasi (4–5).
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import { labelIzin, useIzinAplikasi, type StatusIzin } from '@/features/settings/izin';
import { GroupLabel } from '@/features/settings/parts';
import { Badge, Banner, Button, Card, ListRow, Screen, SubAppBar, Text, type AnyIconName } from '@/ui';

function LencanaIzin({ status }: { status: StatusIzin }): React.JSX.Element {
  return <Badge tone={status === 'diizinkan' ? 'success' : status === 'memeriksa' ? 'neutral' : 'warning'}>{status === 'ditolak' ? 'Dimatikan' : labelIzin(status)}</Badge>;
}

export default function LayarIzin(): React.JSX.Element {
  const izin = useIzinAplikasi();
  const absenTerhalang = izin.kamera === 'ditolak' || izin.lokasi === 'ditolak';

  const baris: { kunci: string; judul: string; ikon: AnyIconName; ket: string; ketDitolak: string; status: StatusIzin }[] = [
    { kunci: 'kamera', judul: 'Kamera', ikon: 'camera', ket: 'Selfie saat check-in dan check-out', ketDitolak: 'Diperlukan untuk selfie absensi', status: izin.kamera },
    { kunci: 'lokasi', judul: 'Lokasi', ikon: 'map-pin', ket: 'Hanya saat aplikasi dipakai · presisi', ketDitolak: 'Diperlukan untuk geofence kantor', status: izin.lokasi },
    { kunci: 'notifikasi', judul: 'Notifikasi', ikon: 'bell', ket: 'Persetujuan, tugas, rapat', ketDitolak: 'Persetujuan, tugas, rapat', status: izin.notifikasi },
  ];

  return (
    <Screen header={<SubAppBar title="Izin aplikasi" />}>
      <Text variant="body" tone="muted">
        RuangKerja hanya memakai izin saat Anda check-in atau check-out. Lokasi tidak dilacak terus-menerus.
      </Text>

      <Card variant="flat">
        {baris.map((b, i) => (
          <ListRow
            key={b.kunci}
            divider={i > 0}
            icon={b.ikon}
            iconTone={b.status === 'diizinkan' ? 'ok' : b.status === 'memeriksa' ? 'neutral' : 'warn'}
            title={b.judul}
            subtitle={b.status === 'ditolak' ? b.ketDitolak : b.ket}
            trailing={<LencanaIzin status={b.status} />}
            onPress={b.kunci === 'notifikasi' && b.status !== 'diizinkan' ? () => router.push('/pengaturan/notifikasi-izin' as never) : undefined}
          />
        ))}
      </Card>

      {absenTerhalang ? (
        <Banner tone="warn" message="Check-in GPS + selfie tidak bisa dilakukan tanpa izin ini. Pakai QR kiosk atau minta koreksi ke HR bila perlu." />
      ) : null}

      <View style={{ gap: 8 }}>
        <GroupLabel>Kanal notifikasi Android</GroupLabel>
        <Card variant="flat">
          <ListRow
            icon="bell-ring"
            title="Atur per jenis di Setelan Android"
            subtitle="Absensi, tugas, persetujuan, rapat, obrolan, pengumuman & ringkasan"
            onPress={izin.bukaSetelan}
            accessibilityLabel="Buka setelan notifikasi Android"
          />
        </Card>
      </View>

      <Button title="Buka Setelan Android" variant="outline" icon="settings" onPress={izin.bukaSetelan} />
    </Screen>
  );
}
