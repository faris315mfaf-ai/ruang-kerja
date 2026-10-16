/**
 * Checklist tugas: centang, tambah, ubah (dialog), hapus, urut naik/turun,
 * dan ringkasan selesai yang bisa dilipat. Hak `can.work` (penerima titipan
 * boleh); lainnya baca saja.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ButirChecklist } from '@/api/tugas';
import { radius, useTheme } from '@/theme';
import { Button, Checkbox, Dialog, Icon, IconButton, Input, Pressable, Progress, Text } from '@/ui';

import { SwipeRow } from './SwipeRow';

export function ChecklistBagian({
  butir,
  boleh,
  alasanTerkunci,
  onCentang,
  onTambah,
  onUbah,
  onHapus,
  onGeser,
  onTerkunci,
}: {
  butir: ButirChecklist[];
  boleh: boolean;
  alasanTerkunci: string | null;
  onCentang: (b: ButirChecklist, nilai: boolean) => void;
  onTambah: (judul: string) => Promise<boolean>;
  onUbah: (b: ButirChecklist, judul: string) => Promise<boolean>;
  onHapus: (b: ButirChecklist) => void;
  /** Pindahkan `b` sebelum/sesudah butir lain. */
  onGeser: (b: ButirChecklist, arah: 'naik' | 'turun') => void;
  onTerkunci: (pesan: string) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [tambah, setTambah] = useState(false);
  const [teks, setTeks] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [lipat, setLipat] = useState(true);
  const [ubah, setUbah] = useState<ButirChecklist | null>(null);
  const [teksUbah, setTeksUbah] = useState('');

  const selesai = butir.filter((b) => b.is_done).length;
  const persen = butir.length === 0 ? 0 : Math.round((selesai / butir.length) * 100);
  const lipatAktif = lipat && selesai > 3;
  const tampil = lipatAktif ? butir.filter((b) => !b.is_done) : butir;

  async function kirim(): Promise<void> {
    const t = teks.trim();
    if (t === '' || mengirim) {
      return;
    }
    setMengirim(true);
    const ok = await onTambah(t);
    setMengirim(false);
    if (ok) {
      setTeks('');
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={s.kepala}>
        <Text variant="overline" tone="muted">
          Checklist
        </Text>
        {butir.length > 0 ? (
          <Text variant="overline" tone="muted">
            {selesai}/{butir.length}
          </Text>
        ) : null}
        <View style={{ flex: 1 }}>{butir.length > 0 ? <Progress value={persen} label={`Checklist ${selesai} dari ${butir.length} selesai`} /> : null}</View>
        <IconButton
          icon={boleh ? 'plus' : 'lock'}
          label={boleh ? 'Tambah butir checklist' : 'Checklist terkunci'}
          variant="ghost"
          size={44}
          onPress={() => (boleh ? setTambah((v) => !v) : onTerkunci(alasanTerkunci ?? 'Checklist tidak bisa diubah.'))}
        />
      </View>

      {butir.length === 0 && !tambah ? (
        <Text variant="meta">Belum ada item. Tambahkan langkah kecil agar mudah dicentang.</Text>
      ) : null}

      {lipatAktif ? (
        <View style={s.lipat}>
          <Icon name="chevron-down" size={18} color={colors.muted} />
          <Text variant="meta" style={{ flex: 1 }}>
            {selesai} item selesai lainnya
          </Text>
          <Pressable onPress={() => setLipat(false)} accessibilityRole="button" accessibilityLabel="Tampilkan butir selesai" hitSlop={8}>
            <Text variant="label" tone="link">
              Tampilkan
            </Text>
          </Pressable>
        </View>
      ) : null}

      {tampil.map((b) => (
        <SwipeRow
          key={b.id}
          aksi={
            boleh
              ? [
                  { label: 'Ubah', icon: 'pencil', tone: 'info', onPress: () => { setUbah(b); setTeksUbah(b.title); } },
                  { label: 'Hapus', icon: 'trash-2', tone: 'danger', onPress: () => onHapus(b) },
                ]
              : []
          }
        >
          <View style={[s.butir, { backgroundColor: colors.bg }]}>
            <Checkbox checked={b.is_done} onChange={(v) => (boleh ? onCentang(b, v) : onTerkunci(alasanTerkunci ?? 'Checklist tidak bisa diubah.'))} label={b.title} style={{ flex: 1 }} />
          </View>
        </SwipeRow>
      ))}
      {!lipat && selesai > 3 ? (
        <Pressable onPress={() => setLipat(true)} accessibilityRole="button" hitSlop={8}>
          <Text variant="label" tone="link">
            Sembunyikan item selesai
          </Text>
        </Pressable>
      ) : null}

      {tambah ? (
        <Input
          value={teks}
          onChangeText={setTeks}
          placeholder="Tambah butir checklist"
          maxLength={200}
          autoFocus
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={() => void kirim()}
          accessibilityLabel="Butir checklist baru"
          right={<IconButton icon="plus" label="Tambah butir" variant="ghost" size={40} onPress={() => void kirim()} disabled={teks.trim() === '' || mengirim} />}
        />
      ) : null}

      {boleh && butir.length > 1 ? <Text variant="meta">Geser butir ke kiri untuk mengubah atau menghapus.</Text> : null}

      <Dialog
        visible={ubah !== null}
        title="Ubah butir"
        onClose={() => setUbah(null)}
        actions={[
          { label: 'Batal', onPress: () => setUbah(null), variant: 'quiet' },
          {
            label: 'Simpan',
            variant: 'tonal',
            disabled: teksUbah.trim() === '',
            onPress: () => {
              const b = ubah;
              setUbah(null);
              if (b && teksUbah.trim() !== b.title) {
                void onUbah(b, teksUbah.trim());
              }
            },
          },
        ]}
      >
        <Input value={teksUbah} onChangeText={setTeksUbah} maxLength={200} accessibilityLabel="Judul butir" autoFocus />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Naik" variant="outline" size="sm" icon="arrow-up" onPress={() => ubah && (onGeser(ubah, 'naik'), setUbah(null))} />
          <Button title="Turun" variant="outline" size="sm" icon="arrow-down" onPress={() => ubah && (onGeser(ubah, 'turun'), setUbah(null))} />
        </View>
      </Dialog>
    </View>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lipat: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  butir: { borderRadius: radius.md, minHeight: 48, justifyContent: 'center' },
});
