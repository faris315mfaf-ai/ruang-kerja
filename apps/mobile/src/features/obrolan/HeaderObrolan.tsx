/**
 * Header layar obrolan (mockup 07/15/16): tombol kembali, ubin/identitas,
 * judul + subjudul, dan aksi ikon di kanan. Kaca dengan garis bawah.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, useTheme } from '@/theme';
import { Glass, IconButton, Pressable, Text, type AppBarAction } from '@/ui';
import { usePanel } from '@/ui/panel';

export function HeaderObrolan({
  leading,
  title,
  subtitle,
  onPressTitle,
  actions = [],
  onBack,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  onPressTitle?: () => void;
  actions?: AppBarAction[];
  onBack?: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const panel = usePanel();
  const identitas = (
    <>
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="title" weight={700} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="meta" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </>
  );
  return (
    <Glass style={{ paddingTop: insets.top, borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <View style={[s.bar, { minHeight: layout.appBar + 8 }]}>
        {onBack || !panel.tertanam ? (
          <IconButton icon="arrow-left" label="Kembali" variant="ghost" onPress={onBack ?? (() => router.back())} />
        ) : panel.tutup ? (
          <IconButton icon="x" label="Tutup" variant="ghost" onPress={panel.tutup} />
        ) : (
          <View style={{ width: 8 }} />
        )}
        {onPressTitle ? (
          <Pressable onPress={onPressTitle} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${title}, buka detail`} style={s.identitas}>
            {identitas}
          </Pressable>
        ) : (
          <View style={s.identitas}>{identitas}</View>
        )}
        {actions.map((a) => (
          <IconButton key={a.label} {...a} variant="ghost" />
        ))}
      </View>
    </Glass>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  identitas: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
});
