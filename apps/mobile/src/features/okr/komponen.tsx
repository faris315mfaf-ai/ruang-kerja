/**
 * Komponen OKR (mockup 06 › 21–24): kartu objective bercincin, kartu key
 * result (progres vs diharapkan, bobot, pemilik, Check-in · Detail), grafik
 * rencana vs aktual dari riwayat check-in (SVG).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import type { KeyResult, Kuartal, Objective } from '@/api/okr';
import { CincinProgres } from '@/features/proyek/komponen';
import { nomorHari, tglBulan } from '@/features/proyek/format';
import { useTheme } from '@/theme';
import { Badge, Button, Card, Progress, Text } from '@/ui';

import { labelKuartal, nadaOkr, nilaiKr, pecahanPersen } from './format';

export function bukaObjective(id: string): void {
  router.push(`/okr/${encodeURIComponent(id)}` as never);
}

export function bukaKr(id: string, checkin = false): void {
  router.push(`/okr/kr/${encodeURIComponent(id)}${checkin ? '?checkin=1' : ''}` as never);
}

export function nadaCincinOkr(o: Objective): 'success' | 'warning' | 'danger' {
  return o.progress.status === 'on_track' ? 'success' : o.progress.status === 'at_risk' ? 'warning' : 'danger';
}

export function LencanaStatusObjective({ o }: { o: Objective }): React.JSX.Element {
  if (o.status === 'closed') return <Badge tone="neutral">Ditutup</Badge>;
  if (o.status === 'draft') return <Badge tone="info">Draf</Badge>;
  return (
    <Badge tone={nadaOkr(o.progress.status)} dot>
      {o.progress.status_label}
    </Badge>
  );
}

export function KartuObjective({ o }: { o: Objective }): React.JSX.Element {
  const krs = o.key_results ?? [];
  return (
    <Card onPress={() => bukaObjective(o.id)} accessibilityLabel={`${o.title}, ${o.division.name}, progres ${pecahanPersen(o.progress.value)}, diharapkan ${pecahanPersen(o.progress.expected)}, ${o.progress.status_label}`} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <CincinProgres nilai={o.progress.value * 100} rencana={o.progress.expected * 100} nada={nadaCincinOkr(o)} ukuran={60} tebal={6} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="meta">{`${o.division.name} · ${labelKuartal(o.quarter)}`}</Text>
          <Text variant="title" numberOfLines={3}>
            {o.title}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <LencanaStatusObjective o={o} />
        <Text variant="meta">{`${krs.length} key result · PIC ${o.owner.name}`}</Text>
      </View>
    </Card>
  );
}

export function KartuKr({ kr, onCheckin, bolehCheckin }: { kr: KeyResult; onCheckin?: () => void; bolehCheckin: boolean }): React.JSX.Element {
  const v = Math.max(0, Math.min(1, kr.progress.value)) * 100;
  return (
    <Card variant="tight" style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{kr.title}</Text>
          <Text variant="meta">{`${kr.owner.name} · bobot ${kr.weight}`}</Text>
        </View>
        <Badge tone={nadaOkr(kr.progress.status)} dot>
          {kr.progress.status_label}
        </Badge>
      </View>
      <Progress value={v} marker={kr.progress.expected * 100} label={`${kr.title}: ${pecahanPersen(kr.progress.value)}, diharapkan ${pecahanPersen(kr.progress.expected)}`} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="meta" style={{ fontSize: 14, flex: 1 }}>
          {`${nilaiKr(kr, kr.current_value)} dari ${nilaiKr(kr, kr.target_value)}${kr.target_value < kr.start_value ? ' (makin kecil makin baik)' : ''}`}
        </Text>
        <Text variant="label">{pecahanPersen(kr.progress.value)}</Text>
      </View>
      {kr.progress.raw < 0 ? (
        <Text variant="meta" tone="danger">
          Mundur dari nilai awal.
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {bolehCheckin && onCheckin ? <Button title="Check-in" size="sm" icon="circle-plus" onPress={onCheckin} style={{ flex: 1 }} /> : null}
        <Button title="Detail" size="sm" variant="outline" onPress={() => bukaKr(kr.id)} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

/** Rencana (garis lurus awal → target selama kuartal) vs aktual (titik check-in). */
export function GrafikKr({ kr, kuartal }: { kr: KeyResult; kuartal: Kuartal }): React.JSX.Element {
  const { colors } = useTheme();
  const [lebar, setLebar] = useState(300);
  const tinggi = 140;
  const pad = 8;
  const awal = nomorHari(kuartal.start) ?? 0;
  const akhir = Math.max((nomorHari(kuartal.end) ?? awal) , awal + 1);
  const cek = kr.checkins ?? [];
  const nilai = [kr.start_value, kr.target_value, ...cek.map((c) => c.value)];
  const min = Math.min(...nilai);
  const maks = Math.max(...nilai);
  const rentang = maks - min || 1;
  const x = (ymd: string): number => pad + ((Math.max(awal, Math.min(akhir, nomorHari(ymd) ?? awal)) - awal) / (akhir - awal)) * (lebar - pad * 2);
  const y = (v: number): number => tinggi - pad - ((v - min) / rentang) * (tinggi - pad * 2);
  const titik = [{ date: kuartal.start, value: kr.start_value }, ...cek.map((c) => ({ date: c.date, value: c.value }))];
  const ringkas = cek.length ? `Grafik rencana vs aktual. Check-in terakhir ${nilaiKr(kr, cek[cek.length - 1]?.value ?? kr.current_value)}.` : 'Belum ada check-in.';
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: tinggi }} onLayout={(e) => setLebar(Math.max(120, Math.round(e.nativeEvent.layout.width)))} accessible accessibilityRole="image" accessibilityLabel={ringkas}>
        <Svg width={lebar} height={tinggi}>
          <Line x1={x(kuartal.start)} y1={y(kr.start_value)} x2={x(kuartal.end)} y2={y(kr.target_value)} stroke={colors.muted} strokeWidth={1.5} strokeDasharray="5 4" />
          {titik.length > 1 ? <Polyline points={titik.map((t) => `${x(t.date).toFixed(1)},${y(t.value).toFixed(1)}`).join(' ')} fill="none" stroke={colors.primary} strokeWidth={3} /> : null}
          {titik.map((t, i) => (
            <Circle key={`${t.date}-${i}`} cx={x(t.date)} cy={y(t.value)} r={3.5} fill={colors.primary} />
          ))}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} importantForAccessibility="no-hide-descendants">
        <Text variant="meta">{tglBulan(kuartal.start)}</Text>
        <Text variant="meta">Aktual ━ · Rencana ┄</Text>
        <Text variant="meta">{tglBulan(kuartal.end)}</Text>
      </View>
    </View>
  );
}
