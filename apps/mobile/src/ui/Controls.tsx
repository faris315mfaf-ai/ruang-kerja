import { useEffect } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { motion, radius, useTheme } from '@/theme';

import { Gradient } from './Gradient';
import { Icon, type AnyIconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

// ── Switch 52×32 ─────────────────────────────────────────────────────────────

export function Switch({
  value,
  onValueChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (nilai: boolean) => void;
  /** Label TalkBack bila tidak ada teks di sebelahnya. */
  label?: string;
  disabled?: boolean;
}): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const kurangiGerak = useReducedMotion();
  const p = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    p.value = kurangiGerak ? (value ? 1 : 0) : withTiming(value ? 1 : 0, { duration: motion.base, easing: motion.ease });
  }, [value, kurangiGerak, p]);

  const gayaAktif = useAnimatedStyle(() => ({ opacity: p.value }));
  const gayaKenop = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(p.value, [0, 1], [3, 23]) }] }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      scaleTo={1}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      style={[s.trek, { backgroundColor: disabled ? colors.surface2 : colors.borderStrong }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, gayaAktif, { borderRadius: 16, overflow: 'hidden', opacity: disabled ? 0.5 : undefined }]}>
        <Gradient name="aksi" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[s.kenop, { boxShadow: shadows.knob }, gayaKenop]} />
    </Pressable>
  );
}

// ── Checkbox & Radio (baris ≥ 48) ────────────────────────────────────────────

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  style,
}: {
  checked: boolean;
  onChange: (nilai: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      scaleTo={1}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      style={[s.baris, style]}
    >
      <View style={[s.centang, { borderColor: checked ? 'transparent' : colors.borderStrong, opacity: disabled ? 0.5 : 1 }]}>
        {checked ? (
          <>
            <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 5 }]} />
            <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.6} />
          </>
        ) : null}
      </View>
      {label ? (
        <Text variant="body" style={{ flex: 1 }}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function Radio({
  selected,
  onSelect,
  label,
  description,
  disabled = false,
  style,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      scaleTo={1}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={[s.baris, style]}
    >
      <View style={[s.radio, { borderColor: selected ? colors.primary : colors.borderStrong, opacity: disabled ? 0.5 : 1 }]}>
        {selected ? <View style={[s.radioIsi, { backgroundColor: colors.primary }]} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        {description ? <Text variant="meta">{description}</Text> : null}
      </View>
    </Pressable>
  );
}

// ── Segmen & tab ─────────────────────────────────────────────────────────────

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  badge?: number | null;
}

export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  variant = 'soft',
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** `soft`: pilihan putih · `solid`: pilihan gradien aksi. */
  variant?: 'soft' | 'solid';
}): React.JSX.Element {
  const { colors, shadows } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[s.segmen, { backgroundColor: colors.surface2 }]}>
      {options.map((opsi) => {
        const aktif = opsi.value === value;
        const solid = aktif && variant === 'solid';
        return (
          <Pressable
            key={opsi.value}
            onPress={() => onChange(opsi.value)}
            scaleTo={1}
            accessibilityRole="tab"
            accessibilityLabel={opsi.badge ? `${opsi.label}, ${opsi.badge}` : opsi.label}
            accessibilityState={{ selected: aktif }}
            style={[s.segmenItem, aktif && !solid ? { backgroundColor: colors.surface, boxShadow: shadows.segment } : null]}
          >
            {solid ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} /> : null}
            <Text variant="label" style={{ color: solid ? '#FFFFFF' : aktif ? colors.text : colors.muted }} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              {opsi.label}
            </Text>
            {opsi.badge !== null && opsi.badge !== undefined ? (
              <View style={[s.segmenBadge, { backgroundColor: solid ? 'rgba(255,255,255,0.25)' : aktif ? colors.primary : colors.borderStrong }]}>
                <Text variant="meta" weight={700} style={{ fontSize: 11, lineHeight: 14, color: solid ? '#FFFFFF' : aktif ? colors.primaryFg : colors.surface }} maxFontSizeMultiplier={1.2}>
                  {opsi.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Nama lama (`Segmented`) — API sama, gaya soft. */
export const Segmented = SegmentedTabs;

/** Tab bergaris bawah 3 px (Tugas · Dokumen 6 · File 24); bergulir bila sempit. */
export function TabNav<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={{ flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 20 }}
    >
      {options.map((opsi) => {
        const aktif = opsi.value === value;
        return (
          <Pressable
            key={opsi.value}
            onPress={() => onChange(opsi.value)}
            scaleTo={1}
            accessibilityRole="tab"
            accessibilityState={{ selected: aktif }}
            style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: aktif ? colors.primary : 'transparent' }}
          >
            <Text variant="title" tone={aktif ? 'link' : 'muted'} weight={aktif ? 700 : 600}>
              {opsi.badge !== null && opsi.badge !== undefined ? `${opsi.label}  ${opsi.badge}` : opsi.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ── Chip ─────────────────────────────────────────────────────────────────────

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  count,
  variant = 'filter',
  onDismiss,
  disabled = false,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: AnyIconName;
  count?: number;
  /** `filter`: pilihan tunggal (aktif = gradien) · `tonal`: pilihan ganda (link-soft + centang). */
  variant?: 'filter' | 'tonal';
  /** Menampilkan × yang menghapus chip. */
  onDismiss?: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const gradien = selected && variant === 'filter';
  const tonal = selected && variant === 'tonal';
  const fg = gradien ? '#FFFFFF' : tonal ? colors.link : disabled ? colors.subtle : colors.muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      accessibilityState={{ selected, disabled }}
      hitSlop={3}
      style={[
        s.chip,
        {
          backgroundColor: gradien ? 'transparent' : tonal ? colors.linkSoft : disabled ? colors.surface2 : colors.surface,
          borderColor: gradien || tonal ? 'transparent' : colors.border,
        },
      ]}
    >
      {gradien ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 21 }]} /> : null}
      {tonal ? <Icon name="check" size={16} color={fg} /> : icon ? <Icon name={icon} size={16} color={fg} /> : null}
      {/* simple + flexShrink 0: Android kadang mengukur label sedikit lebih sempit dari
          glyph-nya (font kustom), lalu numberOfLines memotongnya menjadi "Sem…". */}
      <Text variant="label" style={{ color: fg, flexShrink: 0 }} numberOfLines={1} textBreakStrategy="simple" maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="label" style={{ color: fg, opacity: 0.85 }} maxFontSizeMultiplier={1.4}>
          {String(count)}
        </Text>
      ) : null}
      {onDismiss ? (
        <Pressable onPress={onDismiss} scaleTo={1} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Hapus ${label}`}>
          <Icon name="x" size={16} color={fg} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Baris chip bergulir horizontal (maks. satu baris, tidak membungkus). */
export function ChipScroller({ children, contentStyle }: { children: React.ReactNode; contentStyle?: StyleProp<ViewStyle> }): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={[{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }, contentStyle]}
    >
      {children}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  trek: { width: 52, height: 32, borderRadius: 16, justifyContent: 'center', overflow: 'hidden' },
  kenop: { position: 'absolute', top: 3, left: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  centang: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioIsi: { width: 12, height: 12, borderRadius: 6 },
  segmen: { flexDirection: 'row', padding: 4, borderRadius: radius.lg, gap: 4 },
  segmenItem: { flex: 1, minHeight: 44, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  segmenBadge: { minWidth: 20, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center' },
  chip: { minHeight: 42, borderRadius: 21, borderWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
});
