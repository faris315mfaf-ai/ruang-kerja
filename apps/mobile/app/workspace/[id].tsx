/**
 * Layar workspace (mockup 05 › 16–21): bar atas + tab Ringkasan (proyek) ·
 * Tugas (Board/List/Kalender) · Dokumen · File · Catatan · Aktivitas ·
 * Anggota, menu ⋯ (favorit, folder Drive, tautan, pengaturan, otomasi).
 * Tab yang pernah dibuka tetap terpasang (filter & posisi tidak hilang).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Share, View } from 'react-native';

import { ApiError, webBase } from '@/api/client';
import { ambilDetailWorkspace, setFavorit, type DetailWorkspace, type NamaTab } from '@/api/workspace';
import { AktivitasTab } from '@/features/workspace/AktivitasTab';
import { AnggotaTab } from '@/features/workspace/AnggotaTab';
import { GalatMuat, PitaOffline } from '@/features/workspace/bagian';
import { DokumenTab, FileTab } from '@/features/workspace/DokumenFileTab';
import { KepalaWorkspace } from '@/features/workspace/KepalaWorkspace';
import { CatatanTab, RingkasanTab } from '@/features/workspace/RingkasanCatatanTab';
import { TugasTab } from '@/features/workspace/TugasTab';
import { useResource, useSegarkanSaatFokus } from '@/features/workspace/useResource';
import { useSession } from '@/session/SessionProvider';
import { BottomSheet, EmptyState, Loading, PageGlow, SheetAction, TabNav, useSnackbar } from '@/ui';
import { useTheme } from '@/theme';

type TabTampil = Exclude<NamaTab, 'pengaturan'>;

const URUTAN: TabTampil[] = ['ringkasan', 'tugas', 'dokumen', 'file', 'catatan', 'aktivitas', 'anggota'];
const LABEL: Record<TabTampil, string> = { ringkasan: 'Ringkasan', tugas: 'Tugas', dokumen: 'Dokumen', file: 'File', catatan: 'Catatan', aktivitas: 'Aktivitas', anggota: 'Anggota' };

function bacaTab(nilai: string | string[] | undefined): TabTampil | null {
  const t = Array.isArray(nilai) ? nilai[0] : nilai;
  return t !== undefined && (URUTAN as string[]).includes(t) ? (t as TabTampil) : null;
}

export default function LayarWorkspace(): React.JSX.Element {
  const { colors } = useTheme();
  const { id, tab: tabParam } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { user } = useSession();
  const snackbar = useSnackbar();
  const ws = typeof id === 'string' ? id : '';
  const detail = useResource<DetailWorkspace>(ws !== '' ? `ws:${ws}` : null, () => ambilDetailWorkspace(ws));
  useSegarkanSaatFokus(detail.muat);
  const [tabPilih, setTabPilih] = useState<TabTampil | null>(bacaTab(tabParam));
  const [dikunjungi, setDikunjungi] = useState<Set<TabTampil>>(new Set());
  const [menu, setMenu] = useState(false);
  const data = detail.data;

  const tabs = useMemo<TabTampil[]>(() => (data ? URUTAN.filter((t) => data.tabs.includes(t)) : []), [data]);
  const aktif: TabTampil = tabPilih !== null && tabs.includes(tabPilih) ? tabPilih : tabs.includes('tugas') ? 'tugas' : (tabs[0] ?? 'tugas');

  function pilihTab(t: TabTampil): void {
    setTabPilih(t);
    setDikunjungi((s) => (s.has(t) ? s : new Set(s).add(t)));
  }

  async function ubahFavorit(): Promise<void> {
    if (!data) {
      return;
    }
    const baru = !data.favorit;
    setMenu(false);
    detail.ubah((lama) => ({ ...lama, favorit: baru }));
    try {
      await setFavorit(data.workspace.id, baru);
      snackbar.show({ message: baru ? 'Ditambahkan ke favorit.' : 'Dihapus dari favorit.', variant: 'ok' });
    } catch (err) {
      detail.ubah((lama) => ({ ...lama, favorit: !baru }));
      snackbar.show({ message: err instanceof ApiError ? err.message : 'Favorit gagal diubah.', variant: 'bad' });
    }
  }

  const subjudul = data
    ? `${data.workspace.key} · ${data.counts.open_tasks} tugas${data.workspace.arsip ? ' · diarsipkan' : ''} · ${data.counts.members} anggota`
    : undefined;

  if (detail.galat && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <PageGlow />
        <KepalaWorkspace nama="Workspace" />
        {detail.galat.status === 404 ? (
          <EmptyState icon="circle-help" title="Workspace tidak ditemukan" description="Workspace ini privat atau sudah dihapus. Minta Owner menambahkan Anda." actionLabel="Ke daftar workspace" onAction={() => router.replace('/workspace')} />
        ) : (
          <GalatMuat galat={detail.galat} judul="Workspace belum bisa dimuat" onCoba={() => void detail.muat()} />
        )}
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <PageGlow />
        <KepalaWorkspace nama="…" />
        <View style={{ padding: 16 }}>
          <Loading label="Memuat workspace…" rows={4} />
        </View>
      </View>
    );
  }

  const opsiTab = tabs.map((t) => ({
    value: t,
    label: LABEL[t],
    badge: t === 'dokumen' ? data.counts.documents : t === 'file' ? data.counts.files : t === 'anggota' ? data.counts.members : null,
  }));

  const tampilkan = (t: TabTampil): boolean => t === aktif || dikunjungi.has(t);
  const konten = (t: TabTampil): React.ReactNode => {
    switch (t) {
      case 'ringkasan':
        return <RingkasanTab detail={data} />;
      case 'tugas':
        return <TugasTab detail={data} meId={user?.id ?? null} />;
      case 'dokumen':
        return <DokumenTab detail={data} />;
      case 'file':
        return <FileTab detail={data} />;
      case 'catatan':
        return <CatatanTab detail={data} />;
      case 'aktivitas':
        return <AktivitasTab ws={data.workspace.id} />;
      case 'anggota':
        return <AnggotaTab detail={data} />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageGlow />
      <KepalaWorkspace nama={data.workspace.name} warna={data.workspace.color} tipe={data.workspace.type} subjudul={subjudul} onMenu={() => setMenu(true)} />
      {detail.offline ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <PitaOffline diperbarui={detail.diperbarui} objek="workspace" />
        </View>
      ) : null}
      <TabNav value={aktif} options={opsiTab} onChange={pilihTab} />
      <View style={{ flex: 1 }}>
        {tabs.filter(tampilkan).map((t) => (
          <View key={t} style={{ flex: 1, display: t === aktif ? 'flex' : 'none' }}>
            {konten(t)}
          </View>
        ))}
      </View>

      <BottomSheet visible={menu} onClose={() => setMenu(false)} title={data.workspace.name} scrollable>
        {data.can.favorite ? (
          <SheetAction icon="star" label={data.favorit ? 'Hapus dari favorit' : 'Favoritkan workspace'} onPress={() => void ubahFavorit()} />
        ) : null}
        <SheetAction
          icon="users"
          label={`Anggota (${data.counts.members})`}
          onPress={() => {
            setMenu(false);
            pilihTab('anggota');
          }}
        />
        {data.workspace.drive_folder_url ? (
          <SheetAction
            icon="folder-open"
            label="Buka folder Drive"
            onPress={() => {
              setMenu(false);
              void Linking.openURL(data.workspace.drive_folder_url ?? '').catch(() => snackbar.show({ message: 'Tautan tidak bisa dibuka.', variant: 'warn' }));
            }}
          />
        ) : null}
        <SheetAction
          icon="link"
          label="Bagikan tautan"
          onPress={() => {
            setMenu(false);
            void Share.share({ message: `${data.workspace.name} (${data.workspace.key})\n${webBase()}/w/${data.workspace.key}` }).catch(() => undefined);
          }}
        />
        <SheetAction
          icon="settings"
          label="Pengaturan · baca saja"
          onPress={() => {
            setMenu(false);
            router.push(`/workspace/${data.workspace.id}/pengaturan` as never);
          }}
        />
        {user?.features.automation ? (
          <SheetAction
            icon="workflow"
            label="Otomasi & berulang"
            onPress={() => {
              setMenu(false);
              router.push({ pathname: '/otomasi', params: { workspace: data.workspace.key } } as never);
            }}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}
