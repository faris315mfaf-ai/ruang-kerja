/** Ikon kecil khusus Catatan: spinner, ikon status simpan, tombol bar 44. */
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { Icon, Pressable } from '@/ui';

import type { StatusSimpan } from './sesiSimpan';

/** Lingkaran berputar (berhenti di frame diam dengan reduced motion). */
export function Spin({ size = 22, color }: { size?: number; color: string }): React.JSX.Element {
  const kurangiGerak = useReducedMotion();
  const sudut = useSharedValue(0);
  useEffect(() => {
    if (kurangiGerak) {
      cancelAnimation(sudut);
      sudut.value = 0;
      return undefined;
    }
    sudut.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(sudut);
  }, [kurangiGerak, sudut]);
  const gaya = useAnimatedStyle(() => ({ transform: [{ rotate: `${sudut.value}deg` }] }));
  return (
    <Animated.View style={gaya}>
      <Icon name="loader-circle" size={size} color={color} />
    </Animated.View>
  );
}

/**
 * Ikon status simpan/online gabungan (mockup 13): menyimpan = putar,
 * tersimpan = awan + centang hijau, belum tersimpan = awan dicoret + titik
 * kuning, konflik = segitiga peringatan.
 */
export function IkonStatusSimpan({ status, kotor, diHp = false }: { status: StatusSimpan; kotor: boolean; diHp?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  if (status === 'menyimpan') {
    return <Spin color={colors.muted} />;
  }
  if (status === 'konflik') {
    return <Icon name="triangle-alert" size={22} color={colors.warning} />;
  }
  if (status === 'gagal' || kotor) {
    return (
      <View style={s.tumpuk}>
        <Icon name="cloud-off" size={22} color={colors.muted} />
        <View style={[s.titik, { backgroundColor: colors.warning, borderColor: colors.surface }]} />
      </View>
    );
  }
  if (diHp) {
    // Tersimpan di HP, menunggu sinkron: ponsel + centang.
    return (
      <View style={s.tumpuk}>
        <Icon name="smartphone" size={22} color={colors.link} />
        <View style={s.centang}>
          <Icon name="check" size={11} color={colors.link} strokeWidth={3} />
        </View>
      </View>
    );
  }
  return (
    <View style={s.tumpuk}>
      <Icon name="cloud" size={22} color={colors.success} />
      <View style={s.centang}>
        <Icon name="check" size={11} color={colors.success} strokeWidth={3} />
      </View>
    </View>
  );
}

/** Tombol 44 px di app bar editor (isi bebas, pilihan tonal untuk "aktif"). */
export function TombolBar({
  label,
  onPress,
  children,
  aktif = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  aktif?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: aktif, disabled }}
      hitSlop={2}
      style={[s.tombol, aktif && { backgroundColor: colors.linkSoft, borderColor: colors.primary, borderWidth: 1.5 }, disabled && { opacity: 0.45 }, style]}
    >
      {children}
    </Pressable>
  );
}

const s = StyleSheet.create({
  tombol: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tumpuk: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  titik: { position: 'absolute', right: 0, top: 1, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  centang: { position: 'absolute', left: 7, top: 8 },
});
