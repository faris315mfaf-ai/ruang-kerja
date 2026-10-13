/**
 * Pengendali push tingkat aplikasi (dipasang sekali di `app/_layout.tsx`,
 * di dalam Session/AppLock/Unread/UI provider). Tidak merender apa pun.
 *
 *  - saluran Android dibuat setelah masuk (sebelum dialog izin);
 *  - token FCM didaftarkan ke server saat sesi aktif, aplikasi kembali aktif,
 *    token berganti, atau izin baru diberikan; keluar akun membersihkan bilah
 *    notifikasi dan lencana;
 *  - aplikasi terbuka: tidak ada banner sistem ganda — notifikasi remote
 *    menjadi snackbar ringan ("Buka") + hitungan belum dibaca disegarkan;
 *  - ketukan notifikasi (aplikasi terbuka/latar/mati) disimpan lalu dijalankan
 *    setelah sesi + kunci biometrik + navigator siap (maks. 15 menit);
 *  - lencana ikon = jumlah Inbox belum dibaca;
 *  - tawaran izin notifikasi sekali, di konteks (setelah masuk), lewat layar
 *    penjelasan — bukan dialog sistem mentah.
 */
import * as Notifications from 'expo-notifications';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAppLock } from '@/features/auth/appLock';
import { resolveTarget } from '@/features/inbox/target';
import { useSession } from '@/session/SessionProvider';
import { useUnread } from '@/session/UnreadProvider';
import { useSnackbar } from '@/ui';

import { bukaDariPush } from './buka';
import { bacaDataPush, targetDariPush, type DataPush } from './data';
import { pastikanSaluran } from './saluranAndroid';
import { dengarkanDaftarUlangPush, setStatusPush } from './status';
import { daftarkanTokenPush, lupakanPendaftaranPush } from './token';

/** Notifikasi remote saat aplikasi terbuka: tanpa banner sistem; lokal (uji) tetap tampil. */
Notifications.setNotificationHandler({
  handleNotification: async (notifikasi) => {
    const lokal = bacaDataPush(notifikasi.request.content.data)?.lokal === '1';
    return { shouldShowBanner: lokal, shouldShowList: lokal, shouldPlaySound: lokal, shouldSetBadge: false };
  },
});

const KUNCI_TERAKHIR = 'rk.push.ketukan';
const KUNCI_TAWARAN = 'rk.push.izin_ditawarkan';
const KEDALUWARSA_KETUKAN_MS = 15 * 60_000;

interface Tertunda {
  data: DataPush;
  sejak: number;
}

/** Bagian path rute (tanpa query) dari tujuan push — untuk tidak menampilkan banner di layar yang sama. */
function pathTujuan(data: DataPush): string | null {
  const tujuan = resolveTarget(targetDariPush(data), { notifikasiId: data.notification_id || undefined });
  return tujuan.aksi === 'rute' ? (tujuan.href.split('?')[0] ?? null) : null;
}

