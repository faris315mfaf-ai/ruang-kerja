/**
 * Lampirkan (mockup 12): menu Drive · Kamera · Galeri, lalu pemilih file Drive
 * (maks. 10, dari cache `drive_files` — tanpa panggilan Google). Kamera dan
 * galeri belum punya endpoint unggah → ditampilkan nonaktif "Segera hadir".
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { daftarFileDrive, type FileDrive } from '@/api/obrolan';
import { useTheme } from '@/theme';
import { BottomSheet, Button, Checkbox, Icon, Loading, SearchInput, SheetAction, Text } from '@/ui';

import { ikonBerkas, LABEL_BERKAS, ukuranBerkas } from './util';

export const MAKS_LAMPIRAN = 10;

type Tahap = 'menu' | 'drive' | null;

function BarisNonaktif({ icon, label }: { icon: 'camera' | 'image'; label: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.nonaktif]} accessibilityState={{ disabled: true }} accessibilityLabel={`${label}, segera hadir`} accessible>
      <View style={[s.ubin, { backgroundColor: colors.surface2 }]}>
        <Icon name={icon} size={22} color={colors.subtle} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="title" tone="subtle">
          {label}
        </Text>
        <Text variant="meta" tone="subtle">
          Segera hadir — unggah file belum tersedia
        </Text>
      </View>
    </View>
  );
}

export function LampiranSheet({
  tahap,
  onTahap,
  kanalId,
  terpilih,
  onPilih,
}: {
  tahap: Tahap;
  onTahap: (t: Tahap) => void;
  kanalId: string;
  terpilih: FileDrive[];
  onPilih: (berkas: FileDrive[]) => void;
}): React.JSX.Element {
  return (
    <>
      <BottomSheet visible={tahap === 'menu'} onClose={() => onTahap(null)} title="Lampirkan">
        <SheetAction icon="folder" label="File dari Drive" description="Pilih file Google Drive workspace" onPress={() => onTahap('drive')} />
        <BarisNonaktif icon="camera" label="Kamera" />
        <BarisNonaktif icon="image" label="Galeri" />
      </BottomSheet>
      {tahap === 'drive' ? <PemilihDrive kanalId={kanalId} awal={terpilih} onTutup={() => onTahap(null)} onPilih={onPilih} /> : null}
    </>
  );
}

function PemilihDrive({ kanalId, awal, onTutup, onPilih }: { kanalId: string; awal: FileDrive[]; onTutup: () => void; onPilih: (b: FileDrive[]) => void }): React.JSX.Element {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<{ q: string; files: FileDrive[]; galat: string | null } | null>(null);
  const [dipilih, setDipilih] = useState<FileDrive[]>(awal);

  useEffect(() => {
    let batal = false;
    const pewaktu = setTimeout(() => {
      daftarFileDrive(kanalId, q)
        .then((r) => {
          if (!batal) {
            setHasil({ q, files: r.files, galat: null });
          }
        })
        .catch((err: unknown) => {
          if (!batal) {
            setHasil({ q, files: [], galat: err instanceof ApiError ? err.message : 'File Drive tidak dapat dimuat.' });
          }
        });
    }, q === '' ? 0 : 300);
    return () => {
      batal = true;
      clearTimeout(pewaktu);
    };
  }, [kanalId, q]);

  const memuat = hasil === null || hasil.q !== q;
  const ids = new Set(dipilih.map((b) => b.id));
  const penuh = dipilih.length >= MAKS_LAMPIRAN;

  const ubah = (berkas: FileDrive, nyala: boolean): void => {
    setDipilih((lama) => (nyala ? (lama.some((b) => b.id === berkas.id) ? lama : [...lama, berkas]) : lama.filter((b) => b.id !== berkas.id)));
  };

  return (
    <BottomSheet visible onClose={onTutup} title="Pilih file Drive" showClose scrollable>
      <SearchInput value={q} onChangeText={setQ} placeholder="Cari file" />
      {penuh ? (
        <Text variant="meta" tone="warning">
          Maksimal {MAKS_LAMPIRAN} file per pesan.
        </Text>
      ) : null}
      {memuat ? (
        <Loading rows={3} />
      ) : hasil?.galat ? (
        <Text variant="body" tone="danger" accessibilityRole="alert">
          {hasil.galat}
        </Text>
      ) : hasil && hasil.files.length === 0 ? (
        <Text variant="body" tone="muted">
          {q === '' ? 'Belum ada file Drive yang bisa dilampirkan. Tambahkan file lewat RuangKerja web.' : 'Tidak ada file yang cocok.'}
        </Text>
      ) : (
        hasil?.files.map((f) => {
          const nyala = ids.has(f.id);
          return (
            <View key={f.id} style={[s.baris, { borderColor: colors.divider }]}>
              <View style={{ flex: 1 }}>
                <Checkbox checked={nyala} disabled={!nyala && penuh} onChange={(v) => ubah(f, v)} label={f.name} />
                <Text variant="meta" numberOfLines={1} style={{ marginLeft: 36 }}>
                  {[LABEL_BERKAS[f.kind] ?? 'Berkas', ukuranBerkas(f.size_bytes)].filter((x) => x !== '').join(' · ')}
                </Text>
              </View>
              <View style={[s.ubin, { backgroundColor: colors.infoSoft }]}>
                <Icon name={ikonBerkas(f.kind)} size={22} color={colors.info} />
              </View>
            </View>
          );
        })
      )}
      <Button
        title={dipilih.length > 0 ? `Lampirkan ${dipilih.length} file` : 'Lampirkan'}
        onPress={() => {
          onPilih(dipilih);
          onTutup();
        }}
        disabled={dipilih.length === 0 && awal.length === 0}
      />
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  nonaktif: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6, opacity: 0.7 },
  ubin: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60, borderTopWidth: StyleSheet.hairlineWidth },
});
