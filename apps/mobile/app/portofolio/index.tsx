/**
 * Portofolio proyek (mockup 06 › 01–04, `GET /portofolio`): Direksi/Super
 * Admin (mode `direksi`: chip status, kehadiran, KPI, "Butuh keputusan Anda"
 * dengan Diskusikan · Tandai selesai · Minta update, kartu proyek, update
 * terbaru PIC) dan Kepala Divisi (mode `divisi` = "Proyek divisi", baca saja).
 * Filter periode/divisi/arsip di sheet. HR & staf → 403 terkunci. Roadmap &
 * ekspor = desktop (banner + kirim tautan).
 */
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { portofolio, type FilterPortofolio, type Kesehatan, type PeriodePortofolio, type Portofolio } from '@/api/proyek';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { useAksiDireksi } from '@/features/proyek/AksiDireksi';
import { hariLalu, hariTanggal, labelKesehatan, persen, poin, tglBulan } from '@/features/proyek/format';
import { bukaProyek, KartuProyek, LencanaKesehatan, PetakAngka } from '@/features/proyek/komponen';
import { useTarik } from '@/features/proyek/useTarik';
import { PitaOffline } from '@/features/workspace/bagian';
import { useResource, useSegarkanSaatFokus } from '@/features/workspace/useResource';
import { waktuRelatif } from '@/lib/format';
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  Chip,
  ChipScroller,
  DesktopOnlyBanner,
  EmptyState,
  ErrorState,
  Icon,
  ListRow,
  LockedState,
  Panel,
  Radio,
  Screen,
  Skeleton,
  SubAppBar,
  Switch,
  Text,
  errorKindFromStatus,
} from '@/ui';
import { useTheme } from '@/theme';

const PERIODE: { value: PeriodePortofolio; label: string }[] = [
  { value: 'kuartal', label: 'Kuartal ini' },
  { value: 'bulan', label: 'Bulan ini' },
  { value: 'semua', label: 'Semua periode' },
];

