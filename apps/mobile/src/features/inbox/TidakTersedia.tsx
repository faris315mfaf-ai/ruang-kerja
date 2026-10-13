/** Layar "tujuan tidak tersedia" (404/terkunci) — mockup 07-inbox-detail layar 3. */
import { router } from 'expo-router';
import { useEffect } from 'react';

import { EmptyState, Screen, SubAppBar, useSnackbar } from '@/ui';

export function TidakTersedia({ jenis, judulBar, kembaliKe = '/inbox', labelKembali = 'Kembali ke Inbox' }: { jenis: string; judulBar?: string; kembaliKe?: string; labelKembali?: string }): React.JSX.Element {
  const snackbar = useSnackbar();
  useEffect(() => {
    snackbar.show({ message: 'Tujuan notifikasi tidak ditemukan', variant: 'info' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali saat layar dibuka
  }, []);
  return (
    <Screen header={<SubAppBar title={judulBar ?? jenis} />} contentStyle={{ paddingTop: 16 }}>
      <EmptyState
        icon="lock"
        title={`${jenis} ini tidak tersedia`}
        description={`${jenis} dihapus atau Anda tidak lagi punya akses. Notifikasinya tetap ada di Inbox.`}
        actionLabel={labelKembali}
        onAction={() => router.replace(kembaliKe as never)}
      />
    </Screen>
  );
}
