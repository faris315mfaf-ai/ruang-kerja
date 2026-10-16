/**
 * Baris tugas ringkas (Beranda "tugas hari ini", Kalender, dsb.): cincin
 * status + judul + key · workspace, prioritas di kanan. Sumber `attendance`
 * diberi tag "dari absen". Untuk kartu Tugas saya lihat `features/tugas/TugasKartu`.
 */
import { StyleSheet, View } from 'react-native';

import type { TaskListItem, TaskSource } from '@/api/types';
import type { KategoriStatus } from '@/api/tugas';
import { PriorityBars, StatusRing } from '@/features/tugas/ikon';
import { useTheme } from '@/theme';
import { Pressable, Tag, Text } from '@/ui';

export function lencanaSumber(sumber: TaskSource): string {
  return sumber === 'attendance' ? 'dari absen' : '';
}

const KATEGORI: readonly string[] = ['backlog', 'todo', 'in_progress', 'review', 'done', 'canceled'];

export function TugasItem({ tugas, onPress, aksesLabel }: { tugas: TaskListItem; onPress: () => void; aksesLabel?: string }): React.JSX.Element {
  const { colors } = useTheme();
  const kategori = (KATEGORI.includes(tugas.status.category) ? tugas.status.category : tugas.status.is_done ? 'done' : 'todo') as KategoriStatus;
  const selesai = tugas.status.is_done;
  return (
    <Pressable
      onPress={onPress}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={aksesLabel ?? `Buka tugas ${tugas.title}, ${tugas.status.name}`}
      style={s.baris}
    >
      <StatusRing kategori={kategori} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" numberOfLines={2} style={selesai ? { textDecorationLine: 'line-through', color: colors.muted } : undefined}>
          {tugas.title}
        </Text>
        <Text variant="meta" numberOfLines={1}>
          {tugas.workspace.name} · {tugas.status.name}
        </Text>
      </View>
      <View style={s.kanan}>
        {tugas.source === 'attendance' ? <Tag tone="primary">dari absen</Tag> : null}
        <PriorityBars nilai={tugas.priority?.value ?? 0} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  kanan: { alignItems: 'flex-end', gap: 6 },
});
