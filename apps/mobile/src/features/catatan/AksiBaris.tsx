/**
 * Aksi baris pohon (mockup 06/24): menu aksi, ganti nama, pindahkan, hapus
 * (Dialog konfirmasi; isi naik satu tingkat), bagikan sebagai teks. Semua
 * ubah/hapus digerbang `can_edit` simpul; server tetap penentu (403).
 */
import { useCallback, useState } from 'react';
import { Share, View } from 'react-native';

import { ApiError } from '@/api/client';
import { detailCatatan, hapusCatatan, pindahCatatan, ubahJudul, type PohonNode } from '@/api/catatan';
import { adalahOnline } from '@/offline';
import { eIdSementara } from '@/offline/fitur/tugasBersama';
import { BottomSheet, Button, Field, Input, SheetAction, Text, useDialog, useSnackbar } from '@/ui';

import { PemilihTujuan } from './PemilihTujuan';
import { daftarTujuan, jumlahTurunan } from './pohon';
import type { RuangPanel } from './NoteTree';

type Layar =
  | { jenis: 'menu'; node: PohonNode; ruang: RuangPanel; tree: PohonNode[]; bisaBuat: boolean }
  | { jenis: 'ganti'; node: PohonNode; ruang: RuangPanel; tree: PohonNode[] }
  | { jenis: 'pindah'; node: PohonNode; ruang: RuangPanel; tree: PohonNode[] };

export function pesanGalat(err: unknown, cadangan: string): string {
  if (err instanceof ApiError) {
    return err.firstValidationError ?? err.message;
  }
  return cadangan;
}

