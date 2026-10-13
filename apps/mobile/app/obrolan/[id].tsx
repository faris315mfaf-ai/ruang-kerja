/**
 * Linimasa kanal/DM/grup (mockup 07–15, 19–21). Pesan akar urut lama→baru
 * (halaman 30, "Muat sebelumnya" memakai ?sebelum= id akar tertua); balasan
 * thread hidup di layar thread dan hanya muncul sebagai ringkasan. Polling
 * 15 detik HANYA saat fokus + tandai dibaca saat dibuka; auto-gulir hanya bila
 * pembaca dekat dasar; pil "N pesan baru" + tombol lompat bila jauh.
 * Tanpa realtime (WebSocket): indikator mengetik/online sengaja tidak ada.
 */
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import {
  detailKanal,
  dibacaOleh,
  gabungKanal,
  linimasaKanal,
  setReaksi,
  tandaiDibaca,
  type DetailKanal,
  type Pesan,
} from '@/api/obrolan';
import { AksiPesanSheet } from '@/features/obrolan/AksiPesanSheet';
import { Komposer } from '@/features/obrolan/Composer';
import { DibacaOlehSheet } from '@/features/obrolan/DibacaOlehSheet';
import { Gelembung } from '@/features/obrolan/Gelembung';
import { HeaderObrolan } from '@/features/obrolan/HeaderObrolan';
import { UbinKanal } from '@/features/obrolan/UbinKanal';
import { useKirimPesan } from '@/features/obrolan/useKirimPesan';
import { gabungTimeline, gantiPesan, labelHariLinimasa, pesanGalat, subjudulKanal, susunBaris, urutkanTimeline } from '@/features/obrolan/util';
import { useTheme } from '@/theme';
import { Banner, Button, EmptyState, ErrorState, Icon, Pressable, PageGlow, SkeletonRow, Text, toneColor, errorKindFromStatus, useSnackbar } from '@/ui';
import { useSession } from '@/session/SessionProvider';

/** Jarak dari dasar (px) yang masih dianggap "di bawah" untuk auto-gulir. */
const AMBANG_BAWAH = 160;
/** Jarak dari dasar (px) yang memunculkan tombol lompat ke terbaru. */
const AMBANG_JAUH = 480;

function namaDepan(nama: string): string {
  return nama.trim().split(/\s+/)[0] ?? nama;
}

