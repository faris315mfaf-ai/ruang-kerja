/** Pembantu kecil alur masuk: hitung mundur, format, galat. */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError } from '@/api/client';

export const REGEX_EMAIL = /^\S+@\S+\.\S+$/;

/** "0:47", "58:12". */
export function formatMenitDetik(totalDetik: number): string {
  const d = Math.max(0, Math.ceil(totalDetik));
  return `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`;
}

/** Detik tunggu 429: header Retry-After → "dalam N detik" di pesan → "satu menit" → 60. */
export function detikTunggu(err: ApiError): number {
  if (err.retryAfter !== null && err.retryAfter > 0) {
    return Math.min(err.retryAfter, 3600);
  }
  const cocok = /(\d+)\s*detik/i.exec(err.message);
  if (cocok?.[1]) {
    return Number(cocok[1]);
  }
  return 60;
}

/**
 * Hitung mundur dinding-jam (tahan terhadap jeda JS): `mulai(detik)` lalu
 * `sisa` turun tiap detik sampai 0; `habis` true setelah mencapai 0.
 */
export function useHitungMundur(): { sisa: number; mulai: (detik: number) => void; berjalan: boolean; habis: boolean } {
  const [sisa, setSisa] = useState(0);
  const [habis, setHabis] = useState(false);
  const sampaiRef = useRef(0);

  useEffect(() => {
    if (sisa <= 0) {
      return undefined;
    }
    const id = setInterval(() => {
      const baru = Math.ceil((sampaiRef.current - Date.now()) / 1000);
      if (baru > 0) {
        setSisa(baru);
      } else {
        setSisa(0);
        setHabis(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [sisa > 0]); // eslint-disable-line react-hooks/exhaustive-deps -- hanya perlu hidup/mati

  const mulai = useCallback((detik: number): void => {
    sampaiRef.current = Date.now() + detik * 1000;
    setHabis(false);
    setSisa(detik);
  }, []);

  return { sisa, mulai, berjalan: sisa > 0, habis };
}
