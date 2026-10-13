/**
 * Membuat saluran notifikasi Android (+ grup "RuangKerja") lewat
 * expo-notifications. Dipanggil saat aplikasi pertama dibuka setelah masuk,
 * dan SEBELUM dialog izin notifikasi (Android 13+ baru menampilkan dialog
 * bila aplikasi sudah punya saluran). Aman diulang: Android mempertahankan
 * pilihan pengguna atas suara/kepentingan saluran yang sudah ada.
 */
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { GRUP_KANAL, gabungKanal, type DefinisiKanal, type Kepentingan } from './kanal';

const KEPENTINGAN: Record<Kepentingan, Notifications.AndroidImportance> = {
  high: Notifications.AndroidImportance.HIGH,
  default: Notifications.AndroidImportance.DEFAULT,
  low: Notifications.AndroidImportance.LOW,
  min: Notifications.AndroidImportance.MIN,
};

const dibuat = new Map<string, Promise<void>>();

async function buat(kanal: DefinisiKanal): Promise<void> {
  const berbunyi = kanal.importance === 'high' || kanal.importance === 'default';
  await Notifications.setNotificationChannelAsync(kanal.id, {
    name: kanal.name,
    importance: KEPENTINGAN[kanal.importance],
    groupId: GRUP_KANAL,
    // PRIVATE: layar kunci menampilkan "konten disembunyikan" (pengajuan sakit, pelamar, isi obrolan).
    lockscreenVisibility:
      kanal.lockscreen === 'private' ? Notifications.AndroidNotificationVisibility.PRIVATE : Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: berbunyi ? 'default' : null,
    enableVibrate: berbunyi,
    vibrationPattern: kanal.importance === 'high' ? [0, 250, 250, 250] : undefined,
    showBadge: kanal.importance !== 'min',
  });
}

/**
 * Pastikan semua saluran ada. `dariServer` (opsional) = `push.android_channels`
 * dari `GET /pengaturan/notifikasi`; saluran yang belum ada di bawaan ikut dibuat.
 * Tidak pernah melempar galat.
 */
export function pastikanSaluran(dariServer?: readonly DefinisiKanal[] | null): Promise<void> {
  if (Platform.OS !== 'android') {
    return Promise.resolve();
  }
  const daftar = gabungKanal(dariServer);
  const kunci = daftar.map((k) => `${k.id}:${k.importance}:${k.lockscreen}`).join('|');
  const ada = dibuat.get(kunci);
  if (ada) {
    return ada;
  }
  const kerja = (async (): Promise<void> => {
    try {
      await Notifications.setNotificationChannelGroupAsync(GRUP_KANAL, { name: 'RuangKerja' });
    } catch {
      // Tanpa grup saluran tetap dibuat.
    }
    for (const kanal of daftar) {
      try {
        await buat(kanal);
      } catch {
        // Satu saluran gagal tidak menghentikan yang lain; dicoba lagi pada peluncuran berikutnya.
      }
    }
  })();
  dibuat.set(kunci, kerja);
  void kerja.then(undefined, () => dibuat.delete(kunci));
  return kerja;
}

export type StatusSaluran = 'aktif' | 'dimatikan';

/** Status tiap saluran sesuai pengaturan sistem (`importance = NONE` berarti pengguna mematikannya). */
export async function bacaStatusSaluran(): Promise<Record<string, StatusSaluran>> {
  if (Platform.OS !== 'android') {
    return {};
  }
  try {
    const daftar = await Notifications.getNotificationChannelsAsync();
    const hasil: Record<string, StatusSaluran> = {};
    for (const kanal of daftar) {
      hasil[kanal.id] = kanal.importance === Notifications.AndroidImportance.NONE ? 'dimatikan' : 'aktif';
    }
    return hasil;
  } catch {
    return {};
  }
}

/** Buka layar pengaturan sistem untuk satu saluran (suara, getar, pop-up); cadangan: pengaturan aplikasi. */
export async function bukaSetelanSaluran(idSaluran: string): Promise<void> {
  try {
    await Linking.sendIntent('android.settings.CHANNEL_NOTIFICATION_SETTINGS', [
      { key: 'android.provider.extra.APP_PACKAGE', value: Application.applicationId ?? 'store.spkd.ruangkerja' },
      { key: 'android.provider.extra.CHANNEL_ID', value: idSaluran },
    ]);
  } catch {
    await Linking.openSettings().catch(() => undefined);
  }
}
