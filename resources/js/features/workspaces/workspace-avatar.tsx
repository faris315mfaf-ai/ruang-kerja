import type { WorkspaceType } from '@/features/tasks/types';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';
import { workspaceInitial } from './lib';

type Props = {
    name: string;
    type: WorkspaceType;
    color: string | null;
    /** Owner name for personal workspaces (initial of the person). */
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
            {workspaceInitial(name, type, ownerName)}
        </span>
    );
}
