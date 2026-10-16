import { StyleSheet, View } from 'react-native';

import type { ItemPengumuman } from '@/api/pengumuman';
import { Badge, Card, IconButton, Text } from '@/ui';

import { barisMeta, penandaTampil } from './format';

export function KartuPengumuman({
  item,
  onPress,
  onHapus,
}: {
  item: ItemPengumuman;
  onPress: () => void;
  /** Ada = tampilkan tombol hapus (pembuat). */
  onHapus?: () => void;
}): React.JSX.Element {
  const tampil = penandaTampil(item);
  return (
    <Card onPress={onPress} accessibilityLabel={`Pengumuman: ${item.title}. ${barisMeta(item)}`} style={{ gap: 10 }}>
      <View style={s.kepala}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h3" style={{ fontSize: 19, lineHeight: 25 }}>
            {item.title}
          </Text>
          <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
            {barisMeta(item)}
          </Text>
        </View>
        {onHapus ? <IconButton icon="trash-2" label={`Hapus pengumuman ${item.title}`} variant="ghost" size={44} onPress={onHapus} /> : null}
      </View>
      <Text variant="body" numberOfLines={4} style={{ fontSize: 16, lineHeight: 24 }}>
        {item.body}
      </Text>
      <View style={s.pil}>
        <Badge tone={tampil.tone}>{tampil.teks}</Badge>
        {item.dismissed ? <Badge tone="neutral">Ditutup dari beranda</Badge> : null}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pil: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
