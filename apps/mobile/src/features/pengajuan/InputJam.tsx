/**
 * Isian jam "14.00" (24 jam) + dialog pemilih jam (mockup 05-2/05-3): kotak
 * jam : menit besar, kisi jam 00–23 lalu menit per 5, dan mode ketik
 * (ikon papan ketik, format HH.mm). Nilai disimpan "HH:MM" seperti server.
 * Tanpa pustaka datetimepicker (tidak ada di daftar paket yang disetujui).
 */
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { fontFamily, radius, useTheme } from '@/theme';
import { Dialog, Field, Icon, IconButton, Pressable, Text } from '@/ui';

import { jamTampil } from './format';

const JAM = Array.from({ length: 24 }, (_, i) => i);
const MENIT = Array.from({ length: 12 }, (_, i) => i * 5);
const dua = (n: number): string => String(n).padStart(2, '0');

/** "14.05" / "1405" / "14:05" / "9.5" → "14:05"; selain itu null. */
export function parseJamKetik(teks: string): string | null {
  const t = teks.trim().replace(/[:.,\s]/g, '.');
  let jam: number;
  let menit: number;
  if (/^\d{3,4}$/.test(t)) {
    jam = Number(t.slice(0, t.length - 2));
    menit = Number(t.slice(-2));
  } else {
    const m = /^(\d{1,2})\.(\d{1,2})$/.exec(t);
    if (!m) {
      return null;
    }
    jam = Number(m[1]);
    menit = Number(m[2]);
  }
  return jam <= 23 && menit <= 59 ? `${dua(jam)}:${dua(menit)}` : null;
}

