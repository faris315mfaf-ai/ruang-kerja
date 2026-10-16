/**
 * Chip kecil "Offline · data per 09.12" di atas isi `Screen`: muncul bila ada
 * respons yang dijawab dari cache sejak layar dipasang. Begitu jaringan kembali
 * ia berubah menjadi "Data per 09.12 · tarik untuk memperbarui" dan layar yang
 * punya `onRefresh` dimuat ulang otomatis sekali.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';

import { useDataBasi } from './basi';
import { waktuRingkas } from './format';
import { useOnline } from './jaringan';

export function ChipDataBasi({ onMuatUlang }: { onMuatUlang?: () => void }): React.JSX.Element | null {
  const { colors } = useTheme();
  const { basi, ts } = useDataBasi();
  const online = useOnline();
  const muatUlang = useRef(onMuatUlang);
  const sudahDimuat = useRef(false);

  useEffect(() => {
    muatUlang.current = onMuatUlang;
  });

  // Jaringan kembali sementara data masih basi → muat ulang sekali (setelah jeda singkat agar sinkron antrean jalan lebih dulu).
  useEffect(() => {
    if (!basi) {
      sudahDimuat.current = false;
      return undefined;
    }
    if (!online || sudahDimuat.current || !muatUlang.current) {
      return undefined;
    }
    const t = setTimeout(() => {
      sudahDimuat.current = true;
      muatUlang.current?.();
    }, 800);
    return () => clearTimeout(t);
  }, [basi, online]);

  if (!basi || ts === null) {
    return null;
  }
  const jam = waktuRingkas(ts);
  const teks = online ? `Data per ${jam} · tarik ke bawah untuk memperbarui` : `Offline · data per ${jam}`;
  return (
    <View style={[s.chip, { backgroundColor: colors.surface2 }]} accessible accessibilityRole="text" accessibilityLabel={teks} accessibilityLiveRegion="polite">
      <Icon name={online ? 'refresh-cw' : 'cloud-off'} size={14} color={colors.muted} />
      <Text variant="meta" weight={600} numberOfLines={1} style={{ flexShrink: 1 }}>
        {teks}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 28, borderRadius: 14, maxWidth: '100%' },
});
