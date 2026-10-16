/**
 * Potongan UI bersama dashboard Kepala Divisi & HR: petak KPI, bilah segmen
 * kehadiran, daftar kehadiran, filter divisi/tim (sheet) dan kepala halaman
 * dengan ekspor "Tersedia di desktop".
 */
import { useState } from 'react';
import { View } from 'react-native';

import type { FilterDasbor, HitungKehadiran, KeadaanOrang, OrangHadir } from '@/api/beranda';
import { jam } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Avatar, Badge, BottomSheet, Card, Chip, ChipScroller, Radio, Text, type Tone } from '@/ui';

import { angka } from './format';

// ── Petak KPI ────────────────────────────────────────────────────────────────

export function PetakKpi({
  label,
  nilai,
  satuan,
  catatan,
  toneCatatan,
  toneNilai,
}: {
  label: string;
  nilai: string;
  satuan?: string;
  catatan?: string;
  toneCatatan?: 'success' | 'danger' | 'muted';
  toneNilai?: 'danger';
}): React.JSX.Element {
  return (
    <Card variant="tight" style={{ flex: 1, gap: 2 }}>
      <View accessible accessibilityLabel={`${label}: ${nilai}${satuan ? ` ${satuan}` : ''}${catatan ? `, ${catatan}` : ''}`}>
        <Text variant="meta" style={{ fontSize: 14 }}>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="kpi" tone={toneNilai === 'danger' ? 'danger' : 'text'}>
            {nilai}
          </Text>
          {satuan ? <Text variant="body" tone="muted">{satuan}</Text> : null}
        </View>
        {catatan ? (
          <Text variant="meta" tone={toneCatatan ?? 'muted'} style={{ fontSize: 14 }}>
            {catatan}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

// ── Kehadiran ────────────────────────────────────────────────────────────────

export function hadirTotal(c: HitungKehadiran): number {
  return c.present + c.late;
}

export function awayTotal(c: HitungKehadiran): number {
  return c.away > 0 ? c.away : c.leave + c.permit + c.sick + c.business_trip;
}

export function BilahKehadiran({ c }: { c: HitungKehadiran }): React.JSX.Element {
  const { colors } = useTheme();
  const bagian: { kunci: string; label: string; n: number; warna: string }[] = [
    { kunci: 'present', label: 'Hadir', n: c.present, warna: colors.success },
    { kunci: 'late', label: 'Terlambat', n: c.late, warna: colors.fill.warning },
    { kunci: 'away', label: 'Cuti/izin/sakit', n: awayTotal(c), warna: colors.accentBlue },
    { kunci: 'not', label: 'Belum', n: c.not_checked_in + c.absent, warna: colors.borderStrong },
  ];
  const total = bagian.reduce((a, b) => a + b.n, 0);
  return (
    <View style={{ gap: 10 }}>
      <View
        accessible
        accessibilityLabel={bagian.map((b) => `${b.label} ${b.n}`).join(', ')}
        style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.surface2 }}
      >
        {total > 0
          ? bagian.filter((b) => b.n > 0).map((b) => <View key={b.kunci} style={{ flex: b.n, backgroundColor: b.warna }} />)
          : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }}>
        {bagian.map((b) => (
          <View key={b.kunci} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: b.warna }} />
            <Text variant="body" style={{ fontSize: 15 }}>{`${b.label} ${angka(b.n)}`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const TONE_ORANG: Record<KeadaanOrang, Tone> = { present: 'success', late: 'warning', away: 'info', not_checked_in: 'neutral', absent: 'danger' };
const LABEL_ORANG: Record<KeadaanOrang, string> = { present: 'Hadir', late: 'Terlambat', away: 'Dinas', not_checked_in: 'Belum', absent: 'Alpha' };

function subOrang(o: OrangHadir): string {
  switch (o.state) {
    case 'present':
      return `Masuk ${jam(o.check_in_at)}`;
    case 'late':
      return `Masuk ${jam(o.check_in_at)} · terlambat${o.late_minutes > 0 ? ` ${o.late_minutes} menit` : ''}`;
    case 'away':
      return o.status_label ? `${o.status_label} disetujui` : 'Tidak di kantor (pengajuan disetujui)';
    case 'absent':
      return 'Alpha';
    default:
      return 'Belum check-in';
  }
}

export function BarisOrangHadir({ o }: { o: OrangHadir }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }} accessible accessibilityLabel={`${o.user.name}, ${LABEL_ORANG[o.state]}, ${subOrang(o)}`}>
      <Avatar name={o.user.name} size="md" />
      <View style={{ flex: 1 }}>
        <Text variant="title" numberOfLines={1}>
          {o.user.name}
        </Text>
        <Text variant="meta" numberOfLines={1} style={{ fontSize: 14 }}>
          {subOrang(o)}
        </Text>
      </View>
      <Badge tone={TONE_ORANG[o.state]}>{o.state === 'away' ? (o.status_label ?? 'Izin') : LABEL_ORANG[o.state]}</Badge>
    </View>
  );
}

// ── Filter divisi/tim (sheet) ────────────────────────────────────────────────

export function BarisFilter({
  filters,
  divisi,
  tim,
  onDivisi,
  onTim,
}: {
  filters: FilterDasbor;
  divisi: string | null;
  tim: string | null;
  onDivisi: (id: string | null) => void;
  onTim: (id: string | null) => void;
}): React.JSX.Element | null {
  const [buka, setBuka] = useState<'divisi' | 'tim' | null>(null);
  const bolehDivisi = filters.divisions.length > 1;
  const timTersedia = filters.teams.filter((t) => divisi === null || t.division_id === divisi);
  const bolehTim = timTersedia.length > 0;
  if (!bolehDivisi && !bolehTim) {
    return null;
  }
  const namaDivisi = filters.divisions.find((d) => d.id === (divisi ?? filters.divisi))?.name ?? 'Semua';
  const namaTim = filters.teams.find((t) => t.id === tim)?.name ?? 'Semua';

  return (
    <>
      <View style={{ marginHorizontal: -16 }}>
        <ChipScroller>
          {bolehDivisi ? <Chip icon="filter" label={`Divisi: ${namaDivisi}`} onPress={() => setBuka('divisi')} /> : null}
          {bolehTim ? <Chip icon="users" label={`Tim: ${namaTim}`} onPress={() => setBuka('tim')} /> : null}
        </ChipScroller>
      </View>
      <BottomSheet visible={buka !== null} onClose={() => setBuka(null)} title={buka === 'tim' ? 'Pilih tim' : 'Pilih divisi'} scrollable>
        {buka === 'divisi' ? (
          <>
            <Radio selected={divisi === null} label="Semua divisi dalam cakupan" onSelect={() => { onDivisi(null); setBuka(null); }} />
            {filters.divisions.map((d) => (
              <Radio key={d.id} selected={divisi === d.id} label={d.name} onSelect={() => { onDivisi(d.id); setBuka(null); }} />
            ))}
          </>
        ) : null}
        {buka === 'tim' ? (
          <>
            <Radio selected={tim === null} label="Semua tim" onSelect={() => { onTim(null); setBuka(null); }} />
            {timTersedia.map((t) => (
              <Radio key={t.id} selected={tim === t.id} label={t.name} onSelect={() => { onTim(t.id); setBuka(null); }} />
            ))}
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}

/** Garis tipis batang beban kerja/tren (bukan kartu). */
export function Batang({ rasio, warna, tinggi = 8 }: { rasio: number; warna: string; tinggi?: number }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, height: tinggi, borderRadius: radius.sm, backgroundColor: colors.surface2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(2, Math.min(100, rasio * 100))}%`, height: tinggi, borderRadius: radius.sm, backgroundColor: warna }} />
    </View>
  );
}
