/**
 * Pengumuman — daftar "Untuk saya" dan (bagi pembuat) "Saya buat", hapus
 * oleh pembuat, FAB "Pengumuman baru". Mockup: 09-pengumuman-daftar.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ItemPengumuman, TabPengumuman } from '@/api/pengumuman';
import { ApiError } from '@/api/client';
import { KartuPengumuman } from '@/features/pengumuman/KartuPengumuman';
import { useDaftarPengumuman } from '@/features/pengumuman/useDaftarPengumuman';
import { layout, useTheme } from '@/theme';
import { EmptyState, ErrorState, Fab, Loading, Screen, SegmentedTabs, SubAppBar, Text, errorKindFromStatus, useDialog, useSnackbar } from '@/ui';

export default function LayarPengumuman(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const param = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabPengumuman>(param.tab === 'saya-buat' ? 'saya-buat' : 'untuk-saya');
  const daftar = useDaftarPengumuman(tab);
  const { state } = daftar;
  const sudahFokus = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (sudahFokus.current) {
        void daftar.muatUlang(true);
      }
      sudahFokus.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat fokus
    }, []),
  );

  const hapus = async (item: ItemPengumuman): Promise<void> => {
    const ya = await dialog.confirm({
      title: 'Hapus pengumuman?',
      message: `“${item.title}” akan hilang dari semua beranda. Notifikasi yang sudah terkirim tetap ada di Inbox.`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ya) {
      return;
    }
    try {
      await daftar.hapus(item.id);
      snackbar.show({ message: 'Pengumuman dihapus', variant: 'ok' });
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiError && err.status === 0 ? 'Tidak ada koneksi. Pengumuman belum dihapus.' : err instanceof ApiError ? err.message : 'Gagal menghapus pengumuman.',
        variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad',
      });
    }
  };

  const kepala = daftar.bolehBuat ? (
    <View style={{ paddingTop: 4, paddingBottom: 8 }}>
      <SegmentedTabs<TabPengumuman>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'untuk-saya', label: 'Untuk saya' },
          { value: 'saya-buat', label: 'Saya buat' },
        ]}
      />
    </View>
  ) : null;

  let isi: React.JSX.Element;
  if (state.status === 'memuat') {
    isi = (
      <View style={{ paddingHorizontal: layout.gutter, gap: 12 }}>
        {kepala}
        <Loading rows={3} label="Memuat pengumuman…" />
      </View>
    );
  } else if (state.status === 'galat') {
    isi = (
      <View style={{ paddingHorizontal: layout.gutter }}>
        {kepala}
        <ErrorState message={state.galat ?? 'Tidak dapat memuat pengumuman.'} kind={errorKindFromStatus(state.galatStatus)} onRetry={() => void daftar.muatUlang()} />
      </View>
    );
  } else {
    isi = (
      <FlatList
        data={state.items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={kepala}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: insets.bottom + 120, gap: 12 }}
        refreshControl={<RefreshControl refreshing={daftar.menyegarkan} onRefresh={() => void daftar.muatUlang()} tintColor={colors.primary} colors={[colors.primary]} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => void daftar.muatBerikut()}
        ListEmptyComponent={
          tab === 'saya-buat' ? (
            <EmptyState icon="megaphone" title="Belum ada pengumuman buatan Anda" description="Pengumuman yang Anda terbitkan muncul di sini." actionLabel="Pengumuman baru" onAction={() => router.push('/pengumuman/baru' as never)} />
          ) : (
            <EmptyState icon="megaphone" title="Belum ada pengumuman" description="Pengumuman dari kantor akan muncul di sini dan di beranda Anda." />
          )
        }
        ListFooterComponent={
          daftar.memuatLagi ? (
            <Loading rows={1} label="Memuat…" />
          ) : state.galat && state.items.length > 0 ? (
            <Text variant="meta" tone="danger" align="center">
              {state.galat}
            </Text>
          ) : state.items.length > 0 ? (
            <Text variant="meta" align="center" style={{ fontSize: 14 }}>
              Itu saja untuk sekarang
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <KartuPengumuman
            item={item}
            onPress={() => router.push(`/pengumuman/${item.id}` as never)}
            onHapus={item.can_delete ? () => void hapus(item) : undefined}
          />
        )}
      />
    );
  }

  return (
    <Screen scroll={false} header={<SubAppBar title="Pengumuman" />} contentStyle={{ paddingHorizontal: 0 }}>
      {isi}
      {daftar.bolehBuat ? (
        <View style={{ position: 'absolute', right: layout.gutter, bottom: insets.bottom + 20 }}>
          <Fab icon="megaphone" label="Pengumuman baru" extended onPress={() => router.push('/pengumuman/baru' as never)} />
        </View>
      ) : null}
    </Screen>
  );
}
