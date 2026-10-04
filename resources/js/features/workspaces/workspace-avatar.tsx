import type { WorkspaceType } from '@/features/tasks/types';
import type { PaletteColor } from '@/lib/palette';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';

type Props = {
    name: string;
    type: WorkspaceType;
    color: PaletteColor | null;
    className?: string;
};

/** Rounded square with the workspace initial (sidebar, headers, rows). */
export function WorkspaceAvatar({ name, type, color, className }: Props) {
    const initial = name.trim().charAt(0).toUpperCase() || '?';
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
            {initial}
        </span>
    );
}
