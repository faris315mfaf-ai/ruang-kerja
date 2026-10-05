export type RoleName =
    | 'super_admin'
    | 'direksi'
    | 'hr'
    | 'kepala_divisi'
    | 'anggota';

const ROLE_LABELS: Record<RoleName, string> = {
    super_admin: 'Super Admin',
    direksi: 'Direksi',
    hr: 'HR',
    kepala_divisi: 'Kepala Divisi',
    anggota: 'Anggota',
};

/** Highest-ranked role first, used for the single label under a user's name. */
const ROLE_ORDER: RoleName[] = [
    'super_admin',
    'direksi',
    'hr',
    'kepala_divisi',
    'anggota',
];

export function roleLabel(role: string): string {
    return ROLE_LABELS[role as RoleName] ?? role;
}

export function primaryRoleLabel(roles: readonly string[]): string | null {
    const role = ROLE_ORDER.find((candidate) => roles.includes(candidate));

    return role ? ROLE_LABELS[role] : null;
}

export function hasAnyRole(
    roles: readonly string[],
    ...candidates: RoleName[]
): boolean {
    return candidates.some((candidate) => roles.includes(candidate));
}

/** Roles only a Super Admin may grant or revoke (UserPolicy::assignRole). */
export const SUPER_ADMIN_ONLY_ROLES: readonly RoleName[] = [
    'super_admin',
    'direksi',
    'hr',
];

/**
 * Why the role checkbox is locked in the employee form, or null when the
 * actor may toggle it. Mirrors UserPolicy::assignRole.
 */
export function roleLockReason(
    role: RoleName,
    actor: { canAssignPrivilegedRoles: boolean; editingSelf: boolean },
): string | null {
    if (actor.editingSelf) {
        return 'peran sendiri tidak bisa diubah';
    }

    if (
        SUPER_ADMIN_ONLY_ROLES.includes(role) &&
        !actor.canAssignPrivilegedRoles
    ) {
        return 'hanya bisa diatur oleh Super Admin';
    }

    return null;
}
