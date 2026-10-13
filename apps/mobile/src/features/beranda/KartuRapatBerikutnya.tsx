/** Kartu "Rapat berikutnya" (spec 02): tersembunyi bila kosong/fitur rapat mati. */
import { router } from 'expo-router';
import { View } from 'react-native';

import type { MeetingItem } from '@/api/types';
import { jam, tanggalTanpaTahun } from '@/lib/format';
import { Badge, Card, Text } from '@/ui';

import { hariTanggal } from './format';

/** `sekarang` = waktu data dimuat (epoch ms); dihitung di luar render agar murni. */
export function KartuRapatBerikutnya({ item, sekarang }: { item: MeetingItem; sekarang: number }): React.JSX.Element {
  const berlangsung = new Date(item.starts_at).getTime() <= sekarang;
  return (
    <Card
      onPress={() =>
        router.push({
          pathname: '/rapat/[id]/index',
          params: { id: item.id, tanggal: item.occurrence_date, judul: item.title },
        })
      }
      accessibilityLabel={`Rapat berikutnya: ${item.title}, ${jam(item.starts_at)} WIB`}
      style={{ gap: 6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="title">Rapat berikutnya</Text>
        <Badge tone={berlangsung ? 'success' : 'primary'}>{berlangsung ? 'Berlangsung' : `${jam(item.starts_at)} WIB`}</Badge>
      </View>
      <Text variant="h3" numberOfLines={2}>
        {item.title}
      </Text>
      <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
        {`${hariTanggal(item.starts_at) || tanggalTanpaTahun(item.starts_at)} · ${jam(item.starts_at)}–${jam(item.ends_at)} WIB · ${item.platform_label}${
          item.location ? ` · ${item.location}` : ''
        }`}
      </Text>
    </Card>
  );
}
