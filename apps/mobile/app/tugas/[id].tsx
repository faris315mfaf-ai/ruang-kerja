/**
 * Detail tugas (layar penuh) — isi di `@/features/tugas/DetailTugas` supaya
 * bisa juga tampil sebagai panel kanan Tugas dua panel di tablet.
 */
import { useLocalSearchParams } from 'expo-router';

import { DetailTugas } from '@/features/tugas/DetailTugas';

export default function LayarDetailTugas(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DetailTugas id={typeof id === 'string' ? id : undefined} />;
}
