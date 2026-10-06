import type { RoleName } from '@/lib/roles';

/** Roles that make an employee more than "staf" (mirrors Role::aboveStaff()). */
export const ROLES_ABOVE_STAFF: readonly RoleName[] = [
    'super_admin',
    'direksi',
    'hr',
    'kepala_divisi',
];

/**
 * "Staf" (keputusan pemilik 6 Okt 2026): holds none of kepala_divisi, hr,
 * direksi or super_admin (normally just `anggota`). Staff do not see the
 * annual leave balance nor the org chart. Mirrors User::isStaffOnly().
 */
export function isStaffOnly(roles: readonly string[]): boolean {
    return !ROLES_ABOVE_STAFF.some((role) => roles.includes(role));
}
