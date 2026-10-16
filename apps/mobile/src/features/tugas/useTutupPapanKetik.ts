/**
 * Lembar pemilih yang dibuka dari formulir (mis. pil Tenggat/Label saat judul
 * sedang diketik) menutup papan ketik dulu: tanpa ini papan ketik tetap
 * terbuka dan menutupi isi lembar pemilih.
 */
import { useEffect } from 'react';
import { Keyboard } from 'react-native';

export function useTutupPapanKetik(visible: boolean): void {
  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
    }
  }, [visible]);
}
