/**
 * Kartu tugas papan workspace (mockup 05 › 16): kode mono + ikon prioritas,
 * judul, kemajuan checklist, label, tenggat berwarna + ikon, komentar
 * (titik belum-dibaca), avatar penanggung jawab, dan tombol "Pindahkan"
 * (tanpa seret — PLATFORM §2). Status/prioritas selalu ikon + teks
 * (prioritas dibacakan lewat label aksesibilitas kartu).
 */
import { StyleSheet, View } from 'react-native';

import type { KartuWorkspace, LabelRef } from '@/api/workspace';
import { IkonPrioritas } from '@/features/workspace/ikon';
import { ChipMenunggu } from '@/offline/ChipMenunggu';
import { hariSingkat, labelTenggat, LABEL_PRIORITAS } from '@/features/workspace/util';
import { warnaPalet } from '@/lib/palette';
import { useTheme } from '@/theme';
import { Avatar, AvatarStack, Button, Card, Icon, Progress, Text } from '@/ui';

export function KartuPapan({
  tugas,
  labels = [],
  onPress,
  onPindah,
}: {
  tugas: KartuWorkspace;
  labels?: LabelRef[];
  onPress: () => void;
  /** Tombol "Pindahkan" tampil bila diberikan (mode lihat saja = tidak diberikan). */
  onPindah?: () => void;
}): React.JSX.Element {
  const { colors, dark } = useTheme();
  const selesai = tugas.status_category === 'done' || tugas.status_category === 'canceled';
  const tenggat = selesai
    ? tugas.completed_at
      ? { teks: `Selesai ${hariSingkat(tugas.completed_at.slice(0, 10))}`, nada: 'muted' as const, terlambat: false }
      : null
    : labelTenggat(tugas.due_date, false);
  const warnaTenggat = tenggat?.nada === 'danger' ? colors.danger : tenggat?.nada === 'warning' ? colors.warning : colors.muted;
  const label = labels.find((l) => tugas.label_ids.includes(l.id));
  const nama = (tugas.assignees ?? []).map((a) => a.nama ?? '').filter((n) => n !== '');
  const prioritas = LABEL_PRIORITAS[tugas.priority] ?? 'Tanpa';

  return (
    <Card
      onPress={onPress}
      variant="tight"
      accessibilityLabel={`${tugas.key}, ${tugas.title}. Prioritas ${prioritas}${tenggat ? `. ${tenggat.teks}` : ''}${tugas.sinkron === 'menunggu' ? '. Menunggu sinkron' : tugas.sinkron === 'gagal' ? '. Gagal sinkron' : ''}`}
      style={s.kartu}
    >
      <View style={s.atas}>
        <Text variant="mono" tone="muted" style={{ fontSize: 14 }}>
          {tugas.key}
        </Text>
        <IkonPrioritas nilai={tugas.priority} />
      </View>
      <Text variant="title" numberOfLines={3} style={{ marginTop: 2 }}>
        {tugas.title}
      </Text>
      {tugas.sinkron ? <ChipMenunggu status={tugas.sinkron} /> : null}
      {tugas.checklist && tugas.checklist.total > 0 ? (
        <View style={{ gap: 6, marginTop: 4 }}>
          <View style={s.baris}>
            <Text variant="meta" style={{ flex: 1 }}>
              Checklist
            </Text>
            <Text variant="meta">{`${tugas.checklist.done}/${tugas.checklist.total}`}</Text>
          </View>
          <Progress value={(tugas.checklist.done / tugas.checklist.total) * 100} label="Checklist" />
        </View>
      ) : null}
      <View style={s.lencana}>
        {label ? (
          <View style={[s.pil, { borderColor: colors.border }]}>
            <View style={[s.titik, { backgroundColor: warnaPalet(label.color, dark) }]} />
            <Text variant="label" numberOfLines={1} style={{ fontSize: 14, lineHeight: 20, maxWidth: 110 }}>
              {label.name}
            </Text>
          </View>
        ) : null}
        {tenggat ? (
          <View style={s.baris}>
            <Icon name={tenggat.terlambat ? 'clock-alert' : 'calendar'} size={16} color={warnaTenggat} />
            <Text variant="label" style={{ color: warnaTenggat, fontSize: 14, lineHeight: 20 }}>
              {tenggat.teks}
            </Text>
          </View>
        ) : null}
        {tugas.comments && tugas.comments.count > 0 ? (
          <View style={s.baris} accessibilityLabel={`${tugas.comments.count} komentar${tugas.comments.unread ? ', ada yang belum dibaca' : ''}`}>
            <Icon name="message-square" size={16} color={tugas.comments.unread ? colors.primary : colors.muted} />
            <Text variant="label" style={{ color: tugas.comments.unread ? colors.primary : colors.muted, fontSize: 14, lineHeight: 20 }}>
              {tugas.comments.count}
            </Text>
            {tugas.comments.unread ? <View style={[s.titikKecil, { backgroundColor: colors.primary }]} /> : null}
          </View>
        ) : null}
        {tugas.parent_key ? (
          <View style={s.baris}>
            <Icon name="git-branch" size={16} color={colors.muted} />
            <Text variant="meta">{tugas.parent_key}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 8 }} />
        {nama.length > 1 ? (
          <AvatarStack names={nama} max={3} />
        ) : nama.length === 1 ? (
          <Avatar name={nama[0]} size="sm" />
        ) : tugas.assignee_ids.length > 0 ? (
          <Text variant="meta">{`${tugas.assignee_ids.length} orang`}</Text>
        ) : null}
        {onPindah ? (
          <Button title="Pindahkan" icon="arrow-right-left" variant="outline" size="sm" onPress={onPindah} accessibilityHint={`Memindahkan ${tugas.key} ke kolom lain`} />
        ) : null}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  kartu: { gap: 6 },
  atas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lencana: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 6 },
  pil: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, minHeight: 32 },
  titik: { width: 10, height: 10, borderRadius: 5 },
  titikKecil: { width: 6, height: 6, borderRadius: 3 },
});
