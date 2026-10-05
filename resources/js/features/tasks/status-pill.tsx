import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { StatusCategory } from './types';

const TONES: Record<StatusCategory, BadgeTone | null> = {
    backlog: null,
    todo: null,
    in_progress: 'warning',
    review: 'info',
    done: 'success',
    canceled: 'neutral',
};

/**
 * Status pill of the task rows (STugasSaya "Review", "Dikerjakan", "Todo"):
 * soft tone + dot for active work, an outlined pill for work not started.
 */
export function StatusPill({
    name,
    category,
    className,
}: {
    name: string;
    category: StatusCategory;
    className?: string;
}) {
    const tone = TONES[category];

    return (
        <Badge
            variant="status"
            tone={tone ?? undefined}
            dot
            className={cn(
                'h-9',
                tone === null &&
                    'border border-border-strong bg-surface text-text',
                className,
            )}
        >
            <span className="sr-only">Status: </span>
            {name}
        </Badge>
    );
}
