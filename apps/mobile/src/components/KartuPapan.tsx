/**
 * Kartu tugas papan (TaskResource web) — judul, key, titik prioritas,
 * badge komentar (dengan titik belum-dibaca) & checklist, jumlah penanggung.
 * Kontrak papan hanya mengirim `assignee_ids` (tanpa nama) sehingga
 * penanggung tampil sebagai jumlah.
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { BoardTask } from '@/api/types';
import { Card, Meta } from '@/components/ui';
import { warnaPrioritas } from '@/lib/palette';
import { tanggalTanpaTahun } from '@/lib/format';
import { useTheme } from '@/lib/theme';

const LABEL_PRIORITAS: Record<number, string> = {
  0: 'Tanpa',
  1: 'Urgent',
  2: 'Tinggi',
  3: 'Sedang',
  4: 'Rendah',
};

export function KartuPapan({ tugas, onPress }: { tugas: BoardTask; onPress: () => void }): React.JSX.Element {
  const { colors, dark } = useTheme();
  const warna = warnaPrioritas(tugas.priority, colors);

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Buka tugas ${tugas.title}`}
      style={gaya.kartu}
    >
      <View style={gaya.atas}>
        <View style={[gaya.titik, { backgroundColor: warna }]} />
        <Text style={[gaya.judul, { color: colors.text }]} numberOfLines={2}>
          {tugas.title}
        </Text>
      </View>
      <Meta>
        {tugas.key}
        {tugas.due_date ? ` · tenggat ${tanggalTanpaTahun(tugas.due_date)}` : ''}
      </Meta>
      <View style={gaya.lencana}>
        <View style={[gaya.chip, { backgroundColor: colors.surface2 }]}>
          <Ionicons name="person-outline" size={12} color={colors.muted} />
          <Text style={[gaya.chipTeks, { color: colors.muted }]}>
            {tugas.assignees && tugas.assignees.length > 0
              ? tugas.assignees.map((a) => a.nama ?? '·').join(', ')
              : tugas.assignee_ids.length > 0
                ? `${tugas.assignee_ids.length} orang`
                : '—'}
          </Text>
        </View>
        {tugas.checklist ? (
          <View style={[gaya.chip, { backgroundColor: colors.surface2 }]}>
            <Ionicons name="checkbox-outline" size={12} color={colors.muted} />
            <Text style={[gaya.chipTeks, { color: colors.muted }]}>
              {tugas.checklist.done}/{tugas.checklist.total}
            </Text>
          </View>
        ) : null}
        {tugas.comments ? (
          <View style={[gaya.chip, { backgroundColor: colors.surface2 }]}>
            <Ionicons name="chatbubble-outline" size={12} color={tugas.comments.unread ? colors.primary : colors.muted} />
            <Text style={[gaya.chipTeks, { color: tugas.comments.unread ? colors.primary : colors.muted }]}>
              {tugas.comments.count}
            </Text>
            {tugas.comments.unread ? (
              <View style={[gaya.belumBaca, { backgroundColor: dark ? colors.primary : colors.badge }]} />
            ) : null}
          </View>
        ) : null}
        {tugas.parent_key ? (
          <View style={[gaya.chip, { backgroundColor: colors.surface2 }]}>
            <Ionicons name="git-branch-outline" size={12} color={colors.muted} />
            <Text style={[gaya.chipTeks, { color: colors.muted }]}>{tugas.parent_key}</Text>
          </View>
        ) : null}
        <View style={[gaya.chip, { backgroundColor: colors.surface2 }]}>
          <View style={[gaya.titikKecil, { backgroundColor: warna }]} />
          <Text style={[gaya.chipTeks, { color: colors.muted }]}>{LABEL_PRIORITAS[tugas.priority] ?? '—'}</Text>
        </View>
      </View>
    </Card>
  );
}

const gaya = StyleSheet.create({
  kartu: { gap: 6 },
  atas: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titik: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  judul: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  lencana: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipTeks: { fontSize: 12, fontWeight: '600' },
  titikKecil: { width: 8, height: 8, borderRadius: 4 },
  belumBaca: { width: 6, height: 6, borderRadius: 3 },
});
