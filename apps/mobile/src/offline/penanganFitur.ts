/**
 * Titik daftar penangan antrean milik fitur. Modul ini diimpor `OfflineMonitor`
 * saat aplikasi dibuka, jadi penangan terdaftar SEBELUM mesin mengirim item
 * yang tersisa dari sesi sebelumnya (mis. setelah proses dimatikan).
 *
 * Fitur menambah satu baris `import` ke berkasnya sendiri, mis.
 *   import '@/features/absensi/offline';
 * dan berkas itu memanggil `daftarkanPenangan('absensi.masuk', {...})` di level modul.
 * Jangan daftarkan penangan di dalam komponen React (tidak terpasang saat buka dingin).
 */
import '@/features/absensi/offline';
import '@/features/pengajuan/offline';

import '@/offline/fitur/tugas';
import '@/offline/fitur/catatan';
import '@/offline/fitur/laporan';

export {};
