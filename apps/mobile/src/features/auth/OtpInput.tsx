/**
 * Isian kode 6 digit (TOTP): enam kotak di atas satu TextInput tak terlihat,
 * sehingga papan ketik numerik, tempel (paste), dan isi-otomatis SMS/OTP
 * bekerja normal. Kotak aktif bercincin primer; `invalid` = bingkai bahaya.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { fontFamily, radius, useTheme } from '@/theme';
import { Text } from '@/ui';

export interface OtpInputProps {
  value: string;
  onChange: (kode: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Dipanggil sekali saat kolom terisi penuh. */
  onComplete?: (kode: string) => void;
  accessibilityLabel?: string;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  invalid = false,
  disabled = false,
  autoFocus = true,
  onComplete,
  accessibilityLabel = 'Kode autentikasi 6 digit',
}: OtpInputProps): React.JSX.Element {
  const { colors } = useTheme();
  const ref = useRef<TextInput>(null);
  const [fokus, setFokus] = useState(false);
  const sudahSelesai = useRef(false);

  useEffect(() => {
    if (value.length < length) {
      sudahSelesai.current = false;
    } else if (!sudahSelesai.current) {
      sudahSelesai.current = true;
      onComplete?.(value);
    }
  }, [value, length, onComplete]);

  function ubah(teks: string): void {
    onChange(teks.replace(/\D/g, '').slice(0, length));
  }

  const aktif = Math.min(value.length, length - 1);

  return (
    <View style={s.baris}>
      {Array.from({ length }, (_, i) => {
        const digit = value[i] ?? '';
        const kotakAktif = fokus && i === aktif && !disabled;
        return (
          <View
            key={i}
            style={[
              s.kotak,
              {
                backgroundColor: disabled ? colors.surface2 : colors.surface,
                borderColor: invalid ? colors.danger : kotakAktif ? colors.primary : colors.borderStrong,
                boxShadow: kotakAktif ? `0 0 0 4px ${colors.ring}` : invalid ? `0 0 0 3px ${colors.dangerSoft}` : undefined,
              },
            ]}
          >
            <Text variant="h2" weight={700} style={{ fontFamily: fontFamily[700] }}>
              {digit}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={ubah}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={length}
        autoFocus={autoFocus}
        editable={!disabled}
        caretHidden
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        accessibilityLabel={accessibilityLabel}
        onFocus={() => setFokus(true)}
        onBlur={() => setFokus(false)}
        style={s.tersembunyi}
        selectionColor="transparent"
      />
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  kotak: { width: 48, height: 60, borderRadius: radius.control, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  // Menutupi seluruh baris supaya ketukan di kotak mana pun memfokuskan isian.
  tersembunyi: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
});
