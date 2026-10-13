/**
 * Notifikasi di ponsel ini — status izin Android, status push (token FCM
 * terdaftar di server atau belum), status tiap saluran menurut pengaturan
 * sistem, buka setelan saluran, dan kirim notifikasi uji (server bila push
 * aktif, selain itu LOKAL dan ditandai jelas).
 * Mockup: 20-notifikasi-ponsel-ini.
 */
import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { SALURAN_TERSEMBUNYI, TAMPILAN_SALURAN, labelKepentingan } from '@/features/notifikasi/saluran';
import { usePengaturanNotifikasi } from '@/features/notifikasi/usePengaturanNotifikasi';
import { kanalDariServer } from '@/features/notifikasi/push/kanal';
import { bacaStatusSaluran, bukaSetelanSaluran, pastikanSaluran, type StatusSaluran } from '@/features/notifikasi/push/saluranAndroid';
import { mintaDaftarUlangPush, usePushStatus, type StatusPush } from '@/features/notifikasi/push/status';
import { useUjiNotifikasi } from '@/features/notifikasi/push/uji';
import { useIzinAplikasi } from '@/features/settings/izin';
import { useTheme } from '@/theme';
import { Banner, Button, Card, ErrorState, Icon, IconTile, Loading, Pressable, Screen, SubAppBar, Text, errorKindFromStatus } from '@/ui';

/** Penjelasan status push untuk pengguna (tanpa istilah teknis berlebih). */
function ringkasanPush(status: StatusPush, serverSiap: boolean | undefined): { judul: string; isi: string; ok: boolean } {
  switch (status.kode) {
    case 'aktif':
      return serverSiap === false
        ? { judul: 'Perangkat terdaftar', isi: 'Ponsel ini sudah terdaftar, tetapi pengiriman push di server belum diaktifkan.', ok: false }
        : { judul: 'Push aktif', isi: 'Notifikasi dari server akan masuk ke ponsel ini, juga saat aplikasi tertutup.', ok: true };
    case 'izin':
      return { judul: 'Menunggu izin notifikasi', isi: 'Berikan izin notifikasi agar push bisa diterima.', ok: false };
    case 'firebase':
      return {
        judul: 'Push belum tersedia di aplikasi ini',
        isi: 'Aplikasi ini dibangun tanpa konfigurasi Firebase. Inbox dan notifikasi lokal tetap berfungsi.',
        ok: false,
      };
    case 'offline':
      return { judul: 'Menunggu koneksi', isi: 'Ponsel ini akan didaftarkan begitu tersambung ke internet.', ok: false };
    case 'server':
      return { judul: 'Pendaftaran perangkat gagal', isi: status.detail ?? 'Server menolak pendaftaran push ponsel ini.', ok: false };
    default:
      return { judul: 'Memeriksa status push…', isi: '', ok: false };
  }
}

export default function LayarNotifikasiPonsel(): React.JSX.Element {
  const { colors } = useTheme();
  const izin = useIzinAplikasi();
  const { data, memuat, galat, muat } = usePengaturanNotifikasi();
  const push = usePushStatus();
  const uji = useUjiNotifikasi(data?.push.server_ready);
  const [statusSaluran, setStatusSaluran] = useState<Record<string, StatusSaluran>>({});

  const saluran = (data?.push.android_channels ?? []).filter((c) => !SALURAN_TERSEMBUNYI.includes(c.id));
  const aktif = izin.notifikasi === 'diizinkan';
  const ringkasan = ringkasanPush(push, data?.push.server_ready);

  // Saluran baru dari server ikut dibuat, lalu baca status sistemnya (juga setelah kembali dari Setelan).
  const daftarServer = data?.push.android_channels;
  useEffect(() => {
    let hidup = true;
    const segarkan = (): void => {
      void bacaStatusSaluran().then((s) => hidup && setStatusSaluran(s));
    };
    void pastikanSaluran(kanalDariServer(daftarServer)).then(segarkan);
    const langganan = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        segarkan();
      }
    });
    return () => {
      hidup = false;
      langganan.remove();
    };
  }, [daftarServer]);

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
              Android{typeof Platform.Version === 'number' ? ` (API ${Platform.Version})` : ''}
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

      <Card variant="flat">
        <View style={s.baris}>
          <IconTile icon={ringkasan.ok ? 'radio' : 'cloud-off'} tone={ringkasan.ok ? 'ok' : 'warn'} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" weight={700}>
              {ringkasan.judul}
            </Text>
            {ringkasan.isi ? (
              <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                {ringkasan.isi}
              </Text>
            ) : null}
            {push.kode === 'firebase' && push.detail ? (
              <Text variant="meta" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
                {push.detail}
              </Text>
            ) : null}
          </View>
        </View>
        {push.kode !== 'aktif' && push.kode !== 'izin' && push.kode !== 'memeriksa' ? (
          <Button title="Coba daftarkan lagi" variant="tonal" icon="refresh-cw" size="sm" onPress={mintaDaftarUlangPush} style={{ marginTop: 12 }} />
        ) : null}
      </Card>

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
              const dimatikan = !aktif || statusSaluran[c.id] === 'dimatikan';
              return (
                <Pressable
                  key={c.id}
                  onPress={() => void bukaSetelanSaluran(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}. ${dimatikan ? 'Dimatikan di Android' : 'Aktif'}. Buka pengaturan saluran`}
                  style={[s.saluran, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
                >
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
                    <Text variant="meta" weight={700} style={{ fontSize: 14, color: dimatikan ? colors.danger : colors.success }}>
                      {dimatikan ? 'Dimatikan di Android' : 'Aktif'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Icon name="info" size={16} color={colors.muted} />
            <Text variant="meta" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
              Ketuk saluran untuk mengatur suara, getar, dan pop-up di Android. Pilihan In-app & push di halaman sebelumnya memutuskan apa yang dikirim.
            </Text>
          </View>
        </>
      ) : null}

      {aktif ? <Button title="Buka pengaturan notifikasi Android" variant="tonal" icon="settings" onPress={izin.bukaSetelan} /> : null}
      <Button title="Kirim notifikasi uji ke ponsel ini" variant="outline" icon="send" loading={uji.mengirim} onPress={() => void uji.kirim()} />
      <Button title="Uji notifikasi lokal (tanpa server)" variant="quiet" icon="smartphone" disabled={uji.mengirim} onPress={() => void uji.kirimLokal()} />
      <Text variant="meta" style={{ fontSize: 13, lineHeight: 18 }}>
        Uji lewat server mengirim notifikasi lewat Firebase. Uji lokal dibuat di ponsel ini saja dan ditandai LOKAL.
      </Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kartu: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  saluran: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 72 },
});
