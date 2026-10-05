import type { Label } from '@/features/tasks/types';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';

type Props = {
    label: Pick<Label, 'name' | 'color'>;
    count?: number;
    className?: string;
};

/**
 * Label chip (DBoard/DTodo "Konten", "Keuangan"): neutral 26px chip, radius
 * 8, semibold 14px, with the label's palette colour as a small leading dot.
 */
export function LabelPill({ label, count, className }: Props) {
    return (
        <span
            className={cn(
                'inline-flex h-[26px] max-w-full min-w-0 items-center gap-1.5 rounded-sm bg-surface-2 px-2.5 text-[14px] leading-none font-semibold text-text dark:bg-border',
                className,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'size-2 shrink-0 rounded-full',
                    palette(label.color).bg,
                )}
            />
            <span className="truncate">{label.name}</span>
            {count !== undefined && (
                <span className="text-text-muted tnum">{count}</span>
            )}
        </span>
    );
}
