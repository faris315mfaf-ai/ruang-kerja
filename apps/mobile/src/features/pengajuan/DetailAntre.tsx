/**
 * Detail pengajuan yang masih di antrean HP (offline): salinan lokal read-only, status
 * "Menunggu sinkron" / "Gagal sinkron" dengan pesan server, dan aksi yang masih mungkin
 * (ubah isian lalu antre ulang, hapus dari antrean, sinkronkan sekarang). Batal/ubah pengajuan
 * yang sudah di server tetap online-saja dan ada di layar detail biasa.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { hapusItem, sinkronkanSekarang, useOnline } from '@/offline';
import { radius, useTheme } from '@/theme';
import { Banner, Button, Card, Icon, IconTile, Screen, SubAppBar, Text, useDialog, useSnackbar } from '@/ui';

import { ChipSinkron } from './ChipSinkron';
import { META_KATEGORI, judulDetail, judulPeriode } from './format';
import { catatanCutoff, type PengajuanAntre } from './offline';

function Baris({ label, nilai, terakhir = false }: { label: string; nilai: string; terakhir?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.baris, !terakhir && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <Text variant="body" tone="muted" style={s.label}>
        {label}
      </Text>
      <Text variant="body" weight={600} style={{ flex: 1 }}>
        {nilai}
      </Text>
    </View>
  );
}

export function DetailAntre({ item }: { item: PengajuanAntre }): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const online = useOnline();
  const d = item.semu;
  const meta = META_KATEGORI[d.type.category];
  const bermasalah = item.status === 'konflik' || item.status === 'gagal';
  const cutoff = catatanCutoff(item.cutoff);

  const hapus = async (): Promise<void> => {
    const ok = await dialog.confirm({
      title: 'Hapus dari antrean?',
      message: 'Pengajuan ini belum terkirim dan akan dihapus dari HP. Tindakan ini tidak bisa dikembalikan.',
      confirmLabel: 'Hapus',
      cancelLabel: 'Kembali',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    if (await hapusItem(item.itemId)) {
      snackbar.show({ message: 'Dihapus dari antrean.', variant: 'ok' });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/pengajuan');
      }
    } else {
      snackbar.show({ message: 'Sedang dikirim — coba lagi sebentar.', variant: 'info' });
    }
  };

  const footer = (
    <View style={{ flex: 1, gap: 8 }}>
      {bermasalah ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Hapus" variant="outline" icon="trash-2" style={{ flex: 1 }} onPress={() => void hapus()} />
          {item.requestId === null ? <Button title="Ubah & kirim" icon="pencil" style={{ flex: 1.4 }} onPress={() => router.push({ pathname: '/pengajuan/form', params: { antre: item.itemId } })} /> : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Hapus" variant="outline" icon="trash-2" style={{ flex: 1 }} onPress={() => void hapus()} />
          {item.requestId === null ? (
            <Button title="Ubah" variant="outline" icon="pencil" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/pengajuan/form', params: { antre: item.itemId } })} />
          ) : null}
          <Button title="Sinkronkan" icon="refresh-cw" style={{ flex: 1.2 }} disabled={!online} disabledReason="Belum ada koneksi" onPress={() => void sinkronkanSekarang()} />
        </View>
      )}
    </View>
  );

  return (
    <Screen header={<SubAppBar title="Menunggu sinkron" />} footer={footer}>
      <View style={s.kepala}>
        <IconTile icon={meta.icon} tone={meta.tile} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3" weight={700}>
            {judulDetail(d)}
          </Text>
          <Text variant="meta">Tersimpan di HP · belum bernomor</Text>
        </View>
      </View>
      <ChipSinkron status={bermasalah ? 'gagal' : 'menunggu'} />

      {bermasalah ? (
        <View style={[s.kotak, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <Icon name="triangle-alert" size={20} color={colors.danger} />
          <Text variant="label" weight={500} style={{ flex: 1, lineHeight: 21, color: colors.danger }}>
            <Text variant="label" style={{ color: colors.danger }}>
              Server menolak pengajuan ini:{' '}
            </Text>
            {item.galat ?? 'Terjadi galat saat mengirim.'}
            {item.requestId === null ? ' Ubah isiannya lalu kirim lagi, atau hapus.' : ''}
          </Text>
        </View>
      ) : (
        <Banner tone="info" icon="cloud-upload" message={online ? 'Sedang dikirim ke server…' : 'Akan dikirim otomatis saat online. Penyetuju diberi tahu setelah terkirim.'} />
      )}
      {cutoff && !bermasalah ? <Banner tone="warn" icon="clock" message={cutoff} /> : null}

      <Card style={{ padding: 0, gap: 0 }}>
        <Baris label="Jenis" nilai={d.type.name} />
        <Baris label={d.type.category === 'procurement' ? 'Barang' : 'Tanggal'} nilai={judulPeriode(d)} />
        <Baris label="Alasan" nilai={item.alasan || '—'} terakhir={item.lampiranNama.length === 0} />
        {item.lampiranNama.length > 0 ? <Baris label="Lampiran" nilai={item.lampiranNama.join(', ')} terakhir /> : null}
      </Card>
      <Text variant="meta">Membatalkan atau mengubah pengajuan yang sudah di server butuh koneksi; persetujuan juga hanya bisa saat online.</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  baris: { flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'flex-start' },
  label: { width: 96, fontSize: 16 },
  kotak: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg },
});
