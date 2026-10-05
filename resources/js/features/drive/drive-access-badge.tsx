import { CircleAlert, CircleCheck, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DriveAccessMember, DriveAccessSummary } from './types';

const TONES = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    muted: 'bg-surface-2 text-text-muted',
} as const;

/** "Akses tersinkron · 9 anggota" (mockups WorkspaceFile, MFile). */
export function driveAccessText(access: DriveAccessSummary): {
    text: string;
    tone: keyof typeof TONES;
} {
    switch (access.state) {
        case 'synced':
            return {
                text: `Akses tersinkron · ${access.total} anggota`,
                tone: 'success',
            };
        case 'pending':
            return {
                text: `Menunggu sinkron · ${access.pending} anggota`,
                tone: 'warning',
            };
        case 'error':
            return {
                text: `Gagal sinkron · ${access.errors} anggota`,
                tone: 'danger',
            };
        case 'preparing':
            return { text: 'Menyiapkan folder…', tone: 'warning' };
        case 'unused':
            return {
                text: 'Folder dibuat saat pertama dipakai',
                tone: 'muted',
            };
        default:
            return { text: 'Drive belum aktif', tone: 'muted' };
    }
}

export function DriveAccessBadge({
    access,
    className,
}: {
    access: DriveAccessSummary;
    className?: string;
}) {
    const { text, tone } = driveAccessText(access);
    const Icon =
        tone === 'success'
            ? CircleCheck
            : tone === 'danger'
              ? CircleAlert
              : access.state === 'preparing'
                ? Loader2
                : RefreshCw;

    return (
        <span
            className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium',
                TONES[tone],
                className,
            )}
        >
            <Icon
                aria-hidden
                className={cn(
                    'size-3.5 shrink-0',
                    access.state === 'preparing' && 'animate-spin',
                )}
            />
            <span className="truncate">{text}</span>
        </span>
    );
}

/** Per-member status in Pengaturan › Anggota (mockup WorkspacePengaturan). */
export function MemberDriveStatus({
    drive,
}: {
    drive: DriveAccessMember | null;
}) {
    if (!drive) {
        return <span className="text-[12px] text-text-muted">–</span>;
    }

    const tone: keyof typeof TONES =
        drive.status === 'synced'
            ? 'success'
            : drive.status === 'pending'
              ? 'warning'
              : drive.status === 'error'
                ? 'danger'
                : 'muted';
    const Icon =
        tone === 'success'
            ? CircleCheck
            : tone === 'danger'
              ? CircleAlert
              : RefreshCw;

    return (
        <span
            title={drive.error ? `Alasan Google: ${drive.error}` : undefined}
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px]',
                TONES[tone],
            )}
        >
            <Icon aria-hidden className="size-3" />
            {drive.label}
        </span>
    );
}
