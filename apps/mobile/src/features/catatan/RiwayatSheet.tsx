/** Sheet "Riwayat versi" (mockup 22): daftar, pratinjau, pulihkan. */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { pratinjauVersi, pulihkanVersi, versiCatatan, type CatatanDetail, type VersiCatatan, type VersiPratinjau } from '@/api/catatan';
import { useTheme } from '@/theme';
import { Avatar, BottomSheet, Button, ListRow, Loading, Text, useDialog, useSnackbar } from '@/ui';

import { pesanGalat } from './AksiBaris';
import { labelWaktu } from './waktu';

export function RiwayatSheet({
  visible,
  onClose,
  noteId,
  siram,
  onDipulihkan,
}: {
  visible: boolean;
  onClose: () => void;
  noteId: string;
  /** Simpan suntingan lokal dulu agar pemulihan tidak bentrok versi. */
  siram: () => Promise<boolean>;
  onDipulihkan: (note: CatatanDetail) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [daftar, setDaftar] = useState<VersiCatatan[] | null>(null);
  const [bisaPulih, setBisaPulih] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [pratinjau, setPratinjau] = useState<VersiPratinjau | null>(null);
  const [memuatPratinjau, setMemuatPratinjau] = useState(false);
  const [memulihkan, setMemulihkan] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    setGalat(null);
    setDaftar(null);
    try {
      const r = await versiCatatan(noteId);
      setDaftar(r.versions);
      setBisaPulih(r.can_restore);
    } catch (err) {
      setGalat(pesanGalat(err, 'Riwayat versi gagal dimuat.'));
    }
  }, [noteId]);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- muat tiap sheet dibuka
      setPratinjau(null);
      void muat();
    }
  }, [visible, muat]);

  async function lihat(v: VersiCatatan): Promise<void> {
    setMemuatPratinjau(true);
    try {
      setPratinjau(await pratinjauVersi(noteId, v.id));
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Versi gagal dimuat.'), variant: 'bad' });
    } finally {
      setMemuatPratinjau(false);
    }
  }

  async function pulihkan(v: VersiPratinjau): Promise<void> {
    const waktu = labelWaktu(v.created_at);
    const ya = await dialog.confirm({
      title: 'Pulihkan versi ini?',
      message: `Isi catatan diganti dengan versi ${waktu}. Isi sekarang tetap ada di riwayat dan semua penyunting melihat perubahannya.`,
      confirmLabel: 'Pulihkan',
    });
    if (!ya) {
      return;
    }
    setMemulihkan(true);
    try {
      if (!(await siram())) {
        snackbar.show({ message: 'Suntingan Anda belum tersimpan. Simpan dulu sebelum memulihkan versi.', variant: 'warn' });
        return;
      }
      const hasil = await pulihkanVersi(noteId, v.id);
      onDipulihkan(hasil.note);
      setDaftar(hasil.versions);
      setPratinjau(null);
      onClose();
      snackbar.show({ message: 'Versi dipulihkan. Isi sebelumnya tetap ada di riwayat.', variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Versi gagal dipulihkan. Coba lagi.'), variant: 'bad' });
    } finally {
      setMemulihkan(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={pratinjau ? 'Pratinjau versi' : 'Riwayat versi'} scrollable>
      {pratinjau ? (
        <View style={{ gap: 12 }}>
          <Text variant="meta" style={{ marginTop: -8 }}>
            Melihat versi · {labelWaktu(pratinjau.created_at)}
            {pratinjau.author ? ` oleh ${pratinjau.author.name}` : ''}
          </Text>
          <Text variant="title" weight={700}>
            {pratinjau.title}
          </Text>
          <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
            <View style={[s.kertas, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text variant="body">{pratinjau.body_text && pratinjau.body_text.trim() !== '' ? pratinjau.body_text : 'Catatan kosong pada versi ini.'}</Text>
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Daftar" variant="outline" onPress={() => setPratinjau(null)} style={{ flex: 1 }} />
            {bisaPulih ? <Button title="Pulihkan" onPress={() => void pulihkan(pratinjau)} loading={memulihkan} loadingTitle="Memulihkan…" style={{ flex: 1.4 }} /> : null}
          </View>
        </View>
      ) : (
        <>
          <Text variant="meta" style={{ marginTop: -8 }}>
            Pilih versi untuk melihat isinya
          </Text>
          {galat !== null ? (
            <View style={{ gap: 8 }}>
              <Text variant="body" tone="danger" accessibilityRole="alert">
                {galat}
              </Text>
              <Button title="Coba lagi" variant="outline" size="sm" onPress={() => void muat()} />
            </View>
          ) : daftar === null || memuatPratinjau ? (
            <Loading rows={4} />
          ) : daftar.length === 0 ? (
            <Text variant="body" tone="muted">
              Belum ada versi tersimpan. Versi dibuat otomatis setelah beberapa menit menyunting.
            </Text>
          ) : (
            daftar.map((v, i) => (
              <ListRow
                key={v.id}
                leading={<Avatar name={v.author?.name ?? '?'} />}
                title={labelWaktu(v.created_at)}
                subtitle={`${v.author?.name ?? 'Tanpa nama'}${v.label ? ` · ${v.label}` : ''}`}
                divider={i > 0}
                onPress={() => void lihat(v)}
                accessibilityLabel={`Versi ${labelWaktu(v.created_at)}`}
              />
            ))
          )}
        </>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  kertas: { borderWidth: 1, borderRadius: 16, padding: 16 },
});