export function useAksiBaris({
  onBerubah,
  onBuatDi,
}: {
  /** Pohon workspace berubah → muat ulang. */
  onBerubah: (workspaceId: string) => void;
  /** "Catatan baru di sini" / "Folder baru di sini". */
  onBuatDi: (ruang: RuangPanel, parentId: string, kind: 'note' | 'folder') => void;
}): { buka: (node: PohonNode, ruang: RuangPanel, tree: PohonNode[], bisaBuat: boolean) => void; elemen: React.JSX.Element } {
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [layar, setLayar] = useState<Layar | null>(null);
  const [judul, setJudul] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [tujuan, setTujuan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const tutup = useCallback((): void => setLayar(null), []);

  const buka = useCallback(
    (node: PohonNode, ruang: RuangPanel, tree: PohonNode[], bisaBuat: boolean): void => {
      if (eIdSementara(node.id)) {
        snackbar.show({ message: 'Catatan baru ini belum terkirim ke server. Menu aksi tersedia setelah terkirim.', variant: 'info' });
        return;
      }
      setLayar({ jenis: 'menu', node, ruang, tree, bisaBuat });
    },
    [snackbar],
  );

  /** Aksi lewat server: saat offline tampilkan "Butuh koneksi" alih-alih permintaan yang gagal. */
  function perluOnline(aksi: string): boolean {
    if (adalahOnline()) {
      return true;
    }
    snackbar.show({ message: `Butuh koneksi — ${aksi} tidak bisa dilakukan saat offline.`, variant: 'offline' });
    return false;
  }

  async function bagikanTeks(node: PohonNode): Promise<void> {
    try {
      const d = await detailCatatan(node.id);
      const isi = d.body_text ?? '';
      await Share.share({ message: isi.trim() === '' ? d.title : `${d.title}\n\n${isi}` });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Catatan gagal dibagikan.'), variant: 'bad' });
    }
  }

  async function hapus(l: Layar): Promise<void> {
    const { node, ruang } = l;
    const folder = node.kind === 'folder';
    const anak = jumlahTurunan(node);
    const pesan = folder
      ? `“${node.title}” dihapus; ${node.children.length} catatan di dalamnya dipindah ke tingkat di atasnya.`
      : anak > 0
        ? `“${node.title}” dan riwayat versinya tidak akan tampil lagi. ${node.children.length} sub-halaman naik satu tingkat.`
        : `“${node.title}” dan riwayat versinya tidak akan tampil lagi.`;
    setLayar(null);
    if (!perluOnline(folder ? 'menghapus folder' : 'menghapus catatan')) {
      return;
    }
    const ya = await dialog.confirm({ title: folder ? 'Hapus folder?' : 'Hapus catatan?', message: pesan, confirmLabel: 'Hapus', destructive: true });
    if (!ya) {
      return;
    }
    try {
      await hapusCatatan(node.id);
      snackbar.show({ message: `${node.title} dihapus.`, variant: 'ok' });
      onBerubah(ruang.id);
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Catatan gagal dihapus.'), variant: 'bad' });
    }
  }

  async function simpanNama(l: Layar): Promise<void> {
    const baru = judul.trim();
    if (baru === '') {
      setGalat('Judul wajib diisi.');
      return;
    }
    if (baru.length > 200) {
      setGalat('Judul tidak boleh lebih dari 200 karakter.');
      return;
    }
    if (baru === l.node.title) {
      setLayar(null);
      return;
    }
    if (!perluOnline('mengganti nama')) {
      return;
    }
    setSibuk(true);
    try {
      await ubahJudul(l.node.id, baru);
      setLayar(null);
      onBerubah(l.ruang.id);
    } catch (err) {
      setGalat(pesanGalat(err, 'Judul gagal disimpan.'));
    } finally {
      setSibuk(false);
    }
  }

  async function simpanPindah(l: Layar): Promise<void> {
    if (tujuan === (l.node.parent_id ?? null)) {
      setLayar(null);
      return;
    }
    if (!perluOnline('memindahkan catatan')) {
      return;
    }
    setSibuk(true);
    try {
      const asal = l.node.parent_id;
      await pindahCatatan(l.node.id, tujuan);
      setLayar(null);
      onBerubah(l.ruang.id);
      snackbar.show({
        message: `${l.node.title} dipindahkan.`,
        variant: 'ok',
        actionLabel: 'Urungkan',
        onAction: () => {
          pindahCatatan(l.node.id, asal)
            .then(() => onBerubah(l.ruang.id))
            .catch((err: unknown) => snackbar.show({ message: pesanGalat(err, 'Gagal mengurungkan.'), variant: 'bad' }));
        },
      });
    } catch (err) {
      setGalat(pesanGalat(err, 'Catatan gagal dipindahkan.'));
    } finally {
      setSibuk(false);
    }
  }

  const menu = layar?.jenis === 'menu' ? layar : null;
  const ganti = layar?.jenis === 'ganti' ? layar : null;
  const pindah = layar?.jenis === 'pindah' ? layar : null;
  const folder = menu?.node.kind === 'folder';
  const bolehUbah = menu?.node.can_edit === true && !menu.ruang.archived;

  const elemen = (
    <>
      <BottomSheet visible={menu !== null} onClose={tutup} title={folder ? 'Aksi folder' : 'Aksi catatan'}>
        {menu ? (
          <>
            <Text variant="meta" style={{ marginTop: -8 }} numberOfLines={1}>
              {menu.node.title}
            </Text>
            {folder && menu.bisaBuat ? (
              <>
                <SheetAction icon="file-plus" label="Catatan baru di sini" onPress={() => { onBuatDi(menu.ruang, menu.node.id, 'note'); setLayar(null); }} />
                <SheetAction icon="folder-plus" label="Folder baru di sini" onPress={() => { onBuatDi(menu.ruang, menu.node.id, 'folder'); setLayar(null); }} />
              </>
            ) : null}
            {bolehUbah ? (
              <>
                <SheetAction
                  icon="pencil"
                  label="Ganti nama"
                  onPress={() => {
                    setJudul(menu.node.title);
                    setGalat(null);
                    setLayar({ jenis: 'ganti', node: menu.node, ruang: menu.ruang, tree: menu.tree });
                  }}
                />
                <SheetAction
                  icon="folder-input"
                  label="Pindahkan"
                  onPress={() => {
                    setTujuan(menu.node.parent_id ?? null);
                    setGalat(null);
                    setLayar({ jenis: 'pindah', node: menu.node, ruang: menu.ruang, tree: menu.tree });
                  }}
                />
              </>
            ) : null}
            {!folder ? <SheetAction icon="share" label="Bagikan sebagai teks" onPress={() => { setLayar(null); void bagikanTeks(menu.node); }} /> : null}
            {bolehUbah ? <SheetAction icon="trash-2" label={folder ? 'Hapus folder' : 'Hapus catatan'} tone="danger" onPress={() => void hapus(menu)} /> : null}
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={ganti !== null} onClose={tutup} title="Ganti nama">
        {ganti ? (
          <View style={{ gap: 12 }}>
            <Text variant="meta" style={{ marginTop: -8 }} numberOfLines={1}>
              {ganti.node.title}
            </Text>
            <Field label="Judul" error={galat}>
              <Input value={judul} onChangeText={(t) => { setJudul(t); setGalat(null); }} maxLength={200} autoFocus invalid={galat !== null} accessibilityLabel="Judul" onSubmitEditing={() => void simpanNama(ganti)} />
            </Field>
            <Button title="Simpan" onPress={() => void simpanNama(ganti)} loading={sibuk} loadingTitle="Menyimpan…" />
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={pindah !== null} onClose={tutup} title="Pindahkan" scrollable>
        {pindah ? (
          <View style={{ gap: 12 }}>
            <Text variant="meta" style={{ marginTop: -8 }} numberOfLines={1}>
              {pindah.node.title}
            </Text>
            <Field label="Ke" error={galat}>
              <PemilihTujuan tujuan={daftarTujuan(pindah.tree, pindah.node)} terpilih={tujuan} onPilih={(id) => { setTujuan(id); setGalat(null); }} />
            </Field>
            <Button title="Pindahkan" onPress={() => void simpanPindah(pindah)} loading={sibuk} loadingTitle="Memindahkan…" />
          </View>
        ) : null}
      </BottomSheet>
    </>
  );

  return { buka, elemen };
}
