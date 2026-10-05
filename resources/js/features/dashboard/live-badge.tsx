import { cn } from '@/lib/utils';

/**
 * "● Langsung" when realtime updates are connected (DBeranda "Kehadiran hari
 * ini"), else "Diperbarui berkala". Text + dot, never colour alone.
 */
export function LiveBadge({ live }: { live: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-2 text-[15px] font-bold',
                live ? 'text-success' : 'text-text-muted',
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'size-[9px] rounded-full',
                    live
                        ? 'bg-success ring-4 ring-success/15'
                        : 'bg-text-subtle',
                )}
            />
            {live ? 'Langsung' : 'Diperbarui berkala'}
        </span>
    );
}
