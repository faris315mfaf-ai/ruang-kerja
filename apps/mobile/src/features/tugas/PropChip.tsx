/** Pil properti tugas (status, prioritas, penanggung, tenggat, label) — terkunci = abu + gembok. */
import { StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';
import { Icon, Pressable, Text } from '@/ui';

export function PropChip({
  leading,
  label,
  onPress,
  terkunci = false,
  putus = false,
  aktif = false,
  aksesLabel,
}: {
  leading?: React.ReactNode;
  label: string;
  onPress?: () => void;
  terkunci?: boolean;
  /** Garis putus-putus: properti kosong ("Label"). */
  putus?: boolean;
  aktif?: boolean;
  aksesLabel?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const isi = (
    <>
      {leading ? <View style={{ alignItems: 'center', justifyContent: 'center' }}>{leading}</View> : null}
      <Text variant="label" weight={600} numberOfLines={1} maxFontSizeMultiplier={1.4} style={{ flexShrink: 1 }} tone={terkunci ? 'muted' : aktif ? 'link' : 'text'}>
        {label}
      </Text>
      {terkunci ? <Icon name="lock" size={15} color={colors.subtle} /> : null}
    </>
  );
  const gaya = [
    s.pil,
    {
      backgroundColor: terkunci ? colors.surface2 : aktif ? colors.linkSoft : colors.surface,
      borderColor: aktif ? colors.primary : colors.border,
      borderStyle: putus ? ('dashed' as const) : ('solid' as const),
    },
  ];
  return (
    <Pressable
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={aksesLabel ?? (terkunci ? `${label}, terkunci` : label)}
      accessibilityState={{ disabled: terkunci && !onPress }}
      style={gaya}
    >
      {isi}
    </Pressable>
  );
}

const s = StyleSheet.create({
  pil: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, maxWidth: '100%' },
});
