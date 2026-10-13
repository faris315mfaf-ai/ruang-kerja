/** Kartu "Jam sekarang": jam berjalan, status hari, jadwal shift, dan petunjuk ketepatan waktu. */
import { View } from 'react-native';

import type { KeadaanAbsen } from '@/api/absensi';
import type { DaySchedule } from '@/api/types';
import { durasiMenit, jam } from '@/lib/format';
import { useTheme } from '@/theme';
import { Badge, Card, Icon, Text, type Tone } from '@/ui';

import { ringkasJendela } from './jendela';
import { menitAntara } from './waktu';

function selangWaktu(menit: number): string {
  if (menit >= 60) {
    return durasiMenit(menit);
  }
  return `${menit} menit`;
}

interface Petunjuk {
  teks: string;
  nada: 'ok' | 'warn' | 'muted';
}

function petunjuk(state: KeadaanAbsen, sekarang: Date): Petunjuk | null {
  switch (state.code) {
    case 'too_early': {
      const buka = state.windowOpensAt ? jam(state.windowOpensAt) : null;
      // Dengan jam absen perusahaan, "N menit sebelum masuk" tidak berlaku (batasnya jam tetap).
      const sebelum = !state.windows?.checkIn?.from && state.windowOpensAt && state.scheduledStart ? Math.round((Date.parse(state.scheduledStart) - Date.parse(state.windowOpensAt)) / 60_000) : null;
      return buka ? { teks: `Check-in dibuka pukul ${buka}${sebelum ? ` (${selangWaktu(sebelum)} sebelum masuk)` : ''}`, nada: 'muted' } : null;
    }
    case 'not_checked_in': {
      if (!state.scheduledStart) {
        return null;
      }
      const batas = state.lateThreshold ? jam(state.lateThreshold) : null;
      const sebelum = -menitAntara(state.scheduledStart, sekarang);
      if (sebelum > 0) {
        return { teks: `${selangWaktu(sebelum)} sebelum jam masuk${batas ? ` · batas terlambat ${batas}` : ''}`, nada: 'ok' };
      }
      const lewatBatas = state.lateThreshold ? Date.parse(state.lateThreshold) < sekarang.getTime() : false;
      return lewatBatas
        ? { teks: `Lewat batas terlambat${batas ? ` ${batas}` : ''} · akan tercatat terlambat`, nada: 'warn' }
        : { teks: `Dalam toleransi${batas ? ` · batas terlambat ${batas}` : ''}`, nada: 'ok' };
    }
    case 'checked_in':
      return state.checkedInAt ? { teks: `Durasi berjalan ${durasiMenit(Math.max(0, menitAntara(state.checkedInAt, sekarang)))}`, nada: 'muted' } : null;
    default:
      return null;
  }
}

function labelBadge(state: KeadaanAbsen): { teks: string; nada: Tone } {
  switch (state.code) {
    case 'checked_in':
      return { teks: 'Sedang bekerja', nada: 'success' };
    case 'too_early':
      return { teks: 'Belum dibuka', nada: 'neutral' };
    case 'window_closed':
      return { teks: 'Check-in ditutup', nada: 'warning' };
    case 'not_checked_in':
    case 'no_office_location':
      return { teks: 'Belum check-in', nada: 'neutral' };
    default:
      return { teks: state.label, nada: 'neutral' };
  }
}

export function KartuJam({ state, schedule, sekarang, windowsApply = true }: { state: KeadaanAbsen; schedule: DaySchedule; sekarang: Date; windowsApply?: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const badge = labelBadge(state);
  const p = petunjuk(state, sekarang);
  const mode = schedule.workModeLabel
    ? state.isRemote && !/wfh/i.test(schedule.workModeLabel) && schedule.workModeLabel !== 'WFH'
      ? `${schedule.workModeLabel} · WFH`
      : schedule.workModeLabel
    : null;
  const jendela = windowsApply ? ringkasJendela(state.windows) : null;
  const jadwal = schedule.shiftName && schedule.start && schedule.end ? `Shift ${schedule.shiftName} · masuk ${jam(schedule.start)} · pulang ${jam(schedule.end)}` : null;

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="meta" style={{ fontSize: 14 }}>
          Jam sekarang
        </Text>
        <Badge tone={state.isRemote && state.code === 'not_checked_in' && mode ? 'info' : badge.nada}>{state.code === 'not_checked_in' && state.isRemote && mode ? mode : badge.teks}</Badge>
      </View>
      <Text
        variant="mono"
        style={{ fontSize: 44, lineHeight: 52, color: colors.text, letterSpacing: -1 }}
        accessibilityLabel={`Jam sekarang ${jam(sekarang)}`}
      >
        {jam(sekarang)}
      </Text>
      {jadwal ? (
        <Text variant="body" tone="muted" style={{ fontSize: 16, lineHeight: 22 }}>
          {state.code === 'checked_in' && state.checkedInAt && state.scheduledEnd
            ? `Masuk ${jam(state.checkedInAt)} · pulang terjadwal ${jam(state.scheduledEnd)}`
            : jadwal}
        </Text>
      ) : null}
      {p ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={p.nada === 'warn' ? 'clock-alert' : 'clock'} size={20} color={p.nada === 'warn' ? colors.warning : p.nada === 'ok' ? colors.success : colors.muted} />
          <Text variant="label" style={{ flex: 1, color: p.nada === 'warn' ? colors.warning : p.nada === 'ok' ? colors.success : colors.muted }}>
            {p.teks}
          </Text>
        </View>
      ) : null}
      {jendela ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessible accessibilityLabel={`Jam absen perusahaan: ${jendela}`}>
          <Icon name="clock" size={20} color={colors.muted} />
          <Text variant="meta" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
            Jam absen: {jendela}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
