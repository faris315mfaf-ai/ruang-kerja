/**
 * Pratinjau pesan grup WhatsApp manajemen — disusun di klien dengan format yang
 * sama dengan `SendAttendanceWhatsApp::message` (server mengirim pesan aslinya
 * setelah check-in berhasil; ini hanya salinan baca-saja, tanpa endpoint).
 */
import { durasiMenit, jam, jarakMeter, tanggalPanjang } from '@/lib/format';

export interface InputPesanWa {
  arah: 'masuk' | 'pulang';
  nama: string;
  waktu: Date;
  lokasi: string;
  /** Poin rencana (kosong = absen lewat QR/kiosk). */
  poin?: string[];
  /** Durasi kerja (menit) untuk pesan pulang. */
  durasiKerjaMenit?: number | null;
}

export function susunPesanWa(p: InputPesanWa): string {
  const masuk = p.arah === 'masuk';
  const baris = [
    masuk ? '🟢 ABSEN MASUK' : '🔴 ABSEN PULANG',
    `Nama: ${p.nama}`,
    `Tanggal: ${tanggalPanjang(p.waktu)}`,
    `Jam: ${jam(p.waktu)}`,
    `Lokasi: ${p.lokasi}`,
  ];
  if (masuk) {
    const poin = (p.poin ?? []).map((t) => t.trim()).filter((t) => t !== '');
    baris.push('', '📝 Rencana/Laporan Kerja Hari Ini:');
    if (poin.length === 0) {
      baris.push('_(tidak diisi — absen lewat QR/kiosk)_');
    } else {
      poin.forEach((t, i) => baris.push(`${i + 1}. ${t}`));
    }
  } else {
    baris.push(`Durasi kerja: ${durasiMenit(p.durasiKerjaMenit ?? null)}`);
  }
  return baris.join('\n');
}

/** Deskripsi lokasi seperti di pesan server: geofence, WFH (dengan catatan), atau luar kantor. */
export function lokasiPesan(o: { dalam: boolean; namaKantor: string | null; jarakJauh: boolean; catatan: string; jarakM: number | null }): string {
  if (o.dalam && o.namaKantor) {
    return o.namaKantor;
  }
  if (o.jarakJauh) {
    const c = o.catatan.trim();
    return c === '' ? 'WFH' : `WFH — ${c.length > 60 ? `${c.slice(0, 57)}...` : c}`;
  }
  if (o.namaKantor && o.jarakM !== null) {
    return `Luar kantor · ${jarakMeter(o.jarakM)} dari ${o.namaKantor}`;
  }
  return o.namaKantor ?? 'Luar kantor';
}
