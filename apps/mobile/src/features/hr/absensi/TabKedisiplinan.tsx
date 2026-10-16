/**
 * Absensi tim › Kedisiplinan (mockup 11 › 23): periode Minggu/Bulan/Kuartal,
 * KPI 2×2 + dua KPI sekunder berdampingan (tanpa skor gabungan), sheet
 * definisi metrik (ketuk KPI), tren 8 minggu (batang + angka), per orang
 * dengan chip Perlu perhatian/Alpha/Terlambat/Semua, banner ekspor desktop.
 * `GET /absensi/tim/kedisiplinan`.
 */
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { kedisiplinan, type KunciKpi, type LaporanKedisiplinan, type OrangKedisiplinan, type PresetPeriode } from '@/api/hr';
import { jam } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, BottomSheet, Button, Card, Chip, ChipScroller, DesktopOnlyBanner, EmptyState, ErrorState, Icon, Loading, Pressable, Screen, SectionHeader, Segmented, Text, errorKindFromStatus } from '@/ui';

import { angka, persen } from '../format';
import { useMuat } from '../useMuat';
import { useTautanDesktop } from '../useTautanDesktop';

type Saring = 'perhatian' | 'alpha' | 'terlambat' | 'semua';

const SATUAN: Record<KunciKpi, (v: number | null) => string> = {
  attendance_discipline: persen,
  average_lateness: (v) => (v === null ? '—' : `${angka(v)} m`),
  absent_days: (v) => angka(v),
  late_days: (v) => angka(v),
  completion_rate: persen,
  lead_time: (v) => (v === null ? '—' : `${angka(v)} hari`),
};

const LABEL: Record<KunciKpi, string> = {
  attendance_discipline: 'Kedisiplinan hadir',
  average_lateness: 'Rata-rata terlambat',
  absent_days: 'Hari alpha',
  late_days: 'Hari terlambat',
  completion_rate: 'Tingkat penyelesaian',
  lead_time: 'Lead time (median)',
};

function perluPerhatian(o: OrangKedisiplinan): boolean {
  return o.absent_days > 0 || o.late_days >= 2 || (o.discipline !== null && o.discipline < 80);
}

