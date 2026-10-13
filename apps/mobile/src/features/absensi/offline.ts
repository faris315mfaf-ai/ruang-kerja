/**
 * Absen offline (docs/sesi/ponsel-b7-offline.md › "Penangan fitur: absen/pengajuan").
 *
 * Absen masuk/pulang yang ditekan tanpa internet (atau yang gagal terkirim dengan status 0)
 * diantre di basis data terenkripsi: selfie sebagai BLOB, GPS, rencana kerja (masuk) /
 * laporan kerja (pulang), `offline=true`, `offline_at` = jam PERANGKAT saat tombol ditekan
 * (diisi mesin lewat `waktuOfflineKey`), `Idempotency-Key` unik per aksi. Semua item absen satu
 * pengguna memakai satu `urutanKunci` (`absen:<uid>`) sehingga dikirim berurutan menurut waktu
 * tekan: masuk dulu, baru pulang.
 *
 * Berkas ini DIMUAT SAAT APLIKASI DIBUKA (lewat `src/offline/penanganFitur.ts`): tetap ringan —
 * hanya `@/offline` dan modul kecil; layar/kamera dimuat malas bila perlu.
 */
import { daftarkanPenangan, enqueue, type GalatItem, type ItemAntrean, type Penangan } from '@/offline';
import { jamMenit } from '@/offline/format';
import { ymdJakarta } from '@/lib/format';

import {
  AMBANG_PERINGATAN_JAM,
  JENIS_ABSEN,
  catatTersinkron,
  kunciUrutanAbsen,
  umumkanAbsenBerubah,
  type ArahAbsen,
  type MetodeAbsen,
} from './overlay';

export interface TitikAntre {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  mocked: boolean;
}

interface DasarAntre {
  uid: string;
  arah: ArahAbsen;
  /** Jam perangkat saat tombol absen ditekan. */
  tekan: Date;
  /** Kunci idempotensi yang sama dengan percobaan online (bila ada), supaya server tidak menggandakan. */
  kunci: string;
  lokasi: string | null;
  jarakM: number | null;
  dalam: boolean | null;
}

export interface AntreGps extends DasarAntre {
  metode: Exclude<MetodeAbsen, 'qr'>;
  titik: TitikAntre;
  selfieUri: string;
  deviceIdHash: string;
  catatan: string;
  rencana: string[];
  laporan: string[];
}

export interface AntreQr extends DasarAntre {
  payload: string;
  titik: TitikAntre | null;
}

function labelAbsen(arah: ArahAbsen, tekan: Date): string {
  return `Absen ${arah} ${jamMenit(tekan)}`;
}

/** Antre check-in/out GPS + selfie (atau WFH). Melempar bila basis data/berkas gagal. */
export async function antreAbsenGps(a: AntreGps): Promise<ItemAntrean> {
  const fields: Record<string, string> = {
    latitude: String(a.titik.latitude),
    longitude: String(a.titik.longitude),
    client_time: a.tekan.toISOString(),
    mock_location: a.titik.mocked ? '1' : '0',
    device_id: a.deviceIdHash,
    offline: 'true',
  };
  if (a.titik.accuracy !== null) {
    fields.accuracy = String(Math.round(a.titik.accuracy));
  }
  if (a.catatan.trim() !== '') {
    fields.note = a.catatan.trim();
  }
  const poin = a.arah === 'masuk' ? a.rencana : a.laporan;
  poin.forEach((teks, i) => {
    fields[a.arah === 'masuk' ? `work_plan[${i}]` : `work_report[${i}]`] = teks;
  });
  const jenisPoin = a.arah === 'masuk' ? 'rencana kerja' : 'laporan kerja';
  const ringkas = [a.metode === 'wfh' ? 'WFH' : 'GPS + selfie', poin.length > 0 ? `${poin.length} poin ${jenisPoin}` : null].filter(Boolean).join(' · ');
  return enqueue({
    jenis: a.arah === 'masuk' ? JENIS_ABSEN.masuk : JENIS_ABSEN.pulang,
    label: labelAbsen(a.arah, a.tekan),
    ringkas,
    method: 'POST',
    path: a.arah === 'masuk' ? 'absensi/check-in' : 'absensi/check-out',
    formFields: fields,
    berkas: [{ field: 'selfie', nama: 'selfie.jpg', mime: 'image/jpeg', uri: a.selfieUri }],
    clientId: a.kunci,
    urutanKunci: kunciUrutanAbsen(a.uid),
    meta: { uid: a.uid, arah: a.arah, metode: a.metode, lokasi: a.lokasi, jarakM: a.jarakM, dalam: a.dalam, rencana: a.rencana, laporan: a.laporan },
    dibuatPada: a.tekan,
    kedaluwarsaJam: 72,
    waktuOfflineKey: 'offline_at',
  });
}

