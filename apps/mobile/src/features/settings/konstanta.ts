/** Konstanta kecil bersama layar akun & pengaturan. */

/** Alamat HR (tombol "Hubungi HR", Tentang). Dapat diganti lewat `EXPO_PUBLIC_HR_EMAIL`. */
export const EMAIL_HR = process.env.EXPO_PUBLIC_HR_EMAIL ?? 'hr@spkd.store';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "12 Mar 2024" dari YYYY-MM-DD (tanpa pergeseran zona). */
export function tglPendekYMD(nilai: string | null | undefined): string {
  if (!nilai) {
    return '—';
  }
  const [y, m, d] = nilai.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) {
    return nilai;
  }
  return `${d} ${BULAN[m - 1] ?? ''} ${y}`;
}

/** "5 Okt 2026" dari YYYY-MM-DD — alias yang lebih jelas untuk tanggal berlaku. */
export const tglBerlaku = tglPendekYMD;

/** Bandingkan versi "1.2.3": >0 bila a lebih baru dari b. */
export function bandingVersi(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const selisih = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (selisih !== 0) {
      return selisih;
    }
  }
  return 0;
}
