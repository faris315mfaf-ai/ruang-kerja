/** Sheet "Catatan baru" / "Folder baru" (mockup 05): judul, workspace, letak. */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { buatCatatan, type CatatanDetail, type PohonNode } from '@/api/catatan';
import { BottomSheet, Button, Chip, ChipScroller, Field, Input, SegmentedTabs, SelectField, Text } from '@/ui';

import { pesanGalat } from './AksiBaris';
import { PemilihTujuan } from './PemilihTujuan';
import type { RuangPanel } from './NoteTree';
import type { TujuanPindah } from './pohon';

export interface RuangBuat extends RuangPanel {
  tree: PohonNode[];
}

function tujuanFolder(tree: PohonNode[]): TujuanPindah[] {
  const hasil: TujuanPindah[] = [{ id: null, label: 'Tingkat atas (tanpa folder)', depth: 0 }];
  const jelajah = (nodes: PohonNode[], depth: number): void => {
    for (const n of nodes) {
      if (n.kind === 'folder') {
        hasil.push({ id: n.id, label: `${n.title} (folder)`, depth });
        jelajah(n.children, depth + 1);
      }
    }
  };
  jelajah(tree, 0);
  return hasil;
}

export function BuatSheet({
  visible,
  onClose,
  ruang,
  awal,
  onDibuat,
}: {
  visible: boolean;
  onClose: () => void;
  /** Workspace yang boleh diisi (`can_create`). */
  ruang: RuangBuat[];
  awal: { ruangId: string | null; parentId: string | null; kind: 'note' | 'folder' };
  onDibuat: (note: CatatanDetail, ruangId: string, kind: 'note' | 'folder') => void;
}): React.JSX.Element {
  const [kind, setKind] = useState<'note' | 'folder'>('note');
  const [judul, setJudul] = useState('');
  const [ruangId, setRuangId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [letakTerbuka, setLetakTerbuka] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatUmum, setGalatUmum] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (visible) {
      /* eslint-disable react-hooks/set-state-in-effect -- reset form tiap sheet dibuka */
      setKind(awal.kind);
      setJudul('');
      setRuangId(awal.ruangId ?? ruang[0]?.id ?? null);
      setParentId(awal.parentId);
      setLetakTerbuka(false);
      setGalat(null);
      setGalatUmum(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat dibuka
  }, [visible]);

  const dipilih = ruang.find((r) => r.id === ruangId) ?? ruang[0] ?? null;
  const tujuan = dipilih ? tujuanFolder(dipilih.tree) : [];
  const letak = tujuan.find((t) => t.id === parentId) ?? tujuan[0];

  async function buat(): Promise<void> {
    const bersih = judul.trim();
    if (bersih === '') {
      setGalat('Judul wajib diisi.');
      return;
    }
    if (bersih.length > 200) {
      setGalat('Judul tidak boleh lebih dari 200 karakter.');
      return;
    }
    if (dipilih === null) {
      return;
    }
    setSibuk(true);
    setGalatUmum(null);
    try {
      const note = await buatCatatan({ title: bersih, workspace_id: dipilih.id, parent_id: parentId, kind });
      onDibuat(note, dipilih.id, kind);
    } catch (err) {
      setGalatUmum(pesanGalat(err, kind === 'folder' ? 'Folder gagal dibuat.' : 'Catatan gagal dibuat.'));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title={kind === 'folder' ? 'Folder baru' : 'Catatan baru'} scrollable>
      <View style={{ gap: 14 }}>
        <SegmentedTabs
          value={kind}
          onChange={(v) => {
            setKind(v);
            setGalat(null);
          }}
          options={[
            { value: 'note', label: 'Catatan' },
            { value: 'folder', label: 'Folder' },
          ]}
        />
        <Field label="Judul" error={galat}>
          <Input
            value={judul}
            onChangeText={(t) => {
              setJudul(t);
              setGalat(null);
            }}
            placeholder={kind === 'folder' ? 'mis. SOP & panduan' : 'mis. Notulen rapat mingguan 5 Okt'}
            maxLength={200}
            invalid={galat !== null}
            autoFocus
            accessibilityLabel="Judul"
            onSubmitEditing={() => void buat()}
          />
        </Field>
        <Field label="Workspace">
          {ruang.length > 1 ? (
            <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
              {ruang.map((r) => (
                <Chip
                  key={r.id}
                  label={r.personal ? 'Pribadi' : r.name}
                  selected={r.id === dipilih?.id}
                  onPress={() => {
                    setRuangId(r.id);
                    setParentId(null);
                  }}
                />
              ))}
            </ChipScroller>
          ) : (
            <Text variant="body">{dipilih ? (dipilih.personal ? 'Pribadi' : dipilih.name) : '—'}</Text>
          )}
        </Field>
        <Field label={kind === 'folder' ? 'Di dalam folder' : 'Letak'}>
          <SelectField value={letak?.label ?? 'Tingkat atas (tanpa folder)'} onPress={() => setLetakTerbuka((v) => !v)} accessibilityLabel="Letak" />
          {letakTerbuka ? (
            <PemilihTujuan
              tujuan={tujuan}
              terpilih={parentId}
              maxTinggi={220}
              onPilih={(id) => {
                setParentId(id);
                setLetakTerbuka(false);
              }}
            />
          ) : null}
        </Field>
        {galatUmum ? (
          <Text variant="meta" tone="danger" accessibilityRole="alert">
            {galatUmum}
          </Text>
        ) : null}
        <Button
          title={galatUmum ? 'Coba lagi' : kind === 'folder' ? 'Buat folder' : 'Buat catatan'}
          onPress={() => void buat()}
          loading={sibuk}
          loadingTitle="Membuat…"
          disabled={dipilih === null}
        />
      </View>
    </BottomSheet>
  );
}
