/**
 * Dashboard Manajemen (mockup 06 › 16–20; M1–M5, N*): Direksi, HR, Super
 * Admin. Blok dimuat terpisah seperti `Inertia::defer` web (inti dulu, lalu
 * ringkasan/proyek/beban paralel) dengan skeleton & galat per blok. Tab
 * Harian · Mingguan (bawaan) · Bulanan, hero kehadiran + tugas, tile Tepat
 * waktu & Proyek perlu perhatian, grafik rencana vs selesai, tracking proyek,
 * milestone bulan ini, beban kerja, catatan tindakan, jadwal terdekat.
 * Tanpa skor gabungan. Kepala Divisi & staf → 403 terkunci.
 */
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { bebanKerja, manajemen, proyekManajemen, ringkasanManajemen, type BebanKerja, type ManajemenInti, type PeriodeHarian, type PeriodeRata, type ProyekManajemen, type RingkasanManajemen } from '@/api/manajemen';
import { TombolNotulensi } from '@/features/beranda/TombolNotulensi';
import { CatatanTindakanDaftar } from '@/features/manajemen/CatatanTindakan';
import { angka, hariTanggal, labelKesehatan, persen, poin, tglBulan } from '@/features/proyek/format';
import { bukaProyek, GrafikKolom, LencanaKesehatan, PetakAngka } from '@/features/proyek/komponen';
import { bukaDetail } from '@/features/rapat/navigasi';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { PitaOffline } from '@/features/workspace/bagian';
import { useResource, useSegarkanSaatFokus } from '@/features/workspace/useResource';
import { jam } from '@/lib/format';
import { useSession } from '@/session/SessionProvider';
import { Badge, Banner, DesktopOnlyBanner, ErrorState, Hero, ListRow, LockedState, Panel, Progress, Screen, SegmentedTabs, Skeleton, SubAppBar, Text, errorKindFromStatus } from '@/ui';

type Periode = 'harian' | 'mingguan' | 'bulanan';

function GalatBlok({ pesan, onUlang }: { pesan: string; onUlang: () => void }): React.JSX.Element {
  return <Banner tone="bad" icon="circle-alert" message={pesan} actionLabel="Coba lagi" onAction={onUlang} />;
}

