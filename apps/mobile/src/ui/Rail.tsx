/**
 * Rail navigasi 96 dp untuk jendela ≥ 600 dp (tablet, lipat terbuka; mockup
 * 12-android-native/16–18, spec 12 §4.10): merek, Cari, Beranda, Tugas,
 * Absen, Obrolan (atau Inbox bila Obrolan mati), Rapat, Lainnya, lalu avatar
 * (Profil) di bawah. Menggantikan kapsul tab bar — Workspace (tombol tengah
 * kontekstual di ponsel) dibuka lewat Lainnya; tahan Absen = Buat cepat.
 * Dipasang lewat `tabBarPosition: 'left'` di `app/(tabs)/_layout.tsx`.
 */
import { router, useFocusEffect } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line } from 'react-native-svg';

import { useSession } from '@/session/SessionProvider';
import { useUnread } from '@/session/UnreadProvider';
import { motion, useTheme } from '@/theme';

import { useAttendanceStatus } from './attendance-status';
import { BuatCepatSheet } from './BuatCepatSheet';
import { useChrome } from './chrome';
import { Gradient } from './Gradient';
import { Icon, type AnyIconName } from './Icon';
import { Avatar, CountBadge } from './Indicators';
import { Pressable } from './Pressable';
import { LEBAR_RAIL } from './tataLetak';
import { Text } from './Text';

interface ItemRail {
  kunci: string;
  label: string;
  icon: AnyIconName;
  /** Tab di navigator (tabs) — selain itu `href` (layar stack). */
  tab?: string;
  href?: '/cari' | '/inbox' | '/rapat';
  lencana?: number | 'titik';
  aksen?: boolean;
}

/** Tile merek kecil (sama dengan ikon aplikasi: tile putih + rute). */
function Merek(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={s.merek} accessible accessibilityRole="image" accessibilityLabel="RuangKerja">
      <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} />
      <View style={[s.merekTile, { backgroundColor: colors.onBadge }]}>
        <Svg width={26} height={26} viewBox="26 26 56 56">
          <Line x1={42} y1={66} x2={66} y2={42} stroke={colors.brand[600]} strokeWidth={5} strokeLinecap="round" />
          <Circle cx={41} cy={67} r={6.5} fill={colors.fill.teal} />
          <Circle cx={67} cy={41} r={6.5} fill={colors.accentBlue} />
        </Svg>
      </View>
    </View>
  );
}

