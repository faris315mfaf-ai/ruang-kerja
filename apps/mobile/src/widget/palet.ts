/**
 * Palet widget layar utama — turunan statis token tema (`@/theme/tokens`).
 *
 * Widget digambar di proses tanpa UI (tanpa `useTheme`, tanpa konteks React), jadi
 * warnanya dipetakan sekali dari objek token yang sama dengan aplikasi
 * (`lightColors` / `darkColors` + gradien aksi) lewat `buatPalet`. Tidak ada hex
 * di berkas tampilan; hex hanya lahir dari token di `tema.ts`.
 *
 * Murni: hanya `import type`, bisa diuji dengan `npm run test:widget`.
 */
import type { Colors, GradientDef } from '@/theme/tokens';

export interface Palet {
  /** Latar kartu widget. */
  kartu: string;
  kartuBorder: string;
  teks: string;
  teksRedam: string;
  teksSamar: string;
  /** Warna overline ("ABSEN") dan ikon tautan. */
  tautan: string;
  tautanLembut: string;
  permukaan2: string;
  primer: string;
  sukses: string;
  suksesLembut: string;
  peringatan: string;
  bahaya: string;
  garisKuat: string;
  /** Gradien tombol utama (kiri-atas → kanan-bawah). */
  aksi: readonly [string, string];
  /** Warna isi di atas gradien aksi. */
  onAksi: string;
}

type Rgba = { r: number; g: number; b: number; a: number };

const KELIP = (n: number): number => Math.min(255, Math.max(0, Math.round(n)));
const HEKS = (n: number): string => KELIP(n).toString(16).padStart(2, '0').toUpperCase();

/** '#RGB' · '#RRGGBB' · '#RRGGBBAA' · 'rgba(r,g,b,a)' → komponen 0–255 + alfa 0–1; null bila tak dikenal. */
export function uraiWarna(warna: string): Rgba | null {
  const w = warna.trim();
  if (w.startsWith('#')) {
    const h = w.slice(1);
    const penuh = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(penuh)) {
      return null;
    }
    return {
      r: parseInt(penuh.slice(0, 2), 16),
      g: parseInt(penuh.slice(2, 4), 16),
      b: parseInt(penuh.slice(4, 6), 16),
      a: penuh.length === 8 ? parseInt(penuh.slice(6, 8), 16) / 255 : 1,
    };
  }
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(w);
  if (!m) {
    return null;
  }
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) };
}

/** '#RRGGBB' (alfa 1) atau '#RRGGBBAA'. Warna tak dikenal dikembalikan apa adanya. */
export function keHeks(warna: string, alfa?: number): string {
  const c = uraiWarna(warna);
  if (c === null) {
    return warna;
  }
  const a = alfa ?? c.a;
  return `#${HEKS(c.r)}${HEKS(c.g)}${HEKS(c.b)}${a >= 1 ? '' : HEKS(a * 255)}`;
}

/** Campur `a` ke arah `b` sebesar `t` (0–1), hasil '#RRGGBB' buram. */
export function campur(a: string, b: string, t: number): string {
  const x = uraiWarna(a);
  const y = uraiWarna(b);
  if (x === null || y === null) {
    return a;
  }
  return `#${HEKS(x.r + (y.r - x.r) * t)}${HEKS(x.g + (y.g - x.g) * t)}${HEKS(x.b + (y.b - x.b) * t)}`;
}

export interface OpsiPalet {
  /** Kartu tembus pandang ("Latar transparan" di setelan widget). */
  transparan?: boolean;
  /** Warna isi di atas gradien aksi (putih di kedua tema pada mockup). */
  onAksi: string;
}

/** Alfa kartu tembus pandang: cukup terlihat wallpapernya, teks tetap berkontras (teks tidak ikut tembus). */
export const ALFA_TRANSPARAN = 0.62;

export function buatPalet(c: Colors, aksi: GradientDef, opsi: OpsiPalet): Palet {
  const transparan = opsi.transparan === true;
  return {
    kartu: transparan ? keHeks(c.surface, ALFA_TRANSPARAN) : keHeks(c.surface),
    kartuBorder: keHeks(c.border, transparan ? 0.7 : 1),
    teks: keHeks(c.text),
    teksRedam: keHeks(c.muted),
    teksSamar: keHeks(c.subtle),
    tautan: keHeks(c.link),
    tautanLembut: keHeks(c.linkSoft),
    permukaan2: keHeks(c.surface2),
    primer: keHeks(c.primary),
    sukses: keHeks(c.success),
    suksesLembut: keHeks(c.successSoft),
    peringatan: keHeks(c.warning),
    bahaya: keHeks(c.danger),
    garisKuat: keHeks(c.borderStrong),
    aksi: [keHeks(aksi[0]), keHeks(aksi[1])],
    onAksi: keHeks(opsi.onAksi),
  };
}

/**
 * Versi redup untuk data lama (baris cache): teks dan cincin ditarik ke warna kartu
 * (padanan `opacity: .55` di mockup — primitif widget tidak punya opasitas).
 */
export function redupkan(p: Palet, kuat = 0.55): Palet {
  const ke = (w: string): string => campur(p.kartu.slice(0, 7), w.slice(0, 7), kuat);
  return {
    ...p,
    teks: ke(p.teks),
    teksRedam: ke(p.teksRedam),
    teksSamar: ke(p.teksSamar),
    sukses: ke(p.sukses),
    peringatan: ke(p.peringatan),
    bahaya: ke(p.bahaya),
    primer: ke(p.primer),
    garisKuat: ke(p.garisKuat),
  };
}
