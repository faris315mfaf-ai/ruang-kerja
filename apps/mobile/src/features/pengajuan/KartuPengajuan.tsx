/**
 * Kartu pengajuan di "Pengajuan saya" (mockup 01): nomor mono / "Belum
 * bernomor", status bertitik, tag kategori + periode + durasi, jalur langkah
 * "1/2 · menunggu Dimas sejak 2 jam", kutipan penolakan/revisi, kaki
 * "Diajukan 13 Okt".
 */
import { StyleSheet, View } from 'react-native';

import type { ItemPengajuan } from '@/api/pengajuan';
import { radius, useTheme } from '@/theme';
import { Badge, Card, Icon, Tag, Text } from '@/ui';

import { META_KATEGORI, META_STATUS, durasiItem, jamKantor, judulPeriode, namaDepan, sejak, tanggalTanpaTahun } from './format';

function Jalur({ item }: { item: ItemPengajuan }): React.JSX.Element | null {
  const { colors } = useTheme();
  if (item.status !== 'pending' || !item.step_position) {
    return null;
  }
  const nama = item.waiting?.approver?.name ? namaDepan(item.waiting.approver.name) : (item.waiting?.label ?? 'penyetuju');
  const lama = sejak(item.waiting?.since);
  return (
    <View style={s.jalur}>
      <View style={s.batang}>
        {Array.from({ length: item.step_count }, (_, i) => (
          <View
            key={i}
            style={[
              s.segmen,
              { backgroundColor: i + 1 < (item.step_position ?? 0) ? colors.fill.teal : i + 1 === item.step_position ? colors.fill.warning : colors.surface2 },
            ]}
          />
        ))}
      </View>
      <Text variant="meta" style={{ flex: 1 }}>
        {item.step_position}/{item.step_count} · menunggu {nama}
        {lama ? ` sejak ${lama}` : ''}
      </Text>
    </View>
  );
}

export function KartuPengajuan({ item, onPress, ringkas = false }: { item: ItemPengajuan; onPress?: () => void; ringkas?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const status = META_STATUS[item.status];
  const kategori = META_KATEGORI[item.type.category];
  const durasi = durasiItem(item);
  const catatan = item.decision_note?.note && (item.status === 'rejected' || item.status === 'revision_requested') ? item.decision_note : null;
  const ditolak = item.status === 'rejected';

  let kaki: string;
  if (item.status === 'draft') {
    kaki = `Belum dikirim · disimpan ${jamKantor(item.updated_at)}`;
  } else if (item.status === 'approved') {
    kaki = `Diajukan ${tanggalTanpaTahun(item.submitted_at)}${item.decided_at ? ` · disetujui ${tanggalTanpaTahun(item.decided_at)}` : ''}`;
  } else if (item.status === 'revision_requested') {
    kaki = `Diajukan ${tanggalTanpaTahun(item.submitted_at)} · putaran ${item.round}`;
  } else {
    kaki = `Diajukan ${tanggalTanpaTahun(item.submitted_at ?? item.created_at)}`;
  }

  return (
    <Card onPress={onPress} accessibilityLabel={`${item.number ?? 'Belum bernomor'}, ${item.type.name}, ${status.label}. ${judulPeriode(item)}`} style={{ gap: 10 }}>
      <View style={s.atas}>
        <Text variant="mono" tone={item.number ? 'muted' : 'subtle'} style={{ flex: 1 }} numberOfLines={1}>
          {item.number ?? 'Belum bernomor'}
        </Text>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </View>
      <View style={s.judul}>
        <Tag tone={kategori.tag}>{item.type.category === 'procurement' ? 'Barang' : item.type.name}</Tag>
        <Text variant="title" weight={700} style={{ flexShrink: 1 }}>
          {judulPeriode(item)}
        </Text>
        {durasi ? <Text variant="meta">· {durasi}</Text> : null}
      </View>
      {!ringkas && catatan ? (
        <View style={[s.kutipan, { backgroundColor: ditolak ? colors.dangerSoft : colors.infoSoft }]}>
          <Icon name={ditolak ? 'message-square' : 'undo-2'} size={18} color={ditolak ? colors.danger : colors.info} />
          <Text variant="label" weight={500} style={{ flex: 1, color: ditolak ? colors.danger : colors.info, lineHeight: 21 }}>
            “{catatan.note}”{catatan.by ? ` · ${namaDepan(catatan.by)}${catatan.at ? `, ${tanggalTanpaTahun(catatan.at)}` : ''}` : ''}
          </Text>
        </View>
      ) : null}
      {item.status === 'pending' ? (
        <View style={[s.kaki, { borderTopColor: colors.divider }]}>
          <View style={{ flex: 1 }}>
            <Jalur item={item} />
          </View>
          {!ringkas ? <Text variant="meta">Diajukan {tanggalTanpaTahun(item.submitted_at ?? item.created_at)}</Text> : null}
        </View>
      ) : !ringkas ? (
        <Text variant="meta">{kaki}</Text>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  atas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  judul: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  kutipan: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg },
  kaki: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 10 },
  jalur: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  batang: { flexDirection: 'row', gap: 3 },
  segmen: { width: 18, height: 6, borderRadius: 3 },
});
