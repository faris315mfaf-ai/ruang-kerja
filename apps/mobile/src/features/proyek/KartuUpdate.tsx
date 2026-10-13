/**
 * Satu update proyek PIC (mockup 06 › 05, 09): penulis, tanggal, kesehatan,
 * progres/rencana saat itu (snapshot server, tidak dihitung ulang), ringkasan,
 * hambatan, keputusan dibutuhkan (+ "Tandai keputusan selesai" bila boleh),
 * dan arahan Direksi sebagai balasan.
 */
import { View } from 'react-native';

import type { UpdateProyek } from '@/api/proyek';
import { waktuRelatif } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Button, Card, Text } from '@/ui';

import { hariTanggal, persen } from './format';
import { LencanaKesehatan } from './komponen';

export function KartuUpdate({
  u,
  bolehTandai,
  onTandai,
  onBalas,
  ringkas = false,
}: {
  u: UpdateProyek;
  bolehTandai: boolean;
  onTandai?: () => void;
  /** "Beri arahan" mengutip update ini (Direksi). */
  onBalas?: () => void;
  ringkas?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const tgl = u.created_at.slice(0, 10);
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={u.author?.name ?? 'PIC'} />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={1}>
            {u.author?.name ?? 'PIC'}
          </Text>
          <Text variant="meta">{`${hariTanggal(tgl)} · ${waktuRelatif(u.created_at)}`}</Text>
        </View>
        <LencanaKesehatan health={u.health} />
      </View>
      {u.progress_snapshot !== null || u.planned_snapshot !== null ? (
        <Text variant="meta" style={{ fontSize: 14 }}>{`Saat itu: progres ${persen(u.progress_snapshot)} · rencana ${persen(u.planned_snapshot)}`}</Text>
      ) : null}
      <View style={{ gap: 4 }}>
        <Text variant="label" tone="muted">
          Ringkasan
        </Text>
        <Text variant="body" numberOfLines={ringkas ? 4 : undefined}>
          {u.summary}
        </Text>
      </View>
      {u.blockers ? (
        <View style={{ gap: 4 }}>
          <Text variant="label" tone="muted">
            Hambatan
          </Text>
          <Text variant="body" numberOfLines={ringkas ? 3 : undefined}>
            {u.blockers}
          </Text>
        </View>
      ) : null}
      {u.decision_needed ? (
        <View style={{ gap: 8, padding: 12, borderRadius: 16, backgroundColor: u.decision_resolved_at ? colors.surface2 : colors.warningSoft }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="label" tone={u.decision_resolved_at ? 'muted' : 'warning'} style={{ flex: 1 }}>
              Keputusan dibutuhkan
            </Text>
            {u.decision_resolved_at ? <Badge tone="success">Selesai</Badge> : null}
          </View>
          <Text variant="body">{u.decision_needed}</Text>
          {u.decision_resolved_at ? (
            <Text variant="meta">{`Ditandai selesai${u.decision_resolved_by ? ` oleh ${u.decision_resolved_by}` : ''} · ${hariTanggal(u.decision_resolved_at.slice(0, 10))}`}</Text>
          ) : bolehTandai && u.can_resolve && onTandai ? (
            <Button title="Tandai keputusan selesai" icon="check" size="sm" onPress={onTandai} />
          ) : null}
        </View>
      ) : null}
      {u.directions.length > 0 ? (
        <View style={{ gap: 8 }}>
          {u.directions.map((a) => (
            <View key={a.id} style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12, gap: 2 }} accessible accessibilityLabel={`Arahan ${a.author?.name ?? 'Direksi'}: ${a.body}`}>
              <Text variant="meta">{`Arahan ${a.author?.name ?? 'Direksi'} · ${waktuRelatif(a.created_at)}`}</Text>
              <Text variant="body" style={{ fontSize: 15 }}>
                {a.body}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {onBalas ? <Button title="Beri arahan" variant="quiet" size="sm" icon="message-circle" onPress={onBalas} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} /> : null}
    </Card>
  );
}
