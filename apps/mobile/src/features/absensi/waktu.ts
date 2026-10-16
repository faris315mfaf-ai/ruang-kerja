import { useEffect, useState } from 'react';

/** Selisih jam perangkat dari server (ms) diambil saat data dimuat. */
export function hitungOffset(serverTime: string | null | undefined): number {
  const s = serverTime ? Date.parse(serverTime) : NaN;
  return Number.isNaN(s) ? 0 : s - Date.now();
}

/** Jam yang diselaraskan dengan server, diperbarui berkala (`intervalMs`). */
export function useJamServer(offsetMs: number, intervalMs = 15_000): Date {
  const [sekarang, setSekarang] = useState(() => new Date(Date.now() + offsetMs));
  useEffect(() => {
    const perbarui = (): void => setSekarang(new Date(Date.now() + offsetMs));
    perbarui();
    const t = setInterval(perbarui, intervalMs);
    return () => clearInterval(t);
  }, [offsetMs, intervalMs]);
  return sekarang;
}

/** Jam perangkat menyimpang lebih dari ini = ditandai `clock_skew` oleh server. */
export const SKEW_TANDAI_MS = 5 * 60_000;

export function menitAntara(dari: Date | string | null, ke: Date): number {
  const d = typeof dari === 'string' ? Date.parse(dari) : dari instanceof Date ? dari.getTime() : NaN;
  return Number.isNaN(d) ? 0 : Math.floor((ke.getTime() - d) / 60_000);
}
