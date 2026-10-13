/** Cadangan tampilan terakhir (dalam memori) untuk keadaan offline layar baca laporan. */
const simpanan = new Map<string, { data: unknown; pada: number }>();

export function ambilCache<T>(kunci: string): { data: T; pada: number } | null {
  const c = simpanan.get(kunci);
  return c ? { data: c.data as T, pada: c.pada } : null;
}

export function taruhCache(kunci: string, data: unknown): void {
  simpanan.set(kunci, { data, pada: Date.now() });
  if (simpanan.size > 30) {
    const pertama = simpanan.keys().next().value;
    if (pertama !== undefined) simpanan.delete(pertama);
  }
}
