/**
 * Lembar "Menunggu masuk": tamu eksternal yang meminta masuk lewat tautan pribadi.
 * Penyelenggara, notulis, dan peserta internal menekan Izinkan masuk / Tolak
 * (kontrak docs/sesi/rapat-tamu-eksternal.md §4.2–4.3). Email ditampilkan kecil
 * sebagai pembanding nama yang diketik tamu. Tolak minta konfirmasi (tamu tidak
 * bisa meminta lagi sampai ada yang mengizinkan); Izinkan langsung.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PenungguTamu } from '@/api/rapatTamu';
import { lamaMenunggu, tanpaAkhiranTamu } from '@/features/rapat/tamu';
import type { RuangTungguLive } from '@/features/rapat/useRuangTunggu';
import { useTheme } from '@/theme';
import { Avatar, BottomSheet, Button, Icon, Text, useDialog, useSnackbar } from '@/ui';

function namaTamu(t: PenungguTamu): string {
  const nama = tanpaAkhiranTamu(t.name ?? '');
  return nama !== '' ? nama : (t.email ?? 'Tamu tanpa nama');
}

export function SheetRuangTunggu({ visible, onClose, ruang }: { visible: boolean; onClose: () => void; ruang: RuangTungguLive }): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [sekarang, setSekarang] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- segarkan jam tampil saat lembar dibuka
    setSekarang(Date.now());
    const t = setInterval(() => setSekarang(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [visible]);

  async function izinkan(t: PenungguTamu): Promise<void> {
    const hasil = await ruang.izinkan(t.id);
    snackbar.show(hasil.ok ? { message: `${namaTamu(t)} diizinkan masuk.`, variant: 'ok', duration: 2500 } : { message: hasil.pesan, variant: hasil.offline ? 'offline' : 'bad' });
  }

  async function tolak(t: PenungguTamu): Promise<void> {
    const ok = await dialog.confirm({
      title: `Tolak ${namaTamu(t)}?`,
      message: 'Tamu tidak bisa meminta masuk lagi sampai penyelenggara mengizinkannya dari daftar tamu.',
      confirmLabel: 'Tolak',
      cancelLabel: 'Batal',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    const hasil = await ruang.tolak(t.id);
    snackbar.show(hasil.ok ? { message: `${namaTamu(t)} ditolak.`, variant: 'info', duration: 2500 } : { message: hasil.pesan, variant: hasil.offline ? 'offline' : 'bad' });
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Menunggu masuk (${ruang.jumlah})`} showClose scrollable snapPoints={['55%', '90%']}>
      <Text variant="meta">Tamu eksternal masuk lewat tautan pribadi. Periksa nama dan emailnya sebelum mengizinkan. Tamu hanya bisa video, suara, berbagi layar, dan obrolan; tidak melihat notulen atau data aplikasi.</Text>
      {ruang.menunggu.length === 0 ? (
        <View style={[s.kosong, { backgroundColor: colors.surface2 }]}>
          <Icon name="user-check" size={22} color={colors.muted} />
          <Text variant="body" tone="muted" style={{ flex: 1 }}>
            Tidak ada tamu yang menunggu. Daftar diperbarui otomatis.
          </Text>
        </View>
      ) : null}
      {ruang.menunggu.map((t) => {
        const sedang = ruang.sibuk === t.id;
        const lama = lamaMenunggu(t.requested_at, sekarang);
        return (
          <View key={t.id} style={[s.kartu, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={s.atas}>
              <Avatar name={namaTamu(t)} size="md" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title" numberOfLines={1}>
                  {namaTamu(t)}
                </Text>
                {t.email && tanpaAkhiranTamu(t.name ?? '') !== '' ? (
                  <Text variant="meta" numberOfLines={1}>
                    {t.email}
                  </Text>
                ) : null}
                {lama ? <Text variant="meta">{lama}</Text> : null}
              </View>
            </View>
            <View style={s.tombol}>
              <Button title="Tolak" variant="outline" disabled={ruang.sibuk !== null} onPress={() => void tolak(t)} style={{ flex: 1 }} />
              <Button title="Izinkan masuk" icon="user-check" loading={sedang} loadingTitle="Mengizinkan…" disabled={ruang.sibuk !== null && !sedang} onPress={() => void izinkan(t)} style={{ flex: 1.4 }} />
            </View>
          </View>
        );
      })}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  kosong: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16 },
  kartu: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 },
  atas: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tombol: { flexDirection: 'row', gap: 10 },
});
