/** Jalur status (pil bergulir): ketuk untuk memindahkan tugas (hak `can.move`). */
import { ScrollView, StyleSheet } from 'react-native';

import type { OpsiStatus } from '@/api/tugas';
import { radius, useTheme } from '@/theme';
import { Gradient, Pressable, Text } from '@/ui';

export function StatusTrack({ statuses, nilai, onPilih, disabled = false }: { statuses: OpsiStatus[]; nilai: string; onPilih: (id: string) => void; disabled?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, marginHorizontal: -16 }}
      contentContainerStyle={[s.trek, { paddingHorizontal: 16 }]}
      accessibilityRole="radiogroup"
    >
      {statuses.map((st) => {
        const aktif = st.id === nilai;
        return (
          <Pressable
            key={st.id}
            disabled={disabled}
            onPress={() => !aktif && onPilih(st.id)}
            scaleTo={0.97}
            accessibilityRole="radio"
            accessibilityLabel={`Status ${st.name}`}
            accessibilityState={{ selected: aktif, disabled }}
            style={[s.pil, { backgroundColor: aktif ? 'transparent' : colors.surface2 }]}
          >
            {aktif ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} /> : null}
            <Text variant="label" weight={700} style={{ color: aktif ? '#FFFFFF' : colors.muted }} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {st.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  trek: { gap: 6, paddingVertical: 4 },
  pil: { minHeight: 44, borderRadius: radius.lg, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
