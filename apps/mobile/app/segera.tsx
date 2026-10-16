/** Rute generik "Segera hadir" untuk butir menu yang fiturnya belum dibangun. */
import { useLocalSearchParams } from 'expo-router';

import { bacaParamSegera, ComingSoon } from '@/features/settings/ComingSoon';

export default function LayarSegera(): React.JSX.Element {
  const param = useLocalSearchParams();
  return <ComingSoon {...bacaParamSegera(param)} />;
}
