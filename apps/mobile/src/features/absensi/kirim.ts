/**
 * Menjalankan permintaan check-in/out dan menaruh hasilnya di store (sukses atau
 * penolakan) untuk layar `/absensi/hasil`. Satu pintu supaya "Kirim ulang" dan
 * kirim dari layar Absen memakai logika yang sama.
 */
import { jadikanGagal, kirimGps, kirimQr } from '@/api/absensi';
import { deviceIdHash } from '@/lib/device';

import { absenStore, type Arah, type HasilAbsen, type InfoJadwal, type Metode, type PermintaanTerakhir, type TitikKirim } from './store';

export async function jalankanPermintaan(p: PermintaanTerakhir, jadwal: InfoJadwal): Promise<boolean> {
  try {
    const hasil = await kirimGps({
      arah: p.arah,
      latitude: p.titik.latitude,
      longitude: p.titik.longitude,
      accuracy: p.titik.accuracy,
      mockLocation: p.titik.mocked,
      selfieUri: p.selfieUri,
      deviceIdHash: await deviceIdHash(),
      note: p.catatan,
      workPlan: p.arah === 'masuk' ? p.workPlan : undefined,
    });
    absenStore.setHasil({
      jenis: 'sukses',
      arah: p.arah,
      metode: p.metode,
      hasil,
      jumlahRencana: p.workPlan.length,
      catatan: p.catatan,
      ...jadwal,
    });
    absenStore.selesaiKirim();
    return true;
  } catch (err) {
    absenStore.setHasil({ jenis: 'gagal', arah: p.arah, metode: p.metode, gagal: jadikanGagal(err), diterimaPada: Date.now(), retryQr: false });
    return false;
  }
}

export async function jalankanQr(arah: Arah, payload: string, titik: TitikKirim | null, jadwal: InfoJadwal): Promise<boolean> {
  const metode: Metode = 'qr';
  try {
    const hasil = await kirimQr({
      arah,
      payload,
      latitude: titik?.latitude,
      longitude: titik?.longitude,
      accuracy: titik?.accuracy,
      mockLocation: titik?.mocked,
    });
    const sukses: HasilAbsen = { jenis: 'sukses', arah, metode, hasil, jumlahRencana: 0, catatan: '', ...jadwal };
    absenStore.setHasil(sukses);
    absenStore.selesaiKirim();
    return true;
  } catch (err) {
    absenStore.setHasil({ jenis: 'gagal', arah, metode, gagal: jadikanGagal(err), diterimaPada: Date.now(), retryQr: true });
    return false;
  }
}
