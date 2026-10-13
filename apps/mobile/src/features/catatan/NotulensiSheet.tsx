/** Sheet "Notulensi terakhir" + tombol Mulai notulensi (mockup 07). Dapat dipakai Beranda. */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { notulensiTerakhir, type NotulensiRingkas } from '@/api/catatan';
import { waktuRelatif } from '@/lib/format';
import { BottomSheet, Button, ListRow, Skeleton, Text } from '@/ui';

import { pesanGalat } from './AksiBaris';
import { useMulaiNotulensi } from './useMulaiNotulensi';

export function NotulensiSheet({ visible, onClose }: { visible: boolean; onClose: () => void }): React.JSX.Element {
  const { mulai, membuat } = useMulaiNotulensi();
  const [daftar, setDaftar] = useState<NotulensiRingkas[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    setGalat(null);
    setDaftar(null);
    try {
      setDaftar(await notulensiTerakhir(3));
    } catch (err) {
      setGalat(pesanGalat(err, 'Notulensi terakhir gagal dimuat.'));
    }
  }, []);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- muat tiap sheet dibuka
      void muat();
    }
  }, [visible, muat]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Notulensi terakhir">
      <Text variant="meta" style={{ marginTop: -8 }}>
        3 terbaru · ketuk untuk membuka
      </Text>
      {daftar === null && galat === null ? (
        <View style={{ gap: 10 }}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : galat !== null ? (
        <View style={{ gap: 8 }}>
          <Text variant="body" tone="danger" accessibilityRole="alert">
            {galat}
          </Text>
          <Button title="Coba lagi" variant="outline" size="sm" onPress={() => void muat()} />
        </View>
      ) : daftar !== null && daftar.length === 0 ? (
        <Text variant="body" tone="muted">
          Belum ada notulensi. Mulai yang pertama dari tombol “Mulai notulensi”.
        </Text>
      ) : (
        (daftar ?? []).map((n, i) => (
          <ListRow
            key={n.id}
            icon="notebook-pen"
            iconTone="teal"
            title={n.title}
            subtitle={`${n.workspace_name ?? 'Pribadi'} · ${waktuRelatif(n.updated_at)}`}
            divider={i > 0}
            onPress={() => {
              onClose();
              router.push(`/catatan/${n.id}`);
            }}
          />
        ))
      )}
      <Button
        title="Mulai notulensi"
        icon="notebook-pen"
        onPress={() => {
          onClose();
          void mulai();
        }}
        loading={membuat}
        loadingTitle="Membuat notulensi…"
        size="md"
      />
    </BottomSheet>
  );
}
