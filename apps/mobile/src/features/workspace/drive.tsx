/**
 * Bagian bersama tab Dokumen & File (Drive): ikon per jenis berkas, baris
 * berkas, status akses, state "Integrasi Drive belum aktif", sheet aksi
 * berkas dan sheet "Tambah" (opsi tampil tetapi nonaktif dengan penjelasan).
 * Google tidak dipanggil dari aplikasi; semua lewat API (cache `drive_files`).
 */
import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { buatDokumenDrive, type BerkasDrive, type InfoDrive, type StatusAksesDrive } from '@/api/workspace';
import { waktuRelatif } from '@/lib/format';
import { useTheme } from '@/theme';
import { Banner, BottomSheet, Dialog, EmptyState, Field, Icon, IconTile, Input, Pressable, SheetAction, Text, useSnackbar, type AnyIconName, type IconTileTone } from '@/ui';

import { ukuranBerkas } from './util';

export function ikonBerkas(kind: BerkasDrive['kind']): { icon: AnyIconName; tone: IconTileTone } {
  switch (kind) {
    case 'doc':
      return { icon: 'file-text', tone: 'blue' };
    case 'sheet':
      return { icon: 'file-spreadsheet', tone: 'ok' };
    case 'slide':
      return { icon: 'presentation', tone: 'warn' };
    case 'pdf':
      return { icon: 'file-text', tone: 'bad' };
    case 'image':
      return { icon: 'image', tone: 'teal' };
    case 'folder':
      return { icon: 'folder', tone: 'neutral' };
    default:
      return { icon: 'file', tone: 'neutral' };
  }
}

export function teksAkses(a: StatusAksesDrive): string {
  switch (a.state) {
    case 'synced':
      return `Akses tersinkron · ${a.synced} anggota`;
    case 'pending':
      return `Menunggu sinkron · ${a.pending} anggota`;
    case 'error':
      return `Gagal sinkron · ${a.errors} anggota`;
    case 'preparing':
      return 'Menyiapkan folder Drive…';
    case 'unused':
      return 'Folder Drive belum dipakai';
    default:
      return 'Drive belum aktif';
  }
}

export function DriveBelumAktif({ ringkas = false }: { ringkas?: boolean }): React.JSX.Element {
  const pesan = 'Admin RuangKerja belum menghubungkan Google Drive. Dokumen dan file akan muncul di sini setelah integrasi diaktifkan.';
  return ringkas ? (
    <Banner tone="info" icon="cloud-off" title="Integrasi Drive belum aktif" message={pesan} />
  ) : (
    <EmptyState icon="cloud-off" title="Integrasi Drive belum aktif" description={pesan} />
  );
}

