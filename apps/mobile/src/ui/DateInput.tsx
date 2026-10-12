/**
 * Isian tanggal baku RuangKerja: tampil "Selasa, 13/10/2026" (tidak
 * mengikuti bahasa perangkat), diketik `dd/mm/yyyy` saat fokus, atau dipilih
 * dari kalender (sheet). Nilai selalu `YYYY-MM-DD`. Teks salah / di luar
 * rentang → nilai lama dipertahankan + satu pesan singkat.
 */
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { fontFamily, radius, useTheme } from '@/theme';

import { BottomSheet } from './BottomSheet';
import { Button, IconButton } from './Button';
import { Field } from './Input';
import { Gradient } from './Gradient';
import { Pressable } from './Pressable';
import { Text } from './Text';
import {
  NAMA_BULAN,
  NAMA_HARI_SINGKAT,
  formatHariTanggal,
  formatNumerik,
  geserBulan,
  hariIniIso,
  jumlahHari,
  kolomAwalBulan,
  maskKetikan,
  parseIso,
  parseKetikan,
  toIso,
} from './tanggal';

export interface DateInputProps {
  label?: string;
  /** `YYYY-MM-DD` atau kosong. */
  value: string;
  onChange: (iso: string) => void;
  /** Batas bawah/atas (`YYYY-MM-DD`), inklusif. */
  min?: string;
  max?: string;
  /** Bila true, kosong tidak diizinkan (tanpa tombol hapus). */
  required?: boolean;
  /** Galat dari server/form (menimpa pesan lokal). */
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
}

function pesanRentang(iso: string, min: string | undefined, max: string | undefined): string | null {
  if (min && iso < min) {
    return `Tidak boleh sebelum ${formatHariTanggal(min)}.`;
  }
  if (max && iso > max) {
    return `Tidak boleh setelah ${formatHariTanggal(max)}.`;
  }
  return null;
}

export function DateInput({ label, value, onChange, min, max, required = false, error, hint, disabled = false, placeholder = 'dd/mm/yyyy' }: DateInputProps): React.JSX.Element {
  const { colors } = useTheme();
  const [fokus, setFokus] = useState(false);
  const [teks, setTeks] = useState('');
  const [pesan, setPesan] = useState<string | null>(null);
  const [kalender, setKalender] = useState(false);
  const [bulan, setBulan] = useState({ y: 2026, m: 1 });
  const input = useRef<TextInput>(null);

  const bukaKalender = (): void => {
    const awal = parseIso(value) ?? parseIso(hariIniIso());
    if (awal) {
      setBulan({ y: awal.y, m: awal.m });
    }
    setKalender(true);
  };

  const tampil = fokus ? teks : value ? formatHariTanggal(value) : '';
  const galat = error ?? pesan;
  const bolehKosong = !required;

  const simpan = (): void => {
    const mentah = teks.trim();
    if (mentah === '') {
      if (value && bolehKosong) {
        onChange('');
        setPesan(null);
      } else if (required) {
        setPesan(value ? `Tanggal wajib diisi. Nilai lama dipertahankan: ${formatHariTanggal(value)}.` : 'Tanggal wajib diisi.');
      }
      return;
    }
    const iso = parseKetikan(mentah);
    if (!iso) {
      setPesan(value ? `Tanggal tidak valid. Nilai lama dipertahankan: ${formatHariTanggal(value)}.` : 'Tanggal tidak valid. Contoh: 13/10/2026.');
      return;
    }
    const luar = pesanRentang(iso, min, max);
    if (luar) {
      setPesan(luar);
      return;
    }
    setPesan(null);
    if (iso !== value) {
      onChange(iso);
    }
  };

  const pilih = (iso: string): void => {
    setKalender(false);
    setPesan(null);
    onChange(iso);
  };

  const kotak = (
    <View
      style={[
        s.kotak,
        {
          borderColor: galat ? colors.danger : fokus ? colors.primary : colors.borderStrong,
          backgroundColor: disabled ? colors.surface2 : colors.surface,
          boxShadow: galat ? `0 0 0 3px ${colors.dangerSoft}` : fokus ? `0 0 0 4px ${colors.ring}` : undefined,
        },
      ]}
    >
      <TextInput
        ref={input}
        value={tampil}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        keyboardType="number-pad"
        accessibilityLabel={label ? `${label}, ${value ? formatHariTanggal(value) : 'belum diisi'}` : undefined}
        accessibilityHint="Ketik tanggal dengan format hari/bulan/tahun, atau buka kalender"
        onFocus={() => {
          setTeks(value ? formatNumerik(value) : '');
          setFokus(true);
        }}
        onChangeText={(t) => setTeks(t.length < teks.length ? t : maskKetikan(t))}
        onBlur={() => {
          simpan();
          setFokus(false);
        }}
        onSubmitEditing={() => input.current?.blur()}
        style={{ flex: 1, fontFamily: fontFamily[400], fontSize: 17, color: disabled ? colors.muted : colors.text, paddingVertical: 0 }}
      />
      {fokus && bolehKosong && teks ? (
        <IconButton icon="x" label="Hapus tanggal" variant="ghost" size={40} onPress={() => setTeks('')} />
      ) : null}
      <IconButton icon="calendar-days" label="Buka kalender" variant="ghost" size={40} disabled={disabled} onPress={bukaKalender} />
    </View>
  );

  return (
    <>
      {label ? (
        <Field label={label} error={galat} hint={hint} required={required}>
          {kotak}
        </Field>
      ) : (
        kotak
      )}
      <CalendarSheet visible={kalender} bulan={bulan} setBulan={setBulan} value={value} min={min} max={max} clearable={bolehKosong} onClose={() => setKalender(false)} onPick={pilih} />
    </>
  );
}

