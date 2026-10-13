/** Deep link `ruangkerja://okr/kr/{id}/check-in` (pengingat Jumat 15.00) → detail KR dengan sheet check-in terbuka. */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function DeepLinkCheckin(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/okr/kr/${encodeURIComponent(typeof id === 'string' ? id : '')}?checkin=1` as never} />;
}
