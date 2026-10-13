/**
 * Layar keadaan penuh ruang video/pra-gabung (mockup 13 & 20): ubin ikon,
 * judul, penjelasan, hingga tiga tombol, opsional hitung mundur besar.
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Button, IconTile, Text, type AnyIconName, type IconTileTone } from '@/ui';

export interface AksiKeadaan {
  label: string;
  onPress: () => void;
  ikon?: AnyIconName;
  varian?: 'primary' | 'outline' | 'tonal' | 'quiet';
}

export function KeadaanLayar({
  ikon,
  nada = 'neutral',
  judul,
  pesan,
  hitung,
  catatan,
  aksi = [],
  latarRuang = false,
}: {
  ikon: AnyIconName;
  nada?: IconTileTone;
  judul: string;
  pesan?: string;
  /** Teks hitung mundur besar (mis. "14:32"). */
  hitung?: string;
  catatan?: string;
  aksi?: AksiKeadaan[];
  /** Latar `roomDesk` (di dalam ruang) alih-alih latar halaman. */
  latarRuang?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.wadah, latarRuang && { backgroundColor: colors.roomDesk }]} accessibilityLiveRegion="polite">
      <IconTile icon={ikon} tone={nada} size={72} />
      <Text variant="h2" align="center" accessibilityRole="header">
        {judul}
      </Text>
      {pesan ? (
        <Text variant="body" tone="muted" align="center">
          {pesan}
        </Text>
      ) : null}
      {hitung ? (
        <Text variant="display" weight={800} align="center" style={{ fontSize: 48, lineHeight: 56 }} accessibilityLabel={`Dibuka dalam ${hitung}`}>
          {hitung}
        </Text>
      ) : null}
      <View style={s.aksi}>
        {aksi.map((a) => (
          <Button key={a.label} title={a.label} icon={a.ikon} variant={a.varian ?? 'outline'} onPress={a.onPress} />
        ))}
      </View>
      {catatan ? (
        <Text variant="meta" align="center">
          {catatan}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wadah: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 32 },
  aksi: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
});
