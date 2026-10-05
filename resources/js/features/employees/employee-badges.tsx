import type { BadgeTone } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import { roleLabel } from '@/lib/roles';
import type { UserStatus, WorkMode } from '@/types/auth';
import { STATUS_LABELS, WORK_MODE_LABELS } from './labels';

const WORK_MODE_TONES: Record<WorkMode, BadgeTone> = {
    office: 'neutral',
    hybrid: 'info',
    wfh: 'success',
    field: 'warning',
};

/** Komponen label chip ("Kantor", "WFH"). */
export function WorkModeBadge({
    mode,
    className,
}: {
    mode: WorkMode;
    className?: string;
}) {
    return (
        <Badge
            variant="label"
            tone={WORK_MODE_TONES[mode]}
            className={className}
        >
            {WORK_MODE_LABELS[mode]}
        </Badge>
    );
}

/** Dot + text: status is never conveyed by colour alone (DESIGN.md §1). */
export function StatusBadge({
    status,
    className,
}: {
    status: UserStatus;
    className?: string;
}) {
    return (
        <Badge
            variant="status"
            tone={status === 'active' ? 'success' : 'neutral'}
            dot
            className={className}
        >
            {STATUS_LABELS[status]}
        </Badge>
    );
}

const ROLE_RANK = ['super_admin', 'direksi', 'kepala_divisi', 'hr', 'anggota'];

/** Highest role first, e.g. "Kepala Divisi · HR" (mockup Karyawan). */
export function sortRoles(roles: readonly string[]): string[] {
    return [...roles].sort(
        (a, b) => ROLE_RANK.indexOf(a) - ROLE_RANK.indexOf(b),
    );
}

export function RoleBadges({ roles }: { roles: readonly string[] }) {
    if (roles.length === 0) {
        return <span className="text-text-subtle">—</span>;
    }

    return (
        <Badge variant="outline">
            {sortRoles(roles).map(roleLabel).join(' · ')}
        </Badge>
    );
}
