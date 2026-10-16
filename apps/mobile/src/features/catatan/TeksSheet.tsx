/** Tampilan teks A−/A+ (mockup 19): 90–160% langkah 10%, diingat di perangkat ini. */
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { BottomSheet, Button, Text } from '@/ui';

import { SKALA_MAX, SKALA_MIN, useUkuranHuruf } from './ukuranHuruf';

export function TeksSheet({ visible, onClose }: { visible: boolean; onClose: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const { skala, naik, turun } = useUkuranHuruf();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tampilan teks">
      <Text variant="meta" style={{ marginTop: -8 }}>
        Ukuran huruf isi catatan, diingat di perangkat ini
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button title="A−" variant="outline" size="md" onPress={turun} disabled={skala <= SKALA_MIN} style={{ flex: 1 }} />
        <Text variant="h2" align="center" style={{ minWidth: 96 }} accessibilityLiveRegion="polite">
          {skala}%
        </Text>
        <Button title="A+" variant="outline" size="md" onPress={naik} disabled={skala >= SKALA_MAX} style={{ flex: 1 }} />
      </View>
      <Text variant="meta" align="center">
        90–160%, langkah 10%
      </Text>
      <View style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, padding: 16 }}>
        <Text style={{ fontSize: (17 * skala) / 100, lineHeight: (26 * skala) / 100 }}>Menjaga stok minimum tiga bulan untuk 12 SKU utama sebelum musim akhir tahun.</Text>
      </View>
    </BottomSheet>
  );
}
