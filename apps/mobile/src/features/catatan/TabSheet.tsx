/**
 * Sheet "Tab dokumen" (mockup 18): dokumen + tab + sub-tab, tab baru /
 * sub-tab, ganti nama, hapus tab, dan aksi catatan (riwayat, bagikan,
 * ukuran huruf, pindahkan, bagikan sebagai teks, hapus).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { buatCatatan, hapusCatatan, ubahJudul, type CatatanDetail, type TabBaris, type TabDokumen } from '@/api/catatan';
import { adalahOnline } from '@/offline';
import { useTheme } from '@/theme';
import { BottomSheet, Button, Field, Icon, Input, Loading, Pressable, SheetAction, Text, useDialog, useSnackbar } from '@/ui';

import { pesanGalat } from './AksiBaris';

export type AksiCatatan = 'ganti' | 'riwayat' | 'bagikan' | 'huruf' | 'pindah' | 'teks' | 'hapus';

export function TabSheet({
  visible,
  onClose,
  tab,
  memuat,
  galat,
  onCoba,
  note,
  onBerubah,
  onAksi,
  pergi,
}: {
  visible: boolean;
  onClose: () => void;
  tab: TabDokumen | null;
  memuat: boolean;
  galat: string | null;
  onCoba: () => void;
  note: CatatanDetail;
  /** Struktur tab berubah (ganti nama/hapus bukan tab aktif) → muat ulang daftar. */
  onBerubah: () => void;
  onAksi: (aksi: AksiCatatan) => void;
  /** Buka catatan lain di dokumen yang sama (mengganti layar; editor menyiram simpanan dulu). */
  pergi: (id: string) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const [menuBaris, setMenuBaris] = useState<TabBaris | null>(null);
  const [ganti, setGanti] = useState<{ id: string; judul: string } | null>(null);
  const [galatGanti, setGalatGanti] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const root = tab?.tabs.find((t) => t.id === tab.root_id) ?? null;
  const aktif = tab?.tabs.find((t) => t.id === note.id) ?? null;
  const bolehBuat = tab?.can_create === true;
  const indukSub = aktif && aktif.id !== tab?.root_id ? (aktif.level === 0 ? aktif : (tab?.tabs.find((t) => t.id === aktif.tab_id) ?? null)) : null;

  function buka(id: string): void {
    onClose();
    if (id !== note.id) {
      pergi(id);
    }
  }

  /** Tab hanya bisa dikelola lewat server: saat offline tampilkan "Butuh koneksi" alih-alih permintaan yang gagal. */
  function perluOnline(aksi: string): boolean {
    if (adalahOnline()) {
      return true;
    }
    snackbar.show({ message: `Butuh koneksi — ${aksi} tidak bisa dilakukan saat offline.`, variant: 'offline' });
    return false;
  }

  async function buat(parentId: string, judul: string): Promise<void> {
    if (!perluOnline('membuat tab')) {
      return;
    }
    setSibuk(true);
    try {
      const baru = await buatCatatan({ title: judul, parent_id: parentId });
      onClose();
      pergi(baru.id);
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Tab gagal dibuat. Coba lagi.'), variant: 'bad', actionLabel: 'Coba lagi', onAction: () => void buat(parentId, judul) });
    } finally {
      setSibuk(false);
    }
  }

  async function hapusTab(baris: TabBaris): Promise<void> {
    setMenuBaris(null);
    if (!perluOnline('menghapus tab')) {
      return;
    }
    const ya = await dialog.confirm({
      title: 'Hapus catatan?',
      message: `“${baris.title}” dan riwayat versinya tidak akan tampil lagi. Anda kembali ke dokumen di atasnya.`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ya) {
      return;
    }
    try {
      const hasil = await hapusCatatan(baris.id);
      if (baris.id === note.id) {
        onClose();
        pergi(hasil.parent_id ?? tab?.root_id ?? '');
      } else {
        onBerubah();
      }
      snackbar.show({ message: `${baris.title} dihapus.`, variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Tab gagal dihapus.'), variant: 'bad' });
    }
  }

  async function simpanNama(): Promise<void> {
    if (ganti === null) {
      return;
    }
    const baru = ganti.judul.trim();
    if (baru === '') {
      setGalatGanti('Judul wajib diisi.');
      return;
    }
    if (!perluOnline('mengganti nama tab')) {
      return;
    }
    setSibuk(true);
    try {
      await ubahJudul(ganti.id, baru);
      setGanti(null);
      onBerubah();
    } catch (err) {
      setGalatGanti(pesanGalat(err, 'Judul gagal disimpan.'));
    } finally {
      setSibuk(false);
    }
  }

  const bolehUbah = note.can_edit;

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        setMenuBaris(null);
        setGanti(null);
        onClose();
      }}
      title={ganti ? 'Ganti nama' : menuBaris ? menuBaris.title : 'Tab dokumen'}
      scrollable
    >
      {ganti ? (
        <View style={{ gap: 12 }}>
          <Field label="Judul" error={galatGanti}>
            <Input
              value={ganti.judul}
              onChangeText={(t) => {
                setGanti({ ...ganti, judul: t });
                setGalatGanti(null);
              }}
              maxLength={200}
              autoFocus
              invalid={galatGanti !== null}
              accessibilityLabel="Judul"
              onSubmitEditing={() => void simpanNama()}
            />
          </Field>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Batal" variant="outline" onPress={() => setGanti(null)} style={{ flex: 1 }} />
            <Button title="Simpan" onPress={() => void simpanNama()} loading={sibuk} loadingTitle="Menyimpan…" style={{ flex: 1.4 }} />
          </View>
        </View>
      ) : menuBaris ? (
        <View>
          {menuBaris.can_edit ? <SheetAction icon="pencil" label="Ganti nama" onPress={() => { setGanti({ id: menuBaris.id, judul: menuBaris.title }); setGalatGanti(null); setMenuBaris(null); }} /> : null}
          {menuBaris.level === 0 && menuBaris.id !== tab?.root_id && bolehBuat ? (
            <SheetAction icon="plus" label="Tambah sub-tab" onPress={() => { const b = menuBaris; setMenuBaris(null); void buat(b.id, b.next_subtab_title ?? 'Sub-tab 1'); }} />
          ) : null}
          {menuBaris.can_edit && menuBaris.id !== tab?.root_id ? <SheetAction icon="trash-2" label="Hapus tab" tone="danger" onPress={() => void hapusTab(menuBaris)} /> : null}
          <SheetAction icon="arrow-left" label="Kembali" onPress={() => setMenuBaris(null)} />
        </View>
      ) : (
        <>
          <Text variant="meta" style={{ marginTop: -8 }} numberOfLines={1}>
            {root?.title ?? note.title}
          </Text>
          {memuat && !tab ? (
            <Loading rows={3} label="Memuat tab…" />
          ) : galat && !tab ? (
            <View style={{ gap: 8 }}>
              <Text variant="body" tone="danger" accessibilityRole="alert">
                {galat}
              </Text>
              <Button title="Coba lagi" variant="outline" size="sm" onPress={onCoba} />
            </View>
          ) : tab ? (
            <View style={{ gap: 2 }}>
              {tab.tabs.map((t) => {
                const dokumen = t.id === tab.root_id;
                const dipilih = t.id === note.id;
                return (
                  <View key={t.id} style={[s.baris, { paddingLeft: 8 + t.level * 24 }, dipilih && { backgroundColor: colors.linkSoft }]}>
                    <Pressable onPress={() => buka(t.id)} scaleTo={1} accessibilityRole="button" accessibilityState={{ selected: dipilih }} accessibilityLabel={`${dokumen ? 'Dokumen' : t.level === 0 ? 'Tab' : 'Sub-tab'} ${t.title}`} style={s.isi}>
                      {dokumen ? <Icon name={t.preset === 'minutes' ? 'notebook-pen' : 'file-text'} size={22} color={colors.muted} /> : <View style={[s.titik, { backgroundColor: dipilih ? colors.primary : colors.subtle }]} />}
                      <Text variant="title" weight={dipilih ? 700 : 500} tone={dipilih ? 'link' : 'text'} numberOfLines={1} style={{ flex: 1 }}>
                        {t.title}
                      </Text>
                    </Pressable>
                    {!dokumen && (t.can_edit || bolehBuat) ? (
                      <Pressable onPress={() => setMenuBaris(t)} accessibilityRole="button" accessibilityLabel={`Aksi untuk ${t.title}`} scaleTo={1} hitSlop={4} style={s.menu}>
                        <Icon name="ellipsis-vertical" size={20} color={colors.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={[s.pemisah, { borderTopColor: colors.divider }]}>
            {bolehUbah ? <Button title="Ganti nama" icon="pencil" variant="outline" onPress={() => onAksi('ganti')} /> : null}
            <Button title="Riwayat versi" icon="history" variant="outline" onPress={() => onAksi('riwayat')} />
            {note.can_share ? <Button title="Bagikan" icon="share-2" variant="outline" onPress={() => onAksi('bagikan')} /> : null}
            <Button title="Ukuran huruf" icon="a-large-small" variant="outline" onPress={() => onAksi('huruf')} />
            {bolehUbah ? <Button title="Pindahkan" icon="folder-input" variant="outline" onPress={() => onAksi('pindah')} /> : null}
            <Button title="Bagikan sebagai teks" icon="share" variant="outline" onPress={() => onAksi('teks')} />
            {note.can_delete ? <SheetAction icon="trash-2" label="Hapus catatan" tone="danger" onPress={() => onAksi('hapus')} /> : null}
          </View>

          {bolehBuat && tab ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Tab baru" icon="plus" variant="outline" onPress={() => void buat(tab.root_id, tab.next_tab_title)} disabled={sibuk} style={{ flex: 1 }} />
              {indukSub ? <Button title="Sub-tab" icon="plus" variant="outline" onPress={() => void buat(indukSub.id, indukSub.next_subtab_title ?? 'Sub-tab 1')} disabled={sibuk} style={{ flex: 1 }} /> : null}
            </View>
          ) : null}
        </>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: 14, paddingRight: 2 },
  isi: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingLeft: 4 },
  titik: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 7 },
  menu: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pemisah: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
});
