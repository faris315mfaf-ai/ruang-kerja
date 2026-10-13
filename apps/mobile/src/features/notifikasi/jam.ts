/** Jam kirim ringkasan harian. Terima "07.30", "7:30", "0730", "730" → "07:30"; kelipatan 5 menit; selain itu null. */
export function bacaJam(teks: string): string | null {
  const bersih = teks.trim().replace('.', ':');
  let j: number;
  let m: number;
  const titik = /^(\d{1,2}):(\d{2})$/.exec(bersih);
  const rapat = /^(\d{1,2})(\d{2})$/.exec(bersih);
  if (titik) {
    j = Number(titik[1]);
    m = Number(titik[2]);
  } else if (rapat) {
    j = Number(rapat[1]);
    m = Number(rapat[2]);
  } else {
    return null;
  }
  if (j > 23 || m > 59 || m % 5 !== 0) {
    return null;
  }
  return `${String(j).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
