import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { RefObject } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { pageGlow, useTheme, type GradientName } from '@/theme';

/** Sudut CSS 135° (kiri-atas → kanan-bawah). */
const START = { x: 0, y: 0 } as const;
const END = { x: 1, y: 1 } as const;

export interface GradientProps {
  name?: GradientName;
  style?: StyleProp<ViewStyle>;
  /** Sudut horizontal 90° (isian progres) alih-alih diagonal. */
  horizontal?: boolean;
  children?: React.ReactNode;
}

/** Gradien Arus bernama (aksi, merek, hangat, indigo, slate, soft, active). */
export function Gradient({ name = 'aksi', style, horizontal = false, children }: GradientProps): React.JSX.Element {
  const { gradients } = useTheme();
  return (
    <LinearGradient
      colors={[...gradients[name]]}
      start={START}
      end={horizontal ? { x: 1, y: 0 } : END}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

/**
 * Latar halaman: `bg` + dua cahaya radial (teal kiri atas, biru kanan atas)
 * — `--page-glow`. Ditaruh di belakang konten (`absoluteFill`, tidak
 * menangkap sentuhan).
 */
export function PageGlow(): React.JSX.Element {
  const { colors, dark } = useTheme();
  const glow = dark ? pageGlow.dark : pageGlow.light;
  const tepi = (rgb: string): string => rgb.replace(/[\d.]+\)$/, '0)');
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.cahaya,
          {
            left: 0,
            experimental_backgroundImage: [
              {
                type: 'radial-gradient',
                shape: 'ellipse',
                size: { x: 420, y: 260 },
                position: { top: 0, left: 0 },
                colorStops: [{ color: glow.teal, positions: ['0%'] }, { color: tepi(glow.teal), positions: ['70%'] }],
              },
            ],
          },
        ]}
      />
      <View
        style={[
          styles.cahaya,
          {
            right: 0,
            experimental_backgroundImage: [
              {
                type: 'radial-gradient',
                shape: 'ellipse',
                size: { x: 420, y: 260 },
                position: { top: 0, right: 0 },
                colorStops: [{ color: glow.blue, positions: ['0%'] }, { color: tepi(glow.blue), positions: ['70%'] }],
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cahaya: { position: 'absolute', top: 0, width: 420, height: 260 },
});

export interface GlassProps {
  /** Varian kuat (sheet, dialog, popover) vs bar/kapsul. */
  strong?: boolean;
  /**
   * Ref `BlurTargetView` (expo-blur) yang membungkus konten di belakang
   * kaca. Bila diberikan, latar benar-benar diburamkan; tanpa itu (bawaan)
   * kaca hanya latar tembus yang lebih pekat.
   */
  blurTarget?: RefObject<View | null>;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Permukaan kaca: latar tembus `glass` + garis tipis. Android tidak punya
 * blur latar murah tanpa `BlurTargetView`, jadi kaca dibuat lebih pekat
 * (0,82–0,94) agar teks tetap terbaca di atas konten apa pun.
 */
export function Glass({ strong = false, blurTarget, style, children }: GlassProps): React.JSX.Element {
  const { colors, dark } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: strong ? colors.glassStrong : colors.glass, borderColor: colors.glassBorder, borderWidth: StyleSheet.hairlineWidth },
        style,
      ]}
    >
      {blurTarget ? (
        <BlurView
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={strong ? 70 : 50}
          tint={dark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
}
