/** Data detail proyek (`GET /proyek/{key}`) bersama untuk layar detail & turunannya (cache satu kunci). */
import { useCallback } from 'react';

import { detailProyek, type DetailProyek } from '@/api/proyek';
import { useResource, useSegarkanSaatFokus, type HasilResource } from '@/features/workspace/useResource';

export function useProyek(key: string): HasilResource<DetailProyek> {
  const ambil = useCallback(() => detailProyek(key), [key]);
  const r = useResource<DetailProyek>(key !== '' ? `proyek:${key.toUpperCase()}` : null, ambil);
  useSegarkanSaatFokus(r.muat);
  return r;
}

