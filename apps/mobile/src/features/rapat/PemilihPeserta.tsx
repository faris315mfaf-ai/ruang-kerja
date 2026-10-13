/**
 * Lembar "Tambah peserta" (mockup 12-1): cari karyawan aktif (`GET
 * rapat/peserta?q=`), centang banyak, tamu email eksternal.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { cariPeserta, type Orang } from '@/api/rapat';
import { SheetInput } from '@/features/tugas/Pilihan';
import { useTheme } from '@/theme';
import { Avatar, BottomSheet, Button, Checkbox, Icon, Pressable, Text } from '@/ui';

const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PemilihPeserta({
  visible,
  onClose,
  awal,
  terpilih,
  tamu,
  kecuali,
  onUbah,
}: {
  visible: boolean;
  onClose: () => void;
  /** Daftar orang dari formulir (tanpa kata kunci). */
  awal: Orang[];
  terpilih: string[];
  tamu: string[];
  /** Id yang tidak ditampilkan (penyelenggara sendiri). */
  kecuali: string | null;
  onUbah: (ids: string[], tamu: string[], kenal: Orang[]) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [kata, setKata] = useState('');
  const [hasil, setHasil] = useState<Orang[] | null>(null);
  const [memuat, setMemuat] = useState(false);

  useEffect(() => {
    const k = kata.trim();
    if (k === '') {
      return undefined;
    }
    const t = setTimeout(() => {
      setMemuat(true);
      cariPeserta(k)
        .then(setHasil)
        .catch(() => setHasil([]))
        .finally(() => setMemuat(false));
    }, 300);
    return () => clearTimeout(t);
  }, [kata]);

  const daftar = (kata.trim() === '' ? awal : (hasil ?? [])).filter((o) => o.id !== kecuali).slice(0, 50);
  const email = kata.trim().toLowerCase();
  const bisaTamu = POLA_EMAIL.test(email) && !tamu.includes(email) && !daftar.some((o) => (o as Orang & { email?: string }).email === email);

  function alihkan(o: Orang): void {
    const ada = terpilih.includes(o.id);
    onUbah(ada ? terpilih.filter((x) => x !== o.id) : [...terpilih, o.id], tamu, [o]);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable snapPoints={['90%']}>
      <View style={s.kepala}>
        <Text variant="h3" style={{ flex: 1 }} accessibilityRole="header">
          Tambah peserta
        </Text>
        <Button title="Selesai" size="sm" variant="tonal" onPress={onClose} />
      </View>
      <SheetInput value={kata} onChangeText={setKata} placeholder="Cari nama atau ketik email…" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Cari peserta" />
      {bisaTamu ? (
        <Pressable
          onPress={() => {
            onUbah(terpilih, [...tamu, email], []);
            setKata('');
          }}
          accessibilityRole="button"
          accessibilityLabel={`Tambah tamu ${email}`}
          style={s.baris}
        >
          <View style={[s.ikonTamu, { backgroundColor: colors.surface2 }]}>
            <Icon name="mail" size={20} color={colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">{email}</Text>
            <Text variant="meta">Tamu eksternal · undangan email ditahan</Text>
          </View>
          <Icon name="plus" size={20} color={colors.link} />
        </Pressable>
      ) : null}
      {tamu.map((t) => (
        <View key={t} style={s.baris}>
          <View style={[s.ikonTamu, { backgroundColor: colors.surface2 }]}>
            <Icon name="mail" size={20} color={colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">{t}</Text>
            <Text variant="meta">Tamu eksternal · undangan email ditahan</Text>
          </View>
          <Checkbox checked onChange={() => onUbah(terpilih, tamu.filter((x) => x !== t), [])} label={`Hapus tamu ${t}`} />
        </View>
      ))}
      {memuat ? <Text variant="meta">Mencari…</Text> : null}
      {!memuat && kata.trim() !== '' && daftar.length === 0 && !bisaTamu ? <Text variant="meta">Tidak ada karyawan yang cocok.</Text> : null}
      {daftar.map((o) => (
        <Pressable key={o.id} onPress={() => alihkan(o)} scaleTo={1} accessibilityRole="checkbox" accessibilityState={{ checked: terpilih.includes(o.id) }} accessibilityLabel={o.name} style={s.baris}>
          <Avatar name={o.name} size="md" />
          <View style={{ flex: 1 }}>
            <Text variant="label">{o.name}</Text>
            <Text variant="meta" numberOfLines={1}>
              {[o.title, o.division].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Checkbox checked={terpilih.includes(o.id)} onChange={() => alihkan(o)} label={o.name} />
        </Pressable>
      ))}
      <Text variant="meta">Ketik alamat email untuk menambah tamu. Tamu tidak melihat isi aplikasi.</Text>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  ikonTamu: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
