/**
 * Detail milestone (mockup 06 › 12-1): status, target, progres tugas terkait
 * (selesai/total), daftar tugas terkait (buka detail tugas), deskripsi; aksi
 * PIC: Ubah · Tandai selesai/Buka kembali · Hapus.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { hariTanggal, LABEL_KATEGORI, LABEL_MILESTONE, nadaMilestone } from '@/features/proyek/format';
import { bukaTugas } from '@/features/proyek/komponen';
import { useAksiMilestone } from '@/features/proyek/useAksiMilestone';
import { useProyek } from '@/features/proyek/useProyek';
import { Badge, Button, Card, EmptyState, ErrorState, ListRow, Loading, Panel, Progress, Screen, SubAppBar, Text, errorKindFromStatus } from '@/ui';

export default function LayarDetailMilestone(): React.JSX.Element {
  const { key: pk, id: pid } = useLocalSearchParams<{ key: string; id: string }>();
  const key = typeof pk === 'string' ? pk : '';
  const id = typeof pid === 'string' ? pid : '';
  const r = useProyek(key);
  const aksi = useAksiMilestone(key, () => void r.muat());
  const d = r.data;
  const m = d?.milestones.find((x) => x.id === id) ?? null;
  const boleh = (d?.can.manage_milestones ?? false) && !r.offline;

  if (!d || !m || aksi.tersembunyi.has(id)) {
    return (
      <Screen header={<SubAppBar title="Milestone" />}>
        {d ? (
          <EmptyState icon="flag" title="Milestone tidak ditemukan" description="Milestone ini mungkin sudah dihapus." actionLabel="Kembali" onAction={() => router.back()} />
        ) : r.galat ? (
          <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} />
        ) : (
          <Loading rows={4} />
        )}
      </Screen>
    );
  }

  const selesai = m.tasks.filter((t) => t.status_category === 'done').length;
  const aktif = m.tasks.filter((t) => t.status_category !== 'canceled').length;
  const pct = aktif > 0 ? Math.round((selesai / aktif) * 100) : 0;

  return (
    <Screen
      header={<SubAppBar title={`Milestone · ${d.project.key}`} />}
      footer={
        boleh ? (
          <>
            <Button title="Ubah" variant="outline" icon="pencil" style={{ flex: 1 }} onPress={() => router.push(`/proyek/${encodeURIComponent(d.project.key)}/milestone/form?id=${m.id}` as never)} />
            <Button title={m.completed_at ? 'Buka kembali' : 'Tandai selesai'} icon={m.completed_at ? 'rotate-ccw' : 'circle-check'} style={{ flex: 1.4 }} onPress={() => void aksi.tandai(m)} />
          </>
        ) : undefined
      }
    >
      <View style={{ gap: 8 }}>
        <Text variant="h2" accessibilityRole="header">
          {m.name}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge tone={nadaMilestone(m.status)} dot>
            {LABEL_MILESTONE[m.status]}
          </Badge>
          <Text variant="meta" style={{ fontSize: 15 }}>{`Target ${hariTanggal(m.target_date)}`}</Text>
          {m.completed_at ? <Text variant="meta" style={{ fontSize: 15 }}>{`· selesai ${hariTanggal(m.completed_at.slice(0, 10))}`}</Text> : null}
        </View>
      </View>
      <Card style={{ gap: 10 }}>
        <Text variant="label">{aktif > 0 ? `Tugas terkait ${selesai} dari ${aktif} selesai` : 'Belum ada tugas terkait'}</Text>
        <Progress value={pct} label={`Tugas terkait selesai ${pct}%`} />
      </Card>
      <Panel title={`Tugas terkait · ${m.tasks.length}`}>
        {m.tasks.length === 0 ? (
          <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
            {boleh ? 'Tautkan tugas lewat Ubah.' : 'Tidak ada tugas terkait.'}
          </Text>
        ) : (
          m.tasks.map((t, i) => (
            <ListRow key={t.id} title={t.title} subtitle={`${t.code} · ${LABEL_KATEGORI[t.status_category] ?? t.status_category}`} onPress={() => bukaTugas(t.id)} divider={i > 0} style={{ paddingHorizontal: 0 }} />
          ))
        )}
      </Panel>
      {m.description ? (
        <Panel title="Deskripsi">
          <Text variant="body">{m.description}</Text>
        </Panel>
      ) : null}
      {boleh ? <Button title="Hapus milestone" variant="danger" icon="trash-2" onPress={() => void aksi.hapus(m, () => router.back())} /> : null}
    </Screen>
  );
}
