/** Kepala laporan orang lain (mockup 34-2): avatar, nama, jabatan · divisi, tanggal · terkirim. */
import { View } from 'react-native';

import { Avatar, Text } from '@/ui';

export function KepalaPemilik({ nama, baris2, baris3 }: { nama: string; baris2?: string | null; baris3?: string | null }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Avatar name={nama} size="lg" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h3" numberOfLines={2}>
          {nama}
        </Text>
        {baris2 ? (
          <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={2}>
            {baris2}
          </Text>
        ) : null}
        {baris3 ? (
          <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={2}>
            {baris3}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
