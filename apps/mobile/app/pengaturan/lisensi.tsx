/**
 * Lisensi sumber terbuka — pustaka utama yang dipakai aplikasi ponsel.
 * Daftar ringkas (bukan seluruh dependensi transitif).
 */
import { Card, ListRow, Meta, Screen, SubAppBar, Text } from '@/ui';

const PUSTAKA: { nama: string; lisensi: string }[] = [
  { nama: 'React & React Native', lisensi: 'MIT' },
  { nama: 'Expo SDK & Expo Router', lisensi: 'MIT' },
  { nama: 'react-native-reanimated', lisensi: 'MIT' },
  { nama: 'react-native-gesture-handler', lisensi: 'MIT' },
  { nama: 'react-native-safe-area-context & react-native-screens', lisensi: 'MIT' },
  { nama: 'react-native-svg', lisensi: 'MIT' },
  { nama: '@gorhom/bottom-sheet', lisensi: 'MIT' },
  { nama: 'Lucide (ikon)', lisensi: 'ISC' },
  { nama: 'Figtree (huruf)', lisensi: 'SIL OFL 1.1' },
  { nama: 'JetBrains Mono (huruf)', lisensi: 'SIL OFL 1.1' },
];

export default function LayarLisensi(): React.JSX.Element {
  return (
    <Screen header={<SubAppBar title="Lisensi sumber terbuka" />}>
      <Text variant="body" tone="muted">
        RuangKerja dibangun di atas perangkat lunak sumber terbuka berikut. Terima kasih kepada para pengembangnya.
      </Text>
      <Card variant="flat">
        {PUSTAKA.map((p, i) => (
          <ListRow key={p.nama} divider={i > 0} title={p.nama} subtitle={`Lisensi ${p.lisensi}`} />
        ))}
      </Card>
      <Meta style={{ textAlign: 'center' }}>Teks lisensi lengkap ada di repositori masing-masing pustaka.</Meta>
    </Screen>
  );
}