export function InputJam({
  label,
  judulDialog,
  value,
  onChange,
  error,
  placeholder = '--.--',
  clearable = false,
  disabled = false,
}: {
  label: string;
  judulDialog: string;
  value: string;
  onChange: (hhmm: string) => void;
  error?: string | null;
  placeholder?: string;
  /** Tampilkan "Kosongkan" (koreksi: "Tidak diubah"). */
  clearable?: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [buka, setBuka] = useState(false);
  const [jam, setJam] = useState(8);
  const [menit, setMenit] = useState(0);
  const [bagian, setBagian] = useState<'jam' | 'menit'>('jam');
  const [ketik, setKetik] = useState(false);
  const [teks, setTeks] = useState('');
  const [galatKetik, setGalatKetik] = useState<string | null>(null);

  const mulai = (): void => {
    const m = /^(\d{2}):(\d{2})$/.exec(value);
    setJam(m ? Number(m[1]) : 8);
    setMenit(m ? Number(m[2]) : 0);
    setBagian('jam');
    setKetik(false);
    setTeks(value ? jamTampil(value) : '');
    setGalatKetik(null);
    setBuka(true);
  };

  const ok = (): void => {
    if (ketik) {
      const hasil = parseJamKetik(teks);
      if (!hasil) {
        setGalatKetik('Format jam 24 jam, mis. 14.00.');
        return;
      }
      onChange(hasil);
    } else {
      onChange(`${dua(jam)}:${dua(menit)}`);
    }
    setBuka(false);
  };

  const kotakNilai = (n: number, aktif: boolean, tekan: () => void, nama: string): React.JSX.Element => (
    <Pressable
      onPress={tekan}
      accessibilityRole="button"
      accessibilityLabel={`${nama} ${dua(n)}`}
      accessibilityState={{ selected: aktif }}
      style={[s.kotakBesar, { backgroundColor: aktif ? colors.linkSoft : colors.surface2, borderColor: aktif ? colors.primary : 'transparent' }]}
    >
      <Text style={{ fontFamily: fontFamily[600], fontSize: 44, lineHeight: 52, color: aktif ? colors.link : colors.text }}>{dua(n)}</Text>
    </Pressable>
  );

  const pilihan = bagian === 'jam' ? JAM : MENIT;
  const terpilih = bagian === 'jam' ? jam : menit;

  return (
    <>
      <Field label={label} error={error}>
        <Pressable
          onPress={mulai}
          disabled={disabled}
          scaleTo={1}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${value ? jamTampil(value) : 'belum diisi'}`}
          accessibilityHint="Membuka pemilih jam"
          style={[
            s.kotak,
            {
              borderColor: error ? colors.danger : colors.borderStrong,
              backgroundColor: disabled ? colors.surface2 : colors.surface,
              boxShadow: error ? `0 0 0 3px ${colors.dangerSoft}` : undefined,
            },
          ]}
        >
          <Text style={{ flex: 1, fontFamily: fontFamily[400], fontSize: 17, color: value ? (disabled ? colors.muted : colors.text) : colors.subtle }} numberOfLines={1}>
            {value ? jamTampil(value) : placeholder}
          </Text>
          <Icon name="clock" size={22} color={disabled ? colors.subtle : colors.muted} />
        </Pressable>
      </Field>
      <Dialog
        visible={buka}
        title={judulDialog}
        onClose={() => setBuka(false)}
        actions={[
          ...(clearable && value
            ? [
                {
                  label: 'Kosongkan',
                  variant: 'quiet' as const,
                  onPress: () => {
                    onChange('');
                    setBuka(false);
                  },
                },
              ]
            : []),
          { label: 'Batal', variant: 'quiet' as const, onPress: () => setBuka(false) },
          { label: 'OK', variant: 'tonal' as const, onPress: ok },
        ]}
      >
        {ketik ? (
          <View style={{ gap: 8 }}>
            <TextInput
              value={teks}
              onChangeText={(t) => {
                setTeks(t);
                setGalatKetik(null);
              }}
              autoFocus
              placeholder="14.00"
              placeholderTextColor={colors.subtle}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              accessibilityLabel={`${judulDialog}, ketik jam`}
              onSubmitEditing={ok}
              style={[s.ketik, { borderColor: galatKetik ? colors.danger : colors.primary, color: colors.text, backgroundColor: colors.surface }]}
            />
            {galatKetik ? (
              <Text variant="meta" tone="danger" accessibilityRole="alert">
                {galatKetik}
              </Text>
            ) : (
              <Text variant="meta">Format 24 jam, mis. 14.00</Text>
            )}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={s.atas}>
              {kotakNilai(jam, bagian === 'jam', () => setBagian('jam'), 'Jam')}
              <Text style={{ fontFamily: fontFamily[600], fontSize: 44, lineHeight: 52 }}>:</Text>
              {kotakNilai(menit, bagian === 'menit', () => setBagian('menit'), 'Menit')}
            </View>
            <View style={s.kisi} accessibilityRole="radiogroup" accessibilityLabel={bagian === 'jam' ? 'Pilih jam' : 'Pilih menit'}>
              {pilihan.map((n) => {
                const aktif = n === terpilih;
                return (
                  <Pressable
                    key={n}
                    onPress={() => {
                      if (bagian === 'jam') {
                        setJam(n);
                        setBagian('menit');
                      } else {
                        setMenit(n);
                      }
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: aktif }}
                    accessibilityLabel={dua(n)}
                    style={[s.sel, { width: bagian === 'jam' ? '16.66%' : '25%' }]}
                  >
                    <View style={[s.bulat, { backgroundColor: aktif ? colors.primary : 'transparent' }]}>
                      <Text variant="body" weight={aktif ? 700 : 500} style={{ color: aktif ? colors.primaryFg : colors.text }}>
                        {dua(n)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        <View style={{ flexDirection: 'row' }}>
          <IconButton
            icon={ketik ? 'clock' : 'keyboard'}
            label={ketik ? 'Pilih dari kisi jam' : 'Ketik jam'}
            variant="ghost"
            size={44}
            onPress={() => {
              if (!ketik) {
                setTeks(`${dua(jam)}.${dua(menit)}`);
              }
              setKetik(!ketik);
              setGalatKetik(null);
            }}
          />
        </View>
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  kotak: { minHeight: 52, borderRadius: radius.control, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  atas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  kotakBesar: { width: 92, height: 76, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  kisi: { flexDirection: 'row', flexWrap: 'wrap' },
  sel: { height: 44, alignItems: 'center', justifyContent: 'center' },
  bulat: { minWidth: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  ketik: { height: 64, borderWidth: 2, borderRadius: radius.control, fontSize: 32, textAlign: 'center', fontFamily: fontFamily[600] },
});
