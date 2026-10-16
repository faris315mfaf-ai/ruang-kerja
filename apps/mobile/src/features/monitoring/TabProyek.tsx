/**
 * Monitoring Direksi · Proyek & akses cepat (mockup 06 › 37, 39-7; D3, D4):
 * tracking per proyek (status PIC + penanda, laporan & orang minggu ini) dan
 * akses cepat workspace tim/divisi/proyek (cari, chip jenis, "Lihat saja").
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { aksesWorkspace, monitorProyek, type AksesWorkspace, type JenisWorkspace, type MonitorProyek } from '@/api/manajemen';
import { angka } from '@/features/proyek/format';
import { bukaProyek, KartuProyek, LencanaKesehatan } from '@/features/proyek/komponen';
import { PitaOffline, UbinWorkspace } from '@/features/workspace/bagian';
import { useResource } from '@/features/workspace/useResource';
import { Badge, Button, Chip, ChipScroller, EmptyState, ErrorState, ListRow, Loading, Panel, SearchInput, Skeleton, Text, errorKindFromStatus } from '@/ui';

export function TabProyek({ registrasiMuat }: { registrasiMuat: (fn: (() => Promise<void>) | null) => void }): React.JSX.Element {
  const r = useResource<MonitorProyek>('mon-proyek', useCallback(() => monitorProyek(), []));
  const [q, setQ] = useState('');
  const [kata, setKata] = useState('');
  const [jenis, setJenis] = useState<JenisWorkspace | null>(null);
  const ws = useResource<AksesWorkspace>(`mon-ws:${kata}:${jenis ?? ''}`, useCallback(() => aksesWorkspace(kata, jenis), [kata, jenis]));
  const muatR = r.muat;
  const muatWs = ws.muat;
  useEffect(() => {
    registrasiMuat(async () => {
      await Promise.all([muatR(), muatWs()]);
    });
    return () => registrasiMuat(null);
  }, [registrasiMuat, muatR, muatWs]);
  useEffect(() => {
    const t = setTimeout(() => setKata(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const d = r.data;
  return (
    <View style={{ gap: 16 }}>
      {r.offline ? <PitaOffline diperbarui={r.diperbarui} objek="monitoring" /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="h3" accessibilityRole="header" style={{ flex: 1 }}>
          {`Tracking per proyek${d ? ` · ${d.projects.total}` : ''}`}
        </Text>
        <Button title="Portofolio" variant="quiet" size="sm" onPress={() => router.push('/portofolio' as never)} />
      </View>
      {!d ? (
        r.galat ? (
          <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} />
        ) : (
          <View style={{ gap: 12 }}>
            <Skeleton height={180} radiusPx={24} />
            <Skeleton height={180} radiusPx={24} />
          </View>
        )
      ) : d.projects.projects.length === 0 ? (
        <EmptyState icon="briefcase-business" title="Belum ada proyek aktif" description="Proyek dibuat dari workspace bertipe proyek (desktop)." />
      ) : (
        d.projects.projects.map((p) => (
          <KartuProyek
            key={p.id}
            p={p}
            ekstra={<Text variant="meta" style={{ fontSize: 14 }}>{`Minggu ini: ${p.week.reports} laporan · ${p.week.people} orang · ${p.week.tasks} tugas${p.week.hours !== null ? ` · ${angka(p.week.hours, 1)} jam` : ''}`}</Text>}
          />
        ))
      )}

      <Panel title="Akses cepat workspace">
        <SearchInput value={q} onChangeText={setQ} placeholder="Cari nama atau key workspace" />
        <View style={{ marginHorizontal: -16 }}>
          <ChipScroller>
            <Chip label="Semua" selected={jenis === null} onPress={() => setJenis(null)} />
            <Chip label="Proyek" selected={jenis === 'project'} onPress={() => setJenis('project')} />
            <Chip label="Divisi" selected={jenis === 'division'} onPress={() => setJenis('division')} />
            <Chip label="Tim" selected={jenis === 'team'} onPress={() => setJenis('team')} />
          </ChipScroller>
        </View>
        {!ws.data ? (
          ws.galat ? <ErrorState kind={errorKindFromStatus(ws.galat.status)} message={ws.galat.message} onRetry={() => void ws.muat()} /> : <Loading rows={3} />
        ) : ws.data.workspaces.length === 0 ? (
          <EmptyState variant="plain" icon="search-x" title="Tidak ada workspace yang cocok" />
        ) : (
          ws.data.workspaces.map((w, i) => (
            <ListRow
              key={w.id}
              leading={<UbinWorkspace nama={w.name} warna={w.color} tipe={w.type} ukuran={40} />}
              title={w.name}
              subtitle={`${w.key} · ${w.type_label} · ${w.members_count} anggota · ${w.open_tasks_count} tugas terbuka`}
              trailing={w.type === 'project' && w.health ? <LencanaKesehatan health={w.health} /> : w.view_only ? <Badge tone="neutral">Lihat saja</Badge> : undefined}
              onPress={() => (w.type === 'project' ? bukaProyek(w.key) : router.push(`/workspace/${encodeURIComponent(w.key)}` as never))}
              divider={i > 0}
              accessibilityLabel={`${w.name}, ${w.type_label}${w.view_only ? ', lihat saja' : ''}`}
              style={{ paddingHorizontal: 0 }}
            />
          ))
        )}
      </Panel>
    </View>
  );
}
