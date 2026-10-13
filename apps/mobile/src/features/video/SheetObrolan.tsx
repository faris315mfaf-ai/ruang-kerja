/**
 * Obrolan ruang (mockup 18): tidak lewat backend dan tidak disimpan. Memakai
 * `useChat` LiveKit yang sama dengan web — text stream `lk.chat` + paket lama
 * `lk-chat-topic` {id, timestamp, message} — sehingga dua arah kompatibel.
 */
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { jam } from '@/lib/format';
import { fontFamily, radius, useTheme } from '@/theme';
import { BottomSheet, IconButton, Text, useSnackbar } from '@/ui';

export interface PesanObrolan {
  id: string;
  timestamp: number;
  message: string;
  from?: { identity: string; isLocal: boolean };
}

export function SheetObrolan({
  visible,
  onClose,
  pesan,
  kirim,
  mengirim,
  nama,
}: {
  visible: boolean;
  onClose: () => void;
  pesan: PesanObrolan[];
  kirim: (teks: string) => Promise<unknown>;
  mengirim: boolean;
  nama: (identity: string) => string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const [teks, setTeks] = useState('');

  const kirimTeks = async () => {
    const isi = teks.trim();
    if (isi === '') {
      return;
    }
    try {
      await kirim(isi);
      setTeks('');
    } catch {
      snackbar.show({ message: 'Pesan gagal terkirim. Coba lagi.', variant: 'bad' });
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Obrolan" showClose scrollable snapPoints={['70%', '92%']}>
      <Text variant="meta">Hanya berlaku selama rapat dan tidak disimpan.</Text>
      {pesan.length === 0 ? (
        <Text variant="body" tone="muted" align="center" style={{ paddingVertical: 24 }}>
          Belum ada pesan. Pesan Anda terlihat oleh semua orang di ruang.
        </Text>
      ) : null}
      {pesan.map((m) => {
        const milikSaya = m.from?.isLocal ?? false;
        return (
          <View
            key={m.id}
            style={[
              s.gelembung,
              milikSaya ? { alignSelf: 'flex-end', backgroundColor: colors.primary } : { alignSelf: 'flex-start', backgroundColor: colors.surface2 },
            ]}
            accessible
            accessibilityLabel={`${milikSaya ? 'Anda' : nama(m.from?.identity ?? '')}, ${jam(new Date(m.timestamp))}: ${m.message}`}
          >
            {!milikSaya ? (
              <Text variant="meta" weight={700} tone="link">
                {nama(m.from?.identity ?? '').split(/\s+/)[0] ?? ''}
              </Text>
            ) : null}
            <Text variant="body" style={{ color: milikSaya ? colors.primaryFg : colors.text }}>
              {m.message}
            </Text>
          </View>
        );
      })}
      <View style={s.komposer}>
        <BottomSheetTextInput
          value={teks}
          onChangeText={setTeks}
          placeholder="Kirim pesan ke semua orang"
          placeholderTextColor={colors.subtle}
          accessibilityLabel="Pesan obrolan"
          returnKeyType="send"
          onSubmitEditing={() => void kirimTeks()}
          maxLength={2000}
          style={[s.isian, { borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.text, fontFamily: fontFamily[400] }]}
        />
        <IconButton icon="send" label="Kirim pesan" variant="primary" onPress={() => void kirimTeks()} disabled={mengirim || teks.trim() === ''} />
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  gelembung: { maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  komposer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  isian: { flex: 1, minHeight: 52, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 16, fontSize: 17 },
});
