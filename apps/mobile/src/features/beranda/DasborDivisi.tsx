/**
 * Dashboard Kepala Divisi (spec 02, `13`/`14`): kehadiran hari ini, KPI,
 * antrean persetujuan, tren 8 minggu, laporan tim, beban kerja, tugas
 * terlambat, proyek berisiko. Dimuat dua tahap (Inertia deferred): bagian
 * "langsung" (kehadiran, persetujuan, laporan) lalu "metrik" (cache 5 menit).
 * Periode hanya memuat ulang metrik. Ekspor Excel/PDF = desktop.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { dasborDivisi, type DasborDivisi as DataDivisi, type MetrikDivisi } from '@/api/beranda';
import { jam, waktuRelatif } from '@/lib/format';
import { useKirimTautan } from '@/features/settings/useKirimTautan';
import { useTheme } from '@/theme';
import { Avatar, Badge, Button, Card, DesktopOnlyBanner, EmptyState, ErrorState, Hero, Icon, ListRow, Loading, Panel, Progress, Segmented, Skeleton, Tag, Text, errorKindFromStatus, type Tone } from '@/ui';

import { Batang, BarisFilter, BarisOrangHadir, BilahKehadiran, PetakKpi, awayTotal, hadirTotal } from './bagianDasbor';
import { angka, persen, teksDelta } from './format';
import { bukaLaporanTim, bukaPersetujuan } from './nav';
import { PitaGagalSegar, PitaOffline } from './Pita';
import { useMuat, type HasilMuat } from './useMuat';

type Periode = 'minggu' | 'bulan' | 'kuartal';
const PERIODE_OPSI: { value: Periode; label: string }[] = [
  { value: 'minggu', label: 'Minggu ini' },
  { value: 'bulan', label: 'Bulan ini' },
  { value: 'kuartal', label: 'Kuartal ini' },
];

export interface DasborProps {
  /** Judul/subjudul + pemilih + spanduk dari induk (di atas isi). */
  kepala: (info: { judul: string; subjudul?: string }) => React.ReactNode;
  /** Induk memakai ini untuk tarik-untuk-segarkan. */
  registrasiMuat: (fn: (() => Promise<void>) | null) => void;
}

export function DasborDivisi({ kepala, registrasiMuat }: DasborProps): React.JSX.Element {
  const [periode, setPeriode] = useState<Periode>('minggu');
  const [divisi, setDivisi] = useState<string | null>(null);
  const [tim, setTim] = useState<string | null>(null);

  const ambilLangsung = useCallback(() => dasborDivisi('langsung', { divisi, tim }), [divisi, tim]);
  const ambilMetrik = useCallback(() => dasborDivisi('metrik', { periode, divisi, tim }), [periode, divisi, tim]);
  const langsung = useMuat<DataDivisi>(ambilLangsung);
  const metrik = useMuat<DataDivisi>(ambilMetrik);
  const { kirim, mengirim } = useKirimTautan();

  const { muat: muatLangsung } = langsung;
  const { muat: muatMetrik } = metrik;
  useEffect(() => {
    registrasiMuat(async () => {
      await Promise.all([muatLangsung(true), muatMetrik(true)]);
    });
    return () => registrasiMuat(null);
  }, [registrasiMuat, muatLangsung, muatMetrik]);

  const d = langsung.data;
  const kepalaNode = kepala({
    judul: d?.scope.label ?? 'Dashboard divisi',
    subjudul: d ? `${d.scope.member_count} anggota` : undefined,
  });

  if (d === null) {
    return (
      <View style={{ gap: 16 }}>
        {kepalaNode}
        {langsung.galat !== null && !langsung.memuat ? (
          <ErrorState
            kind={errorKindFromStatus(langsung.galat.status)}
            title={langsung.galat.status === 403 || langsung.galat.status === 404 ? 'Tidak ada akses' : 'Dashboard gagal dimuat'}
            message={langsung.galat.status === 403 || langsung.galat.status === 404 ? langsung.galat.message : 'Data divisi tidak bisa diambil. Periksa koneksi lalu coba lagi.'}
            onRetry={() => void langsung.muat()}
          />
        ) : (
          <View style={{ gap: 12 }} accessibilityLabel="Memuat dashboard divisi…">
            <Skeleton height={140} radiusPx={26} />
            <Loading rows={3} label="Memuat dashboard divisi…" />
          </View>
        )}
      </View>
    );
  }

  const att = d.attendance;
  const m = metrik.data?.metrics ?? null;
  const pembanding = m?.period.previous_label ?? (periode === 'minggu' ? 'minggu lalu' : periode === 'bulan' ? 'bulan lalu' : 'kuartal lalu');

  return (
    <View style={{ gap: 16 }}>
      {kepalaNode}
      {langsung.offline ? <PitaOffline terakhir={langsung.terakhir} /> : langsung.gagalSegar ? <PitaGagalSegar /> : null}

      <BarisFilter filters={d.filters} divisi={divisi} tim={tim} onDivisi={(id) => { setDivisi(id); setTim(null); }} onTim={setTim} />

      <Segmented<Periode> value={periode} onChange={setPeriode} options={PERIODE_OPSI} />

      {att ? <HeroKehadiran att={att} /> : null}

      <KpiDivisi metrik={m} memuat={metrik.memuat} h={metrik} pembanding={pembanding} />

      {d.approvals ? <AntreanPersetujuan data={d.approvals} /> : null}

      {m ? <TrenPenyelesaian trend={m.trend} /> : null}

      {att ? <PanelKehadiran att={att} offline={langsung.offline} terakhir={langsung.terakhir} /> : null}

      {d.reports ? <PanelLaporanTim laporan={d.reports} /> : null}

      {m ? (
        <>
          <PanelBeban beban={m.workload} />
          <PanelTerlambat terlambat={m.overdue} />
          {m.projects.length > 0 ? <PanelProyek projects={m.projects} /> : null}
        </>
      ) : metrik.memuat ? (
        <Loading rows={3} label="Memuat metrik tugas…" />
      ) : null}

      <DesktopOnlyBanner message="Ekspor Excel dan PDF dashboard tersedia di desktop." onSendLink={mengirim ? undefined : () => void kirim('/absensi/kedisiplinan')} />
    </View>
  );
}

