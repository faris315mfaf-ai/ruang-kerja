/**
 * Tab Dokumen & File (mockup 05 › 19-1…3). Dibaca dari cache `drive_files`
 * lewat API; Drive belum aktif → keadaan "Integrasi Drive belum aktif"
 * (503 `drive_belum_siap` juga ditangani). Folder + breadcrumb di File.
 */
import { useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ambilDokumen, ambilFile, type BerkasDrive, type DetailWorkspace, type DokumenData, type FileData } from '@/api/workspace';
import { useTheme } from '@/theme';
import { Button, Card, Chip, ChipScroller, EmptyState, Fab, Loading, Text, useSnackbar } from '@/ui';

import { PitaOffline, TabScroll, GalatMuat } from './bagian';
import { AksiBerkasSheet, BarisBerkas, bukaBerkas, DriveBelumAktif, TambahDriveSheet, teksAkses } from './drive';
import { useResource, useSegarkanSaatFokus } from './useResource';

type FilterDokumen = 'semua' | 'doc' | 'sheet' | 'slide';

const LABEL_FILTER: Record<string, string> = { doc: 'Docs', sheet: 'Sheets', slide: 'Slides', pdf: 'PDF' };

function galatDriveBelumSiap(kode: string | null): boolean {
  return kode === 'drive_belum_siap';
}

