/** Bagian lampiran (daftar + aksi, unggah dinonaktifkan sampai Drive siap) dan baris aktivitas. */
import { Linking, StyleSheet, View } from 'react-native';

import type { Aktivitas, DriveInfo, Lampiran } from '@/api/tugas';
import { waktuRelatif } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Avatar, Banner, BottomSheet, Button, Icon, Pressable, SheetAction, Text, type IconName } from '@/ui';

import { ukuranBerkas } from './util';

const IKON: Record<Lampiran['kind'], IconName> = {
  doc: 'file-text',
  sheet: 'file-spreadsheet',
  slide: 'presentation',
  pdf: 'file-text',
  image: 'file-image',
  folder: 'folder',
  other: 'file',
};
const JENIS: Record<Lampiran['kind'], string> = { doc: 'Docs', sheet: 'Sheets', slide: 'Slides', pdf: 'PDF', image: 'Gambar', folder: 'Folder', other: 'Berkas' };

export function pesanUnggah(drive: DriveInfo): string {
  return drive.enabled
    ? 'Pemilih berkas dari ponsel belum ada di aplikasi ini. Tambah lampiran lewat RuangKerja web untuk sementara.'
    : 'Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja. Lampiran bisa ditambah setelah Drive aktif.';
}

export function LampiranBagian({
  lampiran,
  drive,
  bolehUbah,
  onAksi,
  alasanTerkunci,
}: {
  lampiran: Lampiran[];
  drive: DriveInfo;
  bolehUbah: boolean;
  onAksi: (l: Lampiran) => void;
  alasanTerkunci: string | null;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <View style={s.kepala}>
        <Text variant="overline" tone="muted">
          Lampiran
        </Text>
        <Text variant="overline" tone="muted">
          {lampiran.length}
        </Text>
      </View>
      {lampiran.length === 0 ? <Text variant="meta">Belum ada lampiran.</Text> : null}
      {lampiran.map((l) => (
        <Pressable
          key={l.id}
          onPress={() => onAksi(l)}
          scaleTo={0.99}
          accessibilityRole="button"
          accessibilityLabel={`Lampiran ${l.name}`}
          style={[s.baris, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[s.ikon, { backgroundColor: colors.linkSoft }]}>
            <Icon name={IKON[l.kind]} size={22} color={colors.link} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label" numberOfLines={1}>
              {l.name}
            </Text>
            <Text variant="meta" numberOfLines={1}>
              {[JENIS[l.kind], ukuranBerkas(l.size_bytes), l.uploaded_by?.name, waktuRelatif(l.created_at)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Icon name="ellipsis" size={20} color={colors.muted} />
        </Pressable>
      ))}
      {bolehUbah ? (
        <>
          <Button title="Tambah lampiran" icon="paperclip" variant="outline" disabled disabledReason={pesanUnggah(drive)} onPress={() => undefined} />
          <Banner tone="neutral" icon="cloud-upload" message={pesanUnggah(drive)} />
        </>
      ) : alasanTerkunci ? (
        <Text variant="meta">{alasanTerkunci}</Text>
      ) : null}
    </View>
  );
}

export function SheetLampiran({
  lampiran,
  onClose,
  onLepas,
}: {
  lampiran: Lampiran | null;
  onClose: () => void;
  onLepas: (l: Lampiran) => void;
}): React.JSX.Element {
  return (
    <BottomSheet visible={lampiran !== null} onClose={onClose}>
      {lampiran ? (
        <>
          <View style={{ gap: 2, marginBottom: 4 }}>
            <Text variant="h3" numberOfLines={2}>
              {lampiran.name}
            </Text>
            <Text variant="meta">
              {[JENIS[lampiran.kind], ukuranBerkas(lampiran.size_bytes), lampiran.uploaded_by?.name, waktuRelatif(lampiran.created_at)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {lampiran.link ? (
            <SheetAction
              icon="external-link"
              label={lampiran.source === 'drive' ? 'Buka di Google Drive' : 'Buka'}
              onPress={() => {
                const url = lampiran.link;
                onClose();
                if (url) {
                  void Linking.openURL(url).catch(() => undefined);
                }
              }}
            />
          ) : null}
          {lampiran.can_remove ? (
            <SheetAction icon="unlink" label="Lepas dari tugas" tone="danger" description="File tetap ada di Drive" onPress={() => { onClose(); onLepas(lampiran); }} />
          ) : null}
        </>
      ) : null}
    </BottomSheet>
  );
}

export function BarisAktivitas({ a }: { a: Aktivitas }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={s.akt} accessibilityLabel={`${a.causer?.name ?? 'Seseorang'} ${a.text}. ${waktuRelatif(a.created_at)}`}>
      <Avatar name={a.causer?.name ?? '?'} size="sm" />
      <Text variant="body" style={{ flex: 1, fontSize: 15, lineHeight: 22, color: colors.muted }}>
        <Text variant="body" weight={700} style={{ fontSize: 15, color: colors.text }}>
          {a.causer?.name ?? 'Seseorang'}
        </Text>{' '}
        {a.text}
        <Text variant="meta"> · {waktuRelatif(a.created_at)}</Text>
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 12 },
  ikon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  akt: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 2 },
});
