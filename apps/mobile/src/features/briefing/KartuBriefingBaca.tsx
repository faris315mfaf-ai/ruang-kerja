/**
 * Kartu "Briefing terakhir" (pembaca, semua karyawan): cuplikan + sheet baca
 * penuh (spec 02, `06-briefing-pembaca`). Tidak ada keadaan kosong: tanpa
 * briefing (204) atau galat, kartu tidak dirender sama sekali.
 */
import { useState } from 'react';
import { View } from 'react-native';

import type { Briefing } from '@/api/types';
import { tanggalDariYMD } from '@/lib/format';
import { BottomSheet, Button, Card, Icon, Text } from '@/ui';

export function KartuBriefingBaca({ briefing }: { briefing: Briefing }): React.JSX.Element {
  const [buka, setBuka] = useState(false);
  const judul = `${briefing.label} ${tanggalDariYMD(briefing.date)}`;

  return (
    <>
      <Card onPress={() => setBuka(true)} accessibilityLabel={`Briefing terakhir: ${judul}. Ketuk untuk membaca`} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="overline" tone="muted">
            BRIEFING TERAKHIR
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text variant="label" tone="link">
              Baca
            </Text>
            <Icon name="chevron-right" size={18} />
          </View>
        </View>
        <Text variant="h3">{judul}</Text>
        <Text variant="body" tone="muted" numberOfLines={3} style={{ fontSize: 15, lineHeight: 22 }}>
          {briefing.content}
        </Text>
        <Text variant="meta">{`Dicatat oleh ${briefing.oleh}`}</Text>
      </Card>

      <BottomSheet visible={buka} onClose={() => setBuka(false)} title={judul} scrollable>
        <Text variant="meta">{`Dicatat oleh ${briefing.oleh}`}</Text>
        <Text variant="body">{briefing.content}</Text>
        <Button title="Tutup" variant="outline" onPress={() => setBuka(false)} />
      </BottomSheet>
    </>
  );
}
