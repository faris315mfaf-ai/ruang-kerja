import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/utils';
import type { CheckFlow } from '../use-check-flow';

/** Location status over the camera (mockup CheckinSelfie). */
export function LocationChip({
    flow,
    className,
}: {
    flow: CheckFlow;
    className?: string;
}) {
    const { geo, match, isRemote } = flow;
    let dot = 'bg-text-subtle';
    let content: React.ReactNode = 'Membaca lokasi…';

    if (geo.error) {
        dot = 'bg-danger';
        content = 'Lokasi tidak terbaca';
    } else if (geo.position && match) {
        dot = match.inside ? 'bg-success' : isRemote ? 'bg-info' : 'bg-danger';
        content = (
            <>
                <span className="truncate">{match.location.name}</span>
                <span aria-hidden>·</span>
                <span className="font-mono">
                    {formatDistance(match.distanceM)}
                </span>
                <span aria-hidden>·</span>
                <span
                    className={
                        match.inside
                            ? 'text-success'
                            : isRemote
                              ? 'text-info'
                              : 'text-danger'
                    }
                >
                    {match.inside
                        ? 'dalam radius'
                        : isRemote
                          ? 'WFH/lapangan'
                          : 'di luar radius'}
                </span>
            </>
        );
    } else if (geo.position) {
        dot = isRemote ? 'bg-info' : 'bg-text-subtle';
        content = isRemote ? 'WFH/lapangan' : 'Tidak ada lokasi kantor';
    }

    return (
        <div
            role="status"
            className={cn(
                'glass inline-flex h-9 max-w-full items-center gap-2 rounded-full px-3.5 text-sm text-text',
                className,
            )}
        >
            <span
                aria-hidden
                className={cn('size-2.5 shrink-0 rounded-full', dot)}
            />
            {content}
        </div>
    );
}
