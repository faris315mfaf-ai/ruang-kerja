/**
 * Cadangan draf laporan di perangkat (spec 06 pertanyaan #6, bawaan usulan:
 * draf boleh tersimpan lokal, KIRIM tetap butuh koneksi). Satu berkas JSON di
 * folder dokumen aplikasi; ditulis saat simpan ke server gagal (offline),
 * dihapus setelah server menerima. Draf untuk tanggal yang sudah lewat
 * dibuang saat dibaca (server akan menolaknya dengan `laporan_terkunci`).
 */
import { File, Paths } from 'expo-file-system';

import type { BodyLaporan } from '@/api/laporan';

export interface DrafLokal {
  /** Pemilik draf — perangkat bisa dipakai bergantian. */
  userId: string;
  body: BodyLaporan;
  /** ISO waktu perangkat saat draf terakhir diubah. */
  savedAt: string;
}

function berkas(): File {
  return new File(Paths.document, 'laporan-harian-draf.json');
}

export function bacaDrafLokal(userId: string, tanggal: string): DrafLokal | null {
  try {
    const f = berkas();
    if (!f.exists) {
      return null;
    }
    const isi = JSON.parse(f.textSync()) as Partial<DrafLokal>;
    if (isi.userId !== userId || !isi.body || isi.body.report_date !== tanggal || typeof isi.savedAt !== 'string') {
      hapusDrafLokal();
      return null;
    }
    return isi as DrafLokal;
  } catch {
    return null;
  }
}

export function tulisDrafLokal(draf: DrafLokal): void {
  try {
    const f = berkas();
    if (!f.exists) {
      f.create();
    }
    f.write(JSON.stringify(draf));
  } catch {
    // Penyimpanan perangkat gagal — isian tetap ada di layar.
  }
}

export function hapusDrafLokal(): void {
  try {
    const f = berkas();
    if (f.exists) {
      f.delete();
    }
  } catch {
    // abaikan
  }
}
