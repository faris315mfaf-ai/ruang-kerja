import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, useTheme } from '@/theme';

import { useTabBarSpace } from './chrome';
import { AppBar, SubAppBar } from './AppBar';
import { Glass, PageGlow } from './Gradient';

export interface ScreenProps {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Bar tetap di atas (mis. `<SubAppBar title="…" />`); tanpa ini Screen menyisakan inset status bar. */
  header?: React.ReactNode;
  /** Bilah aksi bawah (form): menempel di atas inset gestur, naik bersama papan ketik. */
  footer?: React.ReactNode;
  /** `false` = isi tidak digulir (layar penuh seperti kamera/obrolan). */
  scroll?: boolean;
}

/**
 * Kontainer layar: latar bercahaya kembar, area aman, gulir + tarik-untuk-
 * muat-ulang, padding 16, dan ruang bawah untuk kapsul tab bar (otomatis di
 * dalam tabs).
 */
export function Screen({ children, refreshing = false, onRefresh, contentStyle, header, footer, scroll = true }: ScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const ruangTab = useTabBarSpace();
  const bawah = footer ? 16 : ruangTab > 0 ? ruangTab + 8 : insets.bottom + 32;

  const isi = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ paddingHorizontal: layout.gutter, paddingTop: 4, paddingBottom: bawah, gap: 16 }, contentStyle]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: layout.gutter }, contentStyle]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageGlow />
      {header ?? <View style={{ height: insets.top }} />}
      {isi}
      {footer ? <ActionBar>{footer}</ActionBar> : null}
    </View>
  );
}

/** Judul layar akar (kompatibel dengan `ScreenTitle` lama): 32/40 + subjudul. */
export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }): React.JSX.Element {
  return <AppBar title={title} subtitle={subtitle} />;
}

/** Bilah aksi bawah kaca: tombol sekunder kiri (flex 1) + utama kanan (flex 1,4). */
export function ActionBar({ children }: { children: React.ReactNode }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <Glass strong style={[s.aksi, { paddingBottom: insets.bottom + 12 }]}>
      {children}
    </Glass>
  );
}

const s = StyleSheet.create({
  aksi: { flexDirection: 'row', gap: 10, paddingTop: 12, paddingHorizontal: 16, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 },
});

export { SubAppBar, AppBar };
