/**
 * Detail satu laporan (`GET /laporan/{id}`). Milik sendiri & hari ini →
 * formulir; milik sendiri lampau → baca saja terkunci (mockup 31-5); orang
 * lain (pembaca) → baca saja (mockup 34-2/34-3); 404 → mockup 34-5.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';

import { detailLaporan } from '@/api/laporan';
import { IsiLaporanBaca, dariItemLaporan } from '@/features/laporan/IsiLaporanBaca';
import { KepalaPemilik } from '@/features/laporan/KepalaPemilik';
import { LaporanTidakDitemukan } from '@/features/laporan/TidakDitemukan';
import { tanggalLaporan, tanggalTanpaHari } from '@/features/laporan/format';
import { useMuatBaca } from '@/features/laporan/useMuatBaca';
import { jam } from '@/lib/format';
import { Badge, Banner, Button, ErrorState, Loading, Screen, SubAppBar, Text, errorKindFromStatus } from '@/ui';

export default function DetailLaporan(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ambil = useCallback(() => detailLaporan(id), [id]);
  const m = useMuatBaca(`detail:${id}`, ambil);
  const d = m.data;

  useEffect(() => {
    if (d?.mine && d.can.edit) {
      router.replace('/laporan/hari-ini' as never);
    }
  }, [d]);

  if (m.galat?.status === 404) {
    return <LaporanTidakDitemukan />;
  }

  const judul = d ? (d.mine ? `Laporan ${tanggalTanpaHari(d.report.date)}` : `Laporan ${d.owner.name}`) : 'Laporan';
  const r = d?.report;

  return (
    <Screen header={<SubAppBar title={judul} />} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang(true)}>
      {m.memuat && !d ? (
        <Loading rows={5} label="Memuat laporan…" />
      ) : m.galat && !d ? (
        <ErrorState message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d && r ? (
        <>
          {d.mine ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="overline">Laporan saya</Text>
                <Text variant="h2" accessibilityRole="header">
                  {tanggalLaporan(r.date)}
                </Text>
              </View>
              <Badge tone={r.status === 'submitted' ? 'info' : 'warning'}>{r.status === 'submitted' ? (r.locked ? 'Terkirim · terkunci' : 'Terkirim') : r.locked ? 'Draf · terkunci' : 'Draf'}</Badge>
            </View>
          ) : (
            <KepalaPemilik
              nama={d.owner.name}
              baris2={[d.owner.position, d.owner.division].filter(Boolean).join(' · ') || null}
              baris3={`${tanggalLaporan(r.date)}${r.submitted_at ? ` · terkirim ${jam(r.submitted_at)}` : ''}`}
            />
          )}
          {d.mine && r.locked ? (
            <Banner
              tone="info"
              icon="lock"
              message={r.status === 'submitted' ? 'Laporan ini sudah terkunci (lewat 23.59) dan hanya bisa dibaca.' : 'Draf ini tidak sempat dikirim dan sudah terkunci (lewat 23.59). Pembaca tidak pernah melihatnya.'}
            />
          ) : null}
          <IsiLaporanBaca items={r.items.map(dariItemLaporan)} hours={r.hours} summary={r.summary} blockers={r.blockers} notes={r.notes} />
          {!d.mine ? (
            <Button title={`Riwayat ${d.owner.name}`} variant="outline" icon="history" onPress={() => router.push(`/laporan/orang/${d.owner.id}` as never)} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
