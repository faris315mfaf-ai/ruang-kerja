/**
 * Tugas terlambat & tim (mockup 06 › 14): tab Tugas terlambat (tenggat, PIC
 * tugas, buka detail tugas) dan Tim & beban (tugas terbuka per orang — web
 * tidak menghitung jam di sini), kosong "tidak ada yang terlambat".
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { hariTanggal, nomorHari } from '@/features/proyek/format';
import { bukaTugas } from '@/features/proyek/komponen';
import { useProyek } from '@/features/proyek/useProyek';
import { useTarik } from '@/features/proyek/useTarik';
import { PitaOffline } from '@/features/workspace/bagian';
import { Avatar, Card, EmptyState, ErrorState, ListRow, Loading, Progress, Screen, SegmentedTabs, SubAppBar, Text, errorKindFromStatus } from '@/ui';

type Tab = 'terlambat' | 'tim';

export default function LayarTugasTim(): React.JSX.Element {
  const { key: pk, tab: pt } = useLocalSearchParams<{ key: string; tab?: string }>();
  const key = typeof pk === 'string' ? pk : '';
  const r = useProyek(key);
  const { menarik, tarik } = useTarik(r.muat);
  const [tab, setTab] = useState<Tab>(pt === 'tim' ? 'tim' : 'terlambat');
  const d = r.data;
  const maks = Math.max(1, ...(d?.team_load.members.map((m) => m.open) ?? [1]));
  const hari = nomorHari(d?.today) ?? 0;

  return (
    <Screen header={<SubAppBar title={`Tugas & tim${d ? ` · ${d.project.key}` : ''}`} />} refreshing={menarik} onRefresh={tarik}>
      {r.offline ? <PitaOffline diperbarui={r.diperbarui} objek="data tim" /> : null}
      {!d ? (
        r.galat ? <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} /> : <Loading rows={5} />
      ) : (
        <>
          <SegmentedTabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'terlambat', label: 'Tugas terlambat', badge: d.overdue_tasks.length },
              { value: 'tim', label: 'Tim & beban', badge: d.team_load.members.length },
            ]}
          />
          {tab === 'terlambat' ? (
            d.overdue_tasks.length === 0 ? (
              <EmptyState icon="circle-check" title="Tidak ada tugas terlambat" description="Semua tugas proyek ini masih dalam tenggat." />
            ) : (
              <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
                {d.overdue_tasks.map((t, i) => {
                  const lewat = hari - (nomorHari(t.due_date) ?? hari);
                  return (
                    <ListRow
                      key={t.id}
                      title={t.title}
                      subtitle={`${t.code} · tenggat ${hariTanggal(t.due_date)} · lewat ${lewat} hari`}
                      trailing={t.assignee ? <Avatar name={t.assignee.name} size="sm" /> : <Text variant="meta">Tanpa PIC</Text>}
                      onPress={() => bukaTugas(t.id)}
                      divider={i > 0}
                      accessibilityLabel={`${t.title}, ${t.code}, lewat ${lewat} hari${t.assignee ? `, ${t.assignee.name}` : ''}`}
                    />
                  );
                })}
              </Card>
            )
          ) : d.team_load.members.length === 0 ? (
            <EmptyState icon="users" title="Belum ada tugas terbuka yang ditugaskan" />
          ) : (
            <>
              <Text variant="meta" style={{ fontSize: 15 }}>{`${d.team_load.open_total} tugas terbuka${d.team_load.idle > 0 ? ` · ${d.team_load.idle} anggota tanpa tugas terbuka` : ''}`}</Text>
              <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
                {d.team_load.members.map((m, i) => (
                  <ListRow
                    key={m.person.id}
                    leading={<Avatar name={m.person.name} />}
                    title={m.person.name}
                    subtitle={
                      <View style={{ paddingTop: 6 }}>
                        <Progress value={(m.open / maks) * 100} label={`${m.open} tugas terbuka`} />
                      </View>
                    }
                    trailing={<Text variant="label">{`${m.open}`}</Text>}
                    divider={i > 0}
                  />
                ))}
              </Card>
              <Text variant="meta">Jumlah tugas terbuka per orang di proyek ini, tanpa peringkat atau skor.</Text>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