// ── Bagian-bagian ────────────────────────────────────────────────────────────

function HeroKehadiran({ att }: { att: NonNullable<DataDivisi['attendance']> }): React.JSX.Element {
  const c = att.counts;
  const lain = awayTotal(c);
  return (
    <Hero>
      <Text variant="body" style={{ color: 'rgba(255,255,255,0.9)' }}>
        Kehadiran hari ini
      </Text>
      <View accessible accessibilityLabel={`${hadirTotal(c)} dari ${c.scheduled} hadir`} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text variant="display" tone="onPrimary" weight={800}>
          {angka(hadirTotal(c))}
        </Text>
        <Text variant="h2" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {`/ ${angka(c.scheduled)}`}
        </Text>
      </View>
      <Text variant="body" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22 }}>
        {`${angka(lain)} cuti/izin/sakit · ${angka(c.not_checked_in)} belum check-in`}
      </Text>
    </Hero>
  );
}

function KpiDivisi({ metrik, memuat, h, pembanding }: { metrik: MetrikDivisi | null; memuat: boolean; h: HasilMuat<DataDivisi>; pembanding: string }): React.JSX.Element {
  if (metrik === null) {
    if (h.galat !== null && !memuat) {
      return <ErrorState kind="umum" title="Metrik gagal dimuat" message="Data tugas tidak bisa diambil. Periksa koneksi lalu coba lagi." onRetry={() => void h.muat()} />;
    }
    return (
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton height={96} width="48%" radiusPx={20} />
        <Skeleton height={96} width="48%" radiusPx={20} />
      </View>
    );
  }
  const k = metrik.kpis;
  const dPen = k.completion_rate.delta;
  const dTep = k.on_time_rate.delta;
  const toneDelta = (x: number | null): 'success' | 'danger' | 'muted' => (x === null || x === 0 ? 'muted' : x > 0 ? 'success' : 'danger');
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <PetakKpi
          label="Penyelesaian"
          nilai={persen(k.completion_rate.value)}
          catatan={k.completion_rate.value === null ? 'belum ada tugas bertenggat' : teksDelta(dPen, pembanding)}
          toneCatatan={toneDelta(dPen)}
        />
        <PetakKpi
          label="Ketepatan waktu"
          nilai={persen(k.on_time_rate.value)}
          catatan={k.on_time_rate.value === null ? 'belum ada tugas selesai' : teksDelta(dTep, pembanding)}
          toneCatatan={toneDelta(dTep)}
        />
      </View>
      <PetakKpi
        label="Terlambat"
        nilai={angka(k.overdue_tasks.value)}
        satuan="tugas"
        toneNilai={k.overdue_tasks.value > 0 ? 'danger' : undefined}
        catatan={k.overdue_tasks.value > 0 ? `di ${k.overdue_tasks.people} orang` : 'tidak ada tugas lewat tenggat'}
      />
    </View>
  );
}

