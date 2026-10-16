/**
 * Persetujuan (sisi penyetuju) — mockup 04: 17 tumpukan, 18 daftar, 22 sheet
 * keputusan, 24 banner delegasi, 28 keadaan. Tab Menunggu · Diputus ·
 * Disetujui (HR/SA). Tumpukan: geser kanan = setujui (dikirim setelah 6 detik
 * tanpa "Urungkan"), geser kiri = sheet Tolak (alasan wajib). Tanpa setujui
 * massal di ponsel (docs/PLATFORM.md §3).
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ApiError } from '@/api/client';
import { hentikanDelegasi, type ItemAntrean, type TabPersetujuan } from '@/api/persetujuan';
import { BannerDelegasi } from '@/features/persetujuan/BannerDelegasi';
import { KartuAntrean } from '@/features/persetujuan/BagianKartu';
import { judulKeputusan, lamaSejak } from '@/features/persetujuan/format';
import { bukaDetailPengajuan, bukaPengajuanSaya } from '@/features/persetujuan/nav';
import { SheetKeputusan, type JenisSheet } from '@/features/persetujuan/SheetKeputusan';
import { TumpukanKartu } from '@/features/persetujuan/TumpukanKartu';
import { useAntrean } from '@/features/persetujuan/useAntrean';
import { aturPemilikDetail, lupakanDetail, prefetchDetail, useDetailPersetujuan } from '@/features/persetujuan/useDetail';
import { useSetujuTertunda } from '@/features/persetujuan/useSetujuTertunda';
import { useSession } from '@/session/SessionProvider';
import { layout, radius, useTheme } from '@/theme';
import { Banner, Button, Card, EmptyState, ErrorState, Icon, Loading, Pressable, Screen, SegmentedTabs, SubAppBar, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';

type Mode = 'tumpukan' | 'daftar';

/** Pilihan tampilan diingat selama aplikasi hidup. */
let modeTerakhir: Mode | null = null;

const LABEL_TAB: Record<TabPersetujuan, string> = { menunggu: 'Menunggu', diputus: 'Diputus', disetujui: 'Disetujui' };

function jamTitik(ms: number | null): string {
  if (ms === null) {
    return '—';
  }
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms)).replace(':', '.');
}

function BarUrungkan({ pesan, onUrungkan }: { pesan: string; onUrungkan: () => void }): React.JSX.Element {
  const { colors, shadows } = useTheme();
  return (
    <View style={[s.urungkan, { backgroundColor: colors.inverse, boxShadow: shadows.inverse }]} accessibilityLiveRegion="polite">
      <Icon name="check" size={22} color={colors.inverseStatus.success} />
      <Text variant="label" weight={600} style={{ flex: 1, color: colors.onInverse, fontSize: 16, lineHeight: 23 }}>
        {pesan}
      </Text>
      <Pressable onPress={onUrungkan} scaleTo={1} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Urungkan persetujuan" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text variant="label" weight={700} style={{ color: colors.onInverse, textDecorationLine: 'underline', fontSize: 16 }}>
          Urungkan
        </Text>
      </Pressable>
    </View>
  );
}

