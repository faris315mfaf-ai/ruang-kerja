/**
 * Ikon widget sebagai string SVG (Lucide, lisensi ISC; node diambil dari
 * `lucide-react-native` 1.55 — sumber yang sama dengan ikon aplikasi). Widget tidak
 * bisa memakai komponen React Native, jadi ikon digambar `SvgWidget` dari string.
 * Warna ikon = warna palet (selalu buram: `#RRGGBB`).
 */

export type NamaIkon =
  | 'log-in'
  | 'log-out'
  | 'check'
  | 'coffee'
  | 'cloud-upload'
  | 'refresh-cw'
  | 'lock'
  | 'video'
  | 'calendar-check'
  | 'calendar-x'
  | 'cloud-off'
  | 'list-checks';

const NODE: Record<NamaIkon, string> = {
  'log-in': '<path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
  'log-out': '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  'cloud-upload': '<path d="M12 13v8"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m8 17 4-4 4 4"/>',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  'calendar-check': '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m9 15 2 2 4-4"/>',
  'calendar-x': '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="m14 13-4 4"/><path d="m10 13 4 4"/>',
  'cloud-off': '<path d="M10.94 5.274A7 7 0 0 1 15.71 10h1.79a4.5 4.5 0 0 1 4.222 6.057"/><path d="M18.796 18.81A4.5 4.5 0 0 1 17.5 19H9A7 7 0 0 1 5.79 5.78"/><path d="m2 2 20 20"/>',
  'list-checks': '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/>',
};

/** String SVG 24×24 berwarna `warna` (hex #RRGGBB atau #RRGGBBAA — alfa dibuang). */
export function svgIkon(nama: NamaIkon, warna: string, tebal = 2): string {
  const w = /^#[0-9a-fA-F]{6}/.test(warna) ? warna.slice(0, 7) : '#000000';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${w}" stroke-width="${tebal}" stroke-linecap="round" stroke-linejoin="round">${NODE[nama]}</svg>`;
}
