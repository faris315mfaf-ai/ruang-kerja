/**
 * Pressable dengan skala tekan (0,98 default; ikon tab 0,9; FAB 0,95),
 * 120 ms ease-brand, hanya transform. Reduced motion → tanpa animasi.
 *
 * Fokus keyboard/D-pad: cincin `outline` 3px warna `ring` yang mengikuti
 * `borderRadius` elemen (sorotan persegi bawaan Android dimatikan lewat
 * plugin `withNoFocusHighlight`). Komponen yang menggambar cincinnya
 * sendiri (Button) memberi `focusRing={false}`.
 */
import { useState } from 'react';
import { Pressable as RNPressable, type PressableProps as RNPressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion, useTheme } from '@/theme';

const APressable = Animated.createAnimatedComponent(RNPressable);

export interface PressableProps extends Omit<RNPressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Skala saat ditekan; `1` mematikan animasi. */
  scaleTo?: number;
  /** Cincin fokus bawaan; matikan bila komponen menggambar sendiri. */
  focusRing?: boolean;
}

export function Pressable({ style, scaleTo = motion.pressScale, focusRing = true, onPressIn, onPressOut, onFocus, onBlur, ...rest }: PressableProps): React.JSX.Element {
  const { colors } = useTheme();
  const [fokus, setFokus] = useState(false);
  const skala = useSharedValue(1);
  const kurangiGerak = useReducedMotion();
  const animasi = useAnimatedStyle(() => ({ transform: [{ scale: skala.value }] }));

  const ke = (nilai: number): void => {
    skala.set(kurangiGerak ? nilai : withTiming(nilai, { duration: motion.fast, easing: motion.ease }));
  };

  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        ke(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        ke(1);
        onPressOut?.(e);
      }}
      onFocus={(e) => {
        setFokus(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFokus(false);
        onBlur?.(e);
      }}
      style={[style, focusRing && fokus ? { outlineWidth: 3, outlineColor: colors.ring, outlineOffset: 2, outlineStyle: 'solid' } : null, animasi]}
    />
  );
}
