/**
 * Percakapan (layar penuh) — isi di `@/features/obrolan/Percakapan` supaya
 * juga bisa tampil sebagai kolom tengah Obrolan di tablet.
 */
import { useLocalSearchParams } from 'expo-router';

import { Percakapan } from '@/features/obrolan/Percakapan';

export default function LayarKanal(): React.JSX.Element {
  const { id, nama, jenis, lr } = useLocalSearchParams<{ id: string; nama?: string; jenis?: string; lr?: string }>();
  return <Percakapan id={typeof id === 'string' ? id : undefined} nama={nama} jenis={jenis} lr={lr} />;
}
