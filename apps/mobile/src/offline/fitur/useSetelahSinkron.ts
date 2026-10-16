/**
 * Hook: panggil `fn` (mis. muat ulang senyap) sesaat setelah satu putaran
 * sinkron yang menerbitkan item TUGAS berhasil — supaya daftar/detail beralih
 * dari overlay lokal ke data segar server tanpa pengguna menarik layar.
 */
import { useEffect, useRef } from 'react';

import { onAntrean } from '../antrean';

export function useSetelahSinkron(fn: () => void, awalan: string = 'tugas.'): void {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    let ada = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const lepas = onAntrean((p) => {
      if (p.tipe === 'sukses' && p.item.jenis.startsWith(awalan)) {
        ada = true;
      } else if (p.tipe === 'selesai' && ada) {
        ada = false;
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => ref.current(), 300);
      }
    });
    return () => {
      lepas();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [awalan]);
}
