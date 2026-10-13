/** Catatan tindakan pribadi (mockup 06 › 19; N1–N6) — layar penuh; 403 terkunci untuk peran lain. */
import { router } from 'expo-router';
import { useCallback } from 'react';

import { ApiError } from '@/api/client';
import { daftarCatatanTindakan, type CatatanTindakan } from '@/api/manajemen';
import { CatatanTindakanDaftar } from '@/features/manajemen/CatatanTindakan';
import { useTarik } from '@/features/proyek/useTarik';
import { useResource } from '@/features/workspace/useResource';
import { ErrorState, Loading, LockedState, Screen, SubAppBar, errorKindFromStatus } from '@/ui';

export default function LayarCatatanTindakan(): React.JSX.Element {
  const r = useResource<{ notes: CatatanTindakan[]; limit: number }>('catatan-tindakan', useCallback(() => daftarCatatanTindakan(), []));
  const { menarik, tarik } = useTarik(r.muat);

  if (r.galat instanceof ApiError && r.galat.status === 403) {
    return (
      <Screen header={<SubAppBar title="Catatan tindakan" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState reason="Catatan tindakan untuk Direksi, HR, dan Super Admin." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }
  return (
    <Screen header={<SubAppBar title="Catatan tindakan" />} refreshing={menarik} onRefresh={tarik}>
      {r.data ? (
        <CatatanTindakanDaftar awal={r.data.notes} offline={r.offline} />
      ) : r.galat ? (
        <ErrorState kind={errorKindFromStatus(r.galat.status)} message={r.galat.message} onRetry={() => void r.muat()} />
      ) : (
        <Loading rows={5} label="Memuat catatan tindakan…" />
      )}
    </Screen>
  );
}
