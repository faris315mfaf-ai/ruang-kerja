/**
 * Sheet aksi pesan (mockup 14): pratinjau, delapan reaksi, Balas di thread,
 * Bagikan teks (tanpa paket clipboard), Sunting, Dibaca oleh, Hapus (dialog).
 */
import { Share, StyleSheet, View } from 'react-native';

import { hapusPesan, EMOJI_REAKSI, setReaksi, type Pesan } from '@/api/obrolan';
import { useTheme } from '@/theme';
import { BottomSheet, Pressable, SheetAction, Text, useDialog, useSnackbar } from '@/ui';

import { namaPenulis, pesanDihapus, pesanGalat, ringkasReaksi } from './util';

export function AksiPesanSheet({
  pesan,
  kanalId,
  saya,
  onClose,
  onBalas,
  onSunting,
  onDibacaOleh,
  onUbah,
}: {
  pesan: Pesan | null;
  kanalId: string;
  saya: string | null;
  onClose: () => void;
  /** Kosong di layar thread (balasan tidak bercabang). */
  onBalas?: (pesan: Pesan) => void;
  onSunting: (pesan: Pesan) => void;
  /** Kosong bila bukan anggota kanal (server menolak 403). */
  onDibacaOleh?: (pesan: Pesan) => void;
  onUbah: (pesan: Pesan) => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const dialog = useDialog();
  const snackbar = useSnackbar();
  const dihapus = pesan !== null && pesanDihapus(pesan);
  const milikSaya = pesan !== null && saya !== null && pesan.user_id === saya;
  const bolehReaksi = pesan !== null && !dihapus && (pesan.can?.react ?? false);
  const saatIni = pesan !== null && saya !== null ? ringkasReaksi(pesan, saya).filter((r) => r.mine).map((r) => r.emoji) : [];

  const reaksi = async (emoji: string): Promise<void> => {
    if (pesan === null) {
      return;
    }
    const aktif = !saatIni.includes(emoji);
    onClose();
    try {
      const hasil = await setReaksi(kanalId, pesan.id, emoji, aktif);
      onUbah(hasil.message);
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Reaksi gagal dikirim.'), variant: 'bad' });
    }
  };

  const hapus = async (): Promise<void> => {
    if (pesan === null) {
      return;
    }
    onClose();
    const ok = await dialog.confirm({
      title: 'Hapus pesan?',
      message: milikSaya
        ? 'Pesan akan diganti "Pesan ini dihapus" untuk semua orang. Balasan di thread tetap ada.'
        : 'Anda menghapus pesan ini sebagai admin kanal. Pesan akan diganti "Pesan ini dihapus" untuk semua orang.',
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!ok) {
      return;
    }
    try {
      const hasil = await hapusPesan(kanalId, pesan.id);
      onUbah(hasil.message);
      snackbar.show({ message: 'Pesan dihapus', variant: 'ok' });
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Pesan gagal dihapus.'), variant: 'bad' });
    }
  };

  const bagikan = (): void => {
    if (pesan === null) {
      return;
    }
    onClose();
    void Share.share({ message: pesan.body_text }).catch(() => undefined);
  };

  return (
    <BottomSheet visible={pesan !== null} onClose={onClose} scrollable>
      {pesan !== null ? (
        <>
          <View style={[s.pratinjau, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {namaPenulis(pesan) !== '' ? (
              <Text variant="meta" weight={700} tone="link">
                {milikSaya ? 'Anda' : namaPenulis(pesan)}
              </Text>
            ) : null}
            <Text variant="body" numberOfLines={3} tone={dihapus ? 'subtle' : 'text'} style={dihapus ? { fontStyle: 'italic' } : undefined}>
              {dihapus ? 'Pesan ini dihapus' : pesan.body_text !== '' ? pesan.body_text : 'Lampiran'}
            </Text>
          </View>

          {bolehReaksi ? (
            <View style={s.emoji} accessibilityRole="toolbar">
              {EMOJI_REAKSI.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => void reaksi(e)}
                  accessibilityRole="button"
                  accessibilityLabel={`Reaksi ${e}${saatIni.includes(e) ? ', sudah dipilih' : ''}`}
                  accessibilityState={{ selected: saatIni.includes(e) }}
                  hitSlop={4}
                  style={[s.emojiTombol, saatIni.includes(e) ? { backgroundColor: colors.linkSoft, borderColor: colors.primary } : { borderColor: 'transparent' }]}
                >
                  <Text style={{ fontSize: 26, lineHeight: 32 }} maxFontSizeMultiplier={1.2}>
                    {e}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {!dihapus && pesan.can?.reply && onBalas ? (
            <SheetAction
              icon="message-circle-reply"
              label="Balas di thread"
              onPress={() => {
                onClose();
                onBalas(pesan);
              }}
            />
          ) : null}
          {!dihapus && pesan.body_text !== '' ? <SheetAction icon="share-2" label="Bagikan teks" description="Salin lewat menu bagikan perangkat" onPress={bagikan} /> : null}
          {!dihapus && pesan.can?.edit ? (
            <SheetAction
              icon="pencil"
              label="Sunting"
              onPress={() => {
                onClose();
                onSunting(pesan);
              }}
            />
          ) : null}
          {!dihapus && onDibacaOleh ? (
            <SheetAction
              icon="check-check"
              label="Dibaca oleh"
              onPress={() => {
                onClose();
                onDibacaOleh(pesan);
              }}
            />
          ) : null}
          {!dihapus && pesan.can?.delete ? <SheetAction icon="trash-2" label="Hapus" tone="danger" onPress={() => void hapus()} /> : null}
        </>
      ) : null}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  pratinjau: { borderWidth: 1, borderRadius: 20, padding: 14, gap: 2 },
  emoji: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  emojiTombol: { width: 42, height: 48, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
