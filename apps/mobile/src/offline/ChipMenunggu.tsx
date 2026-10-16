/**
 * Chip kecil "Menunggu sinkron" / "Gagal sinkron" untuk perubahan yang sudah
 * tersimpan di HP tetapi belum diterima server (tugas, komentar, catatan,
 * laporan). Hanya penanda — tidak interaktif; TalkBack membacakan statusnya.
 */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';

export type StatusSinkronUi = 'menunggu' | 'gagal';

export function ChipMenunggu({ status = 'menunggu', teks }: { status?: StatusSinkronUi; teks?: string }): React.JSX.Element {
  const { colors } = useTheme();
  const gagal = status === 'gagal';
  const label = teks ?? (gagal ? 'Gagal sinkron' : 'Menunggu sinkron');
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[s.chip, { backgroundColor: gagal ? colors.dangerSoft : colors.linkSoft }]}
    >
      <Icon name={gagal ? 'triangle-alert' : 'cloud-upload'} size={14} color={gagal ? colors.danger : colors.link} />
      <Text variant="meta" weight={600} numberOfLines={1} style={{ color: gagal ? colors.danger : colors.link, flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, minHeight: 26, borderRadius: 13, maxWidth: '100%' },
});
