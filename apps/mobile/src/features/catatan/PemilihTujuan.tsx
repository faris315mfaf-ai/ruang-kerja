/** Daftar tujuan pindah (Tingkat atas + folder) dengan penanda terpilih. */
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Icon, Pressable, Text } from '@/ui';

import type { TujuanPindah } from './pohon';

export function PemilihTujuan({
  tujuan,
  terpilih,
  onPilih,
  maxTinggi,
}: {
  tujuan: TujuanPindah[];
  terpilih: string | null;
  onPilih: (id: string | null) => void;
  maxTinggi?: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.daftar, { borderColor: colors.border, backgroundColor: colors.surface, maxHeight: maxTinggi }]}>
      {tujuan.map((t, i) => {
        const pilih = t.id === terpilih;
        return (
          <Pressable
            key={t.id ?? 'akar'}
            onPress={() => onPilih(t.id)}
            scaleTo={1}
            accessibilityRole="radio"
            accessibilityState={{ selected: pilih }}
            accessibilityLabel={t.label}
            style={[s.baris, { paddingLeft: 14 + t.depth * 20 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }, pilih && { backgroundColor: colors.linkSoft }]}
          >
            <Icon name={t.id === null ? 'corner-left-up' : 'folder'} size={20} color={pilih ? colors.link : colors.muted} />
            <Text variant="body" style={{ flex: 1 }} numberOfLines={1} tone={pilih ? 'link' : 'text'}>
              {t.label}
            </Text>
            {pilih ? <Icon name="check" size={20} color={colors.link} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  daftar: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingRight: 14 },
});