export function Rail({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { jumlah, obrolan: obrolanBelum } = useUnread();
  const { user } = useSession();
  const { badge, refresh } = useAttendanceStatus();
  const { setTabBarVisible } = useChrome();
  const [buatCepat, setBuatCepat] = useState(false);
  const indeksAwal = useRef(state.index);

  // Rail tidak menutupi konten di bawah: snackbar/FAB tidak perlu naik.
  useFocusEffect(
    useCallback(() => {
      setTabBarVisible(false);
    }, [setTabBarVisible]),
  );

  useEffect(() => {
    if (indeksAwal.current !== state.index) {
      indeksAwal.current = state.index;
      if (state.routes[state.index]?.name !== 'absen') {
        void refresh();
      }
    }
  }, [state.index, state.routes, refresh]);

  const fitur = user?.features;
  const chat = fitur?.chat !== false;
  const items: ItemRail[] = [
    { kunci: 'cari', label: 'Cari', icon: 'search', href: '/cari' },
    { kunci: 'index', label: 'Beranda', icon: 'house', tab: 'index' },
    { kunci: 'tugas', label: 'Tugas', icon: 'square-check-big', tab: 'tugas' },
    { kunci: 'absen', label: 'Absen', icon: 'fingerprint', tab: 'absen', aksen: badge },
    chat
      ? { kunci: 'obrolan', label: 'Obrolan', icon: 'message-circle', tab: 'obrolan', lencana: obrolanBelum }
      : { kunci: 'inbox', label: 'Inbox', icon: 'inbox', href: '/inbox', lencana: jumlah },
    ...(fitur?.meetings !== false ? [{ kunci: 'rapat', label: 'Rapat', icon: 'video', href: '/rapat' } satisfies ItemRail] : []),
    { kunci: 'lainnya', label: 'Lainnya', icon: 'layout-grid', tab: 'lainnya', lencana: chat && jumlah > 0 ? 'titik' : undefined },
  ];

  const aktif = state.routes[state.index]?.name;

  const tekan = (item: ItemRail): void => {
    if (item.href) {
      router.push(item.href);
      return;
    }
    const target = state.routes.find((r) => r.name === item.tab);
    if (!target) {
      return;
    }
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (!event.defaultPrevented) {
      navigation.navigate(item.tab as never);
    }
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[
        s.rail,
        {
          width: LEBAR_RAIL + insets.left,
          paddingLeft: insets.left,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 12,
          backgroundColor: colors.glassStrong,
          borderRightColor: colors.border,
        },
      ]}
    >
      <Merek />
      <ScrollView style={{ flex: 1, alignSelf: 'stretch' }} contentContainerStyle={s.daftar} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const dipilih = item.tab !== undefined && aktif === item.tab;
          const fg = dipilih ? colors.onActive : colors.muted;
          const nomor = typeof item.lencana === 'number' ? item.lencana : 0;
          const label =
            item.kunci === 'absen' && item.aksen
              ? 'Absen, waktunya check-out'
              : nomor > 0
                ? `${item.label}, ${nomor} belum dibaca`
                : item.lencana === 'titik'
                  ? `${item.label}, ada yang belum dibaca`
                  : item.label;
          return (
            <Pressable
              key={item.kunci}
              onPress={() => tekan(item)}
              onLongPress={item.kunci === 'absen' ? () => setBuatCepat(true) : undefined}
              delayLongPress={350}
              accessibilityActions={item.kunci === 'absen' ? [{ name: 'buat-cepat', label: 'Buat cepat' }] : undefined}
              onAccessibilityAction={
                item.kunci === 'absen'
                  ? (e) => {
                      if (e.nativeEvent.actionName === 'buat-cepat') setBuatCepat(true);
                    }
                  : undefined
              }
              scaleTo={motion.tabIconPressScale}
              accessibilityRole={item.tab ? 'tab' : 'button'}
              accessibilityLabel={label}
              accessibilityState={item.tab ? { selected: dipilih } : undefined}
              style={s.item}
            >
              {dipilih ? <Gradient name="active" style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} /> : null}
              <View>
                <Icon name={item.icon} size={24} color={fg} />
                {!dipilih && nomor > 0 ? <CountBadge count={nomor} style={s.lencana} /> : null}
                {!dipilih && item.lencana === 'titik' ? <CountBadge dotOnly style={s.titik} /> : null}
                {item.aksen ? (
                  <View style={[s.tandaSeru, { backgroundColor: colors.badge, borderColor: colors.surface }]}>
                    <Text variant="meta" weight={800} style={{ color: colors.onBadge, fontSize: 11, lineHeight: 13 }} maxFontSizeMultiplier={1}>
                      !
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text variant="label" weight={700} style={{ color: fg, fontSize: 12, lineHeight: 16 }} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable onPress={() => router.push('/profil')} accessibilityRole="button" accessibilityLabel={`Profil ${user?.name ?? ''}`.trim()} style={s.avatar}>
        <Avatar name={user?.name} size="md" ring />
      </Pressable>
      <BuatCepatSheet visible={buatCepat} onClose={() => setBuatCepat(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  rail: { alignItems: 'center', borderRightWidth: StyleSheet.hairlineWidth, gap: 12 },
  merek: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  merekTile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  daftar: { alignItems: 'center', gap: 4, paddingVertical: 4 },
  item: { width: 72, minHeight: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6 },
  lencana: { position: 'absolute', top: -6, right: -10 },
  titik: { position: 'absolute', top: -2, right: -4 },
  tandaSeru: { position: 'absolute', top: -5, right: -8, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
});
