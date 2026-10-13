/**
 * Komponen bersama modul 06: cincin progres (aktual vs rencana), lencana
 * kesehatan PIC + penanda sistem, kartu proyek, bilah status tugas, grafik
 * burn-up & kolom (react-native-svg, tanpa pustaka grafik). Status selalu
 * teks + warna; grafik punya ringkasan teks untuk TalkBack.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect } from 'react-native-svg';

import type { BarisProyek, Kesehatan, KategoriTugas, MetrikProyek, StatusMilestone } from '@/api/proyek';
import { UbinWorkspace } from '@/features/workspace/bagian';
import { useTheme } from '@/theme';
import { Avatar, Badge, Card, Icon, Text } from '@/ui';

import { angka, hariLalu, hariTanggal, labelKesehatan, labelPenanda, LABEL_KATEGORI, nadaKesehatan, nomorHari, persen, tglBulan } from './format';

// ── Cincin progres ───────────────────────────────────────────────────────────

/** Cincin 0–100 dengan penanda rencana (garis kecil). `nilai` null → cincin kosong "—". */
export function CincinProgres({
  nilai,
  rencana,
  ukuran = 64,
  tebal = 7,
  nada = 'primary',
  label,
}: {
  nilai: number | null;
  rencana?: number | null;
  ukuran?: number;
  tebal?: number;
  nada?: 'primary' | 'success' | 'warning' | 'danger';
  label?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const r = (ukuran - tebal) / 2;
  const keliling = 2 * Math.PI * r;
  const v = nilai === null ? 0 : Math.max(0, Math.min(100, nilai));
  const warna = nada === 'success' ? colors.success : nada === 'warning' ? colors.fill.warning : nada === 'danger' ? colors.fill.danger : colors.primary;
  const c = ukuran / 2;
  let penanda: React.ReactNode = null;
  if (rencana !== null && rencana !== undefined) {
    const sudut = (Math.max(0, Math.min(100, rencana)) / 100) * 2 * Math.PI - Math.PI / 2;
    const dalam = r - tebal / 2 - 2;
    const luar = r + tebal / 2 + 2;
    penanda = <Line x1={c + dalam * Math.cos(sudut)} y1={c + dalam * Math.sin(sudut)} x2={c + luar * Math.cos(sudut)} y2={c + luar * Math.sin(sudut)} stroke={colors.marker} strokeWidth={2.5} strokeLinecap="round" />;
  }
  return (
    <View
      style={{ width: ukuran, height: ukuran, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? `Progres ${persen(nilai)}${rencana !== null && rencana !== undefined ? `, rencana ${persen(rencana)}` : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v) }}
    >
      <Svg width={ukuran} height={ukuran} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} stroke={colors.surface2} strokeWidth={tebal} fill="none" />
        {nilai !== null && v > 0 ? (
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={warna}
            strokeWidth={tebal}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(v / 100) * keliling} ${keliling}`}
            transform={`rotate(-90 ${c} ${c})`}
          />
        ) : null}
        {penanda}
      </Svg>
      <Text variant="label" weight={800} style={{ fontSize: ukuran >= 96 ? 26 : ukuran >= 64 ? 16 : 13 }}>
        {persen(nilai)}
      </Text>
    </View>
  );
}

// ── Lencana ─────────────────────────────────────────────────────────────────

export function LencanaKesehatan({ health }: { health: Kesehatan | null }): React.JSX.Element {
  return (
    <Badge tone={nadaKesehatan(health)} dot>
      {labelKesehatan(health)}
    </Badge>
  );
}

export function PenandaProyek({ metrics, style }: { metrics: Pick<MetrikProyek, 'flags' | 'variance'>; style?: StyleProp<ViewStyle> }): React.JSX.Element | null {
  if (metrics.flags.length === 0) return null;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, style]}>
      {metrics.flags.map((f) => (
        <Badge key={f} tone={f === 'stale_update' ? 'neutral' : 'danger'}>
          {labelPenanda(f, metrics.variance)}
        </Badge>
      ))}
    </View>
  );
}

