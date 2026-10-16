/**
 * Riwayat laporan satu orang (pembaca, `GET /laporan/orang/{user}`, mockup
 * 34-4): hanya laporan terkirim bagi pembaca; pemilik melihat drafnya juga.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { riwayatOrang } from '@/api/laporan';
import { BarisRiwayat } from '@/features/laporan/BarisRiwayat';
import { KepalaPemilik } from '@/features/laporan/KepalaPemilik';
import { LaporanTidakDitemukan } from '@/features/laporan/TidakDitemukan';
import { useMuatBaca } from '@/features/laporan/useMuatBaca';
import { jam } from '@/lib/format';
import { Banner, Card, EmptyState, ErrorState, Loading, Screen, SubAppBar, Text, errorKindFromStatus } from '@/ui';

export default function RiwayatOrangLayar(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ambil = useCallback(() => riwayatOrang(id), [id]);
  const m = useMuatBaca(`orang:${id}`, ambil);
  const d = m.data;

  if (m.galat?.status === 404) {
    return <LaporanTidakDitemukan />;
  }

  return (
    <Screen header={<SubAppBar title={d ? `Laporan ${d.owner.name}` : 'Laporan'} />} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang(true)}>
      {m.offlineSejak !== null ? <Banner tone="neutral" icon="cloud-off" message={`Anda sedang offline · menampilkan data tersimpan pukul ${jam(new Date(m.offlineSejak))}`} /> : null}
      {m.memuat && !d ? (
        <Loading rows={5} label="Memuat riwayat…" />
      ) : m.galat && !d ? (
        <ErrorState message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d ? (
        <>
          <KepalaPemilik nama={d.owner.name} baris2={d.mine ? 'Riwayat laporan saya' : 'Riwayat laporan terkirim'} baris3={[d.owner.position, d.owner.division].filter(Boolean).join(' · ') || null} />
          {d.reports.length === 0 ? (
            <EmptyState icon="history" title="Belum ada laporan terkirim" description="Laporan muncul di sini setelah dikirim." />
          ) : (
            <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
              {d.reports.map((r, i) => (
                <BarisRiwayat
                  key={r.id}
                  date={r.date}
                  status={r.status}
                  summary={r.summary}
                  hasBlockers={r.has_blockers}
                  itemsCount={r.items_count}
                  hours={r.hours}
                  garis={i > 0}
                  onPress={() => router.push(`/laporan/${r.id}` as never)}
                />
              ))}
            </Card>
          )}
          {!d.mine ? (
            <Text variant="meta" align="center" style={{ fontSize: 14 }}>
              Draf tidak pernah terlihat pembaca.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
