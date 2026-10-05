import { cn } from '@/lib/utils';
import type { ConnectionMode } from './connection';

/**
 * Small sync state next to the task count (mockup Kanban: "tersinkron
 * langsung"). Polling = WebSocket unavailable, refreshed every 30 s.
 */
export function ConnectionIndicator({
    mode,
    className,
}: {
    mode: ConnectionMode;
    className?: string;
}) {
    const live = mode === 'realtime';

    return (
        <span
            role="status"
            title={
                live
                    ? 'Perubahan dari anggota lain tampil langsung.'
                    : 'Koneksi langsung terputus. Data diperbarui tiap 30 detik.'
            }
            className={cn(
                'inline-flex items-center gap-1.5 text-[15px] text-text-muted',
                className,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'size-1.5 rounded-full',
                    live ? 'bg-success' : 'animate-pulse bg-warning',
                )}
            />
            {live ? 'tersinkron langsung' : 'sinkron tiap 30 dtk'}
        </span>
    );
}
