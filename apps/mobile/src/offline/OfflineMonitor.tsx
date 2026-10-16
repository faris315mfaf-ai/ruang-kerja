/**
 * Komponen tanpa tampilan (`app/_layout.tsx`):
 *  - `PemantauJaringan`: dipasang SEUMUR APLIKASI (juga di layar Masuk): memulai
 *    pemantauan jaringan sesudah frame pertama. Harus tetap hidup saat belum
 *    bersesi — bila tidak, status jaringan basi (mis. airplane mode dimatikan di
 *    layar Masuk) membuat login gagal cepat.
 *  - `OfflineMonitor`: dipasang saat ada sesi: memuat penangan fitur
 *    (`penanganFitur.ts`) dan menampilkan snackbar hasil sinkron ("N item
 *    tersinkron") dan peringatan konflik.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, InteractionManager } from 'react-native';

import { useSnackbar } from '@/ui';

import './penanganFitur';
import { onAntrean, penanganUntuk, type GalatItem, type ItemAntrean } from './antrean';
import { mulaiJaringan } from './jaringan';

export function PemantauJaringan(): null {
  useEffect(() => {
    let berhenti: (() => void) | null = null;
    const tugas = InteractionManager.runAfterInteractions(() => {
      berhenti = mulaiJaringan();
    });
    return () => {
      tugas.cancel();
      berhenti?.();
    };
  }, []);
  return null;
}

export function OfflineMonitor(): null {
  const snackbar = useSnackbar();

  useEffect(() => {
    let konflikTerakhir: { item: ItemAntrean; galat: GalatItem } | null = null;
    let pesanKhusus: string[] = [];
    return onAntrean((p) => {
      if (p.tipe === 'konflik') {
        konflikTerakhir = { item: p.item, galat: p.galat };
        return;
      }
      if (p.tipe === 'sukses') {
        const pesan = penanganUntuk(p.item.jenis)?.pesanSukses?.(p.item);
        if (pesan) {
          pesanKhusus.push(pesan);
        }
        return;
      }
      if (p.tipe !== 'selesai') {
        return;
      }
      if (AppState.currentState !== 'active') {
        konflikTerakhir = null;
        pesanKhusus = [];
        return;
      }
      const lihat = { actionLabel: 'Lihat', onAction: () => router.push('/sinkron' as never) };
      if (p.konflik > 0) {
        const satu = p.konflik === 1 && konflikTerakhir ? `"${konflikTerakhir.item.label}" tidak bisa dikirim: ${konflikTerakhir.galat.pesan}` : null;
        const awal = p.sukses > 0 ? `${p.sukses} item tersinkron · ` : '';
        snackbar.show({ message: satu ?? `${awal}${p.konflik} perubahan perlu diperiksa`, variant: 'warn', duration: 7000, ...lihat });
      } else if (p.sukses > 0) {
        // Semua item putaran ini punya pesan khusus fitur (mis. "Absen masuk 07.52 tersinkron"): tampilkan itu.
        const khusus = pesanKhusus.length === p.sukses && p.sukses <= 2 ? pesanKhusus.join(' · ') : null;
        snackbar.show({ message: khusus ?? (p.sukses === 1 ? '1 item tersinkron' : `${p.sukses} item tersinkron`), variant: 'ok' });
      }
      konflikTerakhir = null;
      pesanKhusus = [];
    });
  }, [snackbar]);

  return null;
}
