/** Sheet "Pindahkan" dari editor (mockup 24): pilih folder tujuan dari pohon workspace. */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { pindahCatatan, pohonWorkspace, type CatatanDetail, type PohonNode } from '@/api/catatan';
import { BottomSheet, Button, Field, Loading, Text, useSnackbar } from '@/ui';

import { pesanGalat } from './AksiBaris';
import { PemilihTujuan } from './PemilihTujuan';
import { cariNode, daftarTujuan } from './pohon';

export function PindahSheet({
  visible,
  onClose,
  note,
  onDipindah,
}: {
  visible: boolean;
  onClose: () => void;
  note: CatatanDetail;
  onDipindah: (note: CatatanDetail) => void;
}): React.JSX.Element {
  const snackbar = useSnackbar();
  const [tree, setTree] = useState<PohonNode[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tujuan, setTujuan] = useState<string | null>(note.parent_id);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let batal = false;
    /* eslint-disable react-hooks/set-state-in-effect -- muat tiap sheet dibuka */
    setTree(null);
    setGalat(null);
    setTujuan(note.parent_id);
    /* eslint-enable react-hooks/set-state-in-effect */
    pohonWorkspace(note.workspace_id)
      .then((r) => {
        if (!batal) {
          setTree(r.tree);
        }
      })
      .catch((err: unknown) => {
        if (!batal) {
          setGalat(pesanGalat(err, 'Daftar folder gagal dimuat.'));
        }
      });
    return () => {
      batal = true;
    };
  }, [visible, note.workspace_id, note.parent_id]);

  const simpul = tree ? cariNode(tree, note.id) : null;

  async function pindah(): Promise<void> {
    if (tujuan === note.parent_id) {
      onClose();
      return;
    }
    setSibuk(true);
    try {
      const baru = await pindahCatatan(note.id, tujuan);
      onDipindah(baru);
      onClose();
      snackbar.show({ message: `${note.title} dipindahkan.`, variant: 'ok' });
    } catch (err) {
      setGalat(pesanGalat(err, 'Anda tidak punya izin memindahkan catatan ini.'));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pindahkan" scrollable>
      <Text variant="meta" style={{ marginTop: -8 }} numberOfLines={1}>
        {note.title}
      </Text>
      {tree === null && galat === null ? (
        <Loading rows={3} />
      ) : (
        <View style={{ gap: 12 }}>
          {tree && simpul ? (
            <Field label="Ke" error={galat}>
              <PemilihTujuan tujuan={daftarTujuan(tree, simpul)} terpilih={tujuan} onPilih={(id) => { setTujuan(id); setGalat(null); }} />
            </Field>
          ) : galat !== null ? (
            <Text variant="body" tone="danger" accessibilityRole="alert">
              {galat}
            </Text>
          ) : (
            <Text variant="meta">Catatan ini tidak ada di daftar folder Anda.</Text>
          )}
          <Button title="Pindahkan" onPress={() => void pindah()} loading={sibuk} loadingTitle="Memindahkan…" disabled={!simpul} />
        </View>
      )}
    </BottomSheet>
  );
}
