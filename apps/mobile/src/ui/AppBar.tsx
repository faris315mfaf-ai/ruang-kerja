import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, useTheme } from '@/theme';

import { IconButton, type IconButtonProps } from './Button';
import { Glass } from './Gradient';
import { usePanel } from './panel';
import { Text } from './Text';

export type AppBarAction = Pick<IconButtonProps, 'icon' | 'label' | 'onPress' | 'badge' | 'disabled'>;

/**
 * App bar besar untuk layar akar tab: judul 32/40 (atau sapaan dengan
 * overline di atasnya) + tombol bulat 48 di kanan (cari, lonceng berlencana).
 * Ditaruh di dalam `Screen` (area aman atas sudah ditangani Screen).
 */
export function AppBar({
  title,
  overline,
  subtitle,
  actions = [],
}: {
  title: string;
  /** Teks kecil kapital di atas judul, mis. tanggal ("SELASA, 13 OKT"). */
  overline?: string;
  subtitle?: string;
  actions?: AppBarAction[];
}): React.JSX.Element {
  return (
    <View style={s.besar}>
      <View style={{ flex: 1, gap: 2 }}>
        {overline ? <Text variant="overline">{overline}</Text> : null}
        <Text variant="display" accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>{subtitle}</Text> : null}
      </View>
      {actions.length > 0 ? (
        <View style={s.aksi}>
          {actions.map((a) => (
            <IconButton key={a.label} {...a} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * App bar layar turunan: 56 px kaca, tombol kembali bulat, judul 17/700.
 * Menangani inset status bar sendiri — taruh di luar area bergulir.
 */
export function SubAppBar({
  title,
  onBack,
  actions = [],
  transparent = false,
}: {
  title: string;
  /** Bawaan: `router.back()`. */
  onBack?: () => void;
  actions?: AppBarAction[];
  /** Tanpa kaca/garis (di atas hero). */
  transparent?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const panel = usePanel();
  // Panel tablet (detail di samping daftar): Tutup bila panel bisa ditutup, selain itu tanpa tombol.
  const tombolKembali =
    onBack || !panel.tertanam ? (
      <IconButton icon="arrow-left" label="Kembali" variant="ghost" onPress={onBack ?? (() => router.back())} />
    ) : panel.tutup ? (
      <IconButton icon="x" label="Tutup" variant="ghost" onPress={panel.tutup} />
    ) : (
      <View style={{ width: 8 }} />
    );
  const isi = (
    <View style={[s.sub, { height: layout.appBar }]}>
      {tombolKembali}
      <Text variant="title" weight={700} numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
        {title}
      </Text>
      {actions.map((a) => (
        <IconButton key={a.label} {...a} variant="ghost" />
      ))}
    </View>
  );
  if (transparent) {
    return <View style={{ paddingTop: insets.top }}>{isi}</View>;
  }
  return (
    <Glass style={{ paddingTop: insets.top, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, borderWidth: 0 }}>{isi}</Glass>
  );
}

const s = StyleSheet.create({
  besar: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 12, paddingBottom: 4 },
  aksi: { flexDirection: 'row', gap: 8 },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
});