export default function LayarPersetujuan(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const { user } = useSession();
  const pemilik = user?.id ?? 'tamu';
  const staf = user?.is_staff_only ?? true;
  const [tab, setTab] = useState<TabPersetujuan>('menunggu');
  const antrean = useAntrean(tab, pemilik);
  const { state } = antrean;
  const [modePilih, setModePilih] = useState<Mode | null>(modeTerakhir);
  const [sheet, setSheet] = useState<{ jenis: JenisSheet; item: ItemAntrean } | null>(null);
  const [konflik, setKonflik] = useState<{ item: ItemAntrean; pesan: string } | null>(null);
  const sudahFokus = useRef(false);
  const offline = state.offline;

  useEffect(() => {
    aturPemilikDetail(user?.id ?? null);
  }, [user?.id]);

  const menunggu = state.halaman?.counts.menunggu ?? 0;
  // Bawaan (spec 04 §8 Q3): tumpukan bila ≤ 10 menunggu, daftar bila lebih; pilihan pengguna diingat.
  const mode: Mode = modePilih ?? (menunggu > 10 ? 'daftar' : 'tumpukan');
  const tumpukan = tab === 'menunggu' && mode === 'tumpukan';

  const tertunda = useSetujuTertunda({
    onTerkirim: (hasil, item) => {
      lupakanDetail(item.id);
      antrean.aturMenunggu(hasil.menunggu);
    },
    onGagal: (item) => {
      antrean.ubahItems((lama) => (lama.some((x) => x.id === item.id) ? lama : [item, ...lama]));
    },
    onKonflik: (item) => {
      lupakanDetail(item.id);
      antrean.ubahItems((lama) => lama.filter((x) => x.id !== item.id));
    },
  });

  useFocusEffect(
    useCallback(() => {
      if (sudahFokus.current) {
        void antrean.muatUlang(true);
      }
      sudahFokus.current = true;
      return () => {
        // Meninggalkan layar (mis. membuka detail) selama jendela urungkan → kirim sekarang.
        tertunda.kirimSekarang('tinggal');
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat fokus berubah
    }, []),
  );

  const items = useMemo(() => (tertunda.tertunda ? state.items.filter((x) => x.id !== tertunda.tertunda?.id) : state.items), [state.items, tertunda.tertunda]);
  const atas = tumpukan ? (items[0] ?? null) : null;
  const detailAtas = useDetailPersetujuan(atas?.id ?? null);

  useEffect(() => {
    if (tumpukan && items[1]) {
      prefetchDetail(items[1].id);
    }
  }, [tumpukan, items]);

  const keluarkan = useCallback(
    (id: string): void => {
      antrean.ubahItems((lama) => lama.filter((x) => x.id !== id));
    },
    [antrean],
  );

  const setujui = (item: ItemAntrean): void => {
    if (offline) {
      return;
    }
    keluarkan(item.id);
    tertunda.jadwalkan(item);
  };

  const urungkan = (): void => {
    const item = tertunda.urungkan();
    if (item) {
      antrean.ubahItems((lama) => [item, ...lama.filter((x) => x.id !== item.id)]);
    }
  };

  const bukaDetail = (item: ItemAntrean): void => {
    router.push(`/persetujuan/${item.id}` as never);
  };

  const selesaiSheet = (hasil: { menunggu: number }, jenis: JenisSheet, item: ItemAntrean): void => {
    setSheet(null);
    lupakanDetail(item.id);
    keluarkan(item.id);
    antrean.aturMenunggu(hasil.menunggu);
    snackbar.show({ message: jenis === 'tolak' ? `${judulKeputusan(item)} ditolak.` : `Revisi diminta dari ${item.user.name}.`, variant: jenis === 'tolak' ? 'info' : 'ok' });
  };

  const tanganiKonflik = (err: ApiError, item: ItemAntrean): void => {
    setSheet(null);
    lupakanDetail(item.id);
    keluarkan(item.id);
    if (tumpukan) {
      setKonflik({ item, pesan: err.message });
    } else {
      snackbar.show({ message: err.message, variant: 'warn' });
    }
    void antrean.muatUlang(true);
  };

  const hentikan = async (id: string, nama: string): Promise<void> => {
    const ya = await dialog.confirm({
      title: 'Hentikan delegasi?',
      message: `Pengajuan baru akan kembali menunggu Anda, bukan ${nama}. Langkah yang sudah dialihkan kembali ke Anda.`,
      confirmLabel: 'Hentikan',
      destructive: true,
    });
    if (!ya) {
      return;
    }
    try {
      await hentikanDelegasi(id);
      snackbar.show({ message: 'Delegasi dihentikan.', variant: 'ok' });
      void antrean.muatUlang(true);
    } catch (err) {
      snackbar.show({ message: (err as ApiError | undefined)?.message ?? 'Delegasi gagal dihentikan.', variant: 'bad' });
    }
  };

  const gantiMode = (): void => {
    const baru: Mode = mode === 'tumpukan' ? 'daftar' : 'tumpukan';
    modeTerakhir = baru;
    setModePilih(baru);
  };

  const halaman = state.halaman;
  // Yang sedang dalam jendela urungkan belum terkirim, tetapi sudah keluar dari antrean di layar.
  const total = Math.max(menunggu - (tertunda.tertunda ? 1 : 0), items.length);
  const tabs = (halaman?.tabs ?? ['menunggu', 'diputus']).map((t) => ({ value: t, label: LABEL_TAB[t], badge: t === 'menunggu' && total > 0 ? total : null }));
  const terlama = lamaSejak(items[0]?.step?.since ?? items[0]?.waiting?.since ?? null);
  const delegasiAktif = halaman?.delegation.active ?? null;
  const tanpaAkses = staf && tab === 'menunggu' && state.status === 'ok' && items.length === 0 && (halaman?.delegation.representing.length ?? 0) === 0 && !tertunda.tertunda;

  const kepala = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      {offline ? (
        <Banner
          tone="warn"
          icon="cloud-off"
          title="Butuh koneksi."
          message={`Daftar terakhir dimuat ${jamTitik(state.dimuat)}. Menyetujui, menolak, dan geser kartu hanya bisa saat online; keputusan tidak disimpan untuk dikirim nanti.`}
          actionLabel="Coba lagi"
          onAction={() => void antrean.muatUlang()}
        />
      ) : null}
      {!tanpaAkses ? (
        <BannerDelegasi delegasi={halaman?.delegation} nonaktif={offline} onUbah={() => router.push('/persetujuan/delegasi' as never)} onHentikan={(id, nama) => void hentikan(id, nama)} />
      ) : null}
      {!tanpaAkses ? <SegmentedTabs<TabPersetujuan> value={tab} onChange={setTab} options={tabs} /> : null}
      {tab === 'disetujui' ? <Banner tone="info" message="Pengajuan yang sudah disetujui bisa dibatalkan dari detailnya (alasan wajib)." /> : null}
      {state.galat && state.items.length > 0 ? (
        <Text variant="meta" tone="danger" accessibilityRole="alert">
          {state.galat}
        </Text>
      ) : null}
    </View>
  );

  let isi: React.JSX.Element;
  if (state.status === 'memuat') {
    isi = (
      <View style={{ paddingHorizontal: layout.gutter, gap: 12 }}>
        {kepala}
        <Loading rows={4} label="Memuat persetujuan…" />
      </View>
    );
  } else if (state.status === 'galat') {
    isi = (
      <View style={{ paddingHorizontal: layout.gutter, gap: 12 }}>
        {kepala}
        <ErrorState message={state.galat ?? 'Tidak dapat memuat persetujuan.'} kind={errorKindFromStatus(state.galatStatus)} onRetry={() => void antrean.muatUlang()} />
      </View>
    );
  } else if (tanpaAkses) {
    isi = (
      <View style={{ paddingHorizontal: layout.gutter, paddingTop: 16 }}>
        <EmptyState icon="shield-off" title="Halaman tidak tersedia" description="Persetujuan hanya untuk atasan, HR, dan Direksi. Pengajuan Anda ada di Pengajuan saya." actionLabel="Buka Pengajuan saya" onAction={bukaPengajuanSaya} />
      </View>
    );
  } else if (tumpukan && (atas || konflik)) {
    isi = (
      <View style={{ flex: 1, paddingHorizontal: layout.gutter }}>
        {kepala}
        <View style={s.barisInfo}>
          <Text variant="title" weight={700} style={{ fontSize: 18 }}>
            {konflik ? 'Sudah diputuskan' : `1 dari ${total}`}
          </Text>
          {terlama && !konflik ? <Text variant="body" tone="muted" style={{ fontSize: 15 }}>{`terlama menunggu ${terlama}`}</Text> : null}
        </View>
        <View style={{ flex: 1, paddingBottom: 8 }}>
          {konflik ? (
            <Card>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Icon name="circle-alert" size={22} color={colors.warning} />
                <Text variant="h3" style={{ flex: 1 }}>
                  Sudah diputuskan
                </Text>
              </View>
              <Text variant="body" tone="muted">{`${judulKeputusan(konflik.item)}: ${konflik.pesan} Daftar persetujuan Anda diperbarui.`}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Button title="Lihat pengajuan" variant="outline" style={{ flex: 1 }} onPress={() => bukaDetail(konflik.item)} />
                <Button title={items.length > 0 ? 'Lanjut' : 'Selesai'} style={{ flex: 1 }} onPress={() => setKonflik(null)} />
              </View>
            </Card>
          ) : atas ? (
            <TumpukanKartu
              items={items}
              detail={detailAtas.data}
              memuatDetail={detailAtas.memuat}
              nonaktif={offline}
              onSetujui={setujui}
              onTolak={(item) => setSheet({ jenis: 'tolak', item })}
              onRevisi={(item) => setSheet({ jenis: 'revisi', item })}
              onDetail={bukaDetail}
            />
          ) : null}
        </View>
      </View>
    );
  } else {
    const kosong =
      tab === 'menunggu' ? (
        <EmptyState icon="check-check" title="Semua beres" description="Tidak ada pengajuan yang menunggu Anda." />
      ) : tab === 'diputus' ? (
        <EmptyState icon="inbox" title="Belum ada keputusan" description="Pengajuan yang Anda setujui, tolak, atau minta revisi akan muncul di sini." />
      ) : (
        <EmptyState icon="circle-check" title="Belum ada pengajuan disetujui" description="Pengajuan disetujui dalam cakupan Anda akan muncul di sini." />
      );
    isi = (
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={kepala}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: insets.bottom + (tertunda.tertunda ? 120 : 32), gap: 12 }}
        refreshControl={<RefreshControl refreshing={antrean.menyegarkan} onRefresh={() => void antrean.muatUlang()} tintColor={colors.primary} colors={[colors.primary]} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => void antrean.muatBerikut()}
        ListEmptyComponent={kosong}
        ListFooterComponent={
          antrean.memuatLagi ? (
            <Loading rows={1} label="Memuat…" />
          ) : tab === 'menunggu' && items.length > 0 ? (
            <View style={{ gap: 6, paddingTop: 4 }}>
              <Text variant="meta" align="center" style={{ fontSize: 14 }}>
                {`${total} pengajuan${terlama ? ` · terlama menunggu ${terlama}` : ''}`}
              </Text>
              {delegasiAktif ? (
                <Text variant="meta" align="center" style={{ fontSize: 14 }}>
                  {`Pengajuan yang sudah menunggu Anda tetap di sini; yang baru masuk ke ${delegasiAktif.delegate.name.split(' ')[0]}.`}
                </Text>
              ) : null}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <KartuAntrean
            item={item}
            tab={tab}
            onPress={() => (tab === 'disetujui' && halaman?.can_cancel_approved ? bukaDetailPengajuan(item.id) : bukaDetail(item))}
            aksi={
              tab === 'menunggu' && !offline
                ? [
                    { name: 'setujui', label: 'Setujui', onPress: () => setujui(item) },
                    { name: 'tolak', label: 'Tolak', onPress: () => setSheet({ jenis: 'tolak', item }) },
                    { name: 'revisi', label: 'Minta revisi', onPress: () => setSheet({ jenis: 'revisi', item }) },
                  ]
                : undefined
            }
          />
        )}
      />
    );
  }

  const tampilTombol = tumpukan && atas !== null && !konflik && state.status === 'ok';
  const aksiBar = [
    { icon: 'user-cog' as const, label: 'Delegasi persetujuan', onPress: () => router.push('/persetujuan/delegasi' as never) },
    ...(tab === 'menunggu' && !tanpaAkses ? [{ icon: mode === 'tumpukan' ? ('list' as const) : ('layers' as const), label: mode === 'tumpukan' ? 'Tampilan daftar' : 'Tampilan tumpukan', onPress: gantiMode }] : []),
  ];

  return (
    <Screen scroll={false} header={<SubAppBar title="Persetujuan" onBack={() => router.back()} actions={tanpaAkses ? [] : aksiBar} />} contentStyle={{ paddingHorizontal: 0 }}>
      {isi}
      {tertunda.tertunda || tampilTombol ? (
        <View style={{ paddingHorizontal: layout.gutter, paddingBottom: insets.bottom + 12, gap: 10 }}>
          {tertunda.tertunda ? (
            <BarUrungkan
              pesan={`${judulKeputusan(tertunda.tertunda)} disetujui${(tertunda.tertunda.step_position ?? 0) < tertunda.tertunda.step_count ? ', diteruskan ke langkah berikutnya' : ''}.`}
              onUrungkan={urungkan}
            />
          ) : null}
          {tampilTombol && atas ? (
            <>
              {!tertunda.tertunda ? (
                <View style={s.petunjuk} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <View style={s.petunjukSisi}>
                    <Icon name="arrow-left" size={18} color={colors.muted} />
                    <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
                      Tolak
                    </Text>
                  </View>
                  <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
                    {offline ? 'Offline' : 'Geser kartu'}
                  </Text>
                  <View style={s.petunjukSisi}>
                    <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
                      Setujui
                    </Text>
                    <Icon name="arrow-right" size={18} color={colors.muted} />
                  </View>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Tolak" icon="x" variant="outline" style={{ flex: 1, paddingHorizontal: 8 }} disabled={offline} disabledReason="Butuh koneksi" onPress={() => setSheet({ jenis: 'tolak', item: atas })} />
                <Button title="Minta revisi" variant="outline" style={{ flex: 1.3, paddingHorizontal: 8 }} disabled={offline} disabledReason="Butuh koneksi" onPress={() => setSheet({ jenis: 'revisi', item: atas })} />
                <Button title="Setujui" icon="check" style={{ flex: 1.2, paddingHorizontal: 8 }} disabled={offline} disabledReason="Butuh koneksi" onPress={() => setujui(atas)} />
              </View>
            </>
          ) : null}
        </View>
      ) : null}
      <SheetKeputusan
        jenis={sheet?.jenis ?? null}
        item={sheet?.item ?? null}
        offline={offline}
        onClose={() => setSheet(null)}
        onSelesai={(hasil, jenis) => sheet && selesaiSheet(hasil, jenis, sheet.item)}
        onKonflik={(err) => sheet && tanganiKonflik(err, sheet.item)}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  barisInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8, paddingBottom: 12 },
  urungkan: { minHeight: 60, borderRadius: radius.lg + 4, paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  petunjuk: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 },
  petunjukSisi: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
