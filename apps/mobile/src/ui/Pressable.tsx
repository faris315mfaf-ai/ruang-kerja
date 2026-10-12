/**
 * Pressable dengan skala tekan (0,98 default; ikon tab 0,9; FAB 0,95),
 * 120 ms ease-brand, hanya transform. Reduced motion → tanpa animasi.
 */
import { Pressable as RNPressable, type PressableProps as RNPressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion } from '@/theme';

const APressable = Animated.createAnimatedComponent(RNPressable);

export interface PressableProps extends Omit<RNPressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Skala saat ditekan; `1` mematikan animasi. */
  scaleTo?: number;
}

export function Pressable({ style, scaleTo = motion.pressScale, onPressIn, onPressOut, ...rest }: PressableProps): React.JSX.Element {
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
      style={[style, animasi]}
    />
  );
}
