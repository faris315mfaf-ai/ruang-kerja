/**
 * Pemilih tampilan dashboard per peran (spec 02, `12-pemilih-tampilan-peran`):
 * Saya · Kepala Divisi · HR · Direksi. Staf tidak punya pemilih. Direksi
 * belum punya API di aplikasi (Bagian 5): chip tampil nonaktif ("segera").
 */
import { Pressable as RNPressable, View } from 'react-native';

import type { ItemTampilan, KunciTampilan } from '@/api/beranda';
import { useTheme } from '@/theme';
import { Chip, ChipScroller, Icon, Text } from '@/ui';

import { bukaDashboardDireksi } from './nav';

const LABEL: Record<KunciTampilan, string> = { saya: 'Saya', divisi: 'Kepala Divisi', hr: 'HR', direksi: 'Direksi' };

export function PemilihTampilan({
  tersedia,
  aktif,
  onPilih,
}: {
  tersedia: ItemTampilan[];
  aktif: KunciTampilan;
  onPilih: (k: KunciTampilan) => void;
}): React.JSX.Element | null {
  const { colors } = useTheme();
  if (tersedia.length <= 1) {
    return null;
  }
  return (
    <View accessibilityRole="radiogroup" style={{ marginHorizontal: -16 }}>
      <ChipScroller>
        {tersedia.map((t) =>
          t.tersedia ? (
            <Chip key={t.key} label={LABEL[t.key] ?? t.label} selected={aktif === t.key} onPress={() => onPilih(t.key)} />
          ) : (
            <RNPressable
              key={t.key}
              onPress={bukaDashboardDireksi}
              accessibilityRole="button"
              accessibilityLabel={`${t.label}, segera hadir di aplikasi`}
              style={{
                minHeight: 42,
                borderRadius: 21,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface2,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon name="lock" size={14} color={colors.subtle} />
              <Text variant="label" tone="subtle">
                {LABEL[t.key] ?? t.label}
              </Text>
              <Text variant="meta" tone="subtle" style={{ fontSize: 12 }}>
                segera
              </Text>
            </RNPressable>
          ),
        )}
      </ChipScroller>
    </View>
  );
}
