/**
 * OKR divisi (mockup 06 › 21–22, 27; O1): tab kuartal, chip divisi, hari ke-N
 * dari kuartal, KPI (progres rata-rata vs diharapkan, jumlah per status),
 * kartu objective bercincin dikelompokkan per divisi, FAB "Objective baru"
 * (Kadiv divisinya, Direksi semua). Fitur mati / tanpa akses = 404.
 */
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { daftarOkr, type DaftarOkr, type Objective } from '@/api/okr';
import { labelKuartal, pecahanPersen } from '@/features/okr/format';
import { KartuObjective } from '@/features/okr/komponen';
import { PetakAngka } from '@/features/proyek/komponen';
import { useTarik } from '@/features/proyek/useTarik';
import { PitaOffline } from '@/features/workspace/bagian';
import { useResource, useSegarkanSaatFokus } from '@/features/workspace/useResource';
import { Card, Chip, ChipScroller, EmptyState, ErrorState, Fab, LockedState, Progress, Screen, SegmentedTabs, Skeleton, SubAppBar, Text, errorKindFromStatus } from '@/ui';

export default function LayarOkr(): React.JSX.Element {
  const [kuartal, setKuartal] = useState<string | undefined>(undefined);
  const [divisi, setDivisi] = useState<string | null>(null);
  const ambil = useCallback(() => daftarOkr(kuartal, divisi), [kuartal, divisi]);
  const r = useResource<DaftarOkr>(`okr:${kuartal ?? 'kini'}:${divisi ?? 'semua'}`, ambil);
  useSegarkanSaatFokus(r.muat);
  const { menarik, tarik } = useTarik(r.muat);
  const d = r.data;

  const kelompok = useMemo(() => {
    const peta = new Map<string, { nama: string; daftar: Objective[] }>();
    for (const o of d?.objectives ?? []) {
      const k = o.division.id;
      if (!peta.has(k)) peta.set(k, { nama: o.division.name, daftar: [] });
      peta.get(k)?.daftar.push(o);
    }
    return [...peta.values()];
  }, [d]);

  if (r.galat?.status === 404 && !d) {
    return (
      <Screen header={<SubAppBar title="OKR divisi" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="OKR belum tersedia" reason="Fitur OKR belum diaktifkan untuk perusahaan ini." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen header={<SubAppBar title="OKR divisi" />} refreshing={menarik} onRefresh={tarik} contentStyle={{ paddingBottom: 120 }}>
        {r.offline ? <PitaOffline diperbarui={r.diperbarui} objek="OKR" /> : null}
        {!d ? (
          r.galat ? (
            <ErrorState kind={errorKindFromStatus(r.galat.status)} title="OKR gagal dimuat" message={r.galat.message} onRetry={() => void r.muat()} />
          ) : (
            <View style={{ gap: 12 }} accessibilityLabel="Memuat OKR…">
              <Skeleton height={44} radiusPx={14} />
              <Skeleton height={110} radiusPx={20} />
              <Skeleton height={150} radiusPx={24} />
              <Skeleton height={150} radiusPx={24} />
            </View>
          )
        ) : (
          <>
            {d.quarters.length > 1 ? (
              <SegmentedTabs<string>
                value={d.filters.quarter}
                onChange={(q) => setKuartal(q)}
                options={[...d.quarters].reverse().map((q) => ({ value: q, label: labelKuartal(q).split(' ')[0] ?? q }))}
              />
            ) : null}
            {d.divisions.length > 1 ? (
              <View style={{ marginHorizontal: -16 }}>
                <ChipScroller>
                  <Chip label="Semua divisi" selected={d.filters.division === 'all'} onPress={() => setDivisi(null)} />
                  {d.divisions.map((v) => (
                    <Chip key={v.id} label={v.name} selected={d.filters.division === v.id} onPress={() => setDivisi(v.id)} />
                  ))}
                </ChipScroller>
              </View>
            ) : null}
            <Card variant="tight" style={{ gap: 8 }}>
              <Text variant="label">{`${d.quarter.label} · hari ke-${d.quarter.day} dari ${d.quarter.days}`}</Text>
              <Progress value={d.quarter.elapsed * 100} label={`${pecahanPersen(d.quarter.elapsed)} kuartal berlalu`} />
              <Text variant="meta">{`${pecahanPersen(d.quarter.elapsed)} kuartal berlalu · minggu ${d.quarter.week} dari ${d.quarter.weeks}`}</Text>
            </Card>
            {d.kpis.count > 0 ? (
              <>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <PetakAngka label="Progres rata-rata" nilai={pecahanPersen(d.kpis.average)} catatan={`diharapkan ${pecahanPersen(d.kpis.expected)}`} />
                  <PetakAngka label="Objective" nilai={String(d.kpis.count)} catatan={labelKuartal(d.filters.quarter)} />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <PetakAngka label="Sesuai jalur" nilai={String(d.kpis.on_track)} nada="success" />
                  <PetakAngka label="Berisiko" nilai={String(d.kpis.at_risk)} nada={d.kpis.at_risk > 0 ? 'warning' : undefined} />
                  <PetakAngka label="Tertinggal" nilai={String(d.kpis.behind)} nada={d.kpis.behind > 0 ? 'danger' : undefined} />
                </View>
              </>
            ) : null}
            {d.objectives.length === 0 ? (
              <EmptyState
                icon="target"
                title={`Belum ada objective ${labelKuartal(d.filters.quarter)}`}
                description={d.can.create ? 'Buat objective divisi lalu tambahkan key result-nya.' : 'Objective divisi Anda akan tampil di sini setelah dibuat Kepala Divisi.'}
                actionLabel={d.can.create && !r.offline ? 'Objective baru' : undefined}
                onAction={() => router.push(`/okr/form?kuartal=${d.filters.quarter}` as never)}
              />
            ) : (
              kelompok.map((g) => (
                <View key={g.nama} style={{ gap: 12 }}>
                  <Text variant="h3" accessibilityRole="header">
                    {g.nama}
                  </Text>
                  {g.daftar.map((o) => (
                    <KartuObjective key={o.id} o={o} />
                  ))}
                </View>
              ))
            )}
          </>
        )}
      </Screen>
      {d?.can.create && !r.offline ? <Fab label="Objective baru" extended onPress={() => router.push(`/okr/form?kuartal=${d.filters.quarter}` as never)} style={{ position: 'absolute', right: 16, bottom: 32 }} /> : null}
    </View>
  );
}
