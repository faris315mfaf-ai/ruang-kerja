/**
 * Notifikasi LOKAL: dibuat aplikasi di ponsel ini, tanpa server/Firebase.
 * Dipakai "Kirim notifikasi uji" saat push belum aktif, supaya tampilan,
 * saluran, dan ketukan bisa diuji. Ditandai `data.lokal = '1'`: tampil di
 * bilah notifikasi meski aplikasi terbuka, dan ketukannya membuka layar
 * "Notifikasi di ponsel ini" (tidak ada baris Inbox).
 */
import * as Notifications from 'expo-notifications';

import { KANAL_UJI } from './kanal';
import { pastikanSaluran } from './saluranAndroid';

export async function tampilkanNotifikasiLokal(opsi: { title: string; body: string; channelId?: string }): Promise<void> {
  await pastikanSaluran();
  const channelId = opsi.channelId ?? KANAL_UJI;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: opsi.title,
      body: opsi.body,
      data: { type: 'system.test', target: 'inbox', id: '', anchor: '', params: '{}', android_channel: channelId, notification_id: '', group_key: channelId, lokal: '1' },
    },
    trigger: { channelId },
  });
}
