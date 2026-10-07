import type { RoleName } from '@/lib/roles';

/**
 * Note under "Tambah karyawan" on how the new account signs in (owner decision
 * 7 Oct 2026): with the company default password configured, every new
 * account except a Super Admin gets it and must change it at first login.
 */
export function newAccountPasswordNote(
    defaultPassword: boolean,
    roles: RoleName[],
): string {
    if (defaultPassword && !roles.includes('super_admin')) {
        return 'Karyawan langsung bisa masuk dengan email ini dan kata sandi bawaan perusahaan, lalu wajib menggantinya saat login pertama. Sandi bawaan bisa dilihat di profilnya › Atur kata sandi.';
    }

    if (defaultPassword) {
        return 'Super Admin tidak mendapat kata sandi bawaan. Setelah disimpan, buka profilnya lalu pilih Atur kata sandi, atau minta ia memakai Lupa kata sandi.';
    }

    return 'Karyawan masuk dengan email ini dan kata sandi. Setelah disimpan, buka profilnya lalu pilih Atur kata sandi, atau minta karyawan memakai Lupa kata sandi.';
}
