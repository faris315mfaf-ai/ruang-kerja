/**
 * Saluran notifikasi Android (id, nama, kepentingan, layar kunci): salinan
 * bawaan dari enum server `App\Domain\Notifications\Enums\AndroidChannel`
 * (kontrak: docs/sesi/ponsel-b2c-inbox.md §1). Dipakai untuk membuat saluran
 * saat aplikasi pertama dibuka, sebelum/tanpa menunggu server; daftar dari
 * `GET /pengaturan/notifikasi` → `push.android_channels` melengkapi bila ada
 * saluran baru.
 *
 * Kesamaan dengan enum dikunci oleh tes
 * `tests/Unit/Notifications/MobilePushParityTest.php` — ubah KEDUANYA bersama.
 * Berkas ini murni (tanpa React Native) agar bisa diuji di Node.
 */

export type Kepentingan = 'high' | 'default' | 'low' | 'min';
export type LayarKunci = 'public' | 'private';

export interface DefinisiKanal {
  id: string;
  name: string;
  importance: Kepentingan;
  lockscreen: LayarKunci;
  /** Boleh dibisukan dari pengaturan sistem; `false` = tetap bersuara (keamanan). */
  mutable: boolean;
}

export const KANAL_BAWAAN: readonly DefinisiKanal[] = [
  { id: 'rk_mendesak', name: 'Perlu tindakan', importance: 'high', lockscreen: 'private', mutable: true },
  { id: 'rk_tugas', name: 'Tugas & sebutan', importance: 'high', lockscreen: 'public', mutable: true },
  { id: 'rk_obrolan', name: 'Obrolan', importance: 'high', lockscreen: 'private', mutable: true },
  { id: 'rk_rapat', name: 'Rapat', importance: 'high', lockscreen: 'public', mutable: true },
  { id: 'rk_pengajuan', name: 'Pengajuan', importance: 'default', lockscreen: 'private', mutable: true },
  { id: 'rk_pengingat', name: 'Pengingat harian', importance: 'default', lockscreen: 'public', mutable: true },
  { id: 'rk_proyek', name: 'Proyek, OKR & hiring', importance: 'default', lockscreen: 'private', mutable: true },
  { id: 'rk_info', name: 'Pengumuman & briefing', importance: 'low', lockscreen: 'public', mutable: true },
  { id: 'rk_keamanan', name: 'Keamanan akun', importance: 'high', lockscreen: 'private', mutable: false },
  { id: 'rk_sinkron', name: 'Sinkron latar', importance: 'min', lockscreen: 'public', mutable: true },
];

/** Saluran bawaan notifikasi tanpa `channel_id` (juga di manifest: `defaultChannel`). */
export const KANAL_CADANGAN = 'rk_info';

/** Saluran notifikasi uji lokal (jenis `system.test` di server memakai saluran yang sama). */
export const KANAL_UJI = 'rk_info';

/** Id grup saluran di pengaturan Android ("RuangKerja"). */
export const GRUP_KANAL = 'ruangkerja';

/** Gabungkan daftar dari server (bila ada) dengan bawaan; server menang per id, saluran baru ikut. */
export function gabungKanal(dariServer: readonly DefinisiKanal[] | null | undefined): DefinisiKanal[] {
  const peta = new Map<string, DefinisiKanal>(KANAL_BAWAAN.map((k) => [k.id, k]));
  for (const k of dariServer ?? []) {
    if (typeof k.id === 'string' && k.id.startsWith('rk_')) {
      peta.set(k.id, k);
    }
  }
  return [...peta.values()];
}

const KEPENTINGAN_VALID: readonly string[] = ['high', 'default', 'low', 'min'];
const LAYAR_KUNCI_VALID: readonly string[] = ['public', 'private'];

/** Saring `push.android_channels` dari server: hanya id `rk_*` dengan nilai yang dikenal aplikasi. */
export function kanalDariServer(
  daftar: readonly { id: string; name: string; importance: string; lockscreen: string; mutable: boolean }[] | null | undefined,
): DefinisiKanal[] {
  return (daftar ?? []).flatMap((k) =>
    KEPENTINGAN_VALID.includes(k.importance) && LAYAR_KUNCI_VALID.includes(k.lockscreen)
      ? [{ id: k.id, name: k.name, importance: k.importance as Kepentingan, lockscreen: k.lockscreen as LayarKunci, mutable: k.mutable }]
      : [],
  );
}
