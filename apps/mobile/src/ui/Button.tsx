import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { motion, radius, size as ukuran, useTheme } from '@/theme';

import { Gradient } from './Gradient';
import { Icon, type AnyIconName } from './Icon';
import { CountBadge } from './Indicators';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'outline' | 'tonal' | 'quiet' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const TINGGI: Record<ButtonSize, number> = { sm: 40, md: ukuran.controlLg, lg: ukuran.controlXl };

export interface ButtonProps {
  title: string;
  onPress: () => void;
  /**
   * primary (gradien aksi) · outline · tonal · quiet · secondary (abu) ·
   * danger (solid) · ghost (= quiet, nama lama).
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /** Spinner + `loadingTitle`; lebar tetap, tidak bisa ditekan ulang. */
  loading?: boolean;
  loadingTitle?: string;
  icon?: AnyIconName;
  /** Alasan nonaktif — dibacakan TalkBack sebagai petunjuk. */
  disabledReason?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  loadingTitle,
  icon,
  disabledReason,
  accessibilityHint,
  style,
}: ButtonProps): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const [fokus, setFokus] = useState(false);
  const v: Exclude<ButtonVariant, 'ghost'> = variant === 'ghost' ? 'quiet' : variant;
  const mati = disabled || loading;
  const nonaktif = disabled && !loading;

  let bg = 'transparent';
  let fg = colors.text;
  let border = 'transparent';
  if (nonaktif) {
    bg = v === 'quiet' ? 'transparent' : colors.surface2;
    fg = colors.subtle;
  } else {
    switch (v) {
      case 'primary':
        fg = '#FFFFFF';
        break;
      case 'outline':
        bg = colors.surface;
        border = colors.borderStrong;
        break;
      case 'tonal':
        bg = colors.linkSoft;
        fg = colors.link;
        break;
      case 'quiet':
        fg = colors.link;
        break;
      case 'secondary':
        bg = colors.surface2;
        break;
      case 'danger':
        bg = colors.danger;
        fg = colors.onDanger;
        break;
    }
  }
  const gradien = v === 'primary' && !nonaktif;
  const tinggi = TINGGI[size];
  const kecil = size === 'sm';

  const isi = (
    <View style={styles.isi}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Icon name={icon} size={kecil ? 18 : 20} color={fg} />
      ) : null}
      <Text
        weight={700}
        numberOfLines={1}
        style={{ color: fg, fontSize: kecil ? 14 : 16, lineHeight: kecil ? 20 : 22 }}
        maxFontSizeMultiplier={1.5}
      >
        {loading && loadingTitle ? loadingTitle : title}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={mati}
      focusRing={false}
      onFocus={() => setFokus(true)}
      onBlur={() => setFokus(false)}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={nonaktif && disabledReason ? disabledReason : accessibilityHint}
      accessibilityState={{ disabled: mati, busy: loading }}
      style={[
        styles.tombol,
        {
          minHeight: tinggi,
          borderRadius: kecil ? radius.md : radius.control,
          backgroundColor: bg,
          borderColor: border,
          paddingHorizontal: kecil ? 14 : 22,
        },
        gradien ? { boxShadow: shadows.button } : null,
        fokus ? { boxShadow: `0 0 0 3px ${colors.ring}` } : null,
        style,
      ]}
    >
      {gradien ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: kecil ? radius.md : radius.control }]} /> : null}
      {isi}
    </Pressable>
  );
}

// ── Tombol ikon bulat 48 ─────────────────────────────────────────────────────

export interface IconButtonProps {
  icon: AnyIconName;
  /** Wajib: label TalkBack ("Notifikasi", "Cari"). */
  label: string;
  onPress: () => void;
  variant?: 'outline' | 'ghost' | 'primary';
  /** Angka lencana merah; `true` = titik. */
  badge?: number | boolean;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, label, onPress, variant = 'outline', badge, disabled = false, size = ukuran.iconButton, style }: IconButtonProps): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const warnaIkon = variant === 'primary' ? '#FFFFFF' : disabled ? colors.subtle : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={typeof badge === 'number' && badge > 0 ? `${label}, ${badge} belum dibaca` : label}
      accessibilityState={{ disabled }}
      hitSlop={size < 48 ? (48 - size) / 2 : 0}
      style={[
        styles.ikon,
        { width: size, height: size, borderRadius: size / 2 },
        variant === 'outline' && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, boxShadow: shadows.card },
        variant === 'primary' && { boxShadow: shadows.button },
        style,
      ]}
    >
      {variant === 'primary' ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} /> : null}
      <Icon name={icon} size={22} color={warnaIkon} />
      {typeof badge === 'number' ? <CountBadge count={badge} style={styles.lencana} /> : badge ? <CountBadge dotOnly style={styles.lencanaTitik} /> : null}
    </Pressable>
  );
}

// ── FAB ──────────────────────────────────────────────────────────────────────

export interface FabProps {
  icon?: AnyIconName;
  label: string;
  onPress: () => void;
  /** Tampilkan label di samping ikon (extended). */
  extended?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** FAB 60 (radius 20), gradien aksi. Posisikan sendiri (mis. `position:'absolute', right:16`). */
export function Fab({ icon = 'plus', label, onPress, extended = false, style }: FabProps): React.JSX.Element {
  const { shadows } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      scaleTo={motion.fabPressScale}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.fab,
        { boxShadow: shadows.button },
        extended ? { paddingHorizontal: 20, gap: 8 } : { width: ukuran.fab },
        style,
      ]}
    >
      <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: radius['xl'] }]} />
      <Icon name={icon} size={24} color="#FFFFFF" />
      {extended ? (
        <Text weight={700} style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 22 }} maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tombol: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  isi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ikon: { alignItems: 'center', justifyContent: 'center' },
  lencana: { position: 'absolute', top: -2, right: -2 },
  lencanaTitik: { position: 'absolute', top: 8, right: 9 },
  fab: { height: ukuran.fab, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
});
