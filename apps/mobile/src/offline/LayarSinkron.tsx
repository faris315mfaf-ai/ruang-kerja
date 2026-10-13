/**
 * Layar "Antrean sinkron" (`/sinkron`): perubahan yang dibuat di perangkat dan
 * belum terkirim, dengan status per item dan aksi Coba lagi / Ubah / Hapus.
 * Mockup: docs/mockups/android/screens/12-android-native/14-offline-antrean-sinkron.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Badge, Button, Card, EmptyState, Icon, Screen, SubAppBar, Text, useDialog, useSnackbar, type AnyIconName, type Tone } from '@/ui';

import { cobaLagi, hapusItem, penanganUntuk, sinkronkanSekarang, useAntrean, type ItemAntrean, type StatusItem } from './antrean';
import { waktuRingkas, jamMenit, ukuranTeks } from './format';
import { useOnline } from './jaringan';

const LABEL_STATUS: Record<StatusItem, { teks: string; nada: Tone; ikon: AnyIconName }> = {
  menunggu: { teks: 'Menunggu', nada: 'neutral', ikon: 'clock' },
  mengirim: { teks: 'Mengirim', nada: 'info', ikon: 'refresh-cw' },
  konflik: { teks: 'Perlu diperiksa', nada: 'danger', ikon: 'triangle-alert' },
  gagal: { teks: 'Gagal', nada: 'danger', ikon: 'circle-x' },
};

function ringkasBerkas(item: ItemAntrean): string | null {
  if (item.berkas.length === 0) {
    return null;
  }
  const total = item.berkas.reduce((n, b) => n + b.ukuran, 0);
  return `${item.berkas.length} berkas · ${ukuranTeks(total)}`;
}

function BarisItem({ item, online }: { item: ItemAntrean; online: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const status = LABEL_STATUS[item.status];
  const penangan = penanganUntuk(item.jenis);
  const sibuk = item.status === 'mengirim';
  const perluTindakan = item.status === 'konflik' || item.status === 'gagal';
  const detail = [item.ringkas, ringkasBerkas(item)].filter(Boolean).join(' · ');
  const catatan = penangan?.catatan?.(item) ?? null;
  const aksiKhusus = item.status === 'konflik' && item.galat ? (penangan?.aksiKonflik?.(item, item.galat) ?? null) : null;

  const hapus = async (): Promise<void> => {
    const setuju = await dialog.confirm({
      title: 'Hapus perubahan ini?',
      message: `"${item.label}" tidak akan dikirim ke server dan tidak bisa dikembalikan.`,
      confirmLabel: 'Hapus',
      cancelLabel: 'Batal',
      destructive: true,
    });
    if (setuju && !(await hapusItem(item.id))) {
      snackbar.show({ message: 'Sedang dikirim — coba lagi sebentar.', variant: 'info' });
    }
  };

  return (
    <Card variant="tight" style={{ gap: 10 }}>
      <View style={s.atas}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={2}>
            {item.label}
          </Text>
          {detail !== '' ? (
            <Text variant="meta" numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Badge tone={status.nada}>{status.teks}</Badge>
          <Text variant="meta" accessibilityLabel={`Dibuat ${waktuRingkas(item.dibuatMs)}`}>
            {jamMenit(item.dibuatMs)}
          </Text>
        </View>
      </View>
      {item.galat && (perluTindakan || item.percobaan > 0) ? (
        <View style={s.galat}>
          <Icon name={status.ikon} size={16} color={perluTindakan ? colors.danger : colors.muted} />
          <Text variant="meta" style={{ flex: 1, color: perluTindakan ? colors.danger : colors.muted }} accessibilityRole={perluTindakan ? 'alert' : undefined}>
            {item.galat.pesan}
          </Text>
        </View>
      ) : null}
      {catatan ? (
        <View style={s.galat}>
          <Icon name={catatan.nada === 'bad' ? 'circle-x' : 'clock-alert'} size={16} color={catatan.nada === 'bad' ? colors.danger : catatan.nada === 'warn' ? colors.warning : colors.muted} />
          <Text variant="meta" style={{ flex: 1, color: catatan.nada === 'bad' ? colors.danger : catatan.nada === 'warn' ? colors.warning : colors.muted }}>
            {catatan.teks}
          </Text>
        </View>
      ) : null}
      {aksiKhusus ? <Button title={aksiKhusus.label} variant="primary" size="sm" icon="clipboard-pen-line" style={s.tombol} onPress={aksiKhusus.onPress} /> : null}
      <View style={s.aksi}>
        <Button
          title="Coba lagi"
          variant="tonal"
          size="sm"
          icon="refresh-cw"
          disabled={sibuk}
          style={s.tombol}
          onPress={() => {
            void cobaLagi(item.id);
          }}
          accessibilityHint={online ? undefined : 'Dikirim saat terhubung kembali'}
        />
        <Button
          title="Ubah"
          variant="outline"
          size="sm"
          icon="pencil"
          disabled={sibuk || !penangan?.ubah}
          disabledReason={penangan?.ubah ? 'Sedang dikirim' : 'Jenis perubahan ini belum bisa diubah'}
          style={s.tombol}
          onPress={() => penangan?.ubah?.(item)}
        />
        <Button title="Hapus" variant="quiet" size="sm" icon="trash-2" disabled={sibuk} style={s.tombol} onPress={() => void hapus()} />
      </View>
    </Card>
  );
}

export function LayarSinkron(): React.JSX.Element {
  const { colors } = useTheme();
  const items = useAntrean((st) => st.items);
  const terakhir = useAntrean((st) => st.terakhirSinkron);
  const sinkron = useAntrean((st) => st.sinkron);
  const jeda = useAntrean((st) => st.jeda);
  const online = useOnline();
  const snackbar = useSnackbar();
  const [memeriksa, setMemeriksa] = useState(false);

  const sinkronSekarang = useCallback(async (): Promise<void> => {
    setMemeriksa(true);
    try {
      const ok = await sinkronkanSekarang();
      if (!ok) {
        snackbar.show({ message: 'Belum ada koneksi. Perubahan dikirim otomatis saat terhubung.', variant: 'offline' });
      }
    } finally {
      setMemeriksa(false);
    }
  }, [snackbar]);

  const perlu = items.filter((i) => i.status === 'konflik' || i.status === 'gagal').length;
  const menunggu = items.length - perlu;
  const ringkas =
    items.length === 0
      ? 'Tidak ada perubahan menunggu'
      : [menunggu > 0 ? `${menunggu} menunggu` : null, perlu > 0 ? `${perlu} perlu diperiksa` : null].filter(Boolean).join(' · ');

  return (
    <Screen header={<SubAppBar title="Antrean sinkron" />} refreshing={memeriksa} onRefresh={() => void sinkronSekarang()}>
      <View style={{ gap: 4 }}>
        <Text variant="h3" accessibilityRole="header">
          Perubahan di perangkat
        </Text>
        <Text variant="meta" style={{ color: colors.muted }}>
          {ringkas}
          {terakhir !== null ? ` · terakhir sinkron ${waktuRingkas(terakhir)}` : ''}
        </Text>
      </View>

      {jeda && items.length > 0 ? (
        <Text variant="label" style={{ color: colors.danger }} accessibilityRole="alert">
          Sesi berakhir. Masuk lagi agar perubahan ini bisa dikirim.
        </Text>
      ) : null}

      {items.length === 0 ? (
        <EmptyState icon="circle-check" title="Tidak ada perubahan menunggu" description="Semua yang Anda ubah sudah terkirim ke server." />
      ) : (
        <View style={{ gap: 12 }}>
          {items.map((item) => (
            <BarisItem key={item.id} item={item} online={online} />
          ))}
        </View>
      )}

      <Button
        title="Sinkronkan sekarang"
        icon="refresh-cw"
        variant="primary"
        loading={memeriksa || sinkron}
        loadingTitle="Menyinkronkan…"
        disabled={items.length === 0}
        disabledReason="Tidak ada yang perlu disinkronkan"
        onPress={() => void sinkronSekarang()}
      />
      <Text variant="meta" align="center">
        Data disimpan terenkripsi di perangkat sampai terkirim.
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  atas: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  galat: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  aksi: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tombol: { minHeight: 48, flexGrow: 1 },
});