export default function LayarManajemen(): React.JSX.Element {
  const { user } = useSession();
  const { kirim, mengirim } = useKirimTautan();
  const [periode, setPeriode] = useState<Periode>('mingguan');
  const [tarikan, setTarikan] = useState(false);
  const inti = useResource<ManajemenInti>('manajemen:inti', useCallback(() => manajemen(), []));
  const terkunci = inti.galat?.status === 403;
  const bolehBlok = inti.data !== null;
  const ring = useResource<RingkasanManajemen>(bolehBlok ? 'manajemen:ringkasan' : null, useCallback(() => ringkasanManajemen(), []));
  const pro = useResource<ProyekManajemen>(bolehBlok ? 'manajemen:proyek' : null, useCallback(() => proyekManajemen(), []));
  const beban = useResource<BebanKerja>(bolehBlok ? 'manajemen:beban' : null, useCallback(() => bebanKerja(), []));
  const muatSemua = useCallback(async () => {
    await Promise.all([inti.muat(), ring.muat(), pro.muat(), beban.muat()]);
  }, [inti, ring, pro, beban]);
  useSegarkanSaatFokus(inti.muat);
  const offline = inti.offline || ring.offline || pro.offline || beban.offline;
  const catatanAktif = user?.features?.notes !== false;

  if (terkunci) {
    return (
      <Screen header={<SubAppBar title="Dashboard Manajemen" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="Dashboard terkunci" reason="Dashboard Manajemen hanya untuk Direksi, HR, dan Super Admin." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  const d = inti.data;
  const r = ring.data;
  const per = r ? (periode === 'harian' ? r.periods.harian : periode === 'mingguan' ? r.periods.mingguan : r.periods.bulanan) : null;

  return (
    <Screen
      header={<SubAppBar title="Dashboard Manajemen" />}
      refreshing={tarikan}
      onRefresh={() => {
        setTarikan(true);
        void muatSemua().finally(() => setTarikan(false));
      }}
    >
      {offline ? <PitaOffline diperbarui={inti.diperbarui} objek="dashboard" /> : null}
      {!d ? (
        inti.galat ? (
          <ErrorState kind={errorKindFromStatus(inti.galat.status)} title="Dashboard gagal dimuat" message={inti.galat.message} onRetry={() => void inti.muat()} />
        ) : (
          <View style={{ gap: 12 }} accessibilityLabel="Memuat dashboard manajemen…">
            <Skeleton height={44} radiusPx={14} />
            <Skeleton height={170} radiusPx={26} />
            <Skeleton height={120} radiusPx={24} />
          </View>
        )
      ) : (
        <>
          <Text variant="overline">{`${d.company} · Manajemen`}</Text>
          {catatanAktif ? <TombolNotulensi /> : null}
          <SegmentedTabs<Periode>
            value={periode}
            onChange={setPeriode}
            options={[
              { value: 'harian', label: 'Harian' },
              { value: 'mingguan', label: 'Mingguan' },
              { value: 'bulanan', label: 'Bulanan' },
            ]}
          />

          {!r ? (
            ring.galat ? (
              <GalatBlok pesan={`Ringkasan gagal dimuat. ${ring.galat.message}`} onUlang={() => void ring.muat()} />
            ) : (
              <View style={{ gap: 12 }} accessibilityLabel="Memuat ringkasan…">
                <Skeleton height={170} radiusPx={26} />
                <Skeleton height={200} radiusPx={24} />
              </View>
            )
          ) : per ? (
            <>
              <Hero style={{ gap: 12 }}>
                <Text variant="meta" tone="onPrimary">{`${hariTanggal(d.today)} · per ${jam(r.generated_at)} · ${per.range.label}`}</Text>
                {periode === 'harian' ? <HeroHarian p={per as PeriodeHarian} /> : <HeroRata p={per as PeriodeRata} periode={periode} />}
              </Hero>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {periode === 'harian' ? (
                  <PetakAngka
                    label="Tugas terlambat"
                    nilai={angka((per as PeriodeHarian).overdue?.count ?? 0)}
                    catatan={(per as PeriodeHarian).overdue?.top_division ? `terbanyak ${(per as PeriodeHarian).overdue?.top_division?.name}` : 'semua divisi'}
                    nada={((per as PeriodeHarian).overdue?.count ?? 0) > 0 ? 'danger' : undefined}
                  />
                ) : (
                  <PetakAngka
                    label="Tepat waktu"
                    nilai={persen((per as PeriodeRata).on_time?.value ?? null)}
                    catatan={(per as PeriodeRata).on_time?.delta !== null && (per as PeriodeRata).on_time ? `${poin((per as PeriodeRata).on_time?.delta)} dari ${(per as PeriodeRata).on_time?.previous_range.label}` : 'belum ada pembanding'}
                  />
                )}
                <PetakAngka
                  label="Proyek perlu perhatian"
                  nilai={pro.data ? angka(pro.data.attention.count) : '…'}
                  catatan={pro.data ? pro.data.attention.items.map((x) => x.key).slice(0, 3).join(' · ') || 'tidak ada' : 'memuat'}
                  nada={pro.data && pro.data.attention.count > 0 ? 'warning' : undefined}
                  onPress={d.can.portfolio ? () => router.push('/portofolio' as never) : undefined}
                />
              </View>
              <Panel title={periode === 'harian' ? 'Kerja hari ini per divisi' : periode === 'mingguan' ? 'Kerja harian minggu lalu' : 'Kerja per minggu'}>
                <GrafikKolom data={per.chart} />
                <Text variant="meta" style={{ fontSize: 14 }}>
                  {per.chart.length ? ringkasGrafik(per.chart) : 'Belum ada tugas bertenggat pada periode ini.'}
                </Text>
              </Panel>
            </>
          ) : null}

          {!pro.data ? (
            pro.galat ? <GalatBlok pesan={`Proyek gagal dimuat. ${pro.galat.message}`} onUlang={() => void pro.muat()} /> : <Skeleton height={180} radiusPx={24} />
          ) : (
            <>
              <Panel title="Tracking per proyek" actionLabel={d.can.portfolio ? 'Portofolio' : undefined} onAction={() => router.push('/portofolio' as never)}>
                {pro.data.projects.length === 0 ? (
                  <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
                    Belum ada proyek aktif.
                  </Text>
                ) : (
                  pro.data.projects.slice(0, 5).map((p, i) => (
                    <ListRow
                      key={p.id}
                      title={p.name}
                      subtitle={
                        <View style={{ gap: 6, paddingTop: 4 }}>
                          <Text variant="meta">{`${p.key}${p.milestone ? ` · ${p.milestone.missed ? 'terlewat' : 'berikutnya'} ${p.milestone.name} ${tglBulan(p.milestone.target_date)}` : ''}`}</Text>
                          <Progress value={p.actual ?? 0} marker={p.planned ?? undefined} label={`${p.name}: ${persen(p.actual)}, rencana ${persen(p.planned)}`} />
                          <Text variant="meta">{`${persen(p.actual)} · rencana ${persen(p.planned)}`}</Text>
                        </View>
                      }
                      trailing={<LencanaKesehatan health={p.health} />}
                      onPress={() => bukaProyek(p.key)}
                      divider={i > 0}
                      accessibilityLabel={`${p.name}, ${labelKesehatan(p.health)}, ${persen(p.actual)}, rencana ${persen(p.planned)}`}
                      style={{ paddingHorizontal: 0 }}
                    />
                  ))
                )}
                {pro.data.total > 5 ? <Text variant="meta">{`${pro.data.total} proyek aktif`}</Text> : null}
              </Panel>
              <Panel title={`Milestone ${pro.data.milestones.month}`}>
                <Text variant="meta">{`${pro.data.milestones.done} dari ${pro.data.milestones.total} selesai`}</Text>
                {pro.data.milestones.items.length === 0 ? (
                  <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
                    Tidak ada milestone bulan ini.
                  </Text>
                ) : (
                  pro.data.milestones.items.slice(0, 6).map((m, i) => (
                    <ListRow
                      key={m.id}
                      title={m.name}
                      subtitle={`${tglBulan(m.target_date)} · ${m.project.key}`}
                      trailing={<Badge tone={m.state === 'done' ? 'success' : m.state === 'missed' ? 'danger' : m.state === 'next' ? 'info' : 'neutral'} dot>{m.state === 'done' ? 'Selesai' : m.state === 'missed' ? 'Terlewat' : m.state === 'next' ? 'Berikutnya' : 'Mendatang'}</Badge>}
                      onPress={() => bukaProyek(m.project.key)}
                      divider={i > 0}
                      style={{ paddingHorizontal: 0 }}
                    />
                  ))
                )}
              </Panel>
            </>
          )}

          {!beban.data ? (
            beban.galat ? <GalatBlok pesan={`Beban kerja gagal dimuat. ${beban.galat.message}`} onUlang={() => void beban.muat()} /> : <Skeleton height={160} radiusPx={24} />
          ) : (
            <Panel title="Beban kerja" actionLabel={beban.data.divisions.length > 0 ? 'Per orang' : undefined} onAction={() => router.push('/manajemen/beban-kerja' as never)}>
              <Text variant="meta">{`${angka(beban.data.total.open)} tugas terbuka · ${angka(beban.data.total.people)} orang · ${angka(beban.data.total.overdue)} terlambat`}</Text>
              {beban.data.divisions.length === 0 ? (
                <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
                  Tidak ada tugas terbuka.
                </Text>
              ) : (
                beban.data.divisions.slice(0, 6).map((v, _i, semua) => {
                  const maks = Math.max(1, ...semua.map((x) => x.open));
                  return (
                    <View key={v.id ?? v.name} style={{ gap: 6 }} accessible accessibilityLabel={`${v.name}: ${v.open} tugas terbuka, ${v.people.length} orang`}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text variant="label">{v.name}</Text>
                        <Text variant="meta">{`${v.open} · ${v.people.length} orang`}</Text>
                      </View>
                      <Progress value={(v.open / maks) * 100} />
                    </View>
                  );
                })
              )}
            </Panel>
          )}

          {d.can.notes ? (
            <Panel title="Catatan tindakan" actionLabel="Semua" onAction={() => router.push('/manajemen/catatan' as never)}>
              <CatatanTindakanDaftar awal={d.notes} batasTerbuka={5} offline={inti.offline} onSemua={() => router.push('/manajemen/catatan' as never)} />
            </Panel>
          ) : null}

          {d.can.schedule ? (
            <Panel title="Jadwal terdekat" actionLabel="Jadwal manajemen" onAction={() => router.push('/manajemen/jadwal' as never)}>
              {d.schedule.length === 0 ? (
                <Text variant="body" tone="muted" style={{ fontSize: 15 }}>
                  Tidak ada rapat pimpinan dalam 14 hari ke depan.
                </Text>
              ) : (
                d.schedule.map((s, i) => (
                  <ListRow
                    key={s.key}
                    icon="calendar-days"
                    iconTone={s.canceled ? 'neutral' : 'teal'}
                    title={s.canceled ? `${s.title} (dibatalkan)` : s.title}
                    subtitle={`${hariTanggal(s.occurrence_date)} · ${jam(s.starts_at)} · ${s.location ?? s.platform_label} · ${s.peserta_count} peserta`}
                    onPress={() => bukaDetail(s.id, s.occurrence_date)}
                    divider={i > 0}
                    style={{ paddingHorizontal: 0 }}
                  />
                ))
              )}
            </Panel>
          ) : null}
          <DesktopOnlyBanner message="Ekspor Excel dashboard tersedia di desktop. Metrik ditampilkan berdampingan tanpa skor gabungan." onSendLink={mengirim ? undefined : () => void kirim('/manajemen')} />
        </>
      )}
    </Screen>
  );
}

function ringkasGrafik(chart: { full_label: string; planned: number; done: number }[]): string {
  const total = chart.reduce((a, c) => ({ p: a.p + c.planned, d: a.d + c.done }), { p: 0, d: 0 });
  const terendah = chart.filter((c) => c.planned > 0).sort((a, b) => a.done / a.planned - b.done / b.planned)[0];
  return `Total ${angka(total.d)} dari ${angka(total.p)} tugas.${terendah ? ` Penyelesaian terendah: ${terendah.full_label} (${terendah.done} dari ${terendah.planned}).` : ''}`;
}

function HeroHarian({ p }: { p: PeriodeHarian }): React.JSX.Element {
  const a = p.attendance;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <View style={{ flex: 1 }} accessible accessibilityLabel={`Hadir hari ini ${a.present} dari ${a.scheduled}`}>
          <Text variant="kpi" tone="onPrimary">{`${a.present}/${a.scheduled}`}</Text>
          <Text variant="meta" tone="onPrimary">{`hadir hari ini · ${a.late} terlambat · ${a.not_checked_in} belum check-in`}</Text>
        </View>
      </View>
      <TugasHero t={p.tasks} label="tugas hari ini selesai" />
    </View>
  );
}

function HeroRata({ p, periode }: { p: PeriodeRata; periode: Periode }): React.JSX.Element {
  return (
    <View style={{ gap: 12 }}>
      <View accessible accessibilityLabel={`Kehadiran rata-rata ${persen(p.attendance.rate)}`}>
        <Text variant="kpi" tone="onPrimary">
          {persen(p.attendance.rate)}
        </Text>
        <Text variant="meta" tone="onPrimary">{`kehadiran rata-rata · ${angka(p.attendance.attended)} dari ${angka(p.attendance.scheduled)} hari-orang`}</Text>
      </View>
      <TugasHero t={p.tasks} label={periode === 'mingguan' ? 'tugas minggu lalu selesai' : 'tugas 4 minggu selesai'} />
    </View>
  );
}

function TugasHero({ t, label }: { t: { done: number; planned: number; rate: number | null }; label: string }): React.JSX.Element {
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${t.done} dari ${t.planned} ${label}`}>
      <Text variant="h3" tone="onPrimary">{`${angka(t.done)}/${angka(t.planned)}`}</Text>
      <Text variant="meta" tone="onPrimary">{`${label}${t.rate !== null ? ` · ${persen(t.rate)}` : ''}`}</Text>
      <Progress value={t.rate ?? 0} />
    </View>
  );
}
