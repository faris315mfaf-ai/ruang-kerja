/**
 * Baris tugas untuk daftar (Beranda "tugas hari ini" & layar Tugas).
 * Sumber `attendance` diberi penanda "dari absen".
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Badge, Row } from '@/components/ui';
import { useTheme } from '@/lib/theme';
import type { TaskListItem, TaskSource } from '@/api/types';

export function lencanaSumber(sumber: TaskSource): string {
  return sumber === 'attendance' ? 'dari absen' : '';
}

export function TugasItem({
  tugas,
  onPress,
  aksesLabel,
}: {
  tugas: TaskListItem;
  onPress: () => void;
  aksesLabel?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const selesai = tugas.status.is_done;
  const prioritas = tugas.priority?.label ?? '';
  const nilai = tugas.priority?.value;
  const prioritasTone =
    nilai === 1
      ? 'danger'
      : nilai === 2
        ? 'warning'
        : nilai === 4
          ? 'neutral'
          : 'info';

  return (
    <Row
      onPress={onPress}
      accessibilityLabel={aksesLabel ?? `Buka tugas ${tugas.title}`}
      title={tugas.title}
      subtitle={`${tugas.workspace.name} · ${tugas.status.name}`}
      right={
        <View style={styles.kanan}>
          <View style={styles.lencanaWrap}>
            {tugas.source === 'attendance' ? <Badge tone="primary">dari absen</Badge> : null}
            {prioritas ? <Badge tone={prioritasTone as 'danger' | 'warning' | 'neutral' | 'info'}>{prioritas}</Badge> : null}
          </View>
          <Ionicons
            name={selesai ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={selesai ? colors.success : colors.subtle}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  kanan: { alignItems: 'flex-end', gap: 4 },
  lencanaWrap: { flexDirection: 'row', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' },
});
