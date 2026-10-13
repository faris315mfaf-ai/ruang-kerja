import { View } from 'react-native';

import { CountBadge, Icon } from '@/ui';

import { useRingkasanAntrean } from './antrean';

/** Lencana angka + chevron untuk baris "Antrean sinkron" di Lainnya (kosong bila tidak ada item). */
export function LencanaAntrean({ warnaChevron }: { warnaChevron: string }): React.JSX.Element {
  const { total } = useRingkasanAntrean();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {total > 0 ? <CountBadge count={total} /> : null}
      <Icon name="chevron-right" size={20} color={warnaChevron} />
    </View>
  );
}
