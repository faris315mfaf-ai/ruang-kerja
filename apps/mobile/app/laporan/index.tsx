/**
 * Laporan harian — riwayat milik sendiri per bulan (mockup 06 › 32): kartu
 * hari ini, pemilih bulan, hitungan (chip filter), daftar per tanggal
 * (Terkirim/Draf/Tidak lapor/Libur) → detail. Pembaca juga mendapat pintu
 * "Laporan tim".
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { riwayatLaporan, type HariRiwayat } from '@/api/laporan';
import { BarisRiwayat } from '@/features/laporan/BarisRiwayat';
import { KartuHariIniRiwayat } from '@/features/laporan/KartuHariIniRiwayat';
import { useBolehLaporanTim } from '@/features/laporan/akses';
import { labelBulan } from '@/features/laporan/format';
import { useMuatBaca } from '@/features/laporan/useMuatBaca';
import { jam } from '@/lib/format';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme';
import { Banner, Card, Chip, ChipScroller, EmptyState, ErrorState, IconButton, ListRow, Loading, Screen, SubAppBar, Text, errorKindFromStatus } from '@/ui';

type Saring = 'semua' | 'submitted' | 'draft' | 'missing';

export default function RiwayatLaporan(): React.JSX.Element {
  const { colors } = useTheme();
  const { user } = useSession();
  const bolehTim = useBolehLaporanTim();
  const [bulan, setBulan] = useState<string | undefined>(undefined);
  const [saring, setSaring] = useState<Saring>('semua');
  const ambil = useCallback(() => riwayatLaporan(bulan), [bulan]);
  const m = useMuatBaca(`riwayat:${user?.id ?? ''}:${bulan ?? 'ini'}`, ambil);
  const d = m.data;

  const pertama = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (pertama.current) {
        pertama.current = false;
        return;
      }
      void m.muatUlang(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- segarkan saat kembali dari formulir
    }, []),
  );

  const hari: HariRiwayat[] = (d?.days ?? []).filter((x) => !x.is_today && (saring === 'semua' || x.status === saring));

  return (
    <Screen header={<SubAppBar title="Laporan harian" />} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang(true)}>
      {m.offlineSejak !== null ? <Banner tone="neutral" icon="cloud-off" message={`Anda sedang offline · menampilkan data tersimpan pukul ${jam(new Date(m.offlineSejak))}`} /> : null}
      {m.memuat && !d ? (
        <Loading rows={5} label="Memuat riwayat laporan…" />
      ) : m.galat && !d ? (
        <ErrorState message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d ? (
        <>
          <KartuHariIniRiwayat hariIni={d.hari_ini} />
          {bolehTim ? (
            <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow icon="users" iconTone="teal" title="Laporan tim" subtitle="Siapa yang sudah dan belum lapor" onPress={() => router.push('/laporan/tim' as never)} style={{ paddingHorizontal: 16 }} />
            </Card>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Text variant="h3" accessibilityRole="header">
              Riwayat
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <IconButton icon="chevron-left" label="Bulan sebelumnya" variant="ghost" size={44} disabled={!d.bulan_sebelumnya} onPress={() => d.bulan_sebelumnya && setBulan(d.bulan_sebelumnya)} />
              <Text variant="label" tone="muted" style={{ minWidth: 72, textAlign: 'center' }} accessibilityLiveRegion="polite">
                {labelBulan(d.bulan)}
              </Text>
              <IconButton icon="chevron-right" label="Bulan berikutnya" variant="ghost" size={44} disabled={!d.bulan_berikutnya} onPress={() => d.bulan_berikutnya && setBulan(d.bulan_berikutnya)} />
            </View>
          </View>
          <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
            <Chip label="Semua" selected={saring === 'semua'} onPress={() => setSaring('semua')} />
            <Chip label="Terkirim" count={d.counts.submitted} selected={saring === 'submitted'} onPress={() => setSaring('submitted')} />
            <Chip label="Draf" count={d.counts.draft} selected={saring === 'draft'} onPress={() => setSaring('draft')} />
            <Chip label="Tidak lapor" count={d.counts.missing} selected={saring === 'missing'} onPress={() => setSaring('missing')} />
          </ChipScroller>
          {hari.length === 0 ? (
            saring === 'semua' ? (
              <EmptyState icon="history" title="Belum ada riwayat" description="Laporan yang Anda kirim muncul di sini." />
            ) : (
              <EmptyState icon="history" title="Tidak ada hari dengan status ini" description={`Bulan ${labelBulan(d.bulan)}.`} variant="plain" />
            )
          ) : (
            <Card variant="flat" style={{ padding: 0, overflow: 'hidden', borderColor: colors.border }}>
              {hari.map((h, i) => (
                <BarisRiwayat
                  key={h.date}
                  date={h.date}
                  status={h.status}
                  summary={h.report?.summary ?? null}
                  hasBlockers={h.report?.has_blockers ?? false}
                  itemsCount={h.report?.items_count ?? 0}
                  hours={h.report?.hours ?? null}
                  holiday={h.holiday ?? null}
                  garis={i > 0}
                  onPress={h.report ? () => router.push(`/laporan/${h.report?.id ?? ''}` as never) : undefined}
                />
              ))}
            </Card>
          )}
          <Text variant="meta" align="center" style={{ fontSize: 14 }}>
            Draf hanya terlihat oleh Anda.
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
