import { usePage } from '@inertiajs/react';
import type { WorkspaceType } from '@/features/tasks/types';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';
import { workspaceInitial } from './lib';

type Props = {
    name: string;
    type: WorkspaceType;
    color: string | null;
    /** Owner name for personal workspaces; defaults to the signed-in user. */
    ownerName?: string | null;
    className?: string;
};

/** Rounded square with the workspace initial (sidebar, headers, rows). */
export function WorkspaceAvatar({
    name,
    type,
    color,
    ownerName,
    className,
}: Props) {
    const personal = type === 'personal';
    const { auth } = usePage().props;

    return (
        <span
            aria-hidden
            className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-semibold',
                personal
                    ? 'bg-surface-2 text-text-muted ring-1 ring-border'
                    : cn(palette(color).bg, 'text-on-brand'),
                className,
            )}
        >
            {workspaceInitial(
                name,
                type,
                // Personal workspaces are only visible to their owner = the viewer.
                ownerName ?? auth.user?.name,
            )}
        </span>
    );
}
