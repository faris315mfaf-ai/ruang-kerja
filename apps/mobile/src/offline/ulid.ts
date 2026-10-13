import * as Crypto from 'expo-crypto';

const ALFABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

/** ULID (26 karakter, urut waktu) — dipakai sebagai id klien & `Idempotency-Key`. */
export function buatUlid(sekarang: number = Date.now()): string {
  let waktu = '';
  let t = sekarang;
  for (let i = 0; i < 10; i += 1) {
    waktu = ALFABET[t % 32] + waktu;
    t = Math.floor(t / 32);
  }
  const acak = Crypto.getRandomBytes(10);
  let rand = '';
  let bit = 0;
  let nilai = 0;
  for (const byte of acak) {
    nilai = (nilai << 8) | byte;
    bit += 8;
    while (bit >= 5) {
      bit -= 5;
      rand += ALFABET[(nilai >> bit) & 31];
    }
    nilai &= (1 << bit) - 1;
  }
  return waktu + rand.slice(0, 16);
}
