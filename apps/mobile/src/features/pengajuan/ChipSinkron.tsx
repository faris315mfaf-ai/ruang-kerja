/** Chip kecil "Menunggu sinkron" / "Gagal sinkron" untuk pengajuan yang baru tersimpan di HP (offline). */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

export function ChipSinkron({ status = 'menunggu' }: { status?: 'menunggu' | 'gagal' }): React.JSX.Element {
  const { colors } = useTheme();
  const gagal = status === 'gagal';
  const label = gagal ? 'Gagal sinkron' : 'Menunggu sinkron';
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={[s.chip, { backgroundColor: gagal ? colors.dangerSoft : colors.linkSoft }]}>
      <Icon name={gagal ? 'triangle-alert' : 'cloud-upload'} size={14} color={gagal ? colors.danger : colors.link} />
      <Text variant="meta" weight={600} numberOfLines={1} style={{ color: gagal ? colors.danger : colors.link, flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, minHeight: 28, borderRadius: 14, maxWidth: '100%' },
});