export function TabKedisiplinan({ header }: { header: React.ReactNode }): React.JSX.Element {
  const { colors } = useTheme();
  const tautan = useTautanDesktop();
  const [periode, setPeriode] = useState<PresetPeriode>('bulan');
  const [divisi, setDivisi] = useState<string | null>(null);
  const [saring, setSaring] = useState<Saring>('perhatian');
  const [semua, setSemua] = useState(false);
  const [definisi, setDefinisi] = useState<KunciKpi | null>(null);
  const ambil = useCallback(() => kedisiplinan({ periode, divisi }), [periode, divisi]);
  const m = useMuat<LaporanKedisiplinan>(`disiplin:${periode}:${divisi ?? ''}`, ambil);
  const d = m.data;

  const orang = d?.report.people ?? [];
  const hitung: Record<Saring, number> = {
    perhatian: orang.filter(perluPerhatian).length,
    alpha: orang.filter((o) => o.absent_days > 0).length,
    terlambat: orang.filter((o) => o.late_days > 0).length,
    semua: orang.length,
  };
  const daftar = orang.filter((o) => (saring === 'semua' ? true : saring === 'alpha' ? o.absent_days > 0 : saring === 'terlambat' ? o.late_days > 0 : perluPerhatian(o)));
  const tampil = semua ? daftar : daftar.slice(0, 5);
  const presets = (d?.filters.presets ?? [
    { value: 'minggu' as const, label: 'Minggu ini' },
    { value: 'bulan' as const, label: 'Bulan ini' },
  ]).filter((x) => x.value !== 'kustom');

  const kpi = (k: KunciKpi): React.JSX.Element | null => {
    const n = d?.report.kpis[k];
    if (!n) return null;
    const delta = n.delta !== null && n.delta !== 0 ? `${n.delta > 0 ? '+' : '−'}${angka(Math.abs(n.delta))} vs ${d?.filters.period.previous_label ?? 'sebelumnya'}` : null;
    return (
      <Pressable
        key={k}
        onPress={() => setDefinisi(k)}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`${LABEL[k]}: ${SATUAN[k](n.value)}${delta ? `, ${delta}` : ''}. Ketuk untuk definisi`}
        style={[s.sel, s.kpiKartu, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text variant="kpi">{SATUAN[k](n.value)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="meta" style={{ fontSize: 14, flexShrink: 1 }}>
            {LABEL[k]}
          </Text>
          <Icon name="info" size={14} color={colors.muted} />
        </View>
        {delta ? (
          <Text variant="meta" style={{ fontSize: 13 }}>
            {delta}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  const def = definisi && d ? d.definitions[definisi] : null;
  const trenMaks = Math.max(100, ...(d?.report.trend.map((t) => t.value ?? 0) ?? [0]));

  return (
    <Screen header={header} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang('tarik')}>
      {m.offlineSejak !== null ? <Banner tone="neutral" icon="cloud-off" message={`Anda offline. Menampilkan data tersimpan pukul ${jam(new Date(m.offlineSejak))}.`} /> : null}
      <Segmented value={periode} options={presets} onChange={(v) => setPeriode(v)} />
      {d ? (
        <View style={{ gap: 2 }}>
          <Text variant="h3" accessibilityRole="header">
            {d.filters.period.label}
          </Text>
          <Text variant="body" tone="muted">
            {`${d.scope.label} · ${d.scope.member_count} orang`}
          </Text>
        </View>
      ) : null}
      {d && d.filters.divisions.length > 1 ? (
        <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
          <Chip label="Semua divisi" selected={divisi === null} onPress={() => setDivisi(null)} />
          {d.filters.divisions.map((v) => (
            <Chip key={v.id} label={v.name} selected={divisi === v.id} onPress={() => setDivisi(divisi === v.id ? null : v.id)} />
          ))}
        </ChipScroller>
      ) : null}
      {m.memuat && !d ? (
        <Loading rows={6} label="Memuat kedisiplinan…" />
      ) : m.galat && !d ? (
        <ErrorState title="Laporan gagal dimuat" message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d ? (
        <>
          <View style={s.kpi}>{(['attendance_discipline', 'average_lateness', 'absent_days', 'late_days'] as KunciKpi[]).map(kpi)}</View>
          <View style={s.kpi}>{(['completion_rate', 'lead_time'] as KunciKpi[]).map(kpi)}</View>

          {d.report.trend.length > 0 ? (
            <Card style={{ gap: 12 }}>
              <View>
                <Text variant="h3" accessibilityRole="header">
                  Tren kedisiplinan hadir
                </Text>
                <Text variant="meta" style={{ fontSize: 14 }}>
                  {`% hari kerja tepat waktu · ${d.report.trend.length} minggu`}
                </Text>
              </View>
              <View style={s.tren}>
                {d.report.trend.map((t) => (
                  <View key={t.week_start} style={s.trenKolom} accessible accessibilityLabel={`Minggu ${t.label}: ${persen(t.value)}`}>
                    <Text variant="meta" weight={700} style={{ fontSize: 12 }}>
                      {t.value === null ? '—' : `${Math.round(t.value)}%`}
                    </Text>
                    <View style={[s.trenTrek, { backgroundColor: colors.surface2 }]}>
                      <View style={{ height: `${((t.value ?? 0) / trenMaks) * 100}%`, backgroundColor: colors.fill.teal, borderRadius: 4 }} />
                    </View>
                    <Text variant="meta" style={{ fontSize: 11 }} numberOfLines={1}>
                      {t.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <SectionHeader title={`Per orang · ${orang.length}`} />
          <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
            <Chip label="Perlu perhatian" count={hitung.perhatian} selected={saring === 'perhatian'} onPress={() => setSaring('perhatian')} />
            <Chip label="Alpha" count={hitung.alpha} selected={saring === 'alpha'} onPress={() => setSaring('alpha')} />
            <Chip label="Terlambat" count={hitung.terlambat} selected={saring === 'terlambat'} onPress={() => setSaring('terlambat')} />
            <Chip label="Semua" count={hitung.semua} selected={saring === 'semua'} onPress={() => setSaring('semua')} />
          </ChipScroller>
          {daftar.length === 0 ? (
            <EmptyState icon="circle-check" title={saring === 'semua' ? 'Belum ada data' : 'Semua tepat waktu'} description={saring === 'semua' ? 'Tidak ada orang terjadwal dalam periode ini.' : 'Tidak ada alpha atau keterlambatan dalam periode ini.'} />
          ) : (
            <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
              {tampil.map((o, i) => (
                <Pressable
                  key={o.user.id}
                  onPress={() => router.push(`/absensi-tim/rekap/${o.user.id}` as never)}
                  scaleTo={1}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.user.name}, ${persen(o.discipline)} tepat waktu dari ${o.scheduled} hari, alpha ${o.absent_days}, terlambat ${o.late_days} hari`}
                  style={[s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
                >
                  <Avatar name={o.user.name} size="md" />
                  <View style={{ flex: 1 }}>
                    <Text variant="title" numberOfLines={1}>
                      {o.user.name}
                    </Text>
                    <Text variant="meta" style={{ fontSize: 14 }}>
                      {`${persen(o.discipline)} tepat waktu · ${o.scheduled} hari${o.average_late !== null ? ` · rata-rata telat ${angka(o.average_late)} m` : ''}`}
                    </Text>
                  </View>
                  {o.absent_days > 0 ? <Badge tone="danger">{`${o.absent_days} alpha`}</Badge> : o.late_days > 0 ? <Badge tone="warning">{`Terlambat ${o.late_days}×`}</Badge> : <Badge tone="success">Tepat waktu</Badge>}
                </Pressable>
              ))}
            </Card>
          )}
          {daftar.length > 5 ? <Button title={semua ? 'Tampilkan lebih sedikit' : `Lihat semua ${daftar.length}`} variant="quiet" onPress={() => setSemua(!semua)} /> : null}
          <DesktopOnlyBanner
            message="Ekspor Excel kedisiplinan dan filter tim tersedia di desktop."
            onSendLink={tautan.mengirim ? undefined : () => tautan.kirim(d.web_path, 'Absensi › Kedisiplinan', 'Ekspor Excel dilakukan dari komputer.')}
          />
          <Text variant="meta" style={{ fontSize: 14 }}>
            Metrik ditampilkan berdampingan dengan konteks; tidak ada “skor produktivitas” gabungan.
          </Text>
        </>
      ) : null}
      <BottomSheet visible={definisi !== null} onClose={() => setDefinisi(null)} title={definisi ? (def?.label ?? LABEL[definisi]) : ''} scrollable>
        <Text variant="overline">Rumus</Text>
        <Text variant="body">{def?.definition ?? 'Definisi belum tersedia.'}</Text>
        <Text variant="meta" style={{ fontSize: 14 }}>
          Satu definisi dipakai di semua dashboard (dihitung dalam tanggal kantor, Asia/Jakarta).
        </Text>
        <Button title="Mengerti" variant="tonal" onPress={() => setDefinisi(null)} />
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  kpi: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sel: { flexBasis: '47%', flexGrow: 1 },
  kpiKartu: { borderWidth: 1, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, gap: 2, minHeight: 48 },
  tren: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  trenKolom: { flex: 1, alignItems: 'center', gap: 4 },
  trenTrek: { width: '70%', height: 96, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12, paddingHorizontal: 16 },
});
