/**
 * Inbox — notifikasi bertab (Semua · Perlu tindakan · Diarsipkan), chip
 * Belum dibaca + jenis, geser baris (Dibaca/Arsipkan), mode pilih dengan
 * bilah aksi massal, tandai semua dibaca, tarik untuk muat ulang, dan
 * paginasi. Mockup: docs/mockups/android/screens/10-inbox-notifikasi-cari/
 * 01–07.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EntriInbox, JenisInbox, TabInbox } from '@/api/inbox';

import { BarisInbox } from '@/features/inbox/BarisInbox';
import { SwipeableRow, type AksiGeser } from '@/features/inbox/SwipeableRow';
import { resolveTarget, bukaTujuan } from '@/features/inbox/target';
import { useInbox } from '@/features/inbox/useInbox';
import { jamKantor, kelompokkanPerHari } from '@/features/inbox/waktu';
import { layout, useTheme } from '@/theme';
import {

  Banner,
  BottomSheet,
  Button,
  Chip,
  ChipScroller,
  EmptyState,
  ErrorState,
  errorKindFromStatus,
  Glass,
  IconButton,
  Loading,
  Screen,
  SegmentedTabs,
  SheetAction,
  SubAppBar,
  Text,
  Badge,
  useDialog,
  useSnackbar,
  type AnyIconName,
} from '@/ui';

const CHIP_JENIS: { nilai: JenisInbox; label: string }[] = [
  { nilai: 'mention', label: 'Disebut' },
  { nilai: 'task', label: 'Tugas' },
  { nilai: 'request', label: 'Pengajuan' },
  { nilai: 'attendance', label: 'Absensi' },
  { nilai: 'system', label: 'Sistem' },
  { nilai: 'info', label: 'Informatif' },
];

interface Kosong {
  icon: AnyIconName;
  title: string;
  description: string;
}

function keadaanKosong(tab: TabInbox, belum: boolean, jenis: JenisInbox | null): Kosong {
  if (belum) {
    return { icon: 'check-check', title: 'Semua sudah dibaca', description: 'Tidak ada notifikasi yang belum dibaca untuk saringan ini.' };
  }
  if (jenis) {
    return { icon: 'filter-x', title: 'Tidak ada notifikasi', description: 'Tidak ada notifikasi dengan jenis ini. Coba jenis lain.' };
  }
  if (tab === 'perlu-tindakan') {
    return { icon: 'circle-check-big', title: 'Tidak ada yang perlu tindakan', description: 'Persetujuan dan tindak lanjut yang menunggu Anda akan muncul di sini.' };
  }
  if (tab === 'diarsipkan') {
    return { icon: 'archive', title: 'Arsip kosong', description: 'Notifikasi yang Anda arsipkan muncul di sini selama 30 hari.' };
  }
  return { icon: 'party-popper', title: 'Semua beres', description: 'Tidak ada notifikasi baru. Notifikasi baru akan muncul di sini.' };
}

export default function LayarInbox(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const inbox = useInbox();
  const { tab, belum, jenis, state, aksi } = inbox;

  const [pilih, setPilih] = useState<string[] | null>(null);
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState<EntriInbox | null>(null);
  const sudahFokus = useRef(false);

  const mode = pilih === null ? 'biasa' : 'pilih';

  // Muat ulang tenang saat layar kembali fokus (tujuan menyelesaikan "Perlu tindakan").
  useFocusEffect(
    useCallback(() => {
      if (sudahFokus.current) {
        void inbox.muatUlang();
      }
      sudahFokus.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat fokus
    }, []),
  );

  // Kembali sistem: keluar dari mode pilih dulu.
  useEffect(() => {
    if (pilih === null) {
      return undefined;
    }
    const langganan = BackHandler.addEventListener('hardwareBackPress', () => {
      setPilih(null);
      return true;
    });
    return () => langganan.remove();
  }, [pilih]);

  // Ganti tab/chip → keluar dari mode pilih.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset mode pilih saat saringan berubah
    setPilih(null);
  }, [tab, belum, jenis]);

  const kelompok = useMemo(() => kelompokkanPerHari(state.items), [state.items]);

  const buka = (item: EntriInbox): void => {
    if (item.read_at === null) {
      void aksi([item], 'baca');
    }
    const tujuan = resolveTarget(item.target, { notifikasiId: item.id });
    if (tujuan.aksi === 'detail') {
      setDetail(item);
      return;
    }
    bukaTujuan(tujuan, item.id);
  };

  const alihPilih = (item: EntriInbox): void => {
    setPilih((lama) => {
      if (lama === null) {
        return [item.id];
      }
      return lama.includes(item.id) ? lama.filter((x) => x !== item.id) : [...lama, item.id];
    });
  };

  const aksiGeser = (item: EntriInbox): AksiGeser[] => {
    if (item.archived_at !== null) {
      return [
        { kunci: 'belum-baca', label: 'Belum dibaca', icon: 'mail', warna: 'blue', onPress: () => void aksi([item], 'belum-baca') },
        { kunci: 'kembalikan', label: 'Kembalikan', icon: 'archive-restore', warna: 'teal', onPress: () => void aksi([item], 'batal-arsip') },
      ];
    }
    return [
      item.read_at === null
        ? { kunci: 'baca', label: 'Dibaca', icon: 'check', warna: 'blue', onPress: () => void aksi([item], 'baca') }
        : { kunci: 'belum-baca', label: 'Belum dibaca', icon: 'mail', warna: 'blue', onPress: () => void aksi([item], 'belum-baca') },
      { kunci: 'arsip', label: 'Arsipkan', icon: 'archive', warna: 'teal', onPress: () => void aksi([item], 'arsip') },
    ];
  };

  const konfirmasiTandaiSemua = async (): Promise<void> => {
    const n = state.counts?.belum_dibaca ?? 0;
    if (n === 0) {
      snackbar.show({ message: 'Tidak ada notifikasi yang belum dibaca', variant: 'info' });
      return;
    }
    const ya = await dialog.confirm({
      title: 'Tandai semua dibaca?',
      message: `${n} notifikasi belum dibaca akan ditandai dibaca. Item “Perlu tindakan” tetap menunggu sampai aksinya selesai.`,
      confirmLabel: 'Tandai dibaca',
    });
    if (ya) {
      const tertandai = await inbox.tandaiSemua();
      if (tertandai !== null) {
        snackbar.show({ message: `${tertandai} notifikasi ditandai dibaca`, variant: 'ok' });
      }
    }
  };

  const terpilih = state.items.filter((i) => pilih?.includes(i.id));
  const diArsip = tab === 'diarsipkan';
  const counts = state.counts;

  const header =
    pilih !== null ? (
      <Glass style={{ paddingTop: insets.top, borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.linkSoft }}>
        <View style={[s.pilihBar, { height: layout.appBar }]}>
          <IconButton icon="x" label="Keluar dari mode pilih" variant="ghost" onPress={() => setPilih(null)} />
          <Text variant="title" weight={700} tone="link" style={{ flex: 1 }} accessibilityLiveRegion="polite">
            {pilih.length} dipilih
          </Text>
          <IconButton
            icon="list-checks"
            label={pilih.length === state.items.length ? 'Batalkan pilih semua' : 'Pilih semua'}
            variant="ghost"
            onPress={() => setPilih(pilih.length === state.items.length ? [] : state.items.map((i) => i.id))}
          />
        </View>
      </Glass>
    ) : (
      <SubAppBar
        title="Inbox"
        actions={[
          { icon: 'search', label: 'Cari', onPress: () => router.push('/cari' as never) },
          { icon: 'check-check', label: 'Tandai semua dibaca', onPress: () => void konfirmasiTandaiSemua() },
          { icon: 'ellipsis-vertical', label: 'Menu lainnya', onPress: () => setMenu(true) },
        ]}
      />
    );

  const kepalaDaftar = (
    <View style={{ gap: 12, paddingTop: 4 }}>
      <View style={{ paddingHorizontal: layout.gutter, gap: 12 }}>
        {state.offlineSejak ? (
          <Banner
            tone="warn"
            icon="wifi-off"
            message={`Anda sedang offline. Menampilkan salinan terakhir (${state.offlineSejak}); tandai dibaca & arsip menunggu koneksi.`}
          />
        ) : inbox.tertunda > 0 ? (
          <Banner tone="info" icon="cloud-upload" message={`${inbox.tertunda} perubahan menunggu koneksi.`} />
        ) : null}
        <SegmentedTabs<TabInbox>
          value={tab}
          onChange={inbox.setTab}
          options={[
            { value: 'semua', label: 'Semua' },
            { value: 'perlu-tindakan', label: 'Perlu tindakan', badge: counts && counts.perlu_tindakan > 0 ? counts.perlu_tindakan : null },
            { value: 'diarsipkan', label: 'Diarsipkan' },
          ]}
        />
      </View>
      <ChipScroller>
        <Chip
          label="Belum dibaca"
          count={counts && counts.belum_dibaca > 0 ? counts.belum_dibaca : undefined}
          selected={belum}
          onPress={() => inbox.setBelum(!belum)}
        />
        {CHIP_JENIS.map((c) => (
          <Chip key={c.nilai} label={c.label} selected={jenis === c.nilai} onPress={() => inbox.setJenis(jenis === c.nilai ? null : c.nilai)} />
        ))}
      </ChipScroller>
      {diArsip && state.items.length > 0 ? (
        <Text variant="meta" style={{ paddingHorizontal: layout.gutter, fontSize: 14 }}>
          Menampilkan arsip. Geser kiri untuk Kembalikan.
        </Text>
      ) : null}
    </View>
  );

  const kakiDaftar = (
    <View style={{ paddingHorizontal: layout.gutter, paddingTop: 12, gap: 12, alignItems: 'center' }}>
      {state.galat && state.items.length > 0 && !state.offlineSejak ? (
        <Banner tone="bad" message={state.galat} actionLabel="Coba lagi" onAction={() => void inbox.muatBerikut()} style={{ alignSelf: 'stretch' }} />
      ) : null}
      {inbox.memuatLagi ? (
        <Loading rows={2} label="Memuat…" />
      ) : state.items.length > 0 && !inbox.punyaBerikut ? (
        <Text variant="meta" align="center" style={{ fontSize: 14 }}>
          {diArsip ? 'Notifikasi disimpan 30 hari. ' : 'Itu saja untuk sekarang. '}
          <Text variant="meta" weight={700} tone="link" style={{ fontSize: 14 }} onPress={() => router.push('/pengaturan/notifikasi' as never)}>
            Atur notifikasi
          </Text>
        </Text>
      ) : null}
    </View>
  );

  let isi: React.JSX.Element;
  if (state.status === 'memuat') {
    isi = (
      <View style={{ gap: 12 }}>
        {kepalaDaftar}
        <View style={{ paddingHorizontal: layout.gutter }}>
          <Loading rows={6} label="Memuat inbox…" />
        </View>
      </View>
    );
  } else if (state.status === 'galat') {
    isi = (
      <View style={{ gap: 12 }}>
        {kepalaDaftar}
        <ErrorState message={state.galat ?? 'Tidak dapat memuat inbox.'} kind={errorKindFromStatus(state.galatStatus)} onRetry={() => void inbox.muatUlang()} />
      </View>
    );
  } else {
    const kosong = keadaanKosong(tab, belum, jenis);
    isi = (
      <FlatList
        data={kelompok}
        keyExtractor={(g) => g.kunci}
        ListHeaderComponent={kepalaDaftar}
        ListFooterComponent={kakiDaftar}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: layout.gutter, paddingTop: 16 }}>
            <EmptyState icon={kosong.icon} title={kosong.title} description={kosong.description} />
          </View>
        }
        contentContainerStyle={{ paddingBottom: pilih !== null ? 24 : insets.bottom + 32, gap: 8 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => void inbox.muatBerikut()}
        refreshControl={<RefreshControl refreshing={inbox.menyegarkan} onRefresh={() => void inbox.muatUlang()} tintColor={colors.primary} colors={[colors.primary]} />}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: grup }) => {
          const baru = grup.items.filter((i) => i.read_at === null).length;
          return (
            <View style={{ gap: 8, paddingHorizontal: layout.gutter, paddingTop: 8 }}>
              <Text variant="overline" tone="muted" accessibilityRole="header">
                {grup.label}
                {baru > 0 ? ` · ${baru} baru` : ''}
              </Text>
              <View style={[s.kartu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {grup.items.map((entri, i) => (
                  <View key={entri.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : undefined}>
                    <SwipeableRow
                      aksi={aksiGeser(entri)}
                      disabled={pilih !== null}
                      onPress={() => (pilih !== null ? alihPilih(entri) : buka(entri))}
                      onLongPress={() => alihPilih(entri)}
                      accessibilityLabel={`${entri.read_at === null ? 'Belum dibaca. ' : ''}${entri.title}. ${jamKantor(entri.created_at)}${entri.action_required ? '. Perlu tindakan' : ''}`}
                    >
                      <BarisInbox item={entri} mode={mode} dipilih={pilih?.includes(entri.id) ?? false} />
                    </SwipeableRow>
                  </View>
                ))}
              </View>
            </View>
          );
        }}
      />
    );
  }

  return (
    <Screen
      scroll={false}
      header={header}
      contentStyle={{ paddingHorizontal: 0 }}
      footer={
        pilih !== null ? (
          <>
            <Button
              title={diArsip ? 'Belum dibaca' : 'Tandai dibaca'}
              variant="tonal"
              icon={diArsip ? 'mail' : 'check'}
              disabled={terpilih.length === 0}
              style={{ flex: 1 }}
              onPress={() => {
                void aksi(terpilih, diArsip ? 'belum-baca' : 'baca');
                setPilih(null);
              }}
            />
            <Button
              title={diArsip ? 'Kembalikan' : 'Arsipkan'}
              icon={diArsip ? 'archive-restore' : 'archive'}
              disabled={terpilih.length === 0}
              style={{ flex: 1.2 }}
              onPress={() => {
                void aksi(terpilih, diArsip ? 'batal-arsip' : 'arsip');
                setPilih(null);
              }}
            />
          </>
        ) : undefined
      }
    >
      {isi}

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title="Inbox">
        <SheetAction
          icon="list-checks"
          label="Pilih beberapa"
          onPress={() => {
            setMenu(false);
            setPilih([]);
          }}
        />
        <SheetAction
          icon="settings"
          label="Pengaturan notifikasi"
          onPress={() => {
            setMenu(false);
            router.push('/pengaturan/notifikasi' as never);
          }}
        />
        <SheetAction
          icon="refresh-cw"
          label="Muat ulang"
          onPress={() => {
            setMenu(false);
            void inbox.muatUlang();
          }}
        />
      </BottomSheet>

      <BottomSheet visible={detail !== null} onClose={() => setDetail(null)} scrollable>
        {detail ? (
          <View style={{ gap: 12 }}>
            <View style={{ alignSelf: 'flex-start' }}>
              <Badge tone="primary" dot={false}>
                {detail.type_label}
              </Badge>
            </View>
            <Text variant="h3">{detail.title}</Text>
            <Text variant="meta" style={{ fontSize: 14 }}>
              {detail.actor?.name ?? 'RuangKerja'} · {jamKantor(detail.created_at)}
            </Text>
            {detail.body ? (
              <View style={[s.isiDetail, { backgroundColor: colors.surface }]}>
                <Text variant="body">{detail.body}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="Belum dibaca"
                variant="outline"
                icon="mail"
                style={{ flex: 1 }}
                onPress={() => {
                  void aksi([detail], 'belum-baca');
                  setDetail(null);
                }}
              />
              <Button
                title={detail.archived_at ? 'Kembalikan' : 'Arsipkan'}
                icon={detail.archived_at ? 'archive-restore' : 'archive'}
                style={{ flex: 1.2 }}
                onPress={() => {
                  void aksi([detail], detail.archived_at ? 'batal-arsip' : 'arsip');
                  setDetail(null);
                }}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  pilihBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  kartu: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  isiDetail: { borderRadius: 20, padding: 16 },
});