export default function LayarKanal(): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { user } = useSession();
  const saya = user?.id ?? null;
  const { id, nama, jenis, lr } = useLocalSearchParams<{ id: string; nama?: string; jenis?: string; lr?: string }>();
  const kanalId = typeof id === 'string' ? id : '';

  const [detail, setDetail] = useState<DetailKanal | null>(null);
  const [galatDetail, setGalatDetail] = useState<{ status: number; pesan: string } | null>(null);
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [adaLagi, setAdaLagi] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<{ status: number; pesan: string } | null>(null);
  const [aksi, setAksi] = useState<Pesan | null>(null);
  const [sunting, setSunting] = useState<Pesan | null>(null);
  const [dibacaId, setDibacaId] = useState<string | null>(null);
  const [labelBaca, setLabelBaca] = useState<{ id: string; label: string } | null>(null);
  const [baruDiBawah, setBaruDiBawah] = useState(0);
  const [jauh, setJauh] = useState(false);
  const [bergabung, setBergabung] = useState(false);
  const [denyut, setDenyut] = useState(0);

  const batasBaca = useMemo(() => (typeof lr === 'string' ? lr : null), [lr]);

  const gulirRef = useRef<ScrollView | null>(null);
  const lompatBawah = useRef(false);
  const jagaGulir = useRef(false);
  const posisiGulir = useRef(0);
  const tinggiIsi = useRef(0);
  const tinggiLayar = useRef(0);
  const jauhRef = useRef(false);
  const hidup = useRef(true);
  const pesanRef = useRef<Pesan[]>([]);
  const baruRef = useRef(0);

  useEffect(() => {
    pesanRef.current = pesan;
  }, [pesan]);
  useEffect(() => {
    baruRef.current = baruDiBawah;
  }, [baruDiBawah]);

  const dekatBawah = (): boolean => tinggiIsi.current - (posisiGulir.current + tinggiLayar.current) < AMBANG_BAWAH;

  const muatDetail = useCallback(async (): Promise<void> => {
    if (kanalId === '') {
      return;
    }
    try {
      const hasil = await detailKanal(kanalId);
      if (hidup.current) {
        setDetail(hasil.channel);
        setGalatDetail(null);
      }
    } catch (err) {
      if (hidup.current && err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        setGalatDetail({ status: err.status, pesan: err.status === 404 ? 'Obrolan tidak ditemukan atau Anda tidak lagi menjadi anggotanya.' : err.message });
      }
    }
  }, [kanalId]);

  /** Muat halaman terbaru (tanpa sebelum) — awal, polling, dan segarkan. */
  const muatTerbaru = useCallback(
    async (diam: boolean): Promise<void> => {
      if (kanalId === '') {
        return;
      }
      if (!diam) {
        setMemuat(true);
      }
      try {
        const hasil = await linimasaKanal(kanalId, null);
        if (!hidup.current) {
          return;
        }
        setGalat(null);
        const lama = pesanRef.current;
        if (lama.length === 0) {
          lompatBawah.current = true;
        } else {
          const baru = hasil.messages.filter((m) => m.parent_id === null && m.user_id !== saya && !lama.some((n) => n.id === m.id));
          if (baru.length > 0) {
            if (dekatBawah()) {
              lompatBawah.current = true;
              void tandaiDibaca(kanalId).catch(() => undefined);
            } else {
              setBaruDiBawah((n) => n + baru.length);
            }
          }
        }
        setAdaLagi((sudah) => (lama.length === 0 ? hasil.has_more : sudah || hasil.has_more));
        setPesan(lama.length === 0 ? urutkanTimeline(hasil.messages) : gabungTimeline(lama, hasil.messages));
        setDenyut((n) => n + 1);
      } catch (err) {
        if (hidup.current) {
          setGalat({ status: err instanceof ApiError ? err.status : -1, pesan: pesanGalat(err, 'Tidak dapat memuat pesan.') });
        }
      } finally {
        if (hidup.current) {
          setMemuat(false);
          setMenyegarkan(false);
        }
      }
    },
    [kanalId, saya],
  );

  /** Muat pesan lebih tua: ?sebelum= id pesan akar tertua yang tampil. */
  const muatSebelumnya = useCallback(async (): Promise<void> => {
    if (kanalId === '' || memuatLagi) {
      return;
    }
    const akarTerlama = pesan.find((m) => m.parent_id === null) ?? pesan[0];
    if (!akarTerlama) {
      return;
    }
    setMemuatLagi(true);
    try {
      const hasil = await linimasaKanal(kanalId, akarTerlama.id);
      if (!hidup.current) {
        return;
      }
      setAdaLagi(hasil.has_more);
      jagaGulir.current = true; // pertahankan posisi baca saat konten bertambah di atas.
      setPesan((lama) => urutkanTimeline([...hasil.messages, ...lama]));
    } catch (err) {
      if (hidup.current) {
        snackbar.show({ message: pesanGalat(err, 'Tidak dapat memuat pesan lebih lama.'), variant: 'bad' });
      }
    } finally {
      if (hidup.current) {
        setMemuatLagi(false);
      }
    }
  }, [kanalId, memuatLagi, pesan, snackbar]);

  /** Polling ringan hanya selama layar aktif (15 detik) + muat saat fokus. */
  useFocusEffect(
    useCallback(() => {
      hidup.current = true;
      void muatDetail();
      void muatTerbaru(pesanRef.current.length > 0);
      if (kanalId !== '') {
        void tandaiDibaca(kanalId).catch(() => undefined);
      }
      const pewaktu = setInterval(() => {
        void muatTerbaru(true);
      }, 15_000);
      return () => {
        hidup.current = false;
        clearInterval(pewaktu);
      };
    }, [kanalId, muatDetail, muatTerbaru]),
  );

  // Kembali (tombol sistem) saat menyunting: batalkan sunting dulu.
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

  const kirimHook = useKirimPesan({
    kanalId,
    saya,
    onTerkirim: useCallback((p: Pesan) => {
      lompatBawah.current = true;
      setPesan((lama) => urutkanTimeline([...lama, p]));
    }, []),
    onTersunting: useCallback((p: Pesan) => setPesan((lama) => gantiPesan(lama, p)), []),
    onSelesaiSunting: useCallback(() => setSunting(null), []),
  });

  const ubahPesan = useCallback((p: Pesan) => setPesan((lama) => gantiPesan(lama, p)), []);

  const reaksi = useCallback(
    async (p: Pesan, emoji: string, aktif: boolean): Promise<void> => {
      try {
        const hasil = await setReaksi(kanalId, p.id, emoji, aktif);
        ubahPesan(hasil.message);
      } catch (err) {
        snackbar.show({ message: pesanGalat(err, 'Reaksi gagal dikirim.'), variant: 'bad' });
      }
    },
    [kanalId, snackbar, ubahPesan],
  );

  const bukaThread = useCallback(
    (p: Pesan) => {
      router.push({ pathname: '/obrolan/[id]/thread/[messageId]', params: { id: kanalId, messageId: p.id, nama: detail?.title ?? nama ?? '' } });
    },
    [kanalId, detail?.title, nama],
  );

  const jenisKanal = detail?.type ?? (jenis as DetailKanal['type'] | undefined) ?? 'private';
  const judul = detail?.title ?? (typeof nama === 'string' && nama !== '' ? nama : 'Obrolan');
  const adalahDm = jenisKanal === 'dm';
  const adalahPercakapan = jenisKanal === 'dm' || jenisKanal === 'group';
  const anggota = detail?.members ?? [];
  const jumlahAnggota = detail?.members_count ?? anggota.length;

  // Status baca (DM/grup): pesan terakhir milik sendiri yang sudah terkirim.
  const pesanSayaTerakhir = useMemo(() => {
    for (let i = pesan.length - 1; i >= 0; i -= 1) {
      const m = pesan[i];
      if (m && m.parent_id === null && m.user_id === saya && m.deleted_at === null && m.deleted !== true) {
        return m.id;
      }
    }
    return null;
  }, [pesan, saya]);

  const bisaLabelBaca = adalahPercakapan && detail?.is_member === true;
  useEffect(() => {
    if (!bisaLabelBaca || pesanSayaTerakhir === null) {
      return undefined;
    }
    let batal = false;
    dibacaOleh(kanalId, pesanSayaTerakhir)
      .then((r) => {
        if (batal) {
          return;
        }
        if (r.read_count === 0) {
          setLabelBaca(null);
          return;
        }
        const nama2 = r.readers.slice(0, 2).map((p) => namaDepan(p.name));
        const sisa = r.readers.length - nama2.length;
        setLabelBaca({ id: pesanSayaTerakhir, label: adalahDm ? 'Dibaca' : `Dibaca ${nama2.join(', ')}${sisa > 0 ? ` +${sisa}` : ''}` });
      })
      .catch(() => undefined);
    return () => {
      batal = true;
    };
  }, [bisaLabelBaca, adalahDm, kanalId, pesanSayaTerakhir, denyut]);

  const baris = useMemo(() => susunBaris(pesan, batasBaca, saya), [pesan, batasBaca, saya]);

  const gabung = async (): Promise<void> => {
    if (bergabung) {
      return;
    }
    setBergabung(true);
    try {
      const hasil = await gabungKanal(kanalId);
      setDetail(hasil.channel);
      snackbar.show({ message: `Anda bergabung ke ${hasil.channel.title}`, variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Gagal bergabung ke kanal.'), variant: 'bad' });
    } finally {
      setBergabung(false);
    }
  };

  const keBawah = (animasi: boolean): void => {
    gulirRef.current?.scrollToEnd({ animated: animasi });
    setBaruDiBawah(0);
    if (baruRef.current > 0) {
      void tandaiDibaca(kanalId).catch(() => undefined);
    }
  };

  const putih = toneColor(colors, 'onPrimary');

  // ── Keadaan layar penuh ───────────────────────────────────────────────────
  if (galatDetail !== null && pesan.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ animation: 'slide_from_right' }} />
        <PageGlow />
        <HeaderObrolan title="Obrolan" />
        <ErrorState message={galatDetail.pesan} kind={errorKindFromStatus(galatDetail.status)} title={galatDetail.status === 404 ? 'Obrolan tidak ditemukan' : undefined} />
      </View>
    );
  }

  const offline = galat !== null && galat.status === 0;
  const terkunciKomposer: string | null =
    detail === null
      ? null
      : detail.archived
        ? 'Kanal ini diarsipkan. Pesan hanya bisa dibaca.'
        : !detail.can_post && detail.type !== 'public'
          ? detail.is_member
            ? 'Anda tidak dapat mengirim pesan di obrolan ini.'
            : 'Mode lihat saja — hanya anggota yang dapat mengirim pesan di sini.'
          : null;
  const perluGabung = detail !== null && detail.type === 'public' && !detail.is_member && !detail.archived;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <Stack.Screen options={{ animation: 'slide_from_right' }} />
      <PageGlow />
      <HeaderObrolan
        leading={<UbinKanal jenis={jenisKanal} nama={judul} workspace={detail?.workspace ?? null} ukuran={40} />}
        title={judul}
        subtitle={subjudulKanal(jenisKanal, jumlahAnggota)}
        onPressTitle={() => router.push({ pathname: '/obrolan/[id]/detail', params: { id: kanalId } })}
        actions={[
          { icon: 'search', label: 'Cari di percakapan', onPress: () => router.push({ pathname: '/obrolan/[id]/cari', params: { id: kanalId, nama: judul } }) },
          { icon: 'info', label: 'Detail kanal', onPress: () => router.push({ pathname: '/obrolan/[id]/detail', params: { id: kanalId } }) },
        ]}
      />

      {offline && pesan.length > 0 ? <Banner tone="warn" icon="wifi-off" message="Offline. Pesan tidak dapat dikirim." style={s.banner} /> : null}
      {galat !== null && !offline && pesan.length > 0 ? <Banner tone="bad" message={galat.pesan} actionLabel="Coba lagi" onAction={() => void muatTerbaru(false)} style={s.banner} /> : null}

      <View style={{ flex: 1 }}>
        {memuat && pesan.length === 0 ? (
          <View style={s.skeleton}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : galat !== null && pesan.length === 0 ? (
          <ErrorState message={galat.pesan} kind={errorKindFromStatus(galat.status === -1 ? undefined : galat.status)} title={galat.status === 0 ? undefined : 'Pesan gagal dimuat'} onRetry={() => void muatTerbaru(false)} />
        ) : (
          <ScrollView
            ref={gulirRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.isi}
            scrollEventThrottle={64}
            onLayout={(e) => {
              tinggiLayar.current = e.nativeEvent.layout.height;
            }}
            onScroll={(e) => {
              posisiGulir.current = e.nativeEvent.contentOffset.y;
              const jarak = tinggiIsi.current - (posisiGulir.current + tinggiLayar.current);
              const baruJauh = jarak > AMBANG_JAUH;
              if (baruJauh !== jauhRef.current) {
                jauhRef.current = baruJauh;
                setJauh(baruJauh);
              }
              if (jarak < AMBANG_BAWAH && baruRef.current > 0) {
                setBaruDiBawah(0);
                void tandaiDibaca(kanalId).catch(() => undefined);
              }
            }}
            onContentSizeChange={(_, tinggi) => {
              if (jagaGulir.current && tinggiIsi.current > 0) {
                gulirRef.current?.scrollTo({ y: posisiGulir.current + (tinggi - tinggiIsi.current), animated: false });
                jagaGulir.current = false;
              } else if (lompatBawah.current) {
                lompatBawah.current = false;
                gulirRef.current?.scrollToEnd({ animated: false });
              }
              tinggiIsi.current = tinggi;
            }}
            refreshControl={
              <RefreshControl
                refreshing={menyegarkan}
                onRefresh={() => {
                  setMenyegarkan(true);
                  void muatTerbaru(true);
                }}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          >
            {adaLagi && pesan.length > 0 ? (
              memuatLagi ? (
                <SkeletonRow />
              ) : (
                <Button title="Muat sebelumnya" variant="quiet" icon="chevron-up" onPress={() => void muatSebelumnya()} style={{ alignSelf: 'center' }} />
              )
            ) : null}

            {pesan.length === 0 && kirimHook.antrean.length === 0 ? (
              <EmptyState icon="message-circle" title="Belum ada pesan" description="Mulai percakapan dengan mengirim pesan pertama." />
            ) : (
              baris.map((b) => {
                if (b.jenis === 'hari') {
                  return (
                    <View key={b.kunci} style={s.pemisahHari}>
                      <View style={[s.pilHari, { backgroundColor: colors.surface2 }]}>
                        <Text variant="meta" weight={700} tone="muted">
                          {labelHariLinimasa(b.hari)}
                        </Text>
                      </View>
                    </View>
                  );
                }
                if (b.jenis === 'belum') {
                  return (
                    <View key={b.kunci} style={s.pemisahBelum} accessibilityRole="text" accessibilityLabel={`${b.jumlah} pesan belum dibaca`}>
                      <View style={[s.garis, { backgroundColor: colors.danger }]} />
                      <Text variant="meta" weight={700} tone="danger">
                        {b.jumlah} pesan belum dibaca
                      </Text>
                      <View style={[s.garis, { backgroundColor: colors.danger }]} />
                    </View>
                  );
                }
                return (
                  <Gelembung
                    key={b.kunci}
                    pesan={b.pesan}
                    saya={saya}
                    tampilIdentitas={!adalahDm}
                    awalKelompok={b.awalKelompok}
                    akhirKelompok={b.akhirKelompok}
                    tampilThread
                    labelBaca={labelBaca !== null && labelBaca.id === b.pesan.id ? labelBaca.label : null}
                    onTekanBaca={() => setDibacaId(b.pesan.id)}
                    onTekanLama={() => setAksi(b.pesan)}
                    onReaksi={(emoji, aktif) => void reaksi(b.pesan, emoji, aktif)}
                    onBukaThread={() => bukaThread(b.pesan)}
                  />
                );
              })
            )}

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

        {baruDiBawah > 0 ? (
          <Pressable
            onPress={() => keBawah(true)}
            accessibilityRole="button"
            accessibilityLabel={`${baruDiBawah} pesan baru, lompat ke terbaru`}
            style={[s.pil, { backgroundColor: colors.primary }]}
          >
            <Icon name="arrow-down" size={18} color={putih} />
            <Text variant="label" weight={700} style={{ color: putih }}>
              {baruDiBawah} pesan baru
            </Text>
          </Pressable>
        ) : jauh ? (
          <Pressable
            onPress={() => keBawah(true)}
            accessibilityRole="button"
            accessibilityLabel="Lompat ke pesan terbaru"
            style={[s.lompat, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon name="arrow-down" size={22} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      {perluGabung ? (
        <View style={[s.gabung, { backgroundColor: colors.glassStrong, borderTopColor: colors.border }]}>
          <Text variant="meta" style={{ flex: 1 }}>
            Anda membaca kanal publik ini. Gabung untuk ikut berbicara.
          </Text>
          <Button title="Gabung kanal" size="sm" loading={bergabung} loadingTitle="Bergabung…" onPress={() => void gabung()} />
        </View>
      ) : (
        <Komposer
          key={sunting?.id ?? 'baru'}
          kanalId={kanalId}
          placeholder="Tulis pesan…"
          anggota={anggota}
          saya={saya}
          edit={sunting}
          onBatalEdit={() => setSunting(null)}
          onKirim={kirimHook.kirim}
          terkunci={terkunciKomposer}
          galat={kirimHook.galat}
          bolehLampir
        />
      )}

      <AksiPesanSheet
        pesan={aksi}
        kanalId={kanalId}
        saya={saya}
        onClose={() => setAksi(null)}
        onBalas={bukaThread}
        onSunting={(p) => setSunting(p)}
        onDibacaOleh={detail?.is_member ? (p) => setDibacaId(p.id) : undefined}
        onUbah={ubahPesan}
      />
      <DibacaOlehSheet kanalId={kanalId} pesanId={dibacaId} onClose={() => setDibacaId(null)} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  banner: { marginHorizontal: 12, marginTop: 8 },
  skeleton: { padding: 16, gap: 12 },
  isi: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16, gap: 0 },
  pemisahHari: { alignItems: 'center', paddingVertical: 10 },
  pilHari: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  pemisahBelum: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  garis: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  pil: { position: 'absolute', alignSelf: 'center', bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 999 },
  lompat: { position: 'absolute', right: 16, bottom: 12, width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gabung: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
