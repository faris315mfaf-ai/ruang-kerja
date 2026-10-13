/**
 * Baris workspace (mockup 05 › 15): ubin gradien berhuruf, nama, "KEY · Jenis ·
 * N anggota", lencana terlambat / diarsipkan / lihat saja, bintang favorit.
 */
import { StyleSheet, View } from 'react-native';

import type { WorkspaceItem } from '@/api/workspace';
import { useTheme } from '@/theme';
import { Badge, Icon, Pressable, Text } from '@/ui';
import { ICONS } from '@/ui/icons';

import { UbinWorkspace } from './bagian';

export function subjudulWorkspace(w: WorkspaceItem): string {
  const bagian: string[] = [w.key];
  if (w.type === 'personal') {
    bagian.push(`${w.open_tasks_count} tugas`);
  } else {
    bagian.push(w.type_label);
    bagian.push(`${w.members_count} anggota`);
  }
  return bagian.join(' · ');
}

export function BarisWorkspace({
  item,
  onPress,
  onFavorit,
  divider = false,
}: {
  item: WorkspaceItem;
  onPress: () => void;
  /** Bintang tampil hanya untuk anggota; diberikan = aksi tombol. */
  onFavorit?: () => void;
  divider?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const lencana: React.ReactNode[] = [];
  if (item.overdue_tasks_count > 0) {
    lencana.push(
      <Badge key="terlambat" tone="danger">
        {`${item.overdue_tasks_count} terlambat`}
      </Badge>,
    );
  }
  if (item.view_only && !item.arsip) {
    lencana.push(
      <Badge key="lihat" tone="info" dot={false}>
        Lihat saja
      </Badge>,
    );
  }
  if (item.arsip) {
    lencana.push(
      <Badge key="arsip" tone="neutral" dot={false}>
        Diarsipkan
      </Badge>,
    );
  }

  return (
    <View style={[s.baris, divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
      <Pressable
        onPress={onPress}
        scaleTo={1}
        accessibilityRole="button"
        accessibilityLabel={`Buka workspace ${item.name}. ${subjudulWorkspace(item)}${item.favorit ? '. Favorit' : ''}${item.overdue_tasks_count > 0 ? `. ${item.overdue_tasks_count} tugas terlambat` : ''}`}
        style={s.isi}
      >
        <UbinWorkspace nama={item.name} warna={item.color} tipe={item.type} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {item.name}
          </Text>
          <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={1}>
            {subjudulWorkspace(item)}
          </Text>
          {lencana.length > 0 ? <View style={s.lencana}>{lencana}</View> : null}
        </View>
      </Pressable>
      {onFavorit ? (
        <Pressable
          onPress={onFavorit}
          scaleTo={0.9}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={item.favorit ? `Hapus ${item.name} dari favorit` : `Jadikan ${item.name} favorit`}
          accessibilityState={{ selected: item.favorit }}
          style={s.bintang}
        >
          <ICONS.star size={22} color={item.favorit ? colors.warning : colors.subtle} fill={item.favorit ? colors.warning : 'none'} strokeWidth={1.9} />
        </Pressable>
      ) : null}
      <Pressable onPress={onPress} scaleTo={1} accessibilityElementsHidden importantForAccessibility="no" style={s.chevron}>
        <Icon name="chevron-right" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingLeft: 16 },
  isi: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  lencana: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  bintang: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center', paddingRight: 8 },
});
