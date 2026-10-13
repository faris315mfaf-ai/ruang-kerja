/**
 * Pengaturan notifikasi — kejadian × kanal (accordion per kategori), ringkasan
 * harian (jam kirim), jam tenang, jeda saat cuti, kirim notifikasi uji.
 * Disimpan otomatis. Mockup: docs/mockups/android/screens/10-inbox-notifikasi-cari/
 * 18, 19.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { kirimNotifikasiUji } from '@/api/notifikasi';
import { bacaJam } from '@/features/notifikasi/jam';
import { MatriksNotifikasi } from '@/features/notifikasi/MatriksNotifikasi';
import { usePengaturanNotifikasi, type StatusSimpan } from '@/features/notifikasi/usePengaturanNotifikasi';
import { useIzinAplikasi } from '@/features/settings/izin';
import { fontFamily, useTheme } from '@/theme';
import {
  Banner,
  Button,
  Card,
  Dialog,
  ErrorState,
  Icon,
  IconTile,
  Input,
  Loading,
  Pressable,
  Screen,
  SubAppBar,
  Switch,
  Text,
  errorKindFromStatus,
  useSnackbar,
} from '@/ui';

/** "07:30" → "07.30" */
const tampilJam = (jam: string): string => jam.replace(':', '.');

function StatusSimpanTeks({ status }: { status: StatusSimpan }): React.JSX.Element | null {
  const { colors } = useTheme();
  if (status === 'diam') {
    return null;
  }
  const peta = {
    menyimpan: { teks: 'Menyimpan…', warna: colors.muted, ikon: 'loader' as const },
    tersimpan: { teks: 'Tersimpan otomatis', warna: colors.success, ikon: 'check' as const },
    gagal: { teks: 'Gagal menyimpan', warna: colors.danger, ikon: 'circle-alert' as const },
  }[status];
  return (
    <View style={s.status} accessibilityLiveRegion="polite">
      <Icon name={peta.ikon} size={16} color={peta.warna} />
      <Text variant="meta" weight={700} style={{ color: peta.warna, fontSize: 14 }}>
        {peta.teks}
      </Text>
    </View>
  );
}

