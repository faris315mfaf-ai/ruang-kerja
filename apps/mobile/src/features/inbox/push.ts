/**
 * Push FCM — BELUM AKTIF.
 *
 * TODO(pemilik): daftarkan push hanya setelah kredensial Firebase tersedia
 * (google-services.json + FCM_PROJECT_ID/FCM_SERVICE_ACCOUNT_JSON di server).
 * Langkah yang menunggu:
 *   1. pasang `expo-notifications` (paket baru — butuh persetujuan; tidak dipasang di paket A2-Inbox),
 *   2. buat saluran Android dari `GET /pengaturan/notifikasi` → `push.android_channels` (9 saluran + `rk_sinkron`),
 *   3. minta izin POST_NOTIFICATIONS di konteks (useIzinAplikasi().mintaNotifikasi, sudah ada),
 *   4. ambil token FCM → `PUT /perangkat/{device}/push-token` (src/api/perangkat.ts),
 *   5. ketuk push: `data.notification_id` → POST /inbox/{id}/baca lalu `resolveTarget({type: data.target, id: data.id, anchor: data.anchor, params: JSON.parse(data.params)})`
 *      (`target = "inbox"` → /inbox/{id}), sama seperti ketukan baris Inbox,
 *   6. lencana ikon: `setBadgeCountAsync(unread)` dari UnreadProvider.
 * Fungsi ini sengaja TIDAK dipanggil dari mana pun.
 */

export interface DataPush {
  type: string;
  target: string;
  id: string;
  anchor: string;
  params: string;
  android_channel: string;
  notification_id: string;
}

export interface HasilDaftarPush {
  status: 'belum-didukung';
}

/** Stub bertipe: kontrak yang akan diisi ketika Firebase tersedia. */
export async function registerPush(): Promise<HasilDaftarPush> {
  return { status: 'belum-didukung' };
}
