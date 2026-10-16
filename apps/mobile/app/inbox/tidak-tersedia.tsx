/** Rute "tujuan notifikasi tidak tersedia" (dipakai resolver tujuan). */
import { useLocalSearchParams } from 'expo-router';

import { TidakTersedia } from '@/features/inbox/TidakTersedia';

export default function LayarTidakTersedia(): React.JSX.Element {
  const { jenis } = useLocalSearchParams<{ jenis?: string }>();
  return <TidakTersedia jenis={jenis ?? 'Halaman'} />;
}
