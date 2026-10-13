/**
 * Notifikasi di ponsel ini — status izin Android + katalog saluran (dari
 * server) + buka setelan sistem + kirim uji. Push FCM belum aktif (menunggu
 * kredensial Firebase), jadi status tiap saluran mengikuti izin global.
 * Mockup: 20-notifikasi-ponsel-ini.
 */
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { kirimNotifikasiUji } from '@/api/notifikasi';
import { SALURAN_TERSEMBUNYI, TAMPILAN_SALURAN, labelKepentingan } from '@/features/notifikasi/saluran';
import { usePengaturanNotifikasi } from '@/features/notifikasi/usePengaturanNotifikasi';
import { useIzinAplikasi } from '@/features/settings/izin';
import { useTheme } from '@/theme';
import { Banner, Button, Card, ErrorState, Icon, IconTile, Loading, Screen, SubAppBar, Text, errorKindFromStatus, useSnackbar } from '@/ui';

export default function LayarNotifikasiPonsel(): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const izin = useIzinAplikasi();
  const { data, memuat, galat, muat } = usePengaturanNotifikasi();
  const [mengirim, setMengirim] = useState(false);

  const saluran = (data?.push.android_channels ?? []).filter((c) => !SALURAN_TERSEMBUNYI.includes(c.id));
  const aktif = izin.notifikasi === 'diizinkan';

  const kirimUji = async (): Promise<void> => {
    setMengirim(true);
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
      setMengirim(false);
    }
  };

  const kepalaStatus =
    izin.notifikasi === 'memeriksa' ? null : aktif ? (
      <Card variant="flat">
        <View style={s.baris}>
          <IconTile icon="circle-check" tone="ok" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" weight={700}>
              Izin notifikasi diberikan
            </Text>
            <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
              Android{typeof Platform.Version === 'number' ? ` (API ${Platform.Version})` : ''} · {data?.push.server_ready ? 'push aktif' : 'push dari server belum aktif'}
            </Text>
          </View>
        </View>
      </Card>
    ) : (
      <>
        <Banner
          tone="bad"
          icon="bell-off"
          title="Notifikasi dimatikan di Android."
          message="Pengingat tidak akan muncul di bilah notifikasi. Inbox di aplikasi tetap berfungsi."
          actionLabel={izin.notifikasi === 'belum' ? 'Aktifkan' : undefined}
          onAction={izin.notifikasi === 'belum' ? () => void izin.mintaNotifikasi() : undefined}
        />
        <Button title="Buka pengaturan Android" icon="settings" onPress={izin.bukaSetelan} />
      </>
    );

  return (
    <Screen header={<SubAppBar title="Notifikasi di ponsel ini" />} onRefresh={() => void muat()}>
      {kepalaStatus}
      {data && !data.push.server_ready ? (
        <Banner tone="info" icon="info" message="Pengiriman push ke ponsel belum diaktifkan di server. Notifikasi tetap masuk Inbox dan email." />
      ) : null}

      {memuat && !data ? (
        <Loading rows={5} label="Memuat saluran…" />
      ) : galat && !data ? (
        <ErrorState message={galat.pesan} kind={errorKindFromStatus(galat.status)} onRetry={() => void muat()} />
      ) : data ? (
        <>
          <Text variant="overline" tone="muted" accessibilityRole="header">
            Saluran notifikasi
          </Text>
          <View style={[s.kartu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {saluran.map((c, i) => {
              const t = TAMPILAN_SALURAN[c.id] ?? { icon: 'bell' as const, tone: 'neutral' as const, deskripsi: '' };
              return (
                <View key={c.id} style={[s.saluran, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
                  <IconTile icon={t.icon} tone={t.tone} size={48} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title" weight={700} style={{ fontSize: 16, lineHeight: 22 }}>
                      {c.name}
                    </Text>
                    <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                      {t.deskripsi}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text variant="meta" style={{ fontSize: 13 }}>
                      {labelKepentingan(c.importance)}
                    </Text>
                    <Text variant="meta" weight={700} style={{ fontSize: 14, color: aktif ? colors.success : colors.danger }}>
                      {aktif ? 'Aktif' : 'Dimatikan di Android'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Icon name="info" size={16} color={colors.muted} />
            <Text variant="meta" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
              Suara, getar, dan pop-up diatur per saluran di pengaturan Android. Pilihan In-app/Email di halaman sebelumnya memutuskan apa yang dikirim.
            </Text>
          </View>
        </>
      ) : null}

      {aktif ? <Button title="Buka pengaturan notifikasi Android" variant="tonal" icon="settings" onPress={izin.bukaSetelan} /> : null}
      <Button title="Kirim notifikasi uji ke ponsel ini" variant="outline" icon="send" loading={mengirim} onPress={() => void kirimUji()} />
    </Screen>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kartu: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  saluran: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 72 },
});
