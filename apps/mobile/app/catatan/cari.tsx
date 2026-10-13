/** Layar cari catatan (`/catatan/cari`): kolom cari + hasil lintas workspace dengan chip berhitung. */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { HasilCari } from '@/features/catatan/HasilCari';
import { Screen, SearchInput, SubAppBar } from '@/ui';

export default function LayarCariCatatan(): React.JSX.Element {
  const { q: awal, workspace } = useLocalSearchParams<{ q?: string; workspace?: string }>();
  const [q, setQ] = useState(typeof awal === 'string' ? awal : '');
  const wsParam = typeof workspace === 'string' && workspace !== '' ? workspace : null;
  return (
    <Screen header={<SubAppBar title="Cari catatan" />} contentStyle={{ paddingTop: 12 }}>
      <SearchInput value={q} onChangeText={setQ} placeholder="Cari judul atau isi catatan" autoFocus />
      <HasilCari q={q} workspaceId={wsParam} onHapus={() => setQ('')} />
    </Screen>
  );
}
