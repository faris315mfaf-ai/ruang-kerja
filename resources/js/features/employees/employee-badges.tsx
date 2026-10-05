import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { UserStatus, WorkMode } from '@/types/auth';
import { STATUS_LABELS, WORK_MODE_LABELS } from './labels';

const WORK_MODE_TONES: Record<WorkMode, string> = {
    office: 'bg-surface-2 text-text-muted',
    hybrid: 'bg-info-soft text-info',
    wfh: 'bg-success-soft text-success',
    field: 'bg-warning-soft text-warning',
};

export function WorkModeBadge({
    mode,
    className,
}: {
    mode: WorkMode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex h-5 items-center rounded-md px-2 text-xs font-medium whitespace-nowrap',
                WORK_MODE_TONES[mode],
                className,
            )}
        >
            {WORK_MODE_LABELS[mode]}
        </span>
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
        <span
            className={cn(
                'inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap',
                status === 'active' ? 'text-success' : 'text-text-muted',
                className,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'size-1.5 rounded-full',
                    status === 'active' ? 'bg-success' : 'bg-text-subtle',
                )}
            />
            {STATUS_LABELS[status]}
        </span>
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
        <span className="inline-flex h-5 items-center rounded-md border border-border px-2 text-xs whitespace-nowrap text-text-muted">
            {sortRoles(roles).map(roleLabel).join(' · ')}
        </span>
    );
}
