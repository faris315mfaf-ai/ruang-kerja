/**
 * Daftar catatan (modul 07): pohon per workspace — folder, catatan,
 * sub-halaman, gembok "Hanya diundang", peran — dengan pencarian, chip
 * workspace berhitung, buat catatan/folder, dan aksi baris. Dibuka dari tab
 * Catatan di detail workspace lewat `/catatan?workspace=<id>`.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PohonNode } from '@/api/catatan';
import { HasilCari } from '@/features/catatan/HasilCari';
import { BuatSheet } from '@/features/catatan/BuatSheet';
import { PanelPohon } from '@/features/catatan/NoteTree';
import { NotulensiSheet } from '@/features/catatan/NotulensiSheet';
import { useAksiBaris } from '@/features/catatan/AksiBaris';
import { hitungCatatan } from '@/features/catatan/pohon';
import { useDaftarCatatan } from '@/features/catatan/useDaftarCatatan';
import { Chip, ChipScroller, EmptyState, ErrorState, Fab, Loading, OfflineBanner, Screen, SearchInput, SubAppBar, useSnackbar } from '@/ui';

export default function LayarDaftarCatatan(): React.JSX.Element {
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
  const wsParam = typeof workspace === 'string' && workspace !== '' ? workspace : null;
  const insets = useSafeAreaInsets();
  const snackbar = useSnackbar();
  const d = useDaftarCatatan(wsParam);

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [tertutup, setTertutup] = useState<ReadonlySet<string>>(new Set());
  const [buatTerbuka, setBuatTerbuka] = useState(false);
  const [awal, setAwal] = useState<{ ruangId: string | null; parentId: string | null; kind: 'note' | 'folder' }>({ ruangId: null, parentId: null, kind: 'note' });
  const [notulensiTerbuka, setNotulensiTerbuka] = useState(false);

  const aksi = useAksiBaris({
    onBerubah: (id) => void d.muatUlangRuang(id),
    onBuatDi: (ruang, parentId, kind) => {
      setAwal({ ruangId: ruang.id, parentId, kind });
      setBuatTerbuka(true);
    },
  });

  const bolehBuat = d.panel.filter((p) => p.canCreate);
  const terlihat = filter === null ? d.panel : d.panel.filter((p) => p.id === filter);
  const kosongTotal = d.panel.every((p) => p.tree.length === 0);
  const mencari = q.trim().length > 0;
  const totalPerRuang = useMemo(() => d.panel.map((p) => ({ id: p.id, label: p.personal ? 'Pribadi' : p.key, jumlah: hitungCatatan(p.tree) })), [d.panel]);

  function toggle(id: string): void {
    setTertutup((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) {
        baru.delete(id);
      } else {
        baru.add(id);
      }
      return baru;
    });
  }

  function bukaBuat(): void {
    const ruangId = filter ?? wsParam ?? bolehBuat.find((p) => p.personal)?.id ?? bolehBuat[0]?.id ?? null;
    setAwal({ ruangId, parentId: null, kind: 'note' });
    setBuatTerbuka(true);
  }

  function bukaNode(node: PohonNode): void {
    router.push(`/catatan/${node.id}`);
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={<SubAppBar title="Catatan" actions={[{ icon: 'notebook-pen', label: 'Notulensi', onPress: () => setNotulensiTerbuka(true) }]} />}
        refreshing={d.memuatUlang && d.status === 'siap'}
        onRefresh={() => void d.muat()}
        contentStyle={{ paddingBottom: insets.bottom + 120, paddingTop: 12 }}
      >
        {d.status === 'memuat' ? (
          <Loading label="Memuat catatan…" rows={5} />
        ) : d.status === 'mati' ? (
          <EmptyState icon="lock" title="Catatan belum diaktifkan" description="Fitur Catatan bersama belum aktif untuk perusahaan Anda. Hubungi admin bila ini keliru." />
        ) : d.status === 'offline' ? (
          <ErrorState kind="offline" message="Catatan butuh koneksi internet. Sambungkan Wi-Fi atau data seluler, lalu coba lagi." onRetry={() => void d.muat()} />
        ) : d.status === 'galat' ? (
          <ErrorState title="Tidak dapat memuat catatan" message={d.pesan ?? 'Server tidak merespons. Periksa koneksi lalu coba lagi.'} onRetry={() => void d.muat()} />
        ) : (
          <>
            {d.pesan !== null ? <OfflineBanner /> : null}
            <SearchInput value={q} onChangeText={setQ} placeholder="Cari judul atau isi catatan" />
            {mencari ? (
              <HasilCari q={q} workspaceId={wsParam} onHapus={() => setQ('')} />
            ) : kosongTotal ? (
              <EmptyState
                icon="notebook-text"
                title="Belum ada catatan"
                description="Tulis SOP, wiki tim, atau notulen ringan yang bisa diedit bersama. Mulai dari workspace Pribadi untuk catatan Anda sendiri."
                actionLabel={bolehBuat.length > 0 ? 'Catatan baru' : undefined}
                onAction={bolehBuat.length > 0 ? bukaBuat : undefined}
              />
            ) : (
              <>
                {wsParam === null && d.panel.length > 1 ? (
                  <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
                    <Chip label="Semua" selected={filter === null} onPress={() => setFilter(null)} />
                    {totalPerRuang.map((r) => (
                      <Chip key={r.id} label={r.label} count={r.jumlah} selected={filter === r.id} onPress={() => setFilter(r.id)} />
                    ))}
                  </ChipScroller>
                ) : null}
                {terlihat.map((p) => (
                  <PanelPohon key={p.id} ruang={p} tree={p.tree} tertutup={tertutup} onToggle={toggle} onBuka={bukaNode} onMenu={(node) => aksi.buka(node, p, p.tree, p.canCreate)} />
                ))}
                {d.terpotong ? (
                  <View style={s.kaki}>
                    <EmptyState variant="plain" icon="folder-tree" title="Workspace lainnya" description="Hanya sebagian workspace ditampilkan di sini. Buka tab Catatan di workspace untuk melihat yang lain." />
                  </View>
                ) : null}
              </>
            )}
          </>
        )}
      </Screen>

      {d.status === 'siap' && !mencari && bolehBuat.length > 0 ? (
        <Fab label="Catatan baru" onPress={bukaBuat} style={{ position: 'absolute', right: 16, bottom: insets.bottom + 16 }} />
      ) : null}

      <BuatSheet
        visible={buatTerbuka}
        onClose={() => setBuatTerbuka(false)}
        ruang={bolehBuat}
        awal={awal}
        onDibuat={(note, ruangId, kind) => {
          setBuatTerbuka(false);
          void d.muatUlangRuang(ruangId);
          if (kind === 'folder') {
            snackbar.show({ message: `Folder “${note.title}” dibuat.`, variant: 'ok' });
          } else {
            router.push(`/catatan/${note.id}`);
          }
        }}
      />
      <NotulensiSheet visible={notulensiTerbuka} onClose={() => setNotulensiTerbuka(false)} />
      {aksi.elemen}
    </View>
  );
}

const s = StyleSheet.create({
  kaki: { marginTop: 4 },
});
