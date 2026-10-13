/**
 * Sheet "Dibaca oleh" (mockup 19 #2): hanya nama pembaca — kontrak tidak
 * menyimpan waktu baca per orang.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { dibacaOleh, type Peserta } from '@/api/obrolan';
import { ApiError } from '@/api/client';
import { Avatar, BottomSheet, Loading, Text } from '@/ui';

interface Hasil {
  id: string;
  galat: string | null;
  jumlahBaca: number;
  penerima: number;
  pembaca: Peserta[];
}

export function DibacaOlehSheet({ kanalId, pesanId, onClose }: { kanalId: string; pesanId: string | null; onClose: () => void }): React.JSX.Element {
  const [hasil, setHasil] = useState<Hasil | null>(null);

  useEffect(() => {
    if (pesanId === null) {
      return undefined;
    }
    let batal = false;
    dibacaOleh(kanalId, pesanId)
      .then((r) => {
        if (!batal) {
          setHasil({ id: pesanId, galat: null, jumlahBaca: r.read_count, penerima: r.recipients_count, pembaca: r.readers });
        }
      })
      .catch((err: unknown) => {
        if (!batal) {
          setHasil({
            id: pesanId,
            galat: err instanceof ApiError ? err.message : 'Daftar pembaca tidak dapat dimuat.',
            jumlahBaca: 0,
            penerima: 0,
            pembaca: [],
          });
        }
      });
    return () => {
      batal = true;
    };
  }, [kanalId, pesanId]);

  const memuat = pesanId !== null && hasil?.id !== pesanId;
  const data = hasil?.id === pesanId ? hasil : null;

  return (
    <BottomSheet visible={pesanId !== null} onClose={onClose} title="Dibaca oleh" showClose scrollable>
      {memuat ? (
        <Loading rows={3} />
      ) : data?.galat ? (
        <Text variant="body" tone="danger" accessibilityRole="alert">
          {data.galat}
        </Text>
      ) : data ? (
        <>
          <Text variant="meta">
            {data.jumlahBaca} dari {data.penerima} orang sudah membaca
          </Text>
          {data.pembaca.length === 0 ? (
            <Text variant="body" tone="muted">
              Belum ada yang membaca pesan ini.
            </Text>
          ) : (
            data.pembaca.map((p) => (
              <View key={p.id} style={s.baris}>
                <Avatar name={p.name} size="md" />
                <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
                  {p.name}
                </Text>
              </View>
            ))
          )}
        </>
      ) : null}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
});