export function DokumenTab({ detail }: { detail: DetailWorkspace }): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const snackbar = useSnackbar();
  const ws = detail.workspace.id;
  const dok = useResource<DokumenData>(`dokumen:${ws}`, () => ambilDokumen(ws));
  useSegarkanSaatFokus(dok.muat);
  const [filter, setFilter] = useState<FilterDokumen>('semua');
  const [aksi, setAksi] = useState<BerkasDrive | null>(null);
  const [tambah, setTambah] = useState(false);
  const data = dok.data;
  const daftar = useMemo(() => (data?.documents ?? []).filter((d) => filter === 'semua' || d.kind === filter), [data, filter]);
  const jumlah = (k: FilterDokumen): number => (data?.documents ?? []).filter((d) => k === 'semua' || d.kind === k).length;
  const bisaTambah = !detail.read_only.read_only;

  if (dok.memuat && !data) {
    return (
      <TabScroll>
        <Loading label="Memuat dokumen…" rows={4} />
      </TabScroll>
    );
  }
  if (dok.galat && !data) {
    return galatDriveBelumSiap(dok.galat.code) ? (
      <TabScroll>
        <DriveBelumAktif />
      </TabScroll>
    ) : (
      <GalatMuat galat={dok.galat} judul="Dokumen belum bisa dimuat" onCoba={() => void dok.muat()} />
    );
  }
  if (!data) {
    return <View />;
  }

  return (
    <View style={{ flex: 1 }}>
      <TabScroll onRefresh={dok.muat} ruangFab={bisaTambah}>
        {dok.offline ? <PitaOffline diperbarui={dok.diperbarui} objek="daftar" /> : null}
        {!data.drive.enabled ? <DriveBelumAktif ringkas /> : null}
        <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
          <Chip label="Semua" count={jumlah('semua')} selected={filter === 'semua'} onPress={() => setFilter('semua')} />
          <Chip label="Docs" count={jumlah('doc')} selected={filter === 'doc'} onPress={() => setFilter('doc')} />
          <Chip label="Sheets" count={jumlah('sheet')} selected={filter === 'sheet'} onPress={() => setFilter('sheet')} />
          <Chip label="Slides" count={jumlah('slide')} selected={filter === 'slide'} onPress={() => setFilter('slide')} />
        </ChipScroller>
        {daftar.length === 0 ? (
          <EmptyState
            icon="file-text"
            title={data.documents.length === 0 ? 'Belum ada dokumen' : 'Tidak ada dokumen jenis ini'}
            description={data.drive.enabled ? 'Buat Google Docs, Sheets, atau Slides di folder workspace ini.' : 'Dokumen akan muncul di sini setelah integrasi Drive diaktifkan.'}
          />
        ) : (
          <>
            <Card variant="flat">
              {daftar.map((d, i) => (
                <View key={d.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : undefined}>
                  <BarisBerkas berkas={d} onPress={() => void bukaBerkas(d, (m) => snackbar.show({ message: m, variant: 'warn' }))} onMenu={() => setAksi(d)} />
                </View>
              ))}
            </Card>
            <Text variant="meta" align="center">
              Dokumen dibuka di aplikasi Google (Docs/Sheets/Slides) atau browser.
            </Text>
          </>
        )}
      </TabScroll>
      {bisaTambah ? (
        <View style={[s.fab, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <Fab icon="plus" label="Dokumen baru" extended onPress={() => setTambah(true)} />
        </View>
      ) : null}
      <AksiBerkasSheet berkas={aksi} onClose={() => setAksi(null)} />
      <TambahDriveSheet visible={tambah} onClose={() => setTambah(false)} ws={ws} kunci={detail.workspace.key} drive={data.drive} onDibuat={() => { setTambah(false); void dok.muat(); }} />
    </View>
  );
}

export function FileTab({ detail }: { detail: DetailWorkspace }): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const snackbar = useSnackbar();
  const ws = detail.workspace.id;
  const [folder, setFolder] = useState<string | null>(null);
  const files = useResource<FileData>(`file:${ws}:${folder ?? ''}`, () => ambilFile(ws, folder));
  useSegarkanSaatFokus(files.muat);
  const [filter, setFilter] = useState<string>('semua');
  const [aksi, setAksi] = useState<BerkasDrive | null>(null);
  const [tambah, setTambah] = useState(false);
  const data = files.data;
  const bisaTambah = !detail.read_only.read_only;

  const daftar = useMemo(() => (data?.files ?? []).filter((f) => f.kind === 'folder' || filter === 'semua' || f.kind === filter), [data, filter]);
  const adaKind = (k: string): number => (data?.files ?? []).filter((f) => f.kind === k).length;

  if (files.memuat && !data) {
    return (
      <TabScroll>
        <Loading label="Memuat file…" rows={4} />
      </TabScroll>
    );
  }
  if (files.galat && !data) {
    return galatDriveBelumSiap(files.galat.code) ? (
      <TabScroll>
        <DriveBelumAktif />
      </TabScroll>
    ) : (
      <GalatMuat galat={files.galat} judul="File belum bisa dimuat" onCoba={() => void files.muat()} />
    );
  }
  if (!data) {
    return <View />;
  }
  const drive = data.drive;

  return (
    <View style={{ flex: 1 }}>
      <TabScroll onRefresh={files.muat} ruangFab={bisaTambah}>
        {files.offline ? <PitaOffline diperbarui={files.diperbarui} objek="daftar" /> : null}
        {!drive.enabled ? <DriveBelumAktif ringkas /> : null}
        <Card variant="tight">
          <Text variant="title" weight={700}>
            {`${drive.shared_drive_name ?? 'Shared Drive'} › ${drive.folder_name ?? detail.workspace.name}`}
          </Text>
          <Text variant="meta">{teksAkses(drive.access)}</Text>
          {drive.folder_url ? <Button title="Buka folder Drive" icon="external-link" variant="outline" size="sm" onPress={() => void Linking.openURL(drive.folder_url ?? '').catch(() => snackbar.show({ message: 'Tautan tidak bisa dibuka.', variant: 'warn' }))} /> : null}
        </Card>

        {data.folder ? (
          <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
            {data.breadcrumbs.map((b, i) => (
              <Chip key={`${b.id ?? 'akar'}-${i}`} label={b.id === null ? 'Semua file' : b.name} icon={i === 0 ? 'folder-open' : undefined} selected={i === data.breadcrumbs.length - 1} onPress={() => setFolder(b.id)} />
            ))}
          </ChipScroller>
        ) : null}

        <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
          <Chip label="Semua" selected={filter === 'semua'} onPress={() => setFilter('semua')} />
          {(['doc', 'sheet', 'slide', 'pdf'] as const).filter((k) => adaKind(k) > 0).map((k) => (
            <Chip key={k} label={LABEL_FILTER[k] ?? k} count={adaKind(k)} selected={filter === k} onPress={() => setFilter(k)} />
          ))}
        </ChipScroller>

        {daftar.length === 0 ? (
          <EmptyState icon="folder-open" title="Belum ada file" description={drive.enabled ? 'Folder ini kosong.' : 'File akan muncul di sini setelah integrasi Drive diaktifkan.'} />
        ) : (
          <Card variant="flat">
            {daftar.map((f, i) => (
              <View key={f.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : undefined}>
                <BarisBerkas
                  berkas={f}
                  onPress={() => (f.kind === 'folder' ? setFolder(f.google_file_id) : void bukaBerkas(f, (m) => snackbar.show({ message: m, variant: 'warn' })))}
                  onMenu={() => setAksi(f)}
                />
              </View>
            ))}
          </Card>
        )}
        <Text variant="meta" align="center">
          {`${data.counts.files} file di workspace ini`}
        </Text>
      </TabScroll>
      {bisaTambah ? (
        <View style={[s.fab, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
          <Fab icon="plus" label="Tambah" extended onPress={() => setTambah(true)} />
        </View>
      ) : null}
      <AksiBerkasSheet berkas={aksi} onClose={() => setAksi(null)} />
      <TambahDriveSheet visible={tambah} onClose={() => setTambah(false)} ws={ws} kunci={detail.workspace.key} drive={drive} folder={folder} onDibuat={() => { setTambah(false); void files.muat(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  fab: { position: 'absolute', right: 16 },
});
