import type { Label } from '@/features/tasks/types';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';

type Props = {
    label: Pick<Label, 'name' | 'color'>;
    count?: number;
    className?: string;
};

/** Label pill: colored dot + name (docs/DESIGN.md §6 kartu Kanban). */
export function LabelPill({ label, count, className }: Props) {
    return (
        <span
            className={cn(
                'inline-flex h-5 max-w-full min-w-0 items-center gap-1.5 rounded-full border border-border px-2 text-[11px] leading-none text-text-muted',
                className,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    palette(label.color).bg,
                )}
            />
            <span className="truncate">{label.name}</span>
            {count !== undefined && (
                <span className="text-text-subtle tnum">{count}</span>
            )}
        </span>
    );
}
