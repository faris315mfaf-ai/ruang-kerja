/**
 * Kinerja saya (spec 02, `11-kinerja-saya`): empat metrik output berdampingan
 * (penyelesaian, tepat waktu, lead time, hadir tepat waktu), tugas terlambat
 * sekarang, grafik mingguan, selesai per workspace. TANPA skor produktivitas
 * gabungan. `?user=` membuka kinerja orang lain bila berhak (404 selain itu).
 */
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { kinerja as ambilKinerja, type Kinerja, type PeriodeDasbor } from '@/api/beranda';
import { useTheme } from '@/theme';
import { Banner, BottomSheet, Button, Card, ErrorState, KpiCard, Loading, OfflineBanner, Panel, Pressable, Screen, Segmented, SubAppBar, Text, IconTile, Icon, errorKindFromStatus } from '@/ui';

import { angka, persen } from './format';
import { useMuat } from './useMuat';

const OPSI: { value: PeriodeDasbor; label: string }[] = [
  { value: 'minggu', label: '8 minggu' },
  { value: 'bulan', label: 'Bulan ini' },
  { value: 'kuartal', label: 'Kuartal' },
];

function kosong(k: Kinerja): boolean {
  return k.counts.due === 0 && k.counts.done_with_due === 0 && k.counts.scheduled_days === 0 && k.by_workspace.length === 0 && k.overdue_count === 0;
}

export function KinerjaLayar(): React.JSX.Element {
  const params = useLocalSearchParams<{ user?: string }>();
  const userId = typeof params.user === 'string' && params.user !== '' ? params.user : null;
  const [periode, setPeriode] = useState<PeriodeDasbor>('minggu');
  const [cara, setCara] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);

  const ambil = useCallback(() => ambilKinerja(periode, userId), [periode, userId]);
  const h = useMuat<Kinerja>(ambil);
  const k = h.data;

  const judul = userId && k ? `Kinerja ${k.person.name}` : userId ? 'Kinerja' : 'Kinerja saya';

  return (
    <Screen
      header={<SubAppBar title={judul} />}
      refreshing={menyegarkan}
      onRefresh={() => {
        setMenyegarkan(true);
        void h.muat(true).finally(() => setMenyegarkan(false));
      }}
      contentStyle={{ paddingTop: 12 }}
    >
      <Segmented<PeriodeDasbor> value={periode} onChange={setPeriode} options={OPSI} />
      {h.offline ? <OfflineBanner /> : null}

      {k === null ? (
        h.galat !== null && !h.memuat ? (
          <ErrorState
            kind={errorKindFromStatus(h.galat.status)}
            title={h.galat.status === 404 ? 'Tidak ditemukan' : undefined}
            message={h.galat.status === 404 || h.galat.status === 403 ? 'Data kinerja ini tidak tersedia untuk Anda.' : h.galat.message}
            onRetry={h.galat.status === 404 || h.galat.status === 403 ? undefined : () => void h.muat()}
          />
        ) : (
          <Loading rows={4} label="Memuat kinerja…" />
        )
      ) : kosong(k) ? (
        <ErrorLike />
      ) : (
        <Isi k={k} lainnya={userId !== null} onCara={() => setCara(true)} />
      )}

      <BottomSheet visible={cara} onClose={() => setCara(false)} title="Cara menghitung metrik" scrollable>
        <Text variant="body">Penyelesaian: tugas selesai dibagi semua tugas yang tenggatnya jatuh di periode ini.</Text>
        <Text variant="body">Tepat waktu: tugas yang selesai pada atau sebelum tenggat dibagi semua tugas selesai yang punya tenggat.</Text>
        <Text variant="body">Lead time: median lama pengerjaan, dari tugas dibuat sampai selesai.</Text>
        <Text variant="body">Hadir tepat waktu: hari hadir tepat waktu dibagi hari kerja terjadwal.</Text>
        <Text variant="meta">Metrik ditampilkan berdampingan. Tidak ada skor produktivitas gabungan.</Text>
        <Button title="Tutup" variant="outline" onPress={() => setCara(false)} />
      </BottomSheet>
    </Screen>
  );
}

function ErrorLike(): React.JSX.Element {
  return (
    <Card style={{ alignItems: 'center', gap: 6 }}>
      <Text variant="h3">Belum ada data kinerja</Text>
      <Text variant="body" tone="muted" align="center" style={{ fontSize: 15, lineHeight: 22 }}>
        Metrik muncul setelah ada tugas bertenggat atau jadwal kerja di periode ini.
      </Text>
    </Card>
  );
}

