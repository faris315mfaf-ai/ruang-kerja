/**
 * Tab bar kapsul (70 px, kaca, inset 12, melayang 14): Beranda · Tugas ·
 * [tombol tengah] · Obrolan · Lainnya. Pil aktif = gradien. Tombol tengah
 * bundar 54 yang naik 26 berganti Absen ⇄ Workspace mengikuti
 * `centerAction` (Workspace membuka sheet, bukan halaman). Bila Obrolan
 * dimatikan (`user.features.chat === false`) slot ke-4 menjadi Inbox.
 */
import { router, useFocusEffect } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, motion, radius, useTheme } from '@/theme';

import { useAttendanceStatus } from './attendance-status';
import { useChrome } from './chrome';
import { Gradient } from './Gradient';
import { Icon, type AnyIconName } from './Icon';
import { CountBadge } from './Indicators';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { useUnread } from '@/session/UnreadProvider';
import { useSession } from '@/session/SessionProvider';
import { WorkspaceSheet } from './WorkspaceSheet';

interface ItemTab {
  nama: string;
  label: string;
  icon: AnyIconName;
  /** Rute stack alih-alih tab (slot Inbox). */
  href?: '/inbox';
  lencana?: number | 'titik';
}

/** Flag fitur dari profil (diperluas backend B1); tak ada → obrolan dianggap aktif. */
function obrolanAktif(user: unknown): boolean {
  const fitur = (user as { features?: { chat?: boolean } } | null)?.features;
  return fitur?.chat !== false;
}

function useKeyboardTampil(): boolean {
  const [tampil, setTampil] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setTampil(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setTampil(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return tampil;
}

export function TabBar({ state, navigation }: BottomTabBarProps): React.JSX.Element | null {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { jumlah } = useUnread();
  const { user } = useSession();
  const { center, refresh } = useAttendanceStatus();
  const { setTabBarVisible } = useChrome();
  const keyboard = useKeyboardTampil();
  const [sheet, setSheet] = useState(false);
  const indeksAwal = useRef(state.index);

  // Snackbar/FAB naik di atas kapsul hanya saat tabs benar-benar terlihat.
  useFocusEffect(
    useCallback(() => {
      setTabBarVisible(true);
      return () => setTabBarVisible(false);
    }, [setTabBarVisible]),
  );

  // Pindah tab → segarkan status absen (mis. sehabis check-in di layar Absen).
  useEffect(() => {
    if (indeksAwal.current !== state.index) {
      indeksAwal.current = state.index;
      void refresh();
    }
  }, [state.index, refresh]);

  const chat = obrolanAktif(user);
  const kiri: ItemTab[] = [
    { nama: 'index', label: 'Beranda', icon: 'house' },
    { nama: 'tugas', label: 'Tugas', icon: 'square-check-big' },
  ];
  const kanan: ItemTab[] = [
    chat ? { nama: 'obrolan', label: 'Obrolan', icon: 'message-circle' } : { nama: 'inbox', label: 'Inbox', icon: 'inbox', href: '/inbox', lencana: jumlah },
    { nama: 'lainnya', label: 'Lainnya', icon: 'menu', lencana: chat && jumlah > 0 ? 'titik' : undefined },
  ];

  const rutaAktif = state.routes[state.index]?.name;

  const ke = (nama: string): void => {
    const target = state.routes.find((r) => r.name === nama);
    if (!target) {
      return;
    }
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (!event.defaultPrevented) {
      navigation.navigate(nama as never);
    }
  };

  const tekan = (item: ItemTab): void => {
    if (item.href) {
      router.push(item.href);
    } else {
      ke(item.nama);
    }
  };

  if (keyboard) {
    return null;
  }

  const absen = center === 'absen';
  const diAbsen = rutaAktif === 'absen';

  const renderItem = (item: ItemTab): React.JSX.Element => {
    const aktif = rutaAktif === item.nama;
    const fg = aktif ? colors.onActive : colors.muted;
    const nomor = typeof item.lencana === 'number' ? item.lencana : 0;
    return (
      <Pressable
        key={item.nama}
        onPress={() => tekan(item)}
        scaleTo={motion.tabIconPressScale}
        accessibilityRole="tab"
        accessibilityLabel={nomor > 0 ? `${item.label}, ${nomor} belum dibaca` : item.lencana === 'titik' ? `${item.label}, ada yang belum dibaca` : item.label}
        accessibilityState={{ selected: aktif }}
        style={s.tab}
      >
        {aktif ? <Gradient name="active" style={[StyleSheet.absoluteFill, { borderRadius: 27 }]} /> : null}
        <View>
          <Icon name={item.icon} size={24} color={fg} />
          {!aktif && nomor > 0 ? <CountBadge count={nomor} style={s.lencana} /> : null}
          {!aktif && item.lencana === 'titik' ? <CountBadge dotOnly style={s.titik} /> : null}
        </View>
        <Text variant="label" weight={700} style={{ color: fg, fontSize: 12, lineHeight: 16 }} maxFontSizeMultiplier={1.3} numberOfLines={1}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={[s.pembungkus, { bottom: insets.bottom + layout.tabLift, left: layout.tabInset, right: layout.tabInset }]}>
      <View
        accessibilityRole="tablist"
        style={[s.kapsul, { backgroundColor: colors.glassStrong, borderColor: colors.glassBorder, boxShadow: shadows.float }]}
      >
        {kiri.map(renderItem)}

        <Pressable
          onPress={() => (absen ? ke('absen') : setSheet(true))}
          scaleTo={motion.fabPressScale}
          accessibilityRole="tab"
          accessibilityLabel={absen ? 'Absen' : 'Workspace'}
          accessibilityHint={absen ? undefined : 'Membuka daftar workspace'}
          accessibilityState={{ selected: absen && diAbsen }}
          style={s.tengah}
        >
          <View style={[s.bundar, { boxShadow: `0 0 0 4px ${colors.surface}, ${shadows.button}` }]}>
            <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: radius.full }]} />
            <Icon name={absen ? 'fingerprint' : 'layout-grid'} size={26} color="#FFFFFF" />
          </View>
          <Text variant="label" weight={absen && diAbsen ? 800 : 700} style={{ color: absen && diAbsen ? colors.text : colors.muted, fontSize: 12, lineHeight: 16 }} maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {absen ? 'Absen' : 'Workspace'}
          </Text>
        </Pressable>

        {kanan.map(renderItem)}
      </View>
      <WorkspaceSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  pembungkus: { position: 'absolute', alignItems: 'center' },
  kapsul: {
    width: '100%',
    maxWidth: layout.tabMaxWidth,
    height: layout.tabBar,
    borderRadius: layout.tabBar / 2,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tab: { flex: 1, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tengah: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'flex-end' },
  bundar: {
    position: 'absolute',
    top: -(layout.tabCenterRaise),
    width: layout.tabCenter,
    height: layout.tabCenter,
    borderRadius: layout.tabCenter / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lencana: { position: 'absolute', top: -6, right: -10 },
  titik: { position: 'absolute', top: -2, right: -4 },
});