export function nadaCincin(metrics: Pick<MetrikProyek, 'variance' | 'flags'>, health: Kesehatan | null): 'primary' | 'success' | 'warning' | 'danger' {
  if (health === 'off_track' || metrics.flags.includes('behind')) return 'danger';
  if (health === 'at_risk' || metrics.flags.length > 0) return 'warning';
  return 'primary';
}

// ── Kartu proyek ─────────────────────────────────────────────────────────────

export function bukaProyek(key: string): void {
  router.push(`/proyek/${encodeURIComponent(key)}` as never);
}

export function KartuProyek({ p, ekstra }: { p: BarisProyek; ekstra?: React.ReactNode }): React.JSX.Element {
  const { colors } = useTheme();
  const m = p.metrics;
  const ms = p.next_milestone;
  const ringkas = `${p.name}, ${p.key}, ${labelKesehatan(p.health)}, progres ${persen(m.actual)}, rencana ${persen(m.planned)}`;
  return (
    <Card onPress={() => bukaProyek(p.key)} accessibilityLabel={ringkas} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <UbinWorkspace nama={p.name} warna={p.color} tipe="project" ukuran={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={2}>
            {p.name}
          </Text>
          <Text variant="meta" numberOfLines={1}>
            {[p.key, p.division].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <CincinProgres nilai={m.actual} rencana={m.planned} nada={nadaCincin(m, p.health)} ukuran={56} tebal={6} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <LencanaKesehatan health={p.health} />
        <PenandaProyek metrics={m} />
      </View>
      <Text variant="meta" style={{ fontSize: 14 }}>
        {`${persen(m.actual)} selesai · rencana ${persen(m.planned)}${m.uses_estimates ? ' · bobot estimasi' : ''}`}
      </Text>
      {ms ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Icon name="flag" size={16} color={ms.status === 'missed' ? colors.danger : colors.muted} />
          <Text variant="meta" style={{ fontSize: 14, flex: 1 }} numberOfLines={2} tone={ms.status === 'missed' ? 'danger' : 'muted'}>
            {`Berikutnya: ${ms.name} · ${hariTanggal(ms.target_date)}`}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="meta" style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>
          {`${p.target_date ? `Target ${tglBulan(p.target_date)}` : 'Tanpa target'} · ${angka(m.overdue)} terlambat`}
        </Text>
        {p.lead ? <Avatar name={p.lead.name} size="sm" /> : null}
        <Text variant="meta" style={{ fontSize: 14 }}>
          {m.update_age_days === null ? 'Belum ada update' : `Update ${hariLalu(m.update_age_days)}`}
        </Text>
      </View>
      {ekstra}
    </Card>
  );
}

// ── Bilah status tugas ───────────────────────────────────────────────────────

const URUTAN_KATEGORI: KategoriTugas[] = ['done', 'review', 'in_progress', 'todo', 'backlog'];

export function BilahStatus({ jumlah }: { jumlah: Record<KategoriTugas, number> }): React.JSX.Element {
  const { colors } = useTheme();
  const warna: Record<string, string> = { done: colors.success, review: colors.fill.violet, in_progress: colors.accentBlue, todo: colors.fill.warning, backlog: colors.borderStrong };
  const total = URUTAN_KATEGORI.reduce((a, k) => a + (jumlah[k] ?? 0), 0);
  const isi = URUTAN_KATEGORI.filter((k) => (jumlah[k] ?? 0) > 0);
  const ringkas = isi.map((k) => `${LABEL_KATEGORI[k]} ${jumlah[k]}`).join(', ');
  return (
    <View style={{ gap: 8 }} accessible accessibilityLabel={total > 0 ? `Status tugas: ${ringkas}` : 'Belum ada tugas'}>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.surface2 }}>
        {total > 0 ? isi.map((k) => <View key={k} style={{ flex: jumlah[k], backgroundColor: warna[k] }} />) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {isi.map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: warna[k] }} />
            <Text variant="meta" style={{ fontSize: 14 }}>{`${LABEL_KATEGORI[k]} ${jumlah[k]}`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Grafik ───────────────────────────────────────────────────────────────────

function useLebar(awal = 300): [number, (e: LayoutChangeEvent) => void] {
  const [lebar, setLebar] = useState(awal);
  return [lebar, (e) => setLebar(Math.max(120, Math.round(e.nativeEvent.layout.width)))];
}

export interface TitikBurnUp {
  date: string;
  scope: number | null;
  done: number | null;
}

/** Burn-up: lingkup (garis abu), selesai (garis merek), ideal (putus-putus), penanda milestone. */
export function GrafikBurnUp({
  titik,
  mulai,
  target,
  hariIni,
  milestones = [],
  tinggi = 160,
}: {
  titik: TitikBurnUp[];
  mulai: string | null;
  target: string | null;
  hariIni: string;
  milestones?: { id: string; target_date: string; status: StatusMilestone }[];
  tinggi?: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [lebar, onLayout] = useLebar();
  const ada = titik.filter((t) => t.scope !== null || t.done !== null);
  const awal = nomorHari(mulai ?? ada[0]?.date) ?? 0;
  const akhir = Math.max(nomorHari(target) ?? 0, nomorHari(hariIni) ?? 0, nomorHari(ada[ada.length - 1]?.date) ?? 0, awal + 1);
  const maks = Math.max(1, ...ada.map((t) => Math.max(t.scope ?? 0, t.done ?? 0)));
  const pad = 6;
  const x = (ymd: string): number => pad + (((nomorHari(ymd) ?? awal) - awal) / (akhir - awal)) * (lebar - pad * 2);
  const y = (v: number): number => tinggi - pad - (v / maks) * (tinggi - pad * 2);
  const garis = (pilih: (t: TitikBurnUp) => number | null): string =>
    ada
      .filter((t) => pilih(t) !== null)
      .map((t) => `${x(t.date).toFixed(1)},${y(pilih(t) ?? 0).toFixed(1)}`)
      .join(' ');
  const lingkupAkhir = [...ada].reverse().find((t) => t.scope !== null)?.scope ?? null;
  const selesaiAkhir = [...ada].reverse().find((t) => t.done !== null)?.done ?? null;
  const awalHari = nomorHari(mulai);
  const targetHari = nomorHari(target);
  const ideal =
    lingkupAkhir !== null && awalHari !== null && targetHari !== null && targetHari > awalHari
      ? Math.round((lingkupAkhir * Math.max(0, Math.min(1, ((nomorHari(hariIni) ?? awalHari) - awalHari) / (targetHari - awalHari)))) * 10) / 10
      : null;
  const ringkas =
    ada.length === 0
      ? 'Belum ada data burn-up.'
      : `Burn-up: selesai ${angka(selesaiAkhir)} dari lingkup ${angka(lingkupAkhir)} tugas${ideal !== null ? `, ideal hari ini ${angka(ideal, 1)}` : ''}.`;
  return (
    <View style={{ gap: 8 }}>
      <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={ringkas} style={{ height: tinggi }}>
        <Svg width={lebar} height={tinggi}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <Line key={f} x1={pad} x2={lebar - pad} y1={y(maks * f)} y2={y(maks * f)} stroke={colors.divider} strokeWidth={1} />
          ))}
          {milestones.map((m) => (
            <Line key={m.id} x1={x(m.target_date)} x2={x(m.target_date)} y1={pad} y2={tinggi - pad} stroke={m.status === 'missed' ? colors.fill.danger : colors.border} strokeWidth={1} strokeDasharray="2 3" />
          ))}
          {ideal !== null && mulai && target ? (
            <Line x1={x(mulai)} y1={y(0)} x2={x(target)} y2={y(lingkupAkhir ?? 0)} stroke={colors.muted} strokeWidth={1.5} strokeDasharray="5 4" />
          ) : null}
          {ada.length > 1 ? <Polyline points={garis((t) => t.scope)} fill="none" stroke={colors.borderStrong} strokeWidth={2} /> : null}
          {ada.length > 1 ? <Polyline points={garis((t) => t.done)} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinejoin="round" /> : null}
          <Line x1={x(hariIni)} x2={x(hariIni)} y1={pad} y2={tinggi - pad} stroke={colors.marker} strokeWidth={1.5} />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} importantForAccessibility="no-hide-descendants">
        <Legenda warna={colors.primary} label={`Selesai ${angka(selesaiAkhir)}`} />
        <Legenda warna={colors.borderStrong} label={`Lingkup ${angka(lingkupAkhir)}`} />
        {ideal !== null ? <Legenda warna={colors.muted} label={`Ideal ${angka(ideal, 1)}`} putus /> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} importantForAccessibility="no-hide-descendants">
        <Text variant="meta">{tglBulan(mulai ?? ada[0]?.date)}</Text>
        <Text variant="meta">{`Hari ini ${tglBulan(hariIni)}`}</Text>
        <Text variant="meta">{tglBulan(target)}</Text>
      </View>
    </View>
  );
}

function Legenda({ warna, label, putus = false }: { warna: string; label: string; putus?: boolean }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 14, height: 0, borderTopWidth: 3, borderColor: warna, borderStyle: putus ? 'dashed' : 'solid' }} />
      <Text variant="meta" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </View>
  );
}