export default function LayarPortofolio(): React.JSX.Element {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<FilterPortofolio>({ periode: 'kuartal', divisi: null, status: null, arsip: false });
  const [sheet, setSheet] = useState(false);
  const [draf, setDraf] = useState<FilterPortofolio>(filter);
  const kunci = `portofolio:${filter.periode}:${filter.divisi ?? ''}:${filter.status ?? ''}:${filter.arsip ? 1 : 0}`;
  const ambil = useCallback(() => portofolio(filter), [filter]);
  const r = useResource<Portofolio>(kunci, ambil);
  useSegarkanSaatFokus(r.muat);
  const { menarik, tarik } = useTarik(r.muat);
  const aksi = useAksiDireksi(() => void r.muat());
  const { kirim, mengirim } = useKirimTautan();
  const d = r.data;
  const divisiMode = d?.mode === 'divisi';
  const judul = divisiMode ? 'Proyek divisi' : 'Portofolio proyek';
  const bolehAksi = (d?.can.steer ?? false) && !r.offline;

  const header = (
    <SubAppBar
      title={judul}
      actions={d ? [{ icon: 'sliders-horizontal', label: 'Filter portofolio', onPress: () => { setDraf(filter); setSheet(true); } }] : []}
    />
  );

  if (r.galat?.status === 403 && !d) {
    return (
      <Screen header={<SubAppBar title="Portofolio proyek" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="Portofolio terkunci" reason="Portofolio proyek hanya untuk Direksi, Super Admin, dan Kepala Divisi (proyek divisinya)." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  const setStatus = (s: Kesehatan | null): void => setFilter((f) => ({ ...f, status: s }));
  const adaFilter = filter.status !== null || filter.divisi !== null || filter.arsip === true || filter.periode !== 'kuartal';
  const h = d?.kpis.active.health;

  return (
    <Screen header={header} refreshing={menarik} onRefresh={tarik}>
      {r.offline ? <PitaOffline diperbarui={r.diperbarui} objek="portofolio" /> : null}
      {!d && r.memuat ? (
        <View style={{ gap: 12 }} accessibilityLabel="Memuat portofolio…">
          <Skeleton height={42} radiusPx={21} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton height={96} radiusPx={20} style={{ flex: 1 }} />
            <Skeleton height={96} radiusPx={20} style={{ flex: 1 }} />
          </View>
          <Skeleton height={180} radiusPx={24} />
          <Skeleton height={180} radiusPx={24} />
        </View>
      ) : !d && r.galat ? (
        <ErrorState kind={errorKindFromStatus(r.galat.status)} title="Portofolio gagal dimuat" message={r.galat.message} onRetry={() => void r.muat()} />
      ) : d ? (
        <>
          <Text variant="meta" style={{ fontSize: 15 }}>
            {`${d.kpis.active.count} proyek aktif · ${d.period_label} · per ${hariTanggal(d.as_of)}`}
          </Text>
          {!filter.arsip ? (
            <View style={{ marginHorizontal: -16 }}>
              <ChipScroller>
                <Chip label="Semua" count={d.kpis.active.count} selected={filter.status === null} onPress={() => setStatus(null)} />
                <Chip label="Bermasalah" count={h?.off_track} selected={filter.status === 'off_track'} onPress={() => setStatus('off_track')} />
                <Chip label="Berisiko" count={h?.at_risk} selected={filter.status === 'at_risk'} onPress={() => setStatus('at_risk')} />
                <Chip label="Sesuai jalur" count={h?.on_track} selected={filter.status === 'on_track'} onPress={() => setStatus('on_track')} />
              </ChipScroller>
            </View>
          ) : (
            <Chip label="Arsip: selesai & batal" selected onDismiss={() => setFilter((f) => ({ ...f, arsip: false }))} />
          )}

          {d.attendance ? (
            <Card variant="tight" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityLabel={`Hadir hari ini ${d.attendance.present} dari ${d.attendance.total}`}>
              <Icon name="clipboard-check" size={22} color={colors.success} />
              <Text variant="body" style={{ flex: 1, fontSize: 15 }}>
                {`Hadir hari ini ${d.attendance.present}/${d.attendance.total} · ${d.attendance.not_checked_in} belum check-in${d.attendance.on_leave > 0 ? ` · ${d.attendance.on_leave} cuti` : ''}`}
              </Text>
            </Card>
          ) : null}

          {!filter.arsip ? (
            <>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <PetakAngka
                  label={divisiMode ? 'Butuh keputusan' : 'Butuh keputusan Anda'}
                  nilai={String(d.kpis.decisions.count)}
                  catatan={[...new Set(d.decisions.map((x) => x.project.key))].join(' · ') || 'tidak ada'}
                  nada={d.kpis.decisions.count > 0 ? 'warning' : undefined}
                />
                <PetakAngka
                  label="Milestone 2 minggu"
                  nilai={String(d.kpis.upcoming_milestones.count)}
                  catatan={d.kpis.upcoming_milestones.items[0] ? `terdekat ${hariTanggal(d.kpis.upcoming_milestones.items[0].target_date)}` : 'tidak ada'}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <PetakAngka
                  label="Milestone terlewat"
                  nilai={String(d.kpis.missed_milestones.count)}
                  catatan={[...new Set(d.kpis.missed_milestones.items.map((x) => x.key))].join(' · ') || 'tidak ada'}
                  nada={d.kpis.missed_milestones.count > 0 ? 'danger' : undefined}
                />
                <PetakAngka
                  label="Tugas terlambat"
                  nilai={String(d.kpis.overdue_tasks.count)}
                  catatan={`di ${d.kpis.overdue_tasks.projects} proyek`}
                  nada={d.kpis.overdue_tasks.count > 0 ? 'danger' : undefined}
                />
              </View>
            </>
          ) : null}

          {!filter.arsip && (d.decisions.length > 0 || d.attention.length > 0) ? (
            <Panel title={divisiMode ? 'Perlu perhatian' : 'Butuh keputusan Anda'}>
              <Text variant="meta" style={{ fontSize: 14 }}>
                {`${d.decisions.length} keputusan · ${d.attention.length} perhatian`}
              </Text>
              {d.decisions.map((k) => (
                <View key={k.id} style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
                  <Text variant="meta" style={{ fontSize: 14 }}>
                    {`${k.project.key} · Diminta ${k.author?.name ?? 'PIC'} · update ${hariTanggal(k.created_at.slice(0, 10))}`}
                  </Text>
                  <Text variant="title">{k.decision}</Text>
                  {bolehAksi ? (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Button
                        title="Diskusikan"
                        variant="outline"
                        size="sm"
                        icon="message-circle"
                        style={{ flex: 1 }}
                        onPress={() => aksi.beriArahan({ key: k.project.key, nama: k.project.name, pic: k.author?.name ?? null, updateId: k.id, kutipan: k.decision })}
                      />
                      {k.can_resolve ? (
                        <Button title="Tandai selesai" size="sm" icon="check" style={{ flex: 1 }} onPress={() => void aksi.tandaiSelesai({ key: k.project.key, updateId: k.id, keputusan: k.decision })} />
                      ) : null}
                    </View>
                  ) : (
                    <Button title="Buka proyek" variant="quiet" size="sm" onPress={() => bukaProyek(k.project.key)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
                  )}
                </View>
              ))}
              {d.attention.map((a) => (
                <View key={a.project.id} style={{ gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.divider }}>
                  <Text variant="meta" style={{ fontSize: 14 }}>
                    {`${a.project.key} · Perhatian · PIC ${a.lead?.name ?? '—'}${a.is_sponsor ? ' · Anda sponsor' : ''}`}
                  </Text>
                  <Text variant="title">
                    {[
                      a.health ? labelKesehatan(a.health) : null,
                      a.metrics.variance !== null && a.metrics.variance < 0 ? `tertinggal ${poin(a.metrics.variance).replace('−', '')}` : null,
                      a.metrics.flags.includes('stale_update') ? `belum ada update ${hariLalu(a.metrics.update_age_days)}` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                  {bolehAksi ? (
                    <Button
                      title="Minta update"
                      variant="tonal"
                      size="sm"
                      icon="bell-ring"
                      style={{ alignSelf: 'flex-start' }}
                      onPress={() => aksi.mintaUpdate({ key: a.project.key, nama: a.project.name, pic: a.lead?.name ?? null })}
                    />
                  ) : (
                    <Button title="Buka proyek" variant="quiet" size="sm" onPress={() => bukaProyek(a.project.key)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
                  )}
                </View>
              ))}
            </Panel>
          ) : null}

          <View style={{ gap: 4 }}>
            <Text variant="h3" accessibilityRole="header">
              {filter.arsip ? `Proyek selesai & batal · ${d.projects.length}` : `Proyek aktif · ${d.projects.length}`}
            </Text>
            {!filter.arsip ? <Text variant="meta">Cincin: progres aktual, garis = rencana per hari ini</Text> : null}
          </View>
          {d.projects.length === 0 ? (
            adaFilter ? (
              <EmptyState
                icon="filter-x"
                title="Tidak ada proyek dengan filter ini"
                description="Ubah status, periode, atau divisi."
                actionLabel="Hapus filter"
                onAction={() => setFilter({ periode: 'kuartal', divisi: null, status: null, arsip: false })}
              />
            ) : (
              <>
                <EmptyState icon="briefcase-business" title={divisiMode ? 'Belum ada proyek yang melibatkan divisi Anda' : 'Belum ada proyek'} description="Proyek dibuat dari workspace bertipe proyek." />
                {!divisiMode ? <DesktopOnlyBanner message="Membuat proyek tersedia di desktop." onSendLink={mengirim ? undefined : () => void kirim('/portofolio')} /> : null}
              </>
            )
          ) : (
            d.projects.map((p) => <KartuProyek key={p.id} p={p} />)
          )}

          {!filter.arsip && d.completed.length > 0 ? (
            <Panel title="Selesai baru-baru ini">
              {d.completed.map((c, i) => (
                <ListRow
                  key={c.id}
                  icon="circle-check"
                  iconTone="ok"
                  title={c.name}
                  subtitle={`${c.key} · selesai ${tglBulan(c.completed_at.slice(0, 10))} · ${c.quarter}`}
                  onPress={() => bukaProyek(c.key)}
                  divider={i > 0}
                  style={{ paddingHorizontal: 0 }}
                />
              ))}
            </Panel>
          ) : null}

          {!filter.arsip && d.feed.length > 0 ? (
            <Panel title="Update terbaru dari PIC">
              {d.feed.map((f, i) => (
                <ListRow
                  key={f.id}
                  leading={<Avatar name={f.author?.name ?? f.project.key} />}
                  title={`${f.author?.name ?? 'PIC'} · ${f.project.key}`}
                  subtitle={`${waktuRelatif(f.created_at)} · ${f.summary}`}
                  trailing={<LencanaKesehatan health={f.health} />}
                  onPress={() => bukaProyek(f.project.key)}
                  divider={i > 0}
                  style={{ paddingHorizontal: 0 }}
                  accessibilityLabel={`${f.author?.name ?? 'PIC'}, ${f.project.name}, ${labelKesehatan(f.health)}: ${f.summary}`}
                />
              ))}
            </Panel>
          ) : null}

          <DesktopOnlyBanner message="Roadmap lintas proyek dan ekspor Excel tersedia di desktop." onSendLink={mengirim ? undefined : () => void kirim('/portofolio')} />
          {d.projects.length > 0 ? (
            <Text variant="meta" style={{ fontSize: 14 }}>{`Rata-rata progres ${persen(d.projects.reduce((a, p) => a + (p.metrics.actual ?? 0), 0) / d.projects.length)} · status kesehatan ditetapkan PIC.`}</Text>
          ) : null}
        </>
      ) : null}

      {aksi.elemen}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Filter portofolio" showClose scrollable>
        {d ? (
          <View style={{ gap: 16 }}>
            <Text variant="label">Periode</Text>
            <View style={{ gap: 4 }} accessibilityRole="radiogroup">
              {PERIODE.map((p) => (
                <Radio key={p.value} label={p.label} selected={(draf.periode ?? 'kuartal') === p.value} onSelect={() => setDraf((x) => ({ ...x, periode: p.value }))} />
              ))}
            </View>
            {d.division_options.length > 0 ? (
              <>
                <Text variant="label">Divisi utama</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Chip label="Semua divisi" variant="tonal" selected={!draf.divisi} onPress={() => setDraf((x) => ({ ...x, divisi: null }))} />
                  {d.division_options.map((o) => (
                    <Chip key={o.value} label={o.label} variant="tonal" selected={draf.divisi === o.value} onPress={() => setDraf((x) => ({ ...x, divisi: o.value }))} />
                  ))}
                </View>
              </>
            ) : null}
            <Switch label="Tampilkan arsip (selesai & batal)" value={draf.arsip === true} onValueChange={(v) => setDraf((x) => ({ ...x, arsip: v }))} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title="Atur ulang"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setDraf({ periode: 'kuartal', divisi: null, status: filter.status, arsip: false })}
              />
              <Button
                title="Terapkan"
                style={{ flex: 1.4 }}
                onPress={() => {
                  setFilter({ ...draf, status: draf.arsip ? null : filter.status });
                  setSheet(false);
                }}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
