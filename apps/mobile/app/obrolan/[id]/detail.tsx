/**
 * Detail kanal (mockup 17/18): identitas + topik, Cari pesan, Buka workspace,
 * bisukan notifikasi (hidup/mati; mention tetap masuk), anggota + peran, dan
 * pengelolaan yang belum ada di web ditampilkan nonaktif "Segera hadir".
 * Tanpa status online (presence Reverb belum dipakai aplikasi).
 */
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { anggotaKanal, bisukanKanal, detailKanal, type AnggotaKanal, type DetailKanal } from '@/api/obrolan';
import { UbinKanal } from '@/features/obrolan/UbinKanal';
import { pesanGalat, subjudulKanal } from '@/features/obrolan/util';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, Button, Card, ErrorState, errorKindFromStatus, Icon, Loading, Screen, SubAppBar, Switch, Text, useSnackbar } from '@/ui';

const RINGKAS = 5;

function BarisNonaktif({ icon, label }: { icon: 'archive' | 'log-out' | 'user-plus' | 'pencil'; label: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={s.nonaktif} accessible accessibilityState={{ disabled: true }} accessibilityLabel={`${label}, segera hadir`}>
      <Icon name={icon} size={22} color={colors.subtle} />
      <Text variant="title" tone="subtle" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="meta" tone="subtle">
        Segera hadir
      </Text>
    </View>
  );
}

