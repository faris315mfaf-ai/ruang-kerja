import { forwardRef, useRef, useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { fontFamily, radius, size as ukuran, useTheme } from '@/theme';

import { IconButton } from './Button';
import { Icon, type AnyIconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

// ── Field: label + isian + petunjuk/galat ────────────────────────────────────

export function Field({
  label,
  children,
  hint,
  error,
  required = false,
  counter,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string | null;
  error?: string | null;
  /** Tandai wajib di label (TalkBack: "wajib"). */
  required?: boolean;
  /** Mis. "0 / 500" di kanan petunjuk. */
  counter?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" accessibilityLabel={required ? `${label}, wajib` : undefined}>
        {label}
        {required ? <Text variant="label" tone="danger">{' *'}</Text> : null}
      </Text>
      {children}
      {error || hint || counter ? (
        <View style={s.baris}>
          {error ? (
            <View style={[s.baris, { flex: 1, gap: 6 }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Icon name="circle-alert" size={14} color={colors.danger} />
              <Text variant="meta" tone="danger" style={{ flex: 1 }}>
                {error}
              </Text>
            </View>
          ) : (
            <Text variant="meta" style={{ flex: 1 }}>
              {hint ?? ''}
            </Text>
          )}
          {counter ? <Text variant="meta">{counter}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────

export interface InputProps extends TextInputProps {
  /** Garis galat (border bahaya + cincin lembut). Pesan ditampilkan lewat `Field error`. */
  invalid?: boolean;
  /** Nonaktif: latar surface-2, tidak bisa diubah. */
  disabled?: boolean;
  /** Ikon di kiri. */
  leftIcon?: AnyIconName;
  /** Sufiks teks ("jam", "m") di kanan. */
  suffix?: string;
  /** Tombol mata tampil/sembunyi untuk sandi (memakai `secureTextEntry`). */
  secureToggle?: boolean;
  /** Elemen kustom di kanan (mis. tombol kalender). */
  right?: React.ReactNode;
  /** Gaya kontainer berborder (saat ada ikon/sufiks/right) atau isian itu sendiri. */
  style?: StyleProp<TextStyle>;
}

const gayaIsian: TextStyle = { fontFamily: fontFamily[400], fontSize: 17, paddingVertical: 0 };

/**
 * Input 52 px, radius 14, 17 px (tanpa zoom). Fokus = border primer + cincin
 * 4 px; galat = border bahaya; nonaktif = latar surface-2.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { invalid = false, disabled = false, leftIcon, suffix, secureToggle = false, right, style, onFocus, onBlur, multiline, editable, secureTextEntry, placeholderTextColor, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [fokus, setFokus] = useState(false);
  const [terlihat, setTerlihat] = useState(false);
  const dalam = useRef<TextInput | null>(null);
  const mati = disabled || editable === false;
  const adaHiasan = leftIcon !== undefined || suffix !== undefined || secureToggle || right !== undefined;
  const tinggiMin = multiline ? 104 : ukuran.controlLg;

  const warnaBorder = invalid ? colors.danger : fokus ? colors.primary : colors.borderStrong;
  const cincin = invalid ? `0 0 0 3px ${colors.dangerSoft}` : fokus ? `0 0 0 4px ${colors.ring}` : undefined;

  const kotak: ViewStyle = {
    minHeight: tinggiMin,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: warnaBorder,
    backgroundColor: mati ? colors.surface2 : colors.surface,
    boxShadow: cincin,
  };

  const teks: TextStyle = { ...gayaIsian, color: mati ? colors.muted : colors.text };
  const pasangRef = (node: TextInput | null): void => {
    dalam.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      ref.current = node;
    }
  };

  const penangan = {
    onFocus: (e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]) => {
      setFokus(true);
      onFocus?.(e);
    },
    onBlur: (e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]) => {
      setFokus(false);
      onBlur?.(e);
    },
  };

  if (!adaHiasan) {
    return (
      <TextInput
        ref={pasangRef}
        placeholderTextColor={placeholderTextColor ?? colors.subtle}
        editable={!mati}
        multiline={multiline}
        accessibilityState={{ disabled: mati }}
        {...rest}
        {...penangan}
        style={[
          // expo/types (expo-env.d.ts) membuat ViewStyle & TextStyle tidak saling cocok.
          kotak as TextStyle,
          teks,
          { paddingHorizontal: 14 },
          multiline ? { paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' } : null,
          style,
        ]}
      />
    );
  }

  return (
    <Pressable
      scaleTo={1}
      onPress={() => dalam.current?.focus()}
      accessible={false}
      style={[s.kotakHias, kotak, multiline ? { alignItems: 'flex-start', paddingTop: 12 } : null, style as StyleProp<ViewStyle>]}
    >
      {leftIcon ? <Icon name={leftIcon} size={20} color={colors.muted} /> : null}
      <TextInput
        ref={pasangRef}
        placeholderTextColor={placeholderTextColor ?? colors.subtle}
        editable={!mati}
        multiline={multiline}
        secureTextEntry={secureToggle ? !terlihat : secureTextEntry}
        accessibilityState={{ disabled: mati }}
        {...rest}
        {...penangan}
        style={[teks, { flex: 1, minHeight: multiline ? 80 : 24 }, multiline ? { textAlignVertical: 'top' } : null]}
      />
      {suffix ? (
        <Text variant="body" tone="muted">
          {suffix}
        </Text>
      ) : null}
      {secureToggle ? (
        <IconButton
          icon={terlihat ? 'eye-off' : 'eye'}
          label={terlihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          variant="ghost"
          size={40}
          onPress={() => setTerlihat((v) => !v)}
        />
      ) : null}
      {right}
    </Pressable>
  );
});

// ── Kolom cari (pil, radius 26) ──────────────────────────────────────────────

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Cari…',
  onSubmitEditing,
  autoFocus,
  style,
}: {
  value: string;
  onChangeText: (teks: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [fokus, setFokus] = useState(false);
  return (
    <View
      style={[
        s.kotakHias,
        {
          minHeight: ukuran.controlLg,
          borderRadius: radius['3xl'] - 2,
          borderWidth: 1,
          borderColor: fokus ? colors.primary : colors.border,
          backgroundColor: colors.surface,
          boxShadow: fokus ? `0 0 0 4px ${colors.ring}` : undefined,
        },
        style,
      ]}
    >
      <Icon name="search" size={20} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        onFocus={() => setFokus(true)}
        onBlur={() => setFokus(false)}
        style={[gayaIsian, { flex: 1, color: colors.text, minHeight: 24 }]}
      />
      {value ? <IconButton icon="x" label="Hapus pencarian" variant="ghost" size={40} onPress={() => onChangeText('')} /> : null}
    </View>
  );
}

// ── Select: tampilan input + chevron, memicu sheet pilihan ──────────────────

export function SelectField({
  value,
  placeholder = 'Pilih…',
  onPress,
  disabled = false,
  invalid = false,
  accessibilityLabel,
}: {
  /** Teks pilihan terpilih (kosong → placeholder). */
  value?: string | null;
  placeholder?: string;
  onPress: () => void;
  disabled?: boolean;
  invalid?: boolean;
  accessibilityLabel?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? placeholder}
      accessibilityValue={value ? { text: value } : undefined}
      accessibilityState={{ disabled }}
      style={[
        s.kotakHias,
        {
          minHeight: ukuran.controlLg,
          borderRadius: radius.control,
          borderWidth: 1,
          borderColor: invalid ? colors.danger : colors.borderStrong,
          backgroundColor: disabled ? colors.surface2 : colors.surface,
          justifyContent: 'space-between',
        },
      ]}
    >
      <Text variant="body" tone={value ? 'text' : 'subtle'} numberOfLines={1} style={{ flex: 1 }}>
        {value || placeholder}
      </Text>
      <Icon name="chevron-down" size={20} color={colors.muted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kotakHias: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
});
