/**
 * Sheet detail laporan dari id saja (sel matriks mingguan / hambatan; mockup
 * 06 › 38): `GET /monitoring/laporan/{id}` (B4-C) → isi baca laporan yang
 * sama dengan sheet laporan tim; 404 = "tidak lagi bisa dibuka".
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { laporanMonitor, type LaporanMonitor } from '@/api/laporan';
import { IsiLaporanBaca, dariItemMonitor } from '@/features/laporan/IsiLaporanBaca';
import { KepalaPemilik } from '@/features/laporan/KepalaPemilik';
import { tanggalLaporan } from '@/features/laporan/format';
import { jam } from '@/lib/format';
import { BottomSheet, Button, ErrorState, Loading } from '@/ui';

export function LaporanSheetId({ id, onClose }: { id: string | null; onClose: () => void }): React.JSX.Element {
  const [data, setData] = useState<LaporanMonitor | null>(null);
  const [galat, setGalat] = useState<{ pesan: string; status: number } | null>(null);
  const [ulang, setUlang] = useState(0);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset saat laporan lain dibuka */
    setData(null);
    setGalat(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!id) return undefined;
    let batal = false;
    laporanMonitor(id)
      .then((r) => {
        if (!batal) setData(r);
      })
      .catch((err: unknown) => {
        if (batal) return;
        const status = err instanceof ApiError ? err.status : 0;
        setGalat({ status, pesan: status === 404 ? 'Laporan ini tidak lagi bisa dibuka.' : status === 0 ? 'Tidak ada koneksi. Coba lagi saat tersambung.' : err instanceof ApiError ? err.message : 'Laporan gagal dimuat.' });
      });
    return () => {
      batal = true;
    };
  }, [id, ulang]);

  return (
    <BottomSheet visible={id !== null} onClose={onClose} scrollable snapPoints={['85%']}>
      {data ? (
        <View style={{ gap: 16 }}>
          <KepalaPemilik nama={data.user.name} baris2={data.user.division} baris3={`${tanggalLaporan(data.date)}${data.submitted_at ? ` · terkirim ${jam(data.submitted_at)}` : ''}`} />
          <IsiLaporanBaca items={data.items.map(dariItemMonitor)} hours={data.hours} summary={data.summary} blockers={data.blockers} notes={data.notes} />
          <Button
            title="Buka laporan penuh"
            variant="outline"
            icon="file-text"
            onPress={() => {
              onClose();
              router.push(`/laporan/${data.id}` as never);
            }}
          />
          <Button
            title={`Riwayat ${data.user.name}`}
            variant="quiet"
            icon="history"
            onPress={() => {
              onClose();
              router.push(`/laporan/orang/${data.user.id}` as never);
            }}
          />
        </View>
      ) : galat ? (
        <ErrorState kind={galat.status === 404 ? 'notfound' : galat.status === 0 ? 'offline' : 'umum'} message={galat.pesan} onRetry={galat.status === 404 ? undefined : () => setUlang((n) => n + 1)} />
      ) : (
        <Loading rows={4} label="Memuat laporan…" />
      )}
    </BottomSheet>
  );
}
