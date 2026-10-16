/**
 * Tab Obrolan (mockup 01–05): daftar dikelompokkan Workspace · Kanal publik ·
 * Kanal privat · Pesan langsung · Grup, lencana belum dibaca, ikon bisu,
 * "Belum bergabung", cari (saring di daftar), tahan lama = aksi baris, FAB
 * "Pesan baru" → Pesan baru / Kanal baru / Jelajahi kanal publik.
 * Di balik flag features.chat: 404 → "Obrolan belum diaktifkan".
 * Polling 20 detik hanya saat tab fokus; offline menampilkan daftar terakhir.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { bisukanKanal, daftarObrolan, tandaiDibaca, type JenisKanal, type KanalRingkas } from '@/api/obrolan';
import { BarisKanal } from '@/features/obrolan/BarisKanal';
import { Percakapan } from '@/features/obrolan/Percakapan';
import { Thread } from '@/features/obrolan/Thread';
import { bukaKanal, kanalDibisukan, LABEL_JENIS, namaKanal, paramKanal, pesanGalat, URUTAN_JENIS } from '@/features/obrolan/util';
import { useTheme } from '@/theme';
import { useSession } from '@/session/SessionProvider';
import { useUnread } from '@/session/UnreadProvider';
import { useTabBarSpace } from '@/ui/chrome';
import {
  AppBar,
  BottomSheet,
  Card,
  EmptyState,
  ErrorState,
  errorKindFromStatus,
  Fab,
  lebarDaftar,
  Loading,
  OfflineBanner,
  PanelProvider,
  Pressable,
  Screen,
  SearchInput,
  SegmentedTabs,
  SheetAction,
  Text,
  useSnackbar,
  useTataLetak,
  type AppBarAction,
} from '@/ui';

type Saringan = 'semua' | 'belum';

function cocok(kanal: KanalRingkas, q: string): boolean {
  const kunci = q.trim().toLowerCase();
  if (kunci === '') {
    return true;
  }
  return [namaKanal(kanal), kanal.workspace?.name ?? '', kanal.topic ?? '', kanal.last_message?.body_text ?? ''].some((t) => t.toLowerCase().includes(kunci));
}

function urutWaktu(a: KanalRingkas, b: KanalRingkas): number {
  const wa = a.last_message?.created_at ?? a.created_at ?? '';
  const wb = b.last_message?.created_at ?? b.created_at ?? '';
  return wa < wb ? 1 : wa > wb ? -1 : 0;
}

export default function LayarObrolan(): React.JSX.Element {
  const { user } = useSession();
  const saya = user?.id ?? null;
  const { jumlah: inboxBelum, perbaruiObrolan } = useUnread();
  const snackbar = useSnackbar();
  const ruangTab = useTabBarSpace();
  const { colors, shadows } = useTheme();
  // Tablet (mockup 12/18): ≥ 720 dp daftar + percakapan; ≥ 1000 dp thread jadi
  // kolom ketiga, di bawahnya thread = panel geser di atas percakapan.
  const tata = useTataLetak();
  const duaPanel = tata.duaPanel;
  const [pilihan, setPilihan] = useState<ReturnType<typeof paramKanal> | null>(null);
  const [thread, setThread] = useState<{ messageId: string; nama: string } | null>(null);
  const tutupThread = useCallback(() => setThread(null), []);

  // Tombol kembali sistem menutup panel thread lebih dulu.
  useFocusEffect(
    useCallback(() => {
      if (!duaPanel || thread === null) {
        return undefined;
      }
      const langganan = BackHandler.addEventListener('hardwareBackPress', () => {
        setThread(null);
        return true;
      });
      return () => langganan.remove();
    }, [duaPanel, thread]),
  );

  const buka = (k: KanalRingkas): void => {
    if (duaPanel) {
      setThread(null);
      setPilihan(paramKanal(k, saya));
    } else {
      bukaKanal(k, saya);
    }
  };

  const [saringan, setSaringan] = useState<Saringan>('semua');
  const [cari, setCari] = useState('');
  const [tampilCari, setTampilCari] = useState(false);
  const [kanal, setKanal] = useState<KanalRingkas[]>([]);
  const [sudahMuat, setSudahMuat] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<{ status: number; pesan: string } | null>(null);
  const [mati, setMati] = useState(false);
  const [sheetBaru, setSheetBaru] = useState(false);
  const [aksiBaris, setAksiBaris] = useState<KanalRingkas | null>(null);
  const hidup = useRef(true);

  const muat = useCallback(
    async (): Promise<void> => {
      try {
        const hasil = await daftarObrolan();
        if (!hidup.current) {
          return;
        }
        setKanal(hasil.channels);
        perbaruiObrolan(hasil.unread_channels);
        setMati(false);
        setGalat(null);
      } catch (err) {
        if (!hidup.current) {
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setMati(true);
          setKanal([]);
        } else {
          setGalat({ status: err instanceof ApiError ? err.status : -1, pesan: pesanGalat(err, 'Tidak dapat memuat obrolan.') });
        }
      } finally {
        if (hidup.current) {
          setSudahMuat(true);
          setMenyegarkan(false);
        }
      }
    },
    [perbaruiObrolan],
  );

  useFocusEffect(
    useCallback(() => {
      hidup.current = true;
      void muat();
      const pewaktu = setInterval(() => void muat(), 20_000);
      return () => {
        hidup.current = false;
        clearInterval(pewaktu);
      };
    }, [muat]),
  );

  const belumSemua = useMemo(() => kanal.filter((k) => k.unread_count > 0), [kanal]);
  const tersaring = useMemo(() => (saringan === 'belum' ? belumSemua : kanal).filter((k) => cocok(k, cari)), [saringan, belumSemua, kanal, cari]);

  const bagian = useMemo(
    () =>
      URUTAN_JENIS.map((jenis) => ({ jenis, item: tersaring.filter((k) => k.type === jenis).sort(urutWaktu) })).filter((b) => b.item.length > 0),
    [tersaring],
  );

  const belumBergabung = kanal.filter((k) => k.type === 'public' && !k.is_member).length;
  const offline = galat !== null && galat.status === 0 && kanal.length > 0;

  const tutupSheetLalu = (aksi: () => void): void => {
    setSheetBaru(false);
    setAksiBaris(null);
    aksi();
  };

  const tandaiBaca = async (k: KanalRingkas): Promise<void> => {
    try {
      await tandaiDibaca(k.id);
      setKanal((lama) => lama.map((x) => (x.id === k.id ? { ...x, unread_count: 0 } : x)));
      void muat();
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Gagal menandai dibaca.'), variant: 'bad' });
    }
  };

  const bisukan = async (k: KanalRingkas, nilai: boolean): Promise<void> => {
    try {
      await bisukanKanal(k.id, nilai);
      setKanal((lama) => lama.map((x) => (x.id === k.id && saya !== null ? { ...x, members: x.members.map((m) => (m.user_id === saya ? { ...m, muted: nilai } : m)) } : x)));
      snackbar.show({
        message: nilai ? `${namaKanal(k)} dibisukan` : `Notifikasi ${namaKanal(k)} diaktifkan`,
        variant: 'ok',
        actionLabel: 'Urungkan',
        onAction: () => void bisukan(k, !nilai),
      });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Pengaturan bisu gagal disimpan.'), variant: 'bad' });
    }
  };

  const aksiAppBar: AppBarAction[] = [
    { icon: 'search', label: 'Cari percakapan', onPress: () => setTampilCari((v) => !v) },
    { icon: 'bell', label: 'Notifikasi', badge: inboxBelum > 0 ? inboxBelum : undefined, onPress: () => router.push('/inbox') },
  ];

  if (mati) {
    return (
      <Screen>
        <AppBar title="Obrolan" />
        <EmptyState icon="cloud-off" title="Obrolan belum diaktifkan" description="Fitur obrolan sedang tidak tersedia di server. Gunakan RuangKerja web atau hubungi admin." />
      </Screen>
    );
  }

  const panelThread =
    thread !== null && pilihan !== null ? (
      <PanelProvider tutup={tutupThread}>
        <Thread key={thread.messageId} id={pilihan.id} messageId={thread.messageId} nama={thread.nama} />
      </PanelProvider>
    ) : null;

  return (
    <View style={[{ flex: 1 }, duaPanel && s.baris]}>
      <View style={duaPanel ? [s.kolomDaftar, { width: lebarDaftar(tata, 'obrolan'), borderRightColor: colors.border }] : { flex: 1 }}>
        <Screen
          refreshing={menyegarkan}
          onRefresh={() => {
            setMenyegarkan(true);
            void muat();
          }}
        >
          <AppBar title="Obrolan" actions={aksiAppBar} />

          {tampilCari ? <SearchInput value={cari} onChangeText={setCari} placeholder="Cari percakapan" autoFocus /> : null}

          <SegmentedTabs<Saringan>
            value={saringan}
            onChange={setSaringan}
            options={[
              { value: 'semua', label: 'Semua', badge: kanal.length > 0 ? kanal.length : null },
              { value: 'belum', label: 'Belum dibaca', badge: belumSemua.length > 0 ? belumSemua.length : null },
            ]}
          />

          {offline ? <OfflineBanner /> : null}

          {!sudahMuat ? (
            <Loading rows={6} />
          ) : galat !== null && kanal.length === 0 ? (
            <ErrorState
              message={galat.pesan}
              kind={errorKindFromStatus(galat.status === -1 ? undefined : galat.status)}
              title={galat.status === 0 ? undefined : 'Obrolan gagal dimuat'}
              onRetry={() => {
                setSudahMuat(false);
                void muat();
              }}
            />
          ) : bagian.length === 0 ? (
            cari.trim() !== '' ? (
              <EmptyState icon="search" title="Tidak ada hasil" description={`Tidak ada percakapan yang cocok dengan “${cari.trim()}”.`} />
            ) : saringan === 'belum' ? (
              <EmptyState icon="check-check" title="Tidak ada pesan baru" description="Semua pesan sudah Anda baca." />
            ) : (
              <EmptyState icon="message-circle" title="Belum ada obrolan" description="Kanal workspace dan pesan langsung akan muncul di sini." actionLabel="Pesan baru" onAction={() => router.push('/obrolan/baru')} />
            )
          ) : (
            <>
              {bagian.map((b) => (
                <View key={b.jenis} style={{ gap: 8 }}>
                  <View style={s.seksi}>
                    <Text variant="overline" tone="muted">
                      {LABEL_JENIS[b.jenis as JenisKanal]}
                    </Text>
                    <Text variant="meta">{b.item.length}</Text>
                  </View>
                  <Card variant="flat">
                    {b.item.map((k, i) => (
                      <BarisKanal key={k.id} kanal={k} saya={saya} divider={i > 0} terpilih={duaPanel && pilihan?.id === k.id} onTekan={() => buka(k)} onTekanLama={() => setAksiBaris(k)} />
                    ))}
                  </Card>
                </View>
              ))}
              {cari.trim() !== '' ? (
                <Text variant="meta" align="center">
                  Cari isi pesan: tahan percakapan lalu pilih “Cari pesan”.
                </Text>
              ) : null}
            </>
          )}
        </Screen>

        <View pointerEvents={offline ? 'none' : 'box-none'} style={[s.fab, { bottom: ruangTab + 16, opacity: offline ? 0.45 : 1 }]}>
          <Fab icon="message-square-plus" label="Pesan baru" onPress={() => setSheetBaru(true)} />
        </View>
      </View>

      {duaPanel ? (
        <View style={{ flex: 1 }}>
          {pilihan !== null ? (
            <PanelProvider>
              <Percakapan
                key={pilihan.id}
                id={pilihan.id}
                nama={pilihan.nama}
                jenis={pilihan.jenis}
                lr={pilihan.lr}
                onBukaThread={(p, judul) => setThread({ messageId: p.id, nama: judul })}
              />
            </PanelProvider>
          ) : (
            <View style={[s.kosong, { backgroundColor: colors.bg }]}>
              <EmptyState icon="message-circle" title="Pilih percakapan" description="Percakapan tampil di sini." />
            </View>
          )}
          {panelThread !== null && !tata.tigaKolom ? (
            <>
              <Pressable onPress={tutupThread} scaleTo={1} accessibilityRole="button" accessibilityLabel="Tutup thread" style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
              <View style={[s.threadGeser, { backgroundColor: colors.bg, borderLeftColor: colors.border, boxShadow: shadows.float }]}>{panelThread}</View>
            </>
          ) : null}
        </View>
      ) : null}
      {panelThread !== null && duaPanel && tata.tigaKolom ? <View style={[s.kolomThread, { borderLeftColor: colors.border }]}>{panelThread}</View> : null}

      <BottomSheet visible={sheetBaru} onClose={() => setSheetBaru(false)} title="Obrolan baru" showClose>
        <SheetAction icon="user-plus" label="Pesan baru" description="Satu rekan = pesan langsung, dua atau lebih = grup" onPress={() => tutupSheetLalu(() => router.push('/obrolan/baru'))} />
        <SheetAction icon="hash" label="Kanal baru" description="Publik atau privat, untuk topik atau tim" onPress={() => tutupSheetLalu(() => router.push('/obrolan/kanal-baru'))} />
        <SheetAction
          icon="compass"
          label="Jelajahi kanal publik"
          description={belumBergabung > 0 ? `Lihat kanal yang bisa Anda ikuti · ${belumBergabung} belum bergabung` : 'Lihat kanal yang bisa Anda ikuti'}
          onPress={() => tutupSheetLalu(() => router.push('/obrolan/jelajah'))}
        />
      </BottomSheet>

      <BottomSheet visible={aksiBaris !== null} onClose={() => setAksiBaris(null)} title={aksiBaris ? namaKanal(aksiBaris) : undefined}>
        {aksiBaris !== null ? (
          <>
            {aksiBaris.unread_count > 0 && aksiBaris.is_member ? (
              <SheetAction icon="check-check" label="Tandai dibaca" onPress={() => tutupSheetLalu(() => void tandaiBaca(aksiBaris))} />
            ) : null}
            {aksiBaris.is_member ? (
              kanalDibisukan(aksiBaris, saya) ? (
                <SheetAction icon="bell" label="Aktifkan notifikasi" onPress={() => tutupSheetLalu(() => void bisukan(aksiBaris, false))} />
              ) : (
                <SheetAction icon="bell-off" label="Bisukan notifikasi" description="Mention tetap masuk" onPress={() => tutupSheetLalu(() => void bisukan(aksiBaris, true))} />
              )
            ) : null}
            <SheetAction
              icon="search"
              label="Cari pesan"
              onPress={() => tutupSheetLalu(() => router.push({ pathname: '/obrolan/[id]/cari', params: { id: aksiBaris.id, nama: namaKanal(aksiBaris) } }))}
            />
            <SheetAction icon="info" label="Detail" onPress={() => tutupSheetLalu(() => router.push({ pathname: '/obrolan/[id]/detail', params: { id: aksiBaris.id } }))} />
          </>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row' },
  kolomDaftar: { borderRightWidth: StyleSheet.hairlineWidth },
  kosong: { flex: 1, justifyContent: 'center', padding: 32 },
  kolomThread: { width: 320, borderLeftWidth: StyleSheet.hairlineWidth },
  threadGeser: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '62%', maxWidth: 400, borderLeftWidth: StyleSheet.hairlineWidth },
  seksi: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  fab: { position: 'absolute', right: 16 },
});
