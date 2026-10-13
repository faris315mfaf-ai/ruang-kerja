/**
 * Baris geser (geser ke kiri → aksi di kanan, mis. Tunda · Selesai). Setiap
 * aksi 88 lebar. Aksi yang sama harus tersedia lewat menu (TalkBack) —
 * pemanggil menyediakan `accessibilityActions`.
 */
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { radius, useTheme } from '@/theme';
import { Icon, Pressable, Text, type IconName } from '@/ui';

export interface AksiGeser {
  label: string;
  icon: IconName;
  tone: 'primary' | 'soft' | 'danger' | 'info';
  onPress: () => void;
}

const LEBAR = 88;

export function SwipeRow({ aksi, children, onBuka }: { aksi: AksiGeser[]; children: React.ReactNode; onBuka?: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const ref = useRef<SwipeableMethods | null>(null);
  if (aksi.length === 0) {
    return <>{children}</>;
  }
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      overshootRight={false}
      rightThreshold={36}
      onSwipeableOpen={onBuka}
      renderRightActions={() => (
        <View style={s.aksi}>
          {aksi.map((a) => {
            const bg = a.tone === 'primary' ? colors.primary : a.tone === 'danger' ? colors.danger : a.tone === 'info' ? colors.infoSoft : colors.surface2;
            const fg = a.tone === 'primary' || a.tone === 'danger' ? '#FFFFFF' : a.tone === 'info' ? colors.info : colors.text;
            return (
              <Pressable
                key={a.label}
                scaleTo={1}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                onPress={() => {
                  ref.current?.close();
                  a.onPress();
                }}
                style={[s.tombol, { backgroundColor: bg }]}
              >
                <Icon name={a.icon} size={22} color={fg} />
                <Text variant="label" weight={700} style={{ color: fg }} maxFontSizeMultiplier={1.3}>
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const s = StyleSheet.create({
  aksi: { flexDirection: 'row', marginLeft: 8, borderRadius: radius.card, overflow: 'hidden' },
  tombol: { width: LEBAR, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
