/** Potongan kecil layar Absen: kartu selfie, daftar prasyarat, pratinjau pesan grup. */
import { File } from 'expo-file-system';
import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { jam } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { BottomSheet, Button, Card, Icon, IconTile, Pressable, Text } from '@/ui';

import type { Selfie } from './store';

function ukuranKb(uri: string): number | null {
  try {
    const f = new File(uri);
    return f.exists ? Math.round(f.size / 1024) : null;
  } catch {
    return null;
  }
}

/** Kartu selfie: belum diambil (tombol Ambil) atau miniatur + Ulangi. */
export function KartuSelfie({
  selfie,
  judul,
  onAmbil,
  disabled = false,
}: {
  selfie: Selfie | null;
  judul: string;
  onAmbil: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const kb = useMemo(() => (selfie ? ukuranKb(selfie.uri) : null), [selfie]);

  if (selfie) {
    return (
      <Card variant="tight" style={s.baris}>
        <Image source={{ uri: selfie.uri }} style={s.mini} accessibilityLabel="Pratinjau selfie" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" weight={700}>
            Selfie siap dikirim
          </Text>
          <Text variant="meta">
            Diambil {jam(new Date(selfie.waktu))}
            {kb !== null ? ` · ±${kb} KB` : ''} · kamera depan
          </Text>
          {selfie.gelap ? (
            <Text variant="meta" style={{ color: colors.warning }}>
              Foto tampak gelap — akan ditandai untuk ditinjau HR.
            </Text>
          ) : null}
        </View>
        <Button title="Ulangi" onPress={onAmbil} variant="outline" size="sm" disabled={disabled} />
      </Card>
    );
  }
  return (
    <Pressable
      onPress={onAmbil}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${judul}. Wajib. Ketuk untuk membuka kamera depan`}
      style={[s.baris, s.putus, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
    >
      <IconTile icon="camera" tone="blue" size={64} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" weight={700}>
          {judul}
        </Text>
        <Text variant="meta">Wajib · kamera depan terbuka saat Anda mengetuk</Text>
      </View>
      <View style={[s.ambil, { backgroundColor: colors.linkSoft }]}>
        <Text variant="label" weight={700} tone="link">
          Ambil
        </Text>
      </View>
    </Pressable>
  );
}

export type StatusSyarat = 'ok' | 'belum' | 'gagal';

/** Daftar prasyarat check-in: ikon + teks (status tidak pernah warna saja). */
export function DaftarPrasyarat({ butir, judul = 'Prasyarat check-in' }: { butir: { status: StatusSyarat; teks: string }[]; judul?: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: 12 }}>
      <Text variant="title" weight={700}>
        {judul}
      </Text>
      {butir.map((b) => (
        <View key={b.teks} style={s.syarat} accessible accessibilityLabel={`${b.teks}: ${b.status === 'ok' ? 'terpenuhi' : b.status === 'gagal' ? 'belum terpenuhi' : 'menunggu'}`}>
          <View
            style={[
              s.tanda,
              { backgroundColor: b.status === 'ok' ? colors.successSoft : b.status === 'gagal' ? colors.dangerSoft : colors.surface2 },
            ]}
          >
            {b.status === 'ok' ? <Icon name="check" size={16} color={colors.success} /> : b.status === 'gagal' ? <Icon name="x" size={16} color={colors.danger} /> : null}
          </View>
          <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>
            {b.teks}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/** Lembar "Pesan ke grup manajemen" — salinan baca-saja. */
export function SheetPesanWa({ visible, onClose, pesan }: { visible: boolean; onClose: () => void; pesan: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Pesan ke grup manajemen" scrollable>
      <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
        Dikirim otomatis setelah check-in berhasil lewat gateway WhatsApp. Isinya salinan, bukan rekaman resmi.
      </Text>
      <View style={[s.gelembung, { backgroundColor: colors.successSoft, borderColor: colors.border }]}>
        <Text variant="body" style={{ fontSize: 15, lineHeight: 22, color: colors.text }} selectable>
          {pesan}
        </Text>
      </View>
      <View style={s.bantu}>
        <Icon name="shield-check" size={18} color={colors.muted} />
        <Text variant="meta" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
          Tanpa NIK, koordinat presisi, atau foto. Gagal terkirim tidak memengaruhi absensi Anda.
        </Text>
      </View>
      <Button title="Mengerti" onPress={onClose} />
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  putus: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.card, padding: 14 },
  mini: { width: 64, height: 64, borderRadius: radius.lg },
  ambil: { paddingHorizontal: 14, minHeight: 40, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  syarat: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tanda: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gelembung: { borderRadius: radius.xl, borderWidth: 1, padding: 16 },
  bantu: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
