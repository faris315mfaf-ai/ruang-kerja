/**
 * Tab bawah: Beranda · Tugas · Absen (tengah menonjol) · Obrolan · Lainnya.
 * Tab Absen memakai tombol bundar utama bergaya Arus; Inbox pindah ke layar
 * Lainnya, jadi lencana belum-dibaca inbox terpasang di tab Lainnya.
 */
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, useTheme } from '@/lib/theme';
import { useUnread } from '@/session/UnreadProvider';

type Ikon = keyof typeof Ionicons.glyphMap;

function TabTombol({
  label,
  icon,
  aktif,
  onPress,
  lencana,
}: {
  label: string;
  icon: Ikon;
  aktif: boolean;
  onPress: () => void;
  lencana?: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: aktif }}
      style={styles.tab}
    >
      <View>
        <Ionicons name={icon} size={24} color={aktif ? colors.primary : colors.subtle} />
        {lencana !== undefined && lencana > 0 ? (
          <View style={[styles.lencana, { backgroundColor: colors.badge }]}>
            <Text style={[styles.lencanaTeks, { color: colors.onBadge }]}>
              {lencana > 99 ? '99+' : lencana}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, { color: aktif ? colors.primary : colors.subtle }]}>{label}</Text>
    </Pressable>
  );
}

function TabBarKita({ state, navigation }: BottomTabBarProps): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { jumlah } = useUnread();

  const rute: { nama: string; label: string; icon: Ikon; lencana?: number }[] = [
    { nama: 'index', label: 'Beranda', icon: 'home-outline' },
    { nama: 'tugas', label: 'Tugas', icon: 'checkbox-outline' },
    { nama: 'absen', label: 'Absen', icon: 'finger-print' },
    { nama: 'obrolan', label: 'Obrolan', icon: 'chatbubbles-outline' },
    { nama: 'lainnya', label: 'Lainnya', icon: 'menu-outline', lencana: jumlah },
  ];

  const ke = (indeks: number, nama: string): void => {
    const event = navigation.emit({
      type: 'tabPress',
      target: String(state.routes[indeks]?.key ?? ''),
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(nama as never);
    }
  };

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {rute.slice(0, 2).map((tab, indeks) => (
        <TabTombol
          key={tab.nama}
          label={tab.label}
          icon={tab.icon}
          aktif={state.index === indeks}
          onPress={() => ke(indeks, tab.nama)}
        />
      ))}

      {/* Tombol tengah menonjol — tab Absen. */}
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel="Absen"
        accessibilityState={{ selected: state.index === 2 }}
        onPress={() => ke(2, 'absen')}
        style={styles.tengah}
      >
        <View style={[styles.tengahBundar, { backgroundColor: colors.primary }]}>
          <Ionicons name="finger-print" size={30} color={colors.primaryFg} />
        </View>
        <Text style={[styles.tabLabel, { color: state.index === 2 ? colors.primary : colors.subtle, marginTop: 4 }]}>
          Absen
        </Text>
      </Pressable>

      {rute.slice(3).map((tab, indeks) => (
        <TabTombol
          key={tab.nama}
          label={tab.label}
          icon={tab.icon}
          lencana={tab.lencana}
          aktif={state.index === indeks + 3}
          onPress={() => ke(indeks + 3, tab.nama)}
        />
      ))}
    </View>
  );
}

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs tabBar={(props) => <TabBarKita {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
      <Tabs.Screen name="tugas" options={{ title: 'Tugas' }} />
      <Tabs.Screen name="absen" options={{ title: 'Absen' }} />
      <Tabs.Screen name="obrolan" options={{ title: 'Obrolan' }} />
      <Tabs.Screen name="lainnya" options={{ title: 'Lainnya' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  lencana: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 18,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 999,
    alignItems: 'center',
  },
  lencanaTeks: { fontSize: 10, fontWeight: '700' },
  tengah: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  tengahBundar: {
    width: 58,
    height: 58,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    shadowColor: '#1E5FD6',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
