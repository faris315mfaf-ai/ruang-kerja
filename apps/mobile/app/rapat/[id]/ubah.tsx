/** Ubah rapat (mockup 08 › 11-3): perubahan berlaku untuk seluruh seri. */
import { useLocalSearchParams } from 'expo-router';

import { FormRapat } from '@/features/rapat/FormRapat';

export default function LayarUbahRapat(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FormRapat rapatId={typeof id === 'string' ? id : ''} />;
}
