/**
 * Sheet check-in key result (mockup 06 › 24-2…24-5; O10): nilai (papan ketik
 * desimal, koma), keyakinan 1–10 (10 tombol, aksesibel), catatan ≤500.
 * Pembaruan optimistis dilakukan pemanggil (`onOptimis`), dibatalkan bila
 * server menolak.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { checkinKr, type HasilKr, type KeyResult } from '@/api/okr';
import { pesanGalat } from '@/features/proyek/tunda';
import { useTheme } from '@/theme';
import { BottomSheet, Button, Field, Input, Pressable, Text, useSnackbar } from '@/ui';

import { bacaAngka, nilaiKr, tulisAngka } from './format';

export function CheckinSheet({
  kr,
  visible,
  onClose,
  onOptimis,
  onSelesai,
  onBatal,
}: {
  kr: KeyResult | null;
  visible: boolean;
  onClose: () => void;
  /** Nilai baru langsung ditampilkan sebelum server menjawab. */
  onOptimis?: (nilai: number) => void;
  onSelesai: (hasil: HasilKr) => void;
  /** Kembalikan tampilan bila gagal. */
  onBatal?: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const [nilai, setNilai] = useState('');
  const [yakin, setYakin] = useState<number | null>(null);
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [lama, setLama] = useState<KeyResult | null>(null);
  if (kr !== lama) {
    setLama(kr);
    setNilai(kr ? tulisAngka(kr.current_value) : '');
    setYakin(null);
    setCatatan('');
    setGalat({});
  }

  const simpan = async (): Promise<void> => {
    if (!kr) return;
    const v = bacaAngka(nilai);
    if (v === null) {
      setGalat({ value: 'Isi nilai dengan angka (maks. 2 desimal).' });
      return;
    }
    if (kr.unit === 'percent' && (v < 0 || v > 100)) {
      setGalat({ value: 'Persen harus 0–100.' });
      return;
    }
    setMenyimpan(true);
    onOptimis?.(v);
    onClose();
    try {
      const hasil = await checkinKr(kr.id, { value: v, confidence: yakin, note: catatan.trim() === '' ? null : catatan.trim() });
      snackbar.show({ message: hasil.message, variant: 'ok' });
      onSelesai(hasil);
    } catch (err) {
      onBatal?.();
      snackbar.show({ message: err instanceof ApiError && err.status === 422 ? (err.firstValidationError ?? err.message) : pesanGalat(err, 'Check-in gagal disimpan.'), variant: 'bad' });
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Check-in" showClose scrollable>
      {kr ? (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 2 }}>
            <Text variant="title">{kr.title}</Text>
            <Text variant="meta">{`Sekarang ${nilaiKr(kr, kr.current_value)} · target ${nilaiKr(kr, kr.target_value)}`}</Text>
          </View>
          <Field label="Nilai terbaru" required error={galat.value || null} hint={kr.unit === 'number' && kr.unit_label ? kr.unit_label : undefined}>
            <Input value={nilai} onChangeText={(t) => { setNilai(t); setGalat({}); }} keyboardType="decimal-pad" inputMode="decimal" invalid={!!galat.value} suffix={kr.unit === 'percent' ? '%' : kr.unit === 'days' ? 'hari' : undefined} accessibilityLabel="Nilai terbaru" autoFocus />
          </Field>
          <Field label="Keyakinan" hint="1 = ragu, 10 = sangat yakin (opsional)">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel="Keyakinan 1 sampai 10">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const pilih = yakin === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setYakin(pilih ? null : n)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: pilih }}
                    accessibilityLabel={`Keyakinan ${n}`}
                    style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: pilih ? colors.primary : colors.borderStrong, backgroundColor: pilih ? colors.primary : colors.surface }}
                  >
                    <Text variant="label" style={{ color: pilih ? colors.primaryFg : colors.text }}>
                      {String(n)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
          <Field label="Catatan" hint="Opsional" counter={`${catatan.length}/500`}>
            <Input value={catatan} onChangeText={setCatatan} multiline maxLength={500} placeholder="Apa yang berubah sejak check-in terakhir?" accessibilityLabel="Catatan check-in" />
          </Field>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Batal" variant="outline" style={{ flex: 1 }} onPress={onClose} />
            <Button title="Simpan check-in" icon="check" loading={menyimpan} style={{ flex: 1.4 }} onPress={() => void simpan()} />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}