export function PushController(): null {
  const { status, blokir } = useSession();
  const { locked, ready: kunciSiap, offerPending } = useAppLock();
  const { jumlah, muatUlang, perbarui } = useUnread();
  const snackbar = useSnackbar();
  const navState = useRootNavigationState();
  const pathname = usePathname();
  const respons = Notifications.useLastNotificationResponse();

  const bersesi = status === 'masuk' && blokir === null;
  const navSiap = Boolean(navState?.key);
  const tertunda = useRef<Tertunda | null>(null);
  const pathRef = useRef(pathname);
  const sebelumnya = useRef(status);
  const prosesRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  // Jalankan ketukan yang tertunda bila semua prasyarat terpenuhi.
  const proses = useCallback((): void => {
    const item = tertunda.current;
    if (!item || !bersesi || !kunciSiap || locked || !navSiap) {
      return;
    }
    tertunda.current = null;
    if (Date.now() - item.sejak > KEDALUWARSA_KETUKAN_MS) {
      return;
    }
    bukaDariPush(item.data, perbarui);
  }, [bersesi, kunciSiap, locked, navSiap, perbarui]);

  // Ketukan notifikasi: cold start, latar, dan aplikasi terbuka (satu pintu: respons terakhir).
  useEffect(() => {
    if (!respons || respons.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      return;
    }
    const data = bacaDataPush(respons.notification.request.content.data);
    if (!data) {
      return;
    }
    const kunci = `${respons.notification.request.identifier}:${respons.notification.date}`;
    let batal = false;
    void (async () => {
      // Android bisa memutar ulang intent peluncur saat tugas dipulihkan: jangan buka dua kali.
      const lama = await SecureStore.getItemAsync(KUNCI_TERAKHIR).catch(() => null);
      if (batal || lama === kunci) {
        return;
      }
      await SecureStore.setItemAsync(KUNCI_TERAKHIR, kunci).catch(() => undefined);
      tertunda.current = { data, sejak: Date.now() };
      prosesRef.current();
    })();
    return () => {
      batal = true;
    };
  }, [respons]);

  useEffect(() => {
    prosesRef.current = proses;
    proses();
  }, [proses]);

  // Notifikasi remote saat aplikasi terbuka → snackbar ringan + segarkan lencana.
  useEffect(() => {
    if (!bersesi) {
      return undefined;
    }
    const langganan = Notifications.addNotificationReceivedListener((notifikasi) => {
      const data = bacaDataPush(notifikasi.request.content.data);
      if (!data || data.lokal === '1') {
        return;
      }
      void muatUlang();
      const judul = notifikasi.request.content.title ?? 'Notifikasi baru';
      const isi = notifikasi.request.content.body;
      // Sudah di layar tujuannya (mis. percakapan yang sedang dibaca): cukup lencana.
      const tujuan = pathTujuan(data);
      if (tujuan !== null && pathRef.current === tujuan) {
        return;
      }
      snackbar.show({
        message: isi ? `${judul} — ${isi}` : judul,
        variant: 'info',
        actionLabel: 'Buka',
        onAction: () => bukaDariPush(data, perbarui),
        duration: 6000,
      });
    });
    return () => langganan.remove();
  }, [bersesi, muatUlang, perbarui, snackbar]);

  // Saluran + pendaftaran token.
  useEffect(() => {
    if (!bersesi) {
      return undefined;
    }
    let hidup = true;
    const daftar = (tokenBaru?: string): void => {
      void pastikanSaluran().then(() => (hidup ? daftarkanTokenPush(tokenBaru) : undefined));
    };
    daftar();
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        daftar();
      }
    });
    // Token berputar: pakai token dari event (mengambil lagi akan memancarkan event yang sama).
    const token = Notifications.addPushTokenListener((t) => daftar(typeof t.data === 'string' ? t.data : undefined));
    const minta = dengarkanDaftarUlangPush(() => daftar());
    return () => {
      hidup = false;
      appState.remove();
      token.remove();
      minta();
    };
  }, [bersesi]);

  // Lencana ikon aplikasi = Inbox belum dibaca.
  useEffect(() => {
    void Notifications.setBadgeCountAsync(status === 'masuk' ? jumlah : 0).catch(() => undefined);
  }, [jumlah, status]);

  // Keluar akun: bersihkan bilah notifikasi, lencana, dan ketukan tertunda.
  useEffect(() => {
    if (sebelumnya.current === 'masuk' && status !== 'masuk') {
      tertunda.current = null;
      lupakanPendaftaranPush();
      setStatusPush('memeriksa');
      void Notifications.dismissAllNotificationsAsync().catch(() => undefined);
      void Notifications.setBadgeCountAsync(0).catch(() => undefined);
    }
    sebelumnya.current = status;
  }, [status]);

  // Tawaran izin notifikasi: sekali per pemasangan, di konteks (setelah masuk, tidak bertabrakan dengan tawaran sidik jari).
  useEffect(() => {
    if (!bersesi || !kunciSiap || locked || !navSiap || offerPending) {
      return undefined;
    }
    let batal = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const izin = await Notifications.getPermissionsAsync();
          if (batal || izin.granted || izin.status !== Notifications.PermissionStatus.UNDETERMINED) {
            return;
          }
          if ((await SecureStore.getItemAsync(KUNCI_TAWARAN)) === '1') {
            return;
          }
          await SecureStore.setItemAsync(KUNCI_TAWARAN, '1');
          if (!batal && tertunda.current === null) {
            router.push('/pengaturan/notifikasi-izin' as never);
          }
        } catch {
          // Tawaran dilewati; bisa diaktifkan dari Pengaturan › Notifikasi.
        }
      })();
    }, 2500);
    return () => {
      batal = true;
      clearTimeout(timer);
    };
  }, [bersesi, kunciSiap, locked, navSiap, offerPending]);

  return null;
}
