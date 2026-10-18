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

import { namaTampilTamu, validasiTamu } from './tamu';

export function PemilihPeserta({
  visible,
  onClose,
  awal,
  terpilih,
  tamu,
  namaTamu,
  batasTamu,
  kecuali,
  onUbah,
}: {
  visible: boolean;
  onClose: () => void;
  /** Daftar orang dari formulir (tanpa kata kunci). */
  awal: Orang[];
  terpilih: string[];
  tamu: string[];
  /** Nama tamu per email (huruf kecil). */
  namaTamu: Record<string, string>;
  batasTamu: number;
  /** Id yang tidak ditampilkan (penyelenggara sendiri). */
  kecuali: string | null;
  /** `nama` hanya diisi bila daftar tamu atau namanya berubah. */
  onUbah: (ids: string[], tamu: string[], kenal: Orang[], nama?: Record<string, string>) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [kata, setKata] = useState('');
  const [namaBaru, setNamaBaru] = useState('');
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
  const cek = validasiTamu(email, namaBaru, tamu.length);
  const bisaTamu = cek.galatEmail === null && !tamu.includes(email) && !daftar.some((o) => (o as Orang & { email?: string }).email === email);
  const penuh = tamu.length >= batasTamu;

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
        <>
          <SheetInput value={namaBaru} onChangeText={setNamaBaru} placeholder="Nama tamu (opsional)" autoCapitalize="words" maxLength={60} invalid={cek.galatNama !== null} accessibilityLabel="Nama tamu (opsional)" />
          {cek.galatNama ? (
            <Text variant="meta" tone="danger" accessibilityRole="alert">
              {cek.galatNama}
            </Text>
          ) : null}
          <Pressable
            onPress={() => {
              if (!cek.valid) {
                return;
              }
              onUbah(terpilih, [...tamu, cek.email], [], cek.nama ? { ...namaTamu, [cek.email]: cek.nama } : namaTamu);
              setKata('');
              setNamaBaru('');
            }}
            accessibilityRole="button"
            accessibilityLabel={`Tambah tamu ${email}`}
            accessibilityState={{ disabled: !cek.valid }}
            style={[s.baris, { opacity: cek.valid ? 1 : 0.5 }]}
          >
            <View style={[s.ikonTamu, { backgroundColor: colors.surface2 }]}>
              <Icon name="mail" size={20} color={colors.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="label">{cek.nama ? `${cek.nama} · ${email}` : email}</Text>
              <Text variant="meta">Tamu eksternal · masuk lewat tautan pribadi</Text>
            </View>
            <Icon name="plus" size={20} color={colors.link} />
          </Pressable>
        </>
      ) : null}
      {penuh && kata.includes('@') ? <Text variant="meta" tone="warning">{`Maksimal ${batasTamu} tamu per rapat.`}</Text> : null}
      {tamu.map((t) => (
        <View key={t} style={s.baris}>
          <View style={[s.ikonTamu, { backgroundColor: colors.surface2 }]}>
            <Icon name="mail" size={20} color={colors.muted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label" numberOfLines={1}>
              {namaTampilTamu({ name: namaTamu[t] ?? null, email: t })}
            </Text>
            <Text variant="meta" numberOfLines={1}>
              {namaTamu[t] ? `${t} · tamu eksternal` : 'Tamu eksternal · masuk lewat tautan pribadi'}
            </Text>
          </View>
          <Checkbox
            checked
            onChange={() => {
              const { [t]: _hapus, ...sisa } = namaTamu;
              onUbah(terpilih, tamu.filter((x) => x !== t), [], sisa);
            }}
            label={`Hapus tamu ${t}`}
          />
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
      <Text variant="meta">Ketik alamat email untuk menambah tamu eksternal. Tamu masuk lewat tautan pribadi yang Anda bagikan sendiri dan tidak melihat isi aplikasi.</Text>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  ikonTamu: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
