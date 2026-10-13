/** Status tarik-untuk-segarkan terpisah dari penyegaran diam-diam saat fokus. */
import { useCallback, useState } from 'react';

export function useTarik(muat: () => Promise<unknown>): { menarik: boolean; tarik: () => void } {
  const [menarik, setMenarik] = useState(false);
  const tarik = useCallback(() => {
    setMenarik(true);
    void muat().finally(() => setMenarik(false));
  }, [muat]);
  return { menarik, tarik };
}