function AntreanPersetujuan({ data }: { data: NonNullable<DataDivisi['approvals']> }): React.JSX.Element {
  const ringkas = data.items
    .slice(0, 3)
    .map((i) => `${i.user.name.split(' ')[0] ?? ''} ${i.type.name.toLowerCase()}`)
    .join(' · ');
  return (
    <Card variant="flat">
      <ListRow
        icon="circle-check"
        iconTone="teal"
        title="Menunggu persetujuan"
        subtitle={data.count === 0 ? 'Tidak ada pengajuan yang menunggu Anda.' : ringkas}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Badge tone={data.count > 0 ? 'primary' : 'neutral'}>{String(data.count)}</Badge>
            <Icon name="chevron-right" size={20} />
          </View>
        }
        onPress={bukaPersetujuan}
        accessibilityLabel={`Menunggu persetujuan, ${data.count}`}
      />
    </Card>
  );
}

function TrenPenyelesaian({ trend }: { trend: MetrikDivisi['trend'] }): React.JSX.Element {
  const { colors } = useTheme();
  const adaData = trend.some((t) => t.value !== null && t.denominator > 0);
  return (
    <Panel title="Tren penyelesaian">
      <Text variant="meta" style={{ marginTop: -8 }}>
        8 minggu · % selesai
      </Text>
      {!adaData ? (
        <Text variant="meta" align="center" style={{ paddingVertical: 20 }}>
          Belum ada tugas bertenggat dalam 8 minggu terakhir.
        </Text>
      ) : (
        <View accessible accessibilityLabel={`Penyelesaian per minggu: ${trend.map((t) => `${t.label} ${t.value ?? 0} persen`).join(', ')}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 150 }}>
          {trend.map((t, i) => (
            <View key={t.week_start} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: 150 }}>
              <Text variant="meta" weight={700} style={{ fontSize: 12 }}>
                {t.value === null ? '–' : angka(t.value)}
              </Text>
              <View
                style={{
                  width: '100%',
                  height: Math.max(4, ((t.value ?? 0) / 100) * 90),
                  borderRadius: 6,
                  backgroundColor: i === trend.length - 1 ? colors.primary : colors.fill.teal,
                  opacity: t.value === null ? 0.3 : 1,
                }}
              />
              <Text variant="meta" style={{ fontSize: 12 }}>{`M${i + 1}`}</Text>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

function PanelKehadiran({ att, offline, terakhir }: { att: NonNullable<DataDivisi['attendance']>; offline: boolean; terakhir: Date | null }): React.JSX.Element {
  const [semua, setSemua] = useState(false);
  const tampil = semua ? att.people : att.people.slice(0, 4);
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="h3" accessibilityRole="header">
          Kehadiran hari ini
        </Text>
        <Badge tone={offline ? 'neutral' : 'success'}>{offline ? `Terakhir ${jam(terakhir)}` : 'Langsung'}</Badge>
      </View>
      <BilahKehadiran c={att.counts} />
      {att.people.length === 0 ? (
        <Text variant="meta">Tidak ada anggota terjadwal hari ini.</Text>
      ) : (
        <View style={{ gap: 4 }}>
          {tampil.map((o) => (
            <BarisOrangHadir key={o.user.id} o={o} />
          ))}
        </View>
      )}
      {att.people.length > 4 ? (
        <Button
          title={semua ? 'Tampilkan lebih sedikit' : `Lihat semua ${att.people.length} anggota`}
          variant="quiet"
          size="sm"
          onPress={() => setSemua((v) => !v)}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
        />
      ) : null}
    </Card>
  );
}

function singkat(nama: string): string {
  const b = nama.trim().split(/\s+/);
  return b.length > 1 ? `${b[0]} ${(b[b.length - 1] ?? '').slice(0, 1)}.` : nama;
}

function PanelLaporanTim({ laporan }: { laporan: NonNullable<DataDivisi['reports']> }): React.JSX.Element {
  const t = laporan.totals;
  const rasio = t.scheduled > 0 ? (t.reported / t.scheduled) * 100 : 0;
  return (
    <Panel title="Laporan tim hari ini" actionLabel="Buka" onAction={bukaLaporanTim}>
      {t.scheduled === 0 ? (
        <Text variant="meta">Tidak ada anggota terjadwal hari ini.</Text>
      ) : (
        <>
          <Text variant="body" style={{ fontSize: 15 }}>{`${t.reported} dari ${t.scheduled} anggota terjadwal sudah lapor`}</Text>
          <Progress value={rasio} label={`${t.reported} dari ${t.scheduled} sudah lapor`} />
        </>
      )}
      {laporan.missing.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text variant="meta">Belum lapor</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {laporan.missing.map((o) => (
              <Tag key={o.id} tone="neutral">
                {`${singkat(o.name)}${o.draft ? ' (draf)' : ''}`}
              </Tag>
            ))}
          </View>
        </View>
      ) : null}
      {laporan.reports.map((r) => (
        <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }} accessible accessibilityLabel={`${r.user.name}, ${r.items_count} tugas dilaporkan${r.has_blockers ? ', ada hambatan' : ''}`}>
          <Avatar name={r.user.name} size="md" />
          <View style={{ flex: 1 }}>
            <Text variant="title" numberOfLines={1}>
              {r.user.name}
            </Text>
            <Text variant="meta" style={{ fontSize: 14 }}>{`${r.items_count} tugas dilaporkan · ${jam(r.submitted_at)}`}</Text>
          </View>
          {r.has_blockers ? <Badge tone="warning">Ada hambatan</Badge> : null}
        </View>
      ))}
    </Panel>
  );
}

function PanelBeban({ beban }: { beban: MetrikDivisi['workload'] }): React.JSX.Element {
  const { colors } = useTheme();
  const maks = Math.max(1, ...beban.map((b) => b.open));
  const ada = beban.some((b) => b.open > 0);
  return (
    <Panel title="Beban kerja">
      <Text variant="meta" style={{ marginTop: -8 }}>
        tugas terbuka
      </Text>
      {!ada ? (
        <EmptyState icon="list-todo" title="Belum ada tugas terbuka" description="Beban kerja muncul setelah anggota punya tugas." variant="plain" />
      ) : (
        beban.map((b) => (
          <View key={b.user.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 }} accessible accessibilityLabel={`${b.user.name}: ${b.open} tugas terbuka${b.overdue > 0 ? `, ${b.overdue} terlambat` : ''}`}>
            <Text variant="body" style={{ width: 110, fontSize: 15 }} numberOfLines={1}>
              {b.user.name}
            </Text>
            <Batang rasio={b.open / maks} warna={b.overdue > 0 ? colors.fill.danger : colors.fill.teal} />
            <Text variant="label" style={{ width: 24 }} align="right">
              {angka(b.open)}
            </Text>
          </View>
        ))
      )}
    </Panel>
  );
}

function PanelTerlambat({ terlambat }: { terlambat: MetrikDivisi['overdue'] }): React.JSX.Element {
  return (
    <Panel title="Tugas terlambat">
      {terlambat.total === 0 ? (
        <Text variant="meta">Tidak ada tugas yang lewat tenggat.</Text>
      ) : (
        terlambat.items.map((t) => {
          const tone: 'bad' | 'warn' = t.days_late > 1 ? 'bad' : 'warn';
          return (
            <ListRow
              key={t.id}
              icon="triangle-alert"
              iconTone={tone}
              title={t.title}
              subtitle={`${t.key} · ${t.assignees.map((a) => a.name.split(' ')[0]).join(', ') || 'Belum ditugaskan'} · terlambat ${t.days_late} hari`}
              onPress={() => router.push(`/tugas/${t.id}`)}
              style={{ paddingHorizontal: 0 }}
            />
          );
        })
      )}
    </Panel>
  );
}

function toneProyek(health: string | null, stale: boolean): Tone {
  if (health === 'off_track') {
    return 'danger';
  }
  if (health === 'at_risk' || stale) {
    return 'warning';
  }
  return 'neutral';
}

function PanelProyek({ projects }: { projects: MetrikDivisi['projects'] }): React.JSX.Element {
  return (
    <Panel title="Proyek berisiko">
      {projects.map((p) => (
        <ListRow
          key={p.id}
          icon="folder-kanban"
          iconTone="warn"
          title={`${p.key} · ${p.name}`}
          subtitle={p.stale ? `Update kedaluwarsa${p.last_update_at ? ` · ${waktuRelatif(p.last_update_at)}` : ''}` : `Update ${waktuRelatif(p.last_update_at)}`}
          trailing={<Badge tone={toneProyek(p.health, p.stale)}>{p.health_label ?? 'Perlu update'}</Badge>}
          onPress={() => router.push(`/workspace/${p.id}`)}
          style={{ paddingHorizontal: 0 }}
        />
      ))}
    </Panel>
  );
}

