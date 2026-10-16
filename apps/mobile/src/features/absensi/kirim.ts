/**
 * Menjalankan permintaan check-in/out dan menaruh hasilnya di store (sukses atau
 * penolakan) untuk layar `/absensi/hasil`. Satu pintu supaya "Kirim ulang" dan
 * kirim dari layar Absen memakai logika yang sama.
 *
 * Offline (docs/sesi/ponsel-b7-offline.md): bila perangkat tidak online, atau pengiriman gagal
 * tanpa jawaban (status 0), absen disimpan di antrean HP (`offline.ts`) dengan jam perangkat
 * saat tombol ditekan, dan hasilnya "Tersimpan di HP · akan dikirim otomatis". Kunci idempotensi
 * yang sama dipakai oleh percobaan online dan item antrean, sehingga absen yang sebenarnya sudah
 * diterima server tidak tercatat dua kali.
 */
import { jadikanGagal, kirimGps, kirimQr, type GagalAbsen } from '@/api/absensi';
import { ApiError } from '@/api/client';
import { deviceIdHash } from '@/lib/device';
import { adalahOnline, buatUlid } from '@/offline';

import { antreAbsenGps, antreAbsenQr } from './offline';
import { absenStore, type Arah, type HasilAbsen, type InfoJadwal, type Metode, type PermintaanTerakhir, type TitikKirim } from './store';

function gagalAntre(err: unknown): GagalAbsen {
  const pesan = err instanceof Error ? err.message : 'Penyimpanan di HP gagal.';
  return { reason: 'lain', message: `Absen tidak bisa disimpan di HP: ${pesan}`, status: -1, context: {}, retryAfter: null };
}

async function antreGps(p: PermintaanTerakhir, tekan: Date, kunci: string, hash: string): Promise<boolean> {
  try {
    await antreAbsenGps({
      uid: p.uid as string,
      arah: p.arah,
      metode: p.metode === 'wfh' ? 'wfh' : 'gps',
      tekan,
      kunci,
      lokasi: p.lokasiNama ?? null,
      jarakM: p.jarakM,
      dalam: p.dalam ?? null,
      titik: p.titik,
      selfieUri: p.selfieUri,
      deviceIdHash: hash,
      catatan: p.catatan,
      rencana: p.arah === 'masuk' ? p.workPlan : [],
      laporan: p.arah === 'pulang' ? p.workReport : [],
    });
    absenStore.setHasil({
      jenis: 'antre',
      arah: p.arah,
      metode: p.metode,
      waktu: tekan.toISOString(),
      jumlahRencana: p.workPlan.length,
      jumlahLaporan: p.workReport.length,
      lokasi: p.lokasiNama ?? null,
      jarakM: p.jarakM,
      dalam: p.dalam ?? null,
    });
    absenStore.selesaiKirim();
    return true;
  } catch (err) {
    absenStore.setHasil({ jenis: 'gagal', arah: p.arah, metode: p.metode, gagal: gagalAntre(err), diterimaPada: Date.now(), retryQr: false });
    return false;
  }
}

export async function jalankanPermintaan(p: PermintaanTerakhir, jadwal: InfoJadwal): Promise<boolean> {
  // Simpan agar "Kirim ulang" dan peta luar radius di layar hasil memakai data yang sama.
  absenStore.setPermintaan(p);
  // Jam perangkat saat tombol ditekan — dipakai bila absen harus diantre (offline_at).
  const tekan = new Date();
  const kunci = buatUlid();
  const hash = await deviceIdHash();
  const bisaAntre = typeof p.uid === 'string' && p.uid !== '';
  if (bisaAntre && !adalahOnline()) {
    return antreGps(p, tekan, kunci, hash);
  }
  try {
    const hasil = await kirimGps({
      arah: p.arah,
      latitude: p.titik.latitude,
      longitude: p.titik.longitude,
      accuracy: p.titik.accuracy,
      mockLocation: p.titik.mocked,
      selfieUri: p.selfieUri,
      deviceIdHash: hash,
      note: p.catatan,
      workPlan: p.arah === 'masuk' ? p.workPlan : undefined,
      workReport: p.arah === 'pulang' ? p.workReport : undefined,
      idempotencyKey: kunci,
    });
    absenStore.setHasil({
      jenis: 'sukses',
      arah: p.arah,
      metode: p.metode,
      hasil,
      jumlahRencana: p.workPlan.length,
      jumlahLaporan: p.workReport.length,
      catatan: p.catatan,
      ...jadwal,
    });
    absenStore.selesaiKirim();
    return true;
  } catch (err) {
    if (bisaAntre && err instanceof ApiError && err.status === 0) {
      return antreGps(p, tekan, kunci, hash);
    }
    absenStore.setHasil({ jenis: 'gagal', arah: p.arah, metode: p.metode, gagal: jadikanGagal(err), diterimaPada: Date.now(), retryQr: false });
    return false;
  }
}

export async function jalankanQr(arah: Arah, payload: string, titik: TitikKirim | null, jadwal: InfoJadwal, uid?: string): Promise<boolean> {
  const metode: Metode = 'qr';
  const tekan = new Date();
  const kunci = buatUlid();
  const bisaAntre = typeof uid === 'string' && uid !== '';

  const antre = async (): Promise<boolean> => {
    try {
      await antreAbsenQr({ uid: uid as string, arah, tekan, kunci, payload, titik, lokasi: null, jarakM: null, dalam: null });
      absenStore.setHasil({ jenis: 'antre', arah, metode, waktu: tekan.toISOString(), jumlahRencana: 0, jumlahLaporan: 0, lokasi: null, jarakM: null, dalam: null });
      absenStore.selesaiKirim();
      return true;
    } catch (err) {
      absenStore.setHasil({ jenis: 'gagal', arah, metode, gagal: gagalAntre(err), diterimaPada: Date.now(), retryQr: true });
      return false;
    }
  };

  if (bisaAntre && !adalahOnline()) {
    return antre();
  }
  try {
    const hasil = await kirimQr({
      arah,
      payload,
      latitude: titik?.latitude,
      longitude: titik?.longitude,
      accuracy: titik?.accuracy,
      mockLocation: titik?.mocked,
      idempotencyKey: kunci,
    });
    const sukses: HasilAbsen = { jenis: 'sukses', arah, metode, hasil, jumlahRencana: 0, jumlahLaporan: 0, catatan: '', ...jadwal };
    absenStore.setHasil(sukses);
    absenStore.selesaiKirim();
    return true;
  } catch (err) {
    if (bisaAntre && err instanceof ApiError && err.status === 0) {
      return antre();
    }
    absenStore.setHasil({ jenis: 'gagal', arah, metode, gagal: jadikanGagal(err), diterimaPada: Date.now(), retryQr: true });
    return false;
  }
}