/** Antre check-in/out lewat pindai QR kiosk (tanpa selfie). */
export async function antreAbsenQr(a: AntreQr): Promise<ItemAntrean> {
  const json: Record<string, unknown> = {
    payload: a.payload.slice(0, 512),
    client_time: a.tekan.toISOString(),
    mock_location: a.titik?.mocked === true,
    offline: true,
  };
  if (a.titik) {
    json.latitude = a.titik.latitude;
    json.longitude = a.titik.longitude;
    if (a.titik.accuracy !== null) {
      json.accuracy = Math.round(a.titik.accuracy);
    }
  }
  return enqueue({
    jenis: a.arah === 'masuk' ? JENIS_ABSEN.masukQr : JENIS_ABSEN.pulangQr,
    label: labelAbsen(a.arah, a.tekan),
    ringkas: a.titik ? 'Pindai QR kiosk · GPS ikut' : 'Pindai QR kiosk · tanpa GPS',
    method: 'POST',
    path: a.arah === 'masuk' ? 'absensi/check-in/qr' : 'absensi/check-out/qr',
    json,
    clientId: a.kunci,
    urutanKunci: kunciUrutanAbsen(a.uid),
    meta: { uid: a.uid, arah: a.arah, metode: 'qr', lokasi: a.lokasi, jarakM: a.jarakM, dalam: a.dalam, rencana: [], laporan: [] },
    dibuatPada: a.tekan,
    kedaluwarsaJam: 72,
    waktuOfflineKey: 'offline_at',
  });
}

// ── Penangan ─────────────────────────────────────────────────────────────────

/** Kode penolakan yang berarti absen ini tidak mungkin diterima lagi → tawarkan koreksi absensi. */
const KODE_KOREKSI = new Set(['offline_expired', 'offline_clock_invalid', 'kedaluwarsa']);

function arahItem(item: ItemAntrean): ArahAbsen {
  return item.meta.arah === 'pulang' || item.jenis === JENIS_ABSEN.pulang || item.jenis === JENIS_ABSEN.pulangQr ? 'pulang' : 'masuk';
}

const penangan: Penangan = {
  sesudahSukses(item) {
    const uid = typeof item.meta.uid === 'string' ? item.meta.uid : '';
    if (uid !== '') {
      catatTersinkron(uid, arahItem(item), item.dibuatPada);
    }
    umumkanAbsenBerubah();
  },
  sesudahKonflik() {
    umumkanAbsenBerubah();
  },
  sesudahDibuang() {
    umumkanAbsenBerubah();
  },
  pesanSukses(item) {
    return `Absen ${arahItem(item)} ${jamMenit(item.dibuatMs)} tersinkron`;
  },
  catatan(item) {
    if (item.status === 'konflik' || item.status === 'gagal') {
      return null;
    }
    const jamUmur = (Date.now() - item.dibuatMs) / 3_600_000;
    if (jamUmur >= AMBANG_PERINGATAN_JAM) {
      const sisa = Math.max(0, Math.floor(72 - jamUmur));
      return {
        teks: sisa > 0 ? `Sudah ${Math.floor(jamUmur)} jam di HP. Tersambung ke internet dalam ±${sisa} jam lagi, kalau tidak absen ini hangus (maks. 72 jam).` : 'Hampir 72 jam. Segera tersambung ke internet; setelah itu absen ini tidak bisa dikirim.',
        nada: 'warn',
      };
    }
    return null;
  },
  aksiKonflik(item: ItemAntrean, galat: GalatItem) {
    if (galat.kode === null || !KODE_KOREKSI.has(galat.kode)) {
      return null;
    }
    const tanggal = ymdJakarta(item.dibuatPada);
    return {
      label: 'Ajukan koreksi absensi',
      onPress: () => {
        void import('./koreksi').then((m) => m.bukaKoreksiHari(tanggal));
      },
    };
  },
};

for (const jenis of Object.values(JENIS_ABSEN)) {
  daftarkanPenangan(jenis, penangan);
}