export default function LayarDetailKanal(): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { id } = useLocalSearchParams<{ id: string }>();
  const kanalId = typeof id === 'string' ? id : '';

  const [detail, setDetail] = useState<DetailKanal | null>(null);
  const [semua, setSemua] = useState<AnggotaKanal[] | null>(null);
  const [lihatSemua, setLihatSemua] = useState(false);
  const [memuatAnggota, setMemuatAnggota] = useState(false);
  const [galat, setGalat] = useState<{ status: number; pesan: string } | null>(null);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [bisu, setBisu] = useState<boolean | null>(null);
  const [menyimpanBisu, setMenyimpanBisu] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    try {
      const hasil = await detailKanal(kanalId);
      setDetail(hasil.channel);
      setBisu(null);
      setGalat(null);
    } catch (err) {
      setGalat({ status: err instanceof ApiError ? err.status : -1, pesan: pesanGalat(err, 'Detail kanal tidak dapat dimuat.') });
    } finally {
      setMenyegarkan(false);
    }
  }, [kanalId]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  const tampilSemua = async (): Promise<void> => {
    setLihatSemua(true);
    if (detail === null || !detail.members_has_more || semua !== null) {
      return;
    }
    setMemuatAnggota(true);
    try {
      const daftar: AnggotaKanal[] = [];
      let halaman = 1;
      for (;;) {
        const r = await anggotaKanal(kanalId, halaman);
        daftar.push(...r.members);
        if (!r.meta.has_more || halaman >= 10) {
          break;
        }
        halaman += 1;
      }
      setSemua(daftar);
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Daftar anggota tidak dapat dimuat.'), variant: 'bad' });
    } finally {
      setMemuatAnggota(false);
    }
  };

  const ubahBisu = async (nilai: boolean): Promise<void> => {
    if (menyimpanBisu) {
      return;
    }
    setBisu(nilai);
    setMenyimpanBisu(true);
    try {
      await bisukanKanal(kanalId, nilai);
      snackbar.show({
        message: nilai ? 'Notifikasi dibisukan' : 'Notifikasi diaktifkan',
        variant: 'ok',
        actionLabel: 'Urungkan',
        onAction: () => void ubahBisu(!nilai),
      });
    } catch (err) {
      setBisu(!nilai);
      snackbar.show({ message: pesanGalat(err, 'Pengaturan bisu gagal disimpan.'), variant: 'bad' });
    } finally {
      setMenyimpanBisu(false);
    }
  };

  if (galat !== null && detail === null) {
    return (
      <>
        <Stack.Screen options={{ animation: 'slide_from_right' }} />
        <Screen header={<SubAppBar title="Detail kanal" />}>
          <ErrorState message={galat.status === 404 ? 'Obrolan tidak ditemukan.' : galat.pesan} kind={errorKindFromStatus(galat.status === -1 ? undefined : galat.status)} onRetry={() => void muat()} />
        </Screen>
      </>
    );
  }

  const adalahDm = detail?.type === 'dm';
  const jenis = detail?.type ?? 'private';
  const anggota = lihatSemua ? (semua ?? detail?.members ?? []) : (detail?.members ?? []).slice(0, RINGKAS);
  const jumlah = detail?.members_count ?? 0;
  const bisuAktif = bisu ?? detail?.muted ?? false;
  const percakapan = jenis === 'dm' || jenis === 'group';

  return (
    <>
      <Stack.Screen options={{ animation: 'slide_from_right' }} />
      <Screen
        header={<SubAppBar title="Detail kanal" />}
        refreshing={menyegarkan}
        onRefresh={() => {
          setMenyegarkan(true);
          void muat();
        }}
      >
        {detail === null ? (
          <Loading rows={5} />
        ) : (
          <>
            <View style={s.hero}>
              <UbinKanal jenis={detail.type} nama={detail.title} workspace={detail.workspace} ukuran={72} />
              <Text variant="h2" align="center" accessibilityRole="header">
                {detail.title}
              </Text>
              <Text variant="meta" align="center">
                {subjudulKanal(detail.type, jumlah)}
              </Text>
              {detail.topic ? (
                <Text variant="body" tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22 }}>
                  {detail.topic}
                </Text>
              ) : null}
              {detail.archived ? <Badge tone="warning">Diarsipkan</Badge> : null}
            </View>

            {adalahDm ? <Banner tone="info" icon="lock" message="Percakapan ini hanya terlihat oleh kedua peserta. Admin aplikasi pun tidak bisa membukanya." /> : null}

            <View style={s.aksi}>
              <Card variant="tight" onPress={() => router.push({ pathname: '/obrolan/[id]/cari', params: { id: kanalId, nama: detail.title } })} accessibilityLabel="Cari pesan" style={s.aksiKartu}>
                <Icon name="search" size={22} color={colors.text} />
                <Text variant="label" weight={700}>
                  Cari pesan
                </Text>
              </Card>
              {detail.workspace ? (
                <Card variant="tight" onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: (detail.workspace as { id: string }).id } })} accessibilityLabel="Buka workspace" style={s.aksiKartu}>
                  <Icon name="layout-grid" size={22} color={colors.text} />
                  <Text variant="label" weight={700}>
                    Buka workspace
                  </Text>
                </Card>
              ) : null}
            </View>

            {detail.is_member ? (
              <Card variant="tight">
                <View style={s.bisu}>
                  <View style={{ flex: 1 }}>
                    <Text variant="title">Bisukan notifikasi</Text>
                    <Text variant="meta" style={{ fontSize: 14 }}>
                      Pesan baru tidak membunyikan notifikasi. Mention tetap masuk.
                    </Text>
                  </View>
                  <Switch value={bisuAktif} onValueChange={(v) => void ubahBisu(v)} label="Bisukan notifikasi" disabled={menyimpanBisu} />
                </View>
              </Card>
            ) : null}

            <View style={{ gap: 8 }}>
              <View style={s.seksi}>
                <Text variant="overline" tone="muted">
                  Anggota
                </Text>
                <Text variant="meta">{jumlah}</Text>
              </View>
              <Card variant="flat">
                {anggota.map((a, i) => (
                  <View key={a.user_id} style={[s.anggota, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
                    <Avatar name={a.name} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text variant="title" numberOfLines={1}>
                        {a.name}
                      </Text>
                      {a.title ? (
                        <Text variant="meta" numberOfLines={1} style={{ fontSize: 14 }}>
                          {a.title}
                        </Text>
                      ) : null}
                    </View>
                    {a.role !== 'member' ? (
                      <Badge tone="primary" dot={false}>
                        {a.role_label}
                      </Badge>
                    ) : null}
                  </View>
                ))}
                {!lihatSemua && jumlah > RINGKAS ? (
                  <Button title={`Lihat semua ${jumlah} anggota`} variant="quiet" onPress={() => void tampilSemua()} style={{ margin: 4 }} />
                ) : null}
                {memuatAnggota ? <Loading rows={2} /> : null}
              </Card>
            </View>

            {detail.type !== 'workspace' ? (
              <View style={{ gap: 8 }}>
                <Text variant="overline" tone="muted" style={{ paddingHorizontal: 4 }}>
                  Pengelolaan
                </Text>
                <Card variant="tight">
                  {percakapan && jenis === 'group' ? <BarisNonaktif icon="pencil" label="Ubah nama grup" /> : null}
                  {detail.type === 'private' || jenis === 'group' ? <BarisNonaktif icon="user-plus" label="Tambah anggota" /> : null}
                  {!adalahDm ? <BarisNonaktif icon="log-out" label="Keluar dari kanal" /> : null}
                  {detail.can_manage && !percakapan ? <BarisNonaktif icon="archive" label="Arsipkan kanal" /> : null}
                  <Text variant="meta" tone="subtle">
                    Fitur ini belum tersedia di RuangKerja web, jadi belum bisa dilakukan dari aplikasi.
                  </Text>
                </Card>
              </View>
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, paddingTop: 4 },
  aksi: { flexDirection: 'row', gap: 12 },
  aksiKartu: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 72, gap: 6 },
  bisu: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  seksi: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  anggota: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 8 },
  nonaktif: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
});
