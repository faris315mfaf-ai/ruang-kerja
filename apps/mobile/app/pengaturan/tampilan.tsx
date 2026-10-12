/**
 * Tampilan — Terang / Gelap / Ikuti sistem (berlaku langsung, tersimpan di
 * perangkat). Mockup: docs/mockups/android/screens/01-akses-akun/15-tampilan.
 */
import { Linking, StyleSheet, View } from 'react-native';

import { darkColors, lightColors, radius, useTheme, type ThemeMode } from '@/theme';
import { Banner, ListRow, Pressable, Screen, SubAppBar, Text, IconTile, Icon } from '@/ui';

const PILIHAN: { nilai: ThemeMode; label: string }[] = [
  { nilai: 'light', label: 'Terang' },
  { nilai: 'dark', label: 'Gelap' },
  { nilai: 'system', label: 'Ikuti sistem' },
];

/** Pratinjau miniatur tema (selalu memakai palet tema yang digambarkan, bukan tema aktif). */
function Pratinjau({ nilai }: { nilai: ThemeMode }): React.JSX.Element {
  const terang = { backgroundColor: lightColors.bg, borderColor: lightColors.border };
  const gelap = { backgroundColor: darkColors.bg, borderColor: darkColors.border };
  return (
    <View style={s.pratinjau} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {nilai === 'system' ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={[s.separuh, terang, { borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }]} />
          <View style={[s.separuh, gelap, { borderTopRightRadius: 12, borderBottomRightRadius: 12 }]} />
        </View>
      ) : (
        <View style={[s.penuh, nilai === 'light' ? terang : gelap]} />
      )}
    </View>
  );
}

export default function LayarTampilan(): React.JSX.Element {
  const { mode, setMode, colors } = useTheme();

  const bukaSetelanTampilan = (): void => {
    void Linking.sendIntent('android.settings.DISPLAY_SETTINGS').catch(() => Linking.openSettings().catch(() => undefined));
  };

  return (
    <Screen header={<SubAppBar title="Tampilan" />}>
      <Text variant="body" tone="muted">
        Pilih tema terang, gelap, atau ikuti sistem.
      </Text>

      <View style={s.baris} accessibilityRole="radiogroup">
        {PILIHAN.map((p) => {
          const aktif = mode === p.nilai;
          return (
            <Pressable
              key={p.nilai}
              onPress={() => setMode(p.nilai)}
              accessibilityRole="radio"
              accessibilityLabel={p.label}
              accessibilityState={{ selected: aktif }}
              style={[
                s.kartu,
                { backgroundColor: colors.surface, borderColor: aktif ? colors.primary : colors.border, borderWidth: aktif ? 2 : 1 },
              ]}
            >
              <Pratinjau nilai={p.nilai} />
              <Text variant="label" weight={700} align="center" numberOfLines={1} maxFontSizeMultiplier={1.4}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Banner tone="info" message={'Mode gelap Android atau Hemat Baterai ikut mengubah tampilan saat memilih "Ikuti sistem".'} />

      <ListRow
        leading={<IconTile icon="a-large-small" />}
        title="Ukuran huruf"
        subtitle="Mengikuti Setelan Android › Tampilan"
        trailing={<Icon name="external-link" size={20} color={colors.muted} />}
        onPress={bukaSetelanTampilan}
        accessibilityLabel="Ukuran huruf, buka Setelan Android"
        style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', gap: 10 },
  kartu: { flex: 1, borderRadius: 20, padding: 8, paddingBottom: 12, gap: 10, minHeight: 124 },
  pratinjau: { height: 72, borderRadius: 14, overflow: 'hidden' },
  separuh: { flex: 1, borderWidth: 1 },
  penuh: { flex: 1, borderWidth: 1, borderRadius: 12 },
});
