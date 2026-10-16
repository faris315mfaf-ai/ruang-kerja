/** Pita keadaan halaman: offline (data terakhir tetap terbaca) dan gagal menyegarkan. */
import { jam } from '@/lib/format';
import { Banner } from '@/ui';

export function PitaOffline({ terakhir }: { terakhir: Date | null }): React.JSX.Element {
  return <Banner tone="warn" icon="wifi-off" message={terakhir ? `Tidak ada koneksi · data terakhir ${jam(terakhir)}` : 'Tidak ada koneksi.'} />;
}

export function PitaGagalSegar(): React.JSX.Element {
  return <Banner tone="warn" message="Gagal menyegarkan data — tarik ke bawah untuk mencoba lagi." />;
}
