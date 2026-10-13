/**
 * Thread layar penuh (mockup 15): pesan akar + balasan berhalaman (30) +
 * komposer "Balas di thread…". Polling 15 detik saat fokus; balasan memakai
 * kursor `setelah`. Akar yang dihapus tetap tampil dengan balasannya.
 */
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { balasanThread, detailKanal, setReaksi, type DetailKanal, type Pesan } from '@/api/obrolan';
import { AksiPesanSheet } from '@/features/obrolan/AksiPesanSheet';
import { Komposer } from '@/features/obrolan/Composer';
import { Gelembung } from '@/features/obrolan/Gelembung';
import { HeaderObrolan } from '@/features/obrolan/HeaderObrolan';
import { useKirimPesan } from '@/features/obrolan/useKirimPesan';
import { gantiPesan, pesanGalat, sekelompok } from '@/features/obrolan/util';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme';
import { Button, EmptyState, ErrorState, errorKindFromStatus, PageGlow, SkeletonRow, Text, usePanel, useSnackbar } from '@/ui';

function urut(daftar: Pesan[]): Pesan[] {
  const peta = new Map<string, Pesan>();
  for (const p of daftar) {
    peta.set(p.id, p);
  }
  return [...peta.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Isi layar thread. Dipakai rute `/obrolan/[id]/thread/[messageId]` (layar
 * penuh) dan panel thread Obrolan di tablet (kolom ketiga ≥ 1000 dp, atau
 * panel geser di atas percakapan), dibungkus `PanelProvider`.
 */
export function Thread({ id, messageId, nama }: { id: string | undefined; messageId: string | undefined; nama?: string }): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { user } = useSession();
  const saya = user?.id ?? null;
  const panel = usePanel();
  const opsiLayar = panel.tertanam ? null : <Stack.Screen options={{ animation: 'slide_from_right' }} />;
  const kanalId = typeof id === 'string' ? id : '';
  const akarId = typeof messageId === 'string' ? messageId : '';

  const [detail, setDetail] = useState<DetailKanal | null>(null);
  const [akar, setAkar] = useState<Pesan | null>(null);
  const [balasan, setBalasan] = useState<Pesan[]>([]);
  const [kursor, setKursor] = useState<string | null>(null);
  const [adaLagi, setAdaLagi] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<{ status: number; pesan: string } | null>(null);
  const [aksi, setAksi] = useState<Pesan | null>(null);
  const [sunting, setSunting] = useState<Pesan | null>(null);
  const gulirRef = useRef<ScrollView | null>(null);
  const keBawah = useRef(false);
  const hidup = useRef(true);
  const sudahAda = useRef(false);

  const muat = useCallback(
    async (diam: boolean): Promise<void> => {
      if (kanalId === '' || akarId === '') {
        return;
      }
      if (!diam) {
        setMemuat(true);
      }
      try {
        const hasil = await balasanThread(kanalId, akarId, null);
        if (!hidup.current) {
          return;
        }
        setGalat(null);
        setAkar(hasil.root);
        setBalasan((lama) => urut([...lama, ...hasil.replies]));
        if (!sudahAda.current) {
          sudahAda.current = true;
          setAdaLagi(hasil.has_more);
          setKursor(hasil.next_cursor);
        }
      } catch (err) {
        if (hidup.current) {
          setGalat({ status: err instanceof ApiError ? err.status : -1, pesan: pesanGalat(err, 'Thread tidak dapat dimuat.') });
        }
      } finally {
        if (hidup.current) {
          setMemuat(false);
          setMenyegarkan(false);
        }
      }
    },
    [kanalId, akarId],
  );

  const muatBerikutnya = useCallback(async (): Promise<void> => {
    if (kursor === null || memuatLagi) {
      return;
    }
    setMemuatLagi(true);
    try {
      const hasil = await balasanThread(kanalId, akarId, kursor);
      setBalasan((lama) => urut([...lama, ...hasil.replies]));
      setAdaLagi(hasil.has_more);
      setKursor(hasil.next_cursor);
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Balasan tidak dapat dimuat.'), variant: 'bad' });
    } finally {
      setMemuatLagi(false);
    }
  }, [kanalId, akarId, kursor, memuatLagi, snackbar]);

  useFocusEffect(
    useCallback(() => {
      hidup.current = true;
      void muat(sudahAda.current);
      if (kanalId !== '') {
        detailKanal(kanalId)
          .then((r) => {
            if (hidup.current) {
              setDetail(r.channel);
            }
          })
          .catch(() => undefined);
      }
      const pewaktu = setInterval(() => void muat(true), 15_000);
      return () => {
        hidup.current = false;
        clearInterval(pewaktu);
      };
    }, [kanalId, muat]),
  );

  useFocusEffect(
    useCallback(() => {
      const langganan = BackHandler.addEventListener('hardwareBackPress', () => {
        if (sunting !== null) {
          setSunting(null);
          return true;
        }
        return false;
      });
      return () => langganan.remove();
    }, [sunting]),
  );

  const ubah = useCallback((p: Pesan) => {
    setAkar((a) => (a !== null && a.id === p.id ? gantiPesan([a], p)[0] ?? a : a));
    setBalasan((lama) => gantiPesan(lama, p));
  }, []);

  const kirimHook = useKirimPesan({
    kanalId,
    saya,
    parentId: akarId,
    onTerkirim: useCallback((p: Pesan) => {
      keBawah.current = true;
      setBalasan((lama) => urut([...lama, p]));
    }, []),
    onTersunting: ubah,
    onSelesaiSunting: useCallback(() => setSunting(null), []),
  });

  useEffect(() => {
    if (keBawah.current && balasan.length > 0) {
      keBawah.current = false;
      const t = setTimeout(() => gulirRef.current?.scrollToEnd({ animated: true }), 50);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [balasan.length]);

  const reaksi = useCallback(
    async (p: Pesan, emoji: string, aktif: boolean): Promise<void> => {
      try {
        const hasil = await setReaksi(kanalId, p.id, emoji, aktif);
        ubah(hasil.message);
      } catch (err) {
        snackbar.show({ message: pesanGalat(err, 'Reaksi gagal dikirim.'), variant: 'bad' });
      }
    },
    [kanalId, snackbar, ubah],
  );

  const judulKanal = detail?.title ?? (typeof nama === 'string' && nama !== '' ? nama : 'obrolan');
  const adalahDm = detail?.type === 'dm';
  const daftarBalasan = useMemo(() => balasan, [balasan]);
  const terkunci =
    detail === null ? null : detail.archived ? 'Kanal ini diarsipkan. Pesan hanya bisa dibaca.' : !detail.can_post ? 'Anda tidak dapat membalas di obrolan ini.' : null;

  if (galat !== null && akar === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {opsiLayar}
        <PageGlow />
        <HeaderObrolan title="Thread" subtitle={`di ${judulKanal}`} />
        <ErrorState message={galat.pesan} kind={errorKindFromStatus(galat.status === -1 ? undefined : galat.status)} onRetry={() => void muat(false)} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      {opsiLayar}
      <PageGlow />
      <HeaderObrolan title="Thread" subtitle={`di ${judulKanal}`} />

      {memuat && akar === null ? (
        <View style={s.skeleton}>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : (
        <ScrollView
          ref={gulirRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.isi}
          refreshControl={
            <RefreshControl
              refreshing={menyegarkan}
              onRefresh={() => {
                setMenyegarkan(true);
                void muat(true);
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {akar !== null ? (
            <Gelembung
              pesan={akar}
              saya={saya}
              tampilIdentitas={!adalahDm}
              awalKelompok
              akhirKelompok
              onTekanLama={() => setAksi(akar)}
              onReaksi={(emoji, aktif) => void reaksi(akar, emoji, aktif)}
            />
          ) : null}

          <View style={s.pemisah} accessibilityRole="text">
            <View style={[s.garis, { backgroundColor: colors.borderStrong }]} />
            <Text variant="meta" weight={700} tone="muted">
              {daftarBalasan.length > 0 ? `${daftarBalasan.length} balasan` : 'Belum ada balasan'}
            </Text>
            <View style={[s.garis, { backgroundColor: colors.borderStrong }]} />
          </View>

          {daftarBalasan.length === 0 && kirimHook.antrean.length === 0 ? (
            <EmptyState icon="message-circle-reply" title="Belum ada balasan" description="Jadilah yang pertama membalas." variant="plain" />
          ) : (
            daftarBalasan.map((p, i) => {
              const sebelum = daftarBalasan[i - 1];
              const sesudah = daftarBalasan[i + 1];
              return (
                <Gelembung
                  key={p.id}
                  pesan={p}
                  saya={saya}
                  tampilIdentitas={!adalahDm}
                  awalKelompok={sebelum === undefined || !sekelompok(sebelum, p)}
                  akhirKelompok={sesudah === undefined || !sekelompok(p, sesudah)}
                  onTekanLama={() => setAksi(p)}
                  onReaksi={(emoji, aktif) => void reaksi(p, emoji, aktif)}
                />
              );
            })
          )}

          {adaLagi ? <Button title={memuatLagi ? 'Memuat…' : 'Muat balasan berikutnya'} variant="quiet" icon="chevron-down" loading={memuatLagi} onPress={() => void muatBerikutnya()} style={{ alignSelf: 'center' }} /> : null}

          {kirimHook.antrean.map((a) => (
            <Gelembung
              key={a.localId}
              pesan={a.pesan}
              saya={saya}
              tampilIdentitas={!adalahDm}
              awalKelompok
              akhirKelompok
              status={a.status}
              onCobaLagi={() => kirimHook.cobaLagi(a.localId)}
              onHapusGagal={() => kirimHook.hapusLokal(a.localId)}
            />
          ))}
        </ScrollView>
      )}

      <Komposer
        key={sunting?.id ?? 'baru'}
        kanalId={kanalId}
        placeholder="Balas di thread…"
        anggota={detail?.members ?? []}
        saya={saya}
        edit={sunting}
        onBatalEdit={() => setSunting(null)}
        onKirim={kirimHook.kirim}
        terkunci={terkunci}
        galat={kirimHook.galat}
      />

      <AksiPesanSheet pesan={aksi} kanalId={kanalId} saya={saya} onClose={() => setAksi(null)} onSunting={(p) => setSunting(p)} onUbah={ubah} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  skeleton: { padding: 16, gap: 12 },
  isi: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16 },
  pemisah: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  garis: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
});