function Isi({ k, lainnya, onCara }: { k: Kinerja; lainnya: boolean; onCara: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const c = k.counts;
  const pen = c.due > 0 ? Math.round((c.done_of_due / c.due) * 100) : null;
  const tep = c.done_with_due > 0 ? Math.round((c.on_time / c.done_with_due) * 100) : null;
  const maks = Math.max(1, ...k.weeks.map((w) => w.on_time + w.late));
  const rangeLabel = k.period_label;

  return (
    <>
      <Text variant="meta" style={{ fontSize: 14 }}>
        {rangeLabel}
      </Text>

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <KpiCard style={{ flex: 1 }} highlight label="Penyelesaian" value={persen(pen)} delta={c.due > 0 ? `${c.done_of_due} dari ${c.due}` : undefined} />
          <KpiCard style={{ flex: 1 }} label="Tepat waktu" value={persen(tep)} delta={c.done_with_due > 0 ? `${c.on_time} dari ${c.done_with_due}` : undefined} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <KpiCard style={{ flex: 1 }} label="Lead time" value={c.lead_time === null ? '—' : `${angka(c.lead_time, 1)} hari`} delta={c.lead_time === null ? undefined : 'median'} />
          <KpiCard
            style={{ flex: 1 }}
            label="Hadir tepat waktu"
            value={persen(k.attendance.on_time_rate)}
            delta={c.scheduled_days > 0 ? `${c.on_time_days} dari ${c.scheduled_days} hari` : undefined}
          />
        </View>
      </View>

      <Card variant="tight" style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="title">Terlambat sekarang</Text>
          <Text variant="kpi" tone={k.overdue_count > 0 ? 'danger' : 'text'}>
            {angka(k.overdue_count)}
          </Text>
        </View>
        {k.overdue.length > 0 ? (
          <Text variant="mono" tone="muted" numberOfLines={2}>
            {k.overdue.map((o) => o.key).join(', ')}
          </Text>
        ) : (
          <Text variant="meta">Tidak ada tugas yang lewat tenggat.</Text>
        )}
      </Card>

      <Panel title="Tugas selesai per minggu">
        {k.weeks.every((w) => w.on_time + w.late === 0) ? (
          <Text variant="meta">Belum ada tugas bertenggat yang selesai pada periode ini.</Text>
        ) : (
          <>
            <View accessible accessibilityLabel={`Tugas selesai per minggu: ${k.weeks.map((w, i) => `M${i + 1} ${w.on_time + w.late}`).join(', ')}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 130 }}>
              {k.weeks.map((w, i) => {
                const total = w.on_time + w.late;
                const tinggi = Math.max(total > 0 ? 6 : 3, (total / maks) * 100);
                return (
                  <View key={w.week_start} style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', height: 130, gap: 4 }}>
                    <View style={{ width: '100%', height: tinggi, borderRadius: 6, overflow: 'hidden', backgroundColor: colors.surface2, justifyContent: 'flex-end' }}>
                      {w.late > 0 ? <View style={{ flex: w.late, backgroundColor: colors.fill.warning }} /> : null}
                      {w.on_time > 0 ? <View style={{ flex: w.on_time, backgroundColor: i === k.weeks.length - 1 ? colors.primary : colors.fill.teal }} /> : null}
                    </View>
                    <Text variant="meta" style={{ fontSize: 12 }}>{`M${i + 1}`}</Text>
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Legenda warna={colors.fill.teal} teks="Tepat waktu" />
              <Legenda warna={colors.fill.warning} teks="Terlambat" />
            </View>
          </>
        )}
      </Panel>

      <Panel title="Selesai per workspace">
        {k.by_workspace.length === 0 ? (
          <Text variant="meta">Belum ada tugas selesai pada periode ini.</Text>
        ) : (
          k.by_workspace.map((w) => (
            <View key={w.workspace?.id ?? w.done} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
              <IconTile icon="layout-grid" tone="teal" />
              <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
                {w.workspace?.name ?? 'Workspace lain'}
              </Text>
              <Text variant="title" weight={700}>
                {angka(w.done)}
              </Text>
            </View>
          ))
        )}
      </Panel>

      <Banner tone="info" icon="shield-check" message={lainnya ? 'Data ini hanya terlihat oleh yang bersangkutan, atasan, dan HR. Tidak ada pelacakan layar atau aplikasi.' : 'Hanya Anda, atasan, dan HR yang melihat data ini. Tidak ada pelacakan layar atau aplikasi.'} />

      <Card variant="flat">
        <Pressable onPress={onCara} scaleTo={1} accessibilityRole="button" accessibilityLabel="Cara menghitung metrik" style={{ minHeight: 56, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="title" style={{ flex: 1 }}>
            Cara menghitung metrik
          </Text>
          <Icon name="chevron-right" size={20} />
        </Pressable>
      </Card>
      <Text variant="meta" align="center">
        Metrik ditampilkan berdampingan. Tidak ada skor produktivitas gabungan.
      </Text>
    </>
  );
}

function Legenda({ warna, teks }: { warna: string; teks: string }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: warna }} />
      <Text variant="meta" style={{ fontSize: 14 }}>
        {teks}
      </Text>
    </View>
  );
}
