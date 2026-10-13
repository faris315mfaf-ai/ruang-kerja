/**
 * Ketuk push → layar tujuan. Memakai resolver tujuan yang sama dengan Inbox dan
 * Cari (`resolveTarget`): target dari server, tidak pernah mem-parsing URL web.
 * Tanpa target (`inbox`) → lembar detail notifikasi `/inbox/{id}`; tujuan yang
 * tidak ada/terkunci ditangani layarnya sendiri ("tidak ditemukan atau tanpa akses").
 */
import { router } from 'expo-router';

import { aksiInbox } from '@/api/inbox';
import { bukaTujuan, resolveTarget } from '@/features/inbox/target';

import { idInboxDariPush, targetDariPush, type DataPush } from './data';

/** Rute layar "Notifikasi di ponsel ini" — tujuan ketukan notifikasi uji LOKAL. */
export const RUTE_UJI_LOKAL = '/pengaturan/notifikasi-ponsel';

/** Dipanggil setelah baris Inbox ditandai dibaca (menerima jumlah belum dibaca terbaru). */
export type SetelahBaca = (belumDibaca: number) => void;

export function bukaDariPush(data: DataPush, setelahBaca?: SetelahBaca): void {
  if (data.lokal === '1') {
    router.push(RUTE_UJI_LOKAL as never);
    return;
  }

  const idInbox = idInboxDariPush(data);
  if (idInbox !== '') {
    void aksiInbox(idInbox, 'baca')
      .then((hasil) => setelahBaca?.(hasil.unread))
      .catch(() => undefined); // 404/offline: tidak menghalangi membuka tujuan
  }

  const tujuan = resolveTarget(targetDariPush(data), { notifikasiId: idInbox === '' ? undefined : idInbox });

  // Kembali ke tab induk dulu supaya "Kembali" dari tujuan tidak menumpuk di layar yang sedang terbuka.
  if (router.canDismiss()) {
    router.dismissAll();
    setTimeout(() => bukaTujuan(tujuan, idInbox === '' ? undefined : idInbox), 60);
    return;
  }
  bukaTujuan(tujuan, idInbox === '' ? undefined : idInbox);
}
