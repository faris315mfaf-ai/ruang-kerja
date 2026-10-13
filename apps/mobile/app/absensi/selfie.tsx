/** Kamera selfie check-in/out → simpan ke store lalu kembali ke layar Absen. */
import { router, useLocalSearchParams } from 'expo-router';

import { KameraSelfie } from '@/components/KameraSelfie';
import { absenStore } from '@/features/absensi/store';
import { useTahanKunciSelama } from '@/features/absensi/useTahanKunciSelama';

function satu(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function LayarSelfie(): React.JSX.Element {
  useTahanKunciSelama();
  const p = useLocalSearchParams();
  return (
    <KameraSelfie
      judul={satu(p.judul) ?? 'Selfie check-in'}
      jadwal={satu(p.jadwal)}
      lokasi={satu(p.lokasi)}
      jamTampil={satu(p.jam)}
      onBatal={() => router.back()}
      onPindaiQr={
        satu(p.qr) === '1'
          ? () => {
              absenStore.setMetode('qr');
              router.back();
            }
          : undefined
      }
      onSelesai={(hasil) => {
        absenStore.setSelfie({ uri: hasil.uri, waktu: Date.now(), gelap: hasil.gelap });
        router.back();
      }}
    />
  );
}