/** Kolom berpasangan Rencana (abu) vs Selesai (merek), per label. */
export function GrafikKolom({ data, tinggi = 140 }: { data: { key: string; label: string; full_label: string; planned: number; done: number }[]; tinggi?: number }): React.JSX.Element {
  const { colors } = useTheme();
  const [lebar, onLayout] = useLebar();
  const maks = Math.max(1, ...data.map((d) => Math.max(d.planned, d.done)));
  const n = Math.max(1, data.length);
  const slot = lebar / n;
  const bw = Math.max(6, Math.min(18, slot / 3));
  const ringkas = data.map((d) => `${d.full_label}: ${d.done} dari ${d.planned} selesai`).join('; ');
  return (
    <View style={{ gap: 6 }}>
      <View onLayout={onLayout} style={{ height: tinggi }} accessible accessibilityRole="image" accessibilityLabel={data.length ? `Grafik rencana dan selesai. ${ringkas}` : 'Belum ada data grafik.'}>
        <Svg width={lebar} height={tinggi}>
          <Line x1={0} x2={lebar} y1={tinggi - 1} y2={tinggi - 1} stroke={colors.divider} strokeWidth={1} />
          {data.map((d, i) => {
            const cx = slot * i + slot / 2;
            const hp = (d.planned / maks) * (tinggi - 8);
            const hd = (d.done / maks) * (tinggi - 8);
            return (
              <G key={d.key}>
                <Rect x={cx - bw - 1} y={tinggi - 1 - hp} width={bw} height={hp} rx={3} fill={colors.surface2} stroke={colors.border} strokeWidth={1} />
                <Rect x={cx + 1} y={tinggi - 1 - hd} width={bw} height={hd} rx={3} fill={colors.fill.teal} />
              </G>
            );
          })}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
        {data.map((d) => (
          <Text key={d.key} variant="meta" align="center" numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>
            {d.label}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }} importantForAccessibility="no-hide-descendants">
        <Legenda warna={colors.border} label="Rencana" />
        <Legenda warna={colors.fill.teal} label="Selesai" />
      </View>
    </View>
  );
}

/** Kartu ringkas angka (tile KPI kecil). */
export function PetakAngka({ label, nilai, catatan, nada, onPress }: { label: string; nilai: string; catatan?: string; nada?: 'danger' | 'warning' | 'success'; onPress?: () => void }): React.JSX.Element {
  return (
    <Card variant="tight" onPress={onPress} accessibilityLabel={`${label}: ${nilai}${catatan ? `, ${catatan}` : ''}`} style={{ flex: 1, gap: 2, minHeight: 96 }}>
      <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={2}>
        {label}
      </Text>
      <Text variant="kpi" tone={nada ?? 'text'}>
        {nilai}
      </Text>
      {catatan ? (
        <Text variant="meta" numberOfLines={2}>
          {catatan}
        </Text>
      ) : null}
    </Card>
  );
}