export function BarisBerkas({ berkas, onPress, onMenu }: { berkas: BerkasDrive; onPress: () => void; onMenu?: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const { icon, tone } = ikonBerkas(berkas.kind);
  const folder = berkas.kind === 'folder';
  const pemilik = berkas.owner_name ?? berkas.owner_email?.split('@')[0] ?? null;
  const sub = [
    berkas.kind_label,
    !folder && berkas.size_bytes !== null ? ukuranBerkas(berkas.size_bytes) : null,
    berkas.modified_at ? `diubah ${waktuRelatif(berkas.modified_at)}` : null,
    pemilik,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={s.baris}>
      <Pressable onPress={onPress} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${folder ? 'Buka folder' : 'Buka'} ${berkas.name}. ${sub}`} style={s.isi}>
        <IconTile icon={icon} tone={tone} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={2}>
            {berkas.name}
          </Text>
          <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
            {sub}
          </Text>
        </View>
        {folder ? (
          <>
            {berkas.children_count !== undefined ? (
              <Text variant="meta" weight={600}>
                {`${berkas.children_count} file`}
              </Text>
            ) : null}
            <Icon name="chevron-right" size={20} color={colors.muted} />
          </>
        ) : null}
      </Pressable>
      {!folder && onMenu ? (
        <Pressable onPress={onMenu} scaleTo={0.92} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Aksi untuk ${berkas.name}`} style={s.menu}>
          <Icon name="ellipsis-vertical" size={20} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export async function bukaBerkas(berkas: BerkasDrive, tampilkan: (pesan: string) => void): Promise<void> {
  if (!berkas.web_view_link) {
    tampilkan('Berkas ini tidak punya tautan untuk dibuka.');
    return;
  }
  try {
    await Linking.openURL(berkas.web_view_link);
  } catch {
    tampilkan('Tautan tidak bisa dibuka di perangkat ini.');
  }
}

export function AksiBerkasSheet({ berkas, onClose }: { berkas: BerkasDrive | null; onClose: () => void }): React.JSX.Element {
  const snackbar = useSnackbar();
  return (
    <BottomSheet visible={berkas !== null} onClose={onClose} title={berkas?.name ?? 'Berkas'} scrollable>
      {berkas ? (
        <>
          <SheetAction
            icon="external-link"
            label="Buka di Google"
            description="Dibuka di aplikasi Google atau browser"
            onPress={() => {
              onClose();
              void bukaBerkas(berkas, (pesan) => snackbar.show({ message: pesan, variant: 'warn' }));
            }}
          />
          {berkas.web_view_link ? (
            <SheetAction
              icon="share-2"
              label="Bagikan tautan"
              onPress={() => {
                onClose();
                void Share.share({ message: `${berkas.name}\n${berkas.web_view_link ?? ''}` }).catch(() => undefined);
              }}
            />
          ) : null}
          {berkas.used_in && berkas.used_in.length > 0 ? (
            <View style={{ gap: 4 }}>
              <Text variant="overline" tone="muted">
                DIPAKAI DI TUGAS
              </Text>
              {berkas.used_in.map((u) => (
                <Text key={u.key} variant="body" style={{ fontSize: 15 }}>
                  {`${u.key} · ${u.title}`}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  );
}

type JenisBaru = 'document' | 'spreadsheet' | 'presentation';

const OPSI_BARU: { jenis: JenisBaru; judul: string; deskripsi: string; icon: AnyIconName; tone: IconTileTone }[] = [
  { jenis: 'document', judul: 'Google Docs baru', deskripsi: 'Brief, notulen, dokumen teks', icon: 'file-text', tone: 'blue' },
  { jenis: 'spreadsheet', judul: 'Google Sheets baru', deskripsi: 'Tabel, anggaran, rekap', icon: 'file-spreadsheet', tone: 'ok' },
  { jenis: 'presentation', judul: 'Google Slides baru', deskripsi: 'Presentasi dan deck', icon: 'presentation', tone: 'warn' },
];

const OPSI_TERTUNDA: { judul: string; deskripsi: string; icon: AnyIconName }[] = [
  { judul: 'Unggah dari ponsel', deskripsi: 'Foto, PDF, atau dokumen lain', icon: 'upload' },
  { judul: 'Ambil foto dokumen', deskripsi: 'Nota, kuitansi, tanda terima', icon: 'camera' },
  { judul: 'Pilih dari Drive', deskripsi: 'Tautkan file yang sudah ada', icon: 'folder-open' },
];

function OpsiTambah({ judul, deskripsi, icon, tone, aktif, alasan, onPress }: { judul: string; deskripsi: string; icon: AnyIconName; tone?: IconTileTone; aktif: boolean; alasan?: string; onPress?: () => void }): React.JSX.Element {
  return (
    <Pressable
      onPress={aktif ? onPress : undefined}
      disabled={!aktif}
      scaleTo={aktif ? 0.98 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${judul}. ${aktif ? deskripsi : (alasan ?? 'Belum tersedia')}`}
      accessibilityState={{ disabled: !aktif }}
      style={[s.opsi, { opacity: aktif ? 1 : 0.5 }]}
    >
      <IconTile icon={icon} tone={tone} />
      <View style={{ flex: 1 }}>
        <Text variant="title">{judul}</Text>
        <Text variant="meta">{aktif ? deskripsi : (alasan ?? deskripsi)}</Text>
      </View>
    </Pressable>
  );
}

/** Sheet "Tambah ke KEY": buat Docs/Sheets/Slides (Drive aktif); sisanya nonaktif + alasan. */
export function TambahDriveSheet({
  visible,
  onClose,
  ws,
  kunci,
  drive,
  folder,
  onDibuat,
}: {
  visible: boolean;
  onClose: () => void;
  ws: string;
  kunci: string;
  drive: InfoDrive | null;
  folder?: string | null;
  onDibuat: () => void;
}): React.JSX.Element {
  const snackbar = useSnackbar();
  const [jenis, setJenis] = useState<JenisBaru | null>(null);
  const [nama, setNama] = useState('');
  const [membuat, setMembuat] = useState(false);
  const aktifDrive = drive?.enabled === true && drive.can_contribute;
  const alasanMati = drive?.enabled !== true ? 'Integrasi Drive belum aktif.' : !drive.can_contribute ? 'Anda tidak boleh menambah file di workspace ini.' : undefined;
  const label = OPSI_BARU.find((o) => o.jenis === jenis)?.judul ?? '';

  async function buat(): Promise<void> {
    if (jenis === null || membuat) {
      return;
    }
    setMembuat(true);
    try {
      const hasil = await buatDokumenDrive(ws, { type: jenis, name: nama.trim() || undefined, folder: folder ?? undefined });
      setJenis(null);
      setNama('');
      snackbar.show({ message: hasil.message, variant: 'ok', actionLabel: hasil.file.web_view_link ? 'Buka' : undefined, onAction: () => void Linking.openURL(hasil.file.web_view_link ?? '').catch(() => undefined) });
      onDibuat();
    } catch (err) {
      setJenis(null);
      snackbar.show({
        message: err instanceof ApiError ? (err.code === 'drive_belum_siap' ? 'Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja.' : err.message) : 'Dokumen gagal dibuat.',
        variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad',
      });
    } finally {
      setMembuat(false);
    }
  }

  return (
    <>
      <BottomSheet visible={visible && jenis === null} onClose={onClose} title={`Tambah ke ${kunci}`} scrollable>
        {drive?.folder_name || drive?.shared_drive_name ? (
          <Text variant="meta">{`Disimpan di ${drive.shared_drive_name ?? 'Shared Drive'} › ${drive.folder_name ?? kunci}`}</Text>
        ) : null}
        {OPSI_BARU.map((o) => (
          <OpsiTambah key={o.jenis} judul={o.judul} deskripsi={o.deskripsi} icon={o.icon} tone={o.tone} aktif={aktifDrive} alasan={alasanMati} onPress={() => setJenis(o.jenis)} />
        ))}
        {OPSI_TERTUNDA.map((o) => (
          <OpsiTambah key={o.judul} judul={o.judul} deskripsi={o.deskripsi} icon={o.icon} aktif={false} alasan={drive?.enabled !== true ? 'Integrasi Drive belum aktif.' : 'Segera hadir di aplikasi ponsel. Unggah dari RuangKerja desktop.'} />
        ))}
      </BottomSheet>
      <Dialog
        visible={visible && jenis !== null}
        title={label}
        onClose={() => (membuat ? undefined : setJenis(null))}
        actions={[
          { label: 'Batal', onPress: () => setJenis(null), disabled: membuat },
          { label: 'Buat', onPress: () => void buat(), variant: 'primary', loading: membuat },
        ]}
      >
        <Field label="Nama" hint="Kosongkan untuk nama bawaan.">
          <Input value={nama} onChangeText={setNama} placeholder="Tanpa judul" maxLength={150} autoFocus accessibilityLabel="Nama dokumen" onSubmitEditing={() => void buat()} />
        </Field>
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingLeft: 16 },
  isi: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  menu: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  opsi: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 6 },
});
