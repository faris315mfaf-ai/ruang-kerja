/**
 * Akses menu Hiring di Lainnya (`GET /hiring/akses`, selalu 200): baris hanya
 * untuk HR/SA serta pewawancara/penyetuju yang ditugaskan; lencana = kandidat
 * baru + menunggu keputusan (HR) atau menunggu keputusan Anda. Hanya angka,
 * tanpa data pelamar; dimuat ulang saat layar induk mendapat fokus.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { aksesHiring, type AksesHiring } from '@/api/hiring';
import { CountBadge, Icon } from '@/ui';

export function useAksesHiring(): AksesHiring | null {
  const [akses, setAkses] = useState<AksesHiring | null>(null);
  useFocusEffect(
    useCallback(() => {
      let aktif = true;
      aksesHiring()
        .then((a) => {
          if (aktif) {
            setAkses(a);
          }
        })
        .catch(() => undefined);
      return () => {
        aktif = false;
      };
    }, []),
  );
  return akses;
}

/** Node kanan baris Hiring: lencana angka (bila ada) + chevron. */
export function LencanaHiring({ warnaChevron }: { warnaChevron: string }): React.JSX.Element {
  const akses = useAksesHiring();
  const jumlah = akses?.badge ?? 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={jumlah > 0 ? `${jumlah} perlu perhatian` : undefined}>
      {jumlah > 0 ? <CountBadge count={jumlah} /> : null}
      <Icon name="chevron-right" size={20} color={warnaChevron} />
    </View>
  );
}
