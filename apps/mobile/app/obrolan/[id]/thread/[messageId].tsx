/**
 * Thread (layar penuh) — isi di `@/features/obrolan/Thread` supaya juga bisa
 * tampil sebagai panel thread Obrolan di tablet.
 */
import { useLocalSearchParams } from 'expo-router';

import { Thread } from '@/features/obrolan/Thread';

export default function LayarThread(): React.JSX.Element {
  const { id, messageId, nama } = useLocalSearchParams<{ id: string; messageId: string; nama?: string }>();
  return <Thread id={typeof id === 'string' ? id : undefined} messageId={typeof messageId === 'string' ? messageId : undefined} nama={nama} />;
}
