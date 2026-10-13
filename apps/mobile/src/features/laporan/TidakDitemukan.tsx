/** 404 laporan (mockup 34-5): draf orang lain / bukan pembaca. */
import { router } from 'expo-router';

import { EmptyState, Screen, SubAppBar } from '@/ui';

export function LaporanTidakDitemukan({ judul = 'Laporan' }: { judul?: string }): React.JSX.Element {
  return (
    <Screen header={<SubAppBar title={judul} />} contentStyle={{ paddingTop: 24 }}>
      <EmptyState
        icon="circle-help"
        title="Laporan tidak ditemukan"
        description="Laporan belum dikirim atau Anda tidak berhak membacanya."
        actionLabel="Kembali"
        onAction={() => (router.canGoBack() ? router.back() : router.replace('/laporan' as never))}
      />
    </Screen>
  );
}
