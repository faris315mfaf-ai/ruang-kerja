/**
 * Perangkat saya — daftar `GET /perangkat` (penanda perangkat ini, terakhir
 * aktif, sidik jari, push), cabut perangkat lain, cabut perangkat ini (=
 * keluar), batas 5 perangkat. Keadaan: memuat, galat/offline, penuh.
 * Mockup: docs/mockups/android/screens/01-akses-akun/18-perangkat-saya.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { BATAS_PERANGKAT, cabutPerangkat, daftarPerangkat, type DeviceRow } from '@/api/perangkat';
import { useKeluar } from '@/features/settings/useKeluar';
import { tglJamLengkap } from '@/features/settings/konstanta';
import { Badge, Banner, Card, ErrorState, Icon, IconButton, IconTile, Screen, SkeletonRow, SubAppBar, Text, useDialog, useSnackbar, errorKindFromStatus } from '@/ui';
import { useTheme } from '@/theme';

function Chip({ ikon, label }: { ikon: 'fingerprint' | 'bell-ring' | 'bell-off'; label: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.chip, { backgroundColor: colors.surface2 }]}>
      <Icon name={ikon} size={14} color={colors.muted} />
      <Text variant="meta" weight={700} tone="muted" style={{ fontSize: 13 }}>
        {label}
      </Text>
    </View>
  );
}

function terakhirAktif(d: DeviceRow): string {
  if (d.is_current) {
    return 'Aktif sekarang';
  }
  if (!d.last_seen_at) {
    return 'Belum pernah aktif';
  }
  return `Terakhir aktif ${tglJamLengkap(d.last_seen_at)}`;
}

export default function LayarPerangkat(): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const { keluarLangsung } = useKeluar();
  const [daftar, setDaftar] = useState<DeviceRow[] | null>(null);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [mencabut, setMencabut] = useState<string | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    try {
      const hasil = await daftarPerangkat();
      setDaftar([...hasil.devices].sort((a, b) => Number(b.is_current) - Number(a.is_current)));
      setGalat(null);
    } catch (err) {
      setGalat({
        pesan: err instanceof ApiError && err.status !== 0 ? err.message : 'Koneksi ke server terputus. Data Anda aman, coba muat lagi.',
        status: err instanceof ApiError ? err.status : 0,
      });
    } finally {
      setMemuat(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  const cabut = async (d: DeviceRow): Promise<void> => {
    const nama = d.name ?? 'Perangkat';
    const setuju = d.is_current
      ? await dialog.confirm({
          title: 'Cabut perangkat ini?',
          message: 'Ini perangkat yang sedang Anda pakai. Anda akan keluar dan harus masuk lagi.',
          confirmLabel: 'Keluar & cabut',
          cancelLabel: 'Batal',
          destructive: true,
        })
      : await dialog.confirm({
          title: `Cabut ${nama}?`,
          message: 'Perangkat itu langsung keluar dari akun Anda dan notifikasi push-nya dihentikan.',
          confirmLabel: 'Cabut',
          cancelLabel: 'Batal',
          destructive: true,
        });
    if (!setuju) {
      return;
    }
    setMencabut(d.id);
    try {
      await cabutPerangkat(d.id);
      if (d.is_current) {
        await keluarLangsung();
        return;
      }
      setDaftar((lama) => (lama ?? []).filter((x) => x.id !== d.id));
      snackbar.show({ message: `${nama} dicabut`, variant: 'ok' });
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiError ? (err.status === 0 ? 'Tidak ada koneksi. Perangkat belum dicabut.' : err.message) : 'Perangkat gagal dicabut.',
        variant: 'bad',
      });
    } finally {
      setMencabut(null);
    }
  };

  const penuh = (daftar?.length ?? 0) >= BATAS_PERANGKAT;

  return (
    <Screen header={<SubAppBar title="Perangkat saya" />} onRefresh={() => void muat()} refreshing={memuat && daftar !== null}>
      {memuat && daftar === null ? (
        <Card variant="flat">
          {[0, 1, 2].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </Card>
      ) : galat && daftar === null ? (
        <ErrorState title="Daftar perangkat belum termuat" message={galat.pesan} kind={errorKindFromStatus(galat.status)} onRetry={() => void muat()} />
      ) : (
        <>
          <View style={s.kepala}>
            <Text variant="title" weight={700} style={{ flex: 1 }}>
              Perangkat yang masuk ke akun Anda
            </Text>
            <Badge tone={penuh ? 'warning' : 'primary'} dot={false}>
              {`${daftar?.length ?? 0} dari ${BATAS_PERANGKAT}`}
            </Badge>
          </View>

          {penuh ? <Banner tone="warn" message="Batas 5 perangkat tercapai. Mencabut salah satu diperlukan sebelum masuk di perangkat baru." /> : null}

          <Card variant="flat">
            {(daftar ?? []).map((d, i) => (
              <View
                key={d.id}
                style={[s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
              >
                <IconTile icon="smartphone" tone={d.is_current ? 'teal' : 'neutral'} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={s.judul}>
                    <Text variant="title" weight={700} numberOfLines={2} style={{ flexShrink: 1 }}>
                      {d.name ?? 'Perangkat'}
                    </Text>
                    {d.is_current ? <Badge tone="primary" dot={false}>Perangkat ini</Badge> : null}
                  </View>
                  <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                    {`${`${d.platform_label} ${d.os_version ?? ''}`.trim()} · aplikasi ${d.app_version ?? '—'}`}
                  </Text>
                  <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                    {terakhirAktif(d)}
                  </Text>
                  <View style={s.chips}>
                    {d.biometric_login ? <Chip ikon="fingerprint" label="Sidik jari" /> : null}
                    {d.has_push_token ? <Chip ikon="bell-ring" label="Push aktif" /> : <Chip ikon="bell-off" label="Push mati" />}
                  </View>
                </View>
                <IconButton
                  icon="log-out"
                  label={d.is_current ? 'Cabut perangkat ini' : `Cabut ${d.name ?? 'perangkat'}`}
                  variant="ghost"
                  disabled={mencabut !== null}
                  onPress={() => void cabut(d)}
                />
              </View>
            ))}
          </Card>

          <Banner tone="info" message="Mencabut perangkat langsung mengeluarkannya dari akun. Masuk lagi di perangkat itu kapan saja dengan kata sandi." />
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  baris: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  judul: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 30, borderRadius: 999 },
});
