/**
 * Daftar workspace (mockup 05 › 15): kelompok Pribadi · Divisi & tim · Proyek
 * yang diikuti · Lainnya (lihat saja) dari GET /workspace, chip filter,
 * favorit (bintang), lencana terlambat, "Workspace baru" (FAB).
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ambilDaftarWorkspace, setFavorit, type DaftarWorkspace, type JenisKelompok, type WorkspaceItem } from '@/api/workspace';
import { BarisWorkspace } from '@/features/workspace/BarisWorkspace';
import { GalatMuat, PitaOffline, TabScroll } from '@/features/workspace/bagian';
import { useResource } from '@/features/workspace/useResource';
import { useTheme } from '@/theme';
import { Card, Chip, ChipScroller, EmptyState, Fab, Loading, Screen, SubAppBar, Text, useSnackbar } from '@/ui';

type Saring = 'semua' | JenisKelompok;

const TITIK: Record<JenisKelompok, 'slate' | 'teal' | 'blue' | 'gray'> = { pribadi: 'slate', divisi: 'teal', proyek: 'blue', lainnya: 'gray' };
const KOSONG: Record<JenisKelompok, { judul: string; deskripsi: string }> = {
  pribadi: { judul: 'Belum ada workspace pribadi', deskripsi: 'Workspace pribadi dibuat otomatis untuk setiap karyawan.' },
  divisi: { judul: 'Belum ada workspace divisi atau tim', deskripsi: 'Anda belum menjadi anggota divisi atau tim mana pun.' },
  proyek: { judul: 'Belum ada proyek', deskripsi: 'Anda belum menjadi anggota proyek mana pun.' },
  lainnya: { judul: 'Tidak ada workspace lain', deskripsi: 'Workspace yang bisa Anda lihat tanpa menjadi anggota muncul di sini.' },
};

export default function LayarDaftarWorkspace(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const snackbar = useSnackbar();
  const daftar = useResource<DaftarWorkspace>('workspace:daftar', ambilDaftarWorkspace);
  const [saring, setSaring] = useState<Saring>('semua');

  const data = daftar.data;
  const kelompok = useMemo(() => (data?.groups ?? []).filter((g) => g.items.length > 0 || g.jenis !== 'lainnya'), [data]);
  const jumlah = (j: JenisKelompok): number => data?.groups.find((g) => g.jenis === j)?.items.length ?? 0;
  const total = (data?.groups ?? []).reduce((n, g) => n + g.items.length, 0);
  const punyaLainnya = jumlah('lainnya') > 0;
  const boleh = data !== null && (data.can_create.team || data.can_create.project);

  const warnaTitik = (j: JenisKelompok): string => {
    const peta = { slate: colors.muted, teal: colors.fill.teal, blue: colors.accentBlue, gray: colors.subtle };
    return peta[TITIK[j]];
  };

  async function ubahFavorit(item: WorkspaceItem): Promise<void> {
    const baru = !item.favorit;
    daftar.ubah((lama) => ({ ...lama, groups: lama.groups.map((g) => ({ ...g, items: g.items.map((w) => (w.id === item.id ? { ...w, favorit: baru } : w)) })) }));
    try {
      await setFavorit(item.id, baru);
      void daftar.muat();
    } catch (err) {
      daftar.ubah((lama) => ({ ...lama, groups: lama.groups.map((g) => ({ ...g, items: g.items.map((w) => (w.id === item.id ? { ...w, favorit: !baru } : w)) })) }));
      snackbar.show({ message: err instanceof Error ? err.message : 'Favorit gagal diubah.', variant: 'bad' });
    }
  }

  const tampil = saring === 'semua' ? kelompok : kelompok.filter((g) => g.jenis === saring);

  return (
    <View style={{ flex: 1 }}>
      <Screen scroll={false} header={<SubAppBar title="Workspace" />} contentStyle={{ paddingHorizontal: 0 }}>
        {daftar.memuat && !data ? (
          <View style={{ paddingHorizontal: 16 }}>
            <Loading label="Memuat workspace…" rows={5} />
          </View>
        ) : daftar.galat && !data ? (
          <GalatMuat galat={daftar.galat} judul="Workspace belum bisa dimuat" onCoba={() => void daftar.muat()} />
        ) : data ? (
          <TabScroll onRefresh={daftar.muat} ruangFab={boleh}>
            <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
              {punyaLainnya ? 'Workspace di “Lainnya” hanya bisa dilihat, tidak diubah.' : 'Semua workspace yang terlihat untuk Anda.'}
            </Text>
            {daftar.offline ? <PitaOffline diperbarui={daftar.diperbarui} objek="daftar" /> : null}
            <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
              <Chip label="Semua" count={total} selected={saring === 'semua'} onPress={() => setSaring('semua')} />
              <Chip label="Pribadi" count={jumlah('pribadi')} selected={saring === 'pribadi'} onPress={() => setSaring('pribadi')} />
              <Chip label="Divisi & tim" count={jumlah('divisi')} selected={saring === 'divisi'} onPress={() => setSaring('divisi')} />
              <Chip label="Proyek" count={jumlah('proyek')} selected={saring === 'proyek'} onPress={() => setSaring('proyek')} />
              {punyaLainnya ? <Chip label="Lainnya" count={jumlah('lainnya')} selected={saring === 'lainnya'} onPress={() => setSaring('lainnya')} /> : null}
            </ChipScroller>

            {tampil.map((g) => (
              <View key={g.jenis} style={{ gap: 8 }}>
                <View style={s.kepala}>
                  <View style={[s.titik, { backgroundColor: warnaTitik(g.jenis) }]} />
                  <Text variant="overline" tone="muted" accessibilityRole="header">
                    {g.label.toUpperCase()}
                  </Text>
                </View>
                {g.items.length === 0 ? (
                  <EmptyState icon="layout-grid" title={KOSONG[g.jenis].judul} description={KOSONG[g.jenis].deskripsi} />
                ) : (
                  <Card variant="flat">
                    {g.items.map((w, i) => (
                      <BarisWorkspace
                        key={w.id}
                        item={w}
                        divider={i > 0}
                        onPress={() => router.push(`/workspace/${w.id}`)}
                        onFavorit={w.is_member ? () => void ubahFavorit(w) : undefined}
                      />
                    ))}
                  </Card>
                )}
              </View>
            ))}

            {!boleh ? (
              <Text variant="meta" align="center">
                Workspace tim dan proyek baru dibuat oleh yang berwenang.
              </Text>
            ) : null}
          </TabScroll>
        ) : null}
      </Screen>
      {boleh ? (
        <View style={[s.fab, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <Fab icon="plus" label="Workspace baru" onPress={() => router.push('/workspace/baru')} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  titik: { width: 10, height: 10, borderRadius: 5 },
  fab: { position: 'absolute', right: 16 },
});
