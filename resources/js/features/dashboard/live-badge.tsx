import { cn } from '@/lib/utils';

/** "● Langsung" when realtime updates are connected (else "Diperbarui berkala"). */
export function LiveBadge({ live }: { live: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium',
                live
                    ? 'bg-success/10 text-success'
                    : 'bg-surface-2 text-text-muted',
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'size-1.5 rounded-full',
                    live ? 'bg-success' : 'bg-text-subtle',
                )}
            />
            {live ? 'Langsung' : 'Diperbarui berkala'}
        </span>
    );
}
