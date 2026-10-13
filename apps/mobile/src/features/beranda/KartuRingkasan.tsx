/**
 * "Ringkasan" Beranda: metrik output berdampingan (tanpa skor produktivitas
 * gabungan). Staf tidak pernah melihat saldo cuti; non-staf melihatnya bila
 * server mengirimnya.
 */
import { View } from 'react-native';

import type { BerandaSaya } from '@/api/beranda';
import { Card, Text } from '@/ui';

import { angka, persen, tglSingkat } from './format';

function Petak({ label, nilai, catatan }: { label: string; nilai: string; catatan: string }): React.JSX.Element {
  return (
    <Card variant="tight" style={{ flex: 1, gap: 2 }}>
      <View accessible accessibilityLabel={`${label}: ${nilai}, ${catatan}`}>
        <Text variant="meta" style={{ fontSize: 14 }}>
          {label}
        </Text>
        <Text variant="kpi">{nilai}</Text>
        <Text variant="meta" style={{ fontSize: 14 }}>
          {catatan}
        </Text>
      </View>
    </Card>
  );
}

export function KartuRingkasan({ data }: { data: BerandaSaya }): React.JSX.Element | null {
  const r = data.ringkasan;
  if (!r) {
    return null;
  }
  const sejak = r.period.from ? `sejak ${tglSingkat(r.period.from)}` : r.period.label;
  const saldo = data.saldo_cuti;

  return (
    <View style={{ gap: 12 }}>
      <Text variant="h3" accessibilityRole="header">
        Ringkasan
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Petak label="Disiplin hadir" nilai={persen(r.attendance.attendance_discipline.value)} catatan="bulan ini" />
        <Petak label="Selesai bulan ini" nilai={angka(r.kpis.completed.value)} catatan={sejak} />
      </View>
      {saldo !== null && data.flags.saldo_cuti ? (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Petak label="Saldo cuti" nilai={`${angka(saldo.remaining, 1)} hari`} catatan={`${saldo.type} ${saldo.year}`} />
          <Petak label="Tugas terbuka" nilai={angka(r.kpis.open_tasks.value)} catatan={r.kpis.open_tasks.overdue > 0 ? `${r.kpis.open_tasks.overdue} terlambat` : 'tidak ada terlambat'} />
        </View>
      ) : null}
    </View>
  );
}