// ── Kalender (sheet) ─────────────────────────────────────────────────────────

function CalendarSheet({
  visible,
  bulan,
  setBulan,
  value,
  min,
  max,
  clearable,
  onClose,
  onPick,
}: {
  visible: boolean;
  bulan: { y: number; m: number };
  setBulan: React.Dispatch<React.SetStateAction<{ y: number; m: number }>>;
  value: string;
  min?: string;
  max?: string;
  clearable: boolean;
  onClose: () => void;
  onPick: (iso: string) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const hariIni = hariIniIso();

  const total = jumlahHari(bulan.y, bulan.m);
  const kosong = kolomAwalBulan(bulan.y, bulan.m);
  const sel: (number | null)[] = [...Array<null>(kosong).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (sel.length % 7 !== 0) {
    sel.push(null);
  }
  const pekan: (number | null)[][] = [];
  for (let i = 0; i < sel.length; i += 7) {
    pekan.push(sel.slice(i, i + 7));
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pilih tanggal">
      <View style={s.kepalaBulan}>
        <IconButton icon="chevron-left" label="Bulan sebelumnya" variant="ghost" onPress={() => setBulan((b) => geserBulan(b, -1))} />
        <Text variant="title" align="center" style={{ flex: 1 }} accessibilityLiveRegion="polite">{`${NAMA_BULAN[bulan.m - 1] ?? ''} ${bulan.y}`}</Text>
        <IconButton icon="chevron-right" label="Bulan berikutnya" variant="ghost" onPress={() => setBulan((b) => geserBulan(b, 1))} />
      </View>
      <View style={s.baris}>
        {NAMA_HARI_SINGKAT.map((h) => (
          <Text key={h} variant="meta" weight={700} align="center" style={s.sel}>
            {h}
          </Text>
        ))}
      </View>
      {pekan.map((minggu, i) => (
        <View key={i} style={s.baris}>
          {minggu.map((hari, j) => {
            if (hari === null) {
              return <View key={j} style={s.sel} />;
            }
            const iso = toIso({ y: bulan.y, m: bulan.m, d: hari });
            const luar = Boolean((min && iso < min) || (max && iso > max));
            const dipilih = iso === value;
            return (
              <Pressable
                key={j}
                disabled={luar}
                onPress={() => onPick(iso)}
                accessibilityRole="button"
                accessibilityLabel={formatHariTanggal(iso)}
                accessibilityState={{ selected: dipilih, disabled: luar }}
                style={[s.sel, s.hari, !dipilih && iso === hariIni ? { borderWidth: 1.5, borderColor: colors.primary } : null]}
              >
                {dipilih ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: radius.full }]} /> : null}
                <Text variant="body" weight={dipilih ? 700 : 500} style={{ color: dipilih ? '#FFFFFF' : luar ? colors.subtle : colors.text }}>
                  {String(hari)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={s.aksi}>
        {clearable && value ? <Button title="Hapus" variant="quiet" size="sm" onPress={() => onPick('')} /> : <View />}
        <Button
          title="Hari ini"
          variant="tonal"
          size="sm"
          disabled={Boolean((min && hariIni < min) || (max && hariIni > max))}
          onPress={() => onPick(hariIni)}
        />
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  kotak: { minHeight: 52, borderRadius: radius.control, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 14, paddingRight: 6 },
  kepalaBulan: { flexDirection: 'row', alignItems: 'center' },
  baris: { flexDirection: 'row' },
  sel: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  hari: { borderRadius: radius.full },
  aksi: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
