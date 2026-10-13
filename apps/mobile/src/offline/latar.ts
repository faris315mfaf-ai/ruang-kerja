/**
 * Sinkron antrean offline di LATAR BELAKANG (aplikasi ditutup/ditaruh di latar).
 *
 * Modul ini sengaja ringan dan diimpor dari `index.ts` (titik masuk) SEBELUM
 * `expo-router/entry`: `TaskManager.defineTask` wajib dijalankan di scope modul
 * pada setiap start JS — termasuk start headless oleh WorkManager saat proses
 * aplikasi sudah dimatikan sistem — karena tidak ada komponen yang dirender di
 * sana. Isi task (mesin antrean + penangan fitur) dimuat malas lewat `import()`.
 *
 * Android menjadwalkan task lewat WorkManager (syarat: jaringan tersambung),
 * paling cepat tiap 15 menit, tanpa jaminan waktu (Doze/App Standby dapat
 * menundanya hingga berjam-jam). Task dibatasi ±25 dtk. Rincian dan cara uji:
 * docs/sesi/ponsel-b7-offline.md › "Sinkron latar belakang".
 */
import { isRunningInExpoGo } from 'expo';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

/** Nama task (juga kunci pendaftaran persisten WorkManager/TaskManager). */
export const NAMA_TASK_SINKRON = 'ruangkerja-sinkron-antrean';
/** Interval minimum Android (menit); sistem boleh menjalankan lebih jarang. */
export const INTERVAL_SINKRON_MENIT = 15;
/** Anggaran waktu satu putaran; OS menghentikan task latar yang terlalu lama. */
export const BATAS_SINKRON_MS = 25_000;

TaskManager.defineTask(NAMA_TASK_SINKRON, async () => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const kerja = import('./latarKerja').then((m) => m.jalankanSinkronLatar(BATAS_SINKRON_MS));
    // Pengaman terakhir bila basis data/jaringan menggantung di luar kendali mesin.
    const batas = new Promise<'batas'>((selesai) => {
      timer = setTimeout(() => selesai('batas'), BATAS_SINKRON_MS + 3000);
    });
    const hasil = await Promise.race([kerja, batas]);
    return hasil === 'batas' ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  } finally {
    clearTimeout(timer);
  }
});

// Daftar/batal diserialisasi: keluar-masuk akun berurutan cepat tidak boleh saling menyalip.
let ekor: Promise<unknown> = Promise.resolve();

function antre<T>(fn: () => Promise<T>): Promise<T> {
  const giliran = ekor.then(fn);
  ekor = giliran.catch(() => undefined);
  return giliran;
}

/** Daftarkan task periodik (idempoten). false bila tidak tersedia (Expo Go, dibatasi sistem) atau gagal. */
export function daftarkanSinkronLatar(): Promise<boolean> {
  return antre(async () => {
    if (isRunningInExpoGo()) {
      return false;
    }
    try {
      if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) {
        return false;
      }
      await BackgroundTask.registerTaskAsync(NAMA_TASK_SINKRON, { minimumInterval: INTERVAL_SINKRON_MENIT });
      return true;
    } catch {
      return false;
    }
  });
}

/** Batalkan pendaftaran (keluar akun / sesi berakhir). Aman dipanggil bila belum terdaftar. */
export function batalkanSinkronLatar(): Promise<void> {
  return antre(async () => {
    if (isRunningInExpoGo()) {
      return;
    }
    try {
      await BackgroundTask.unregisterTaskAsync(NAMA_TASK_SINKRON);
    } catch {
      // Tidak terdaftar / tidak tersedia: tidak ada yang perlu dibatalkan.
    }
  });
}

export type StatusSinkronLatar = 'aktif' | 'tidak_tersedia';

/** 'aktif' bila task terdaftar di sistem; selain itu 'tidak_tersedia' (Expo Go, dibatasi sistem, belum terdaftar). */
export async function statusSinkronLatar(): Promise<StatusSinkronLatar> {
  if (isRunningInExpoGo()) {
    return 'tidak_tersedia';
  }
  try {
    const tersedia = (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available;
    return tersedia && (await TaskManager.isTaskRegisteredAsync(NAMA_TASK_SINKRON)) ? 'aktif' : 'tidak_tersedia';
  } catch {
    return 'tidak_tersedia';
  }
}