export default function LayarPengaturanNotifikasi(): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const izin = useIzinAplikasi();
  const { data, memuat, galat, offline, status, muat, ubah, ubahKanal } = usePengaturanNotifikasi();
  const [mengirimUji, setMengirimUji] = useState(false);
  const [jamTeks, setJamTeks] = useState('');
  const [dialogJam, setDialogJam] = useState(false);
  const [galatJam, setGalatJam] = useState<string | null>(null);

  const kirimUji = async (): Promise<void> => {
    setMengirimUji(true);
    try {
      const hasil = await kirimNotifikasiUji();
      snackbar.show({ message: hasil.message, variant: 'ok' });
    } catch (err) {
      const mati = err instanceof ApiError && err.status === 0;
      snackbar.show({
        message: mati ? 'Tidak ada koneksi. Notifikasi uji belum terkirim.' : err instanceof ApiError && err.status === 429 ? 'Terlalu sering. Coba lagi sebentar lagi.' : err instanceof ApiError ? err.message : 'Notifikasi uji gagal dikirim.',
        variant: mati ? 'offline' : 'bad',
      });
    } finally {
      setMengirimUji(false);
    }
  };

  const bukaDialogJam = (): void => {
    if (!data) return;
    setJamTeks(tampilJam(data.settings.digest_time));
    setGalatJam(null);
    setDialogJam(true);
  };

  const simpanJam = (): void => {
    const nilai = bacaJam(jamTeks);
    if (!nilai) {
      setGalatJam('Isi jam dengan format JJ.mm, kelipatan 5 menit, mis. 07.30.');
      return;
    }
    setDialogJam(false);
    ubah({ digest_time: nilai });
  };


  const notifIzinMati = izin.notifikasi === 'ditolak' || izin.notifikasi === 'belum';
  const baca = offline;

  return (
    <Screen header={<SubAppBar title="Notifikasi" />} onRefresh={() => void muat()}>
      {memuat && !data ? (
        <Loading rows={6} label="Memuat pengaturan…" />
      ) : galat && !data ? (
        <ErrorState message={galat.pesan} kind={errorKindFromStatus(galat.status)} onRetry={() => void muat()} />
      ) : data ? (
        <>
          {offline ? <Banner tone="warn" icon="wifi-off" message="Anda sedang offline. Pengaturan tampil baca-saja sampai tersambung lagi." /> : null}
          <View style={{ gap: 6 }}>
            <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
              Pilih kejadian yang ingin Anda ketahui, dan lewat kanal apa. Ketuk kejadian untuk mengatur kanalnya.
            </Text>
            <StatusSimpanTeks status={status} />
          </View>

          <Card variant="flat" onPress={() => router.push('/pengaturan/notifikasi-ponsel' as never)} accessibilityLabel="Notifikasi di ponsel ini">
            <View style={s.baris}>
              <IconTile icon="smartphone" tone="teal" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title" weight={700}>
                  Notifikasi di ponsel ini
                </Text>
                <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                  {notifIzinMati ? 'Izin notifikasi belum diberikan' : 'Izin diberikan · saluran & uji notifikasi'}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.subtle} />
            </View>
          </Card>
          {notifIzinMati ? (
            <Banner
              tone="bad"
              icon="bell-off"
              title="Notifikasi dimatikan di Android."
              message="Pengingat tidak akan muncul di bilah notifikasi. Inbox tetap berfungsi."
              actionLabel={izin.notifikasi === 'belum' ? 'Aktifkan' : 'Buka Setelan'}
              onAction={izin.notifikasi === 'belum' ? () => void izin.mintaNotifikasi() : izin.bukaSetelan}
            />
          ) : null}

          <MatriksNotifikasi data={data} onUbah={ubahKanal} baca={baca} />

          <Card>
            <View style={s.baris}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title" weight={700}>
                  Ringkasan harian
                </Text>
                <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                  Satu email setiap hari kerja, berisi yang perlu Anda tindak lanjuti.
                </Text>
              </View>
              <Switch value={data.settings.digest_enabled} onValueChange={(v) => ubah({ digest_enabled: v })} disabled={baca} label="Ringkasan harian" />
            </View>
            <View style={[s.garis, { borderTopColor: colors.divider }]} />
            <View style={[s.baris, { justifyContent: 'space-between' }]}>
              <Text variant="label">Jam kirim</Text>
              <Pressable
                onPress={bukaDialogJam}
                disabled={baca || !data.settings.digest_enabled}
                accessibilityRole="button"
                accessibilityLabel={`Jam kirim ${tampilJam(data.settings.digest_time)} WIB. Ubah`}
                style={[s.jam, { borderColor: colors.borderStrong, opacity: data.settings.digest_enabled && !baca ? 1 : 0.5 }]}
              >
                <Icon name="clock" size={18} color={colors.muted} />
                <Text variant="mono" weight={600} style={{ fontFamily: fontFamily.mono600, fontSize: 17 }}>
                  {tampilJam(data.settings.digest_time)}
                </Text>
                <Text variant="meta" style={{ fontSize: 14 }}>
                  WIB
                </Text>
              </Pressable>
            </View>
            <Pressable onPress={() => router.push('/pengaturan/notifikasi-ringkasan' as never)} accessibilityRole="button" style={s.tautan}>
              <Icon name="eye" size={20} color={colors.link} />
              <Text variant="label" tone="link">
                Lihat contoh ringkasan hari ini
              </Text>
            </Pressable>
          </Card>

          <Card>
            <Text variant="h3" style={{ fontSize: 19 }}>
              Jam tenang
            </Text>
            <View style={s.baris}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">Di luar jam kerja</Text>
                <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                  Tahan notifikasi email {tampilJam(data.quiet_window.start)}–{tampilJam(data.quiet_window.end)} dan akhir pekan; in-app tetap tercatat.
                </Text>
              </View>
              <Switch value={data.settings.quiet_hours} onValueChange={(v) => ubah({ quiet_hours: v })} disabled={baca} label="Jam tenang di luar jam kerja" />
            </View>
            <View style={[s.garis, { borderTopColor: colors.divider }]} />
            <View style={s.baris}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">Saat saya cuti, tahan semua notifikasi</Text>
                <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                  Hanya dicatat di Inbox, tanpa email dan toast. Persetujuan diteruskan ke pengganti bila delegasi aktif.
                </Text>
              </View>
              <Switch value={data.settings.pause_while_on_leave} onValueChange={(v) => ubah({ pause_while_on_leave: v })} disabled={baca} label="Tahan semua notifikasi saat cuti" />
            </View>
          </Card>

          <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
            Email dikirim ke {data.email}. WhatsApp menyusul di Fase 2.
          </Text>
          <Button title="Kirim notifikasi uji" variant="outline" icon="send" loading={mengirimUji} disabled={baca} onPress={() => void kirimUji()} />
        </>
      ) : null}

      <DialogJam
        visible={dialogJam}
        teks={jamTeks}
        galat={galatJam}
        onTeks={(t) => {
          setJamTeks(t);
          setGalatJam(null);
        }}
        onBatal={() => setDialogJam(false)}
        onSimpan={simpanJam}
      />
    </Screen>
  );
}



function DialogJam({
  visible,
  teks,
  galat,
  onTeks,
  onBatal,
  onSimpan,
}: {
  visible: boolean;
  teks: string;
  galat: string | null;
  onTeks: (t: string) => void;
  onBatal: () => void;
  onSimpan: () => void;
}): React.JSX.Element {
  return (
    <Dialog
      visible={visible}
      title="Jam kirim ringkasan"
      message="Ketik jam dalam format JJ.mm (kelipatan 5 menit), waktu kantor WIB."
      onClose={onBatal}
      actions={[
        { label: 'Batal', onPress: onBatal },
        { label: 'Simpan', variant: 'tonal', onPress: onSimpan },
      ]}
    >
      <View style={{ gap: 6 }}>
        <Input
          value={teks}
          onChangeText={onTeks}
          leftIcon="clock"
          suffix="WIB"
          keyboardType="numbers-and-punctuation"
          placeholder="07.30"
          maxLength={5}
          invalid={galat !== null}
          autoFocus
          selectTextOnFocus
          accessibilityLabel="Jam kirim ringkasan"
          returnKeyType="done"
          onSubmitEditing={onSimpan}
        />
        {galat ? (
          <Text variant="meta" tone="danger" accessibilityRole="alert">
            {galat}
          </Text>
        ) : null}
      </View>
    </Dialog>
  );
}

const s = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  garis: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: 10 },
  jam: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 48 },
  tautan: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginTop: 4 },
});
