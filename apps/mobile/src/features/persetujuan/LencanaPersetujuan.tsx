/**
 * Lencana jumlah persetujuan menunggu (`GET /persetujuan/hitung`) untuk baris
 * "Persetujuan" di Lainnya: dimuat ulang setiap layar induk mendapat fokus.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { hitungPersetujuan } from '@/api/persetujuan';
import { CountBadge, Icon } from '@/ui';

export function LencanaPersetujuan({ warnaChevron }: { warnaChevron: string }): React.JSX.Element {
  const [jumlah, setJumlah] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let aktif = true;
      hitungPersetujuan()
        .then((n) => {
          if (aktif) {
            setJumlah(n);
          }
        })
        .catch(() => undefined);
      return () => {
        aktif = false;
      };
    }, []),
  );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={jumlah > 0 ? `${jumlah} menunggu` : undefined}>
      {jumlah > 0 ? <CountBadge count={jumlah} /> : null}
      <Icon name="chevron-right" size={20} color={warnaChevron} />
    </View>
  );
}
