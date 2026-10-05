import { Link, usePage } from '@inertiajs/react';
import { MapPin } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { TONE_CLASSES } from '@/lib/attendance';
import { shellStatus } from '@/lib/check-in-status';
import { cn } from '@/lib/utils';
import { index as attendanceIndex } from '@/routes/attendance';

/** Today's attendance in the sidebar (mockup Main), from the shared `attendanceStatus`. */
export function CheckInStatus() {
    const { state } = useSidebar();
    const { attendanceStatus } = usePage().props;
    const status = shellStatus(attendanceStatus);
    const tone = TONE_CLASSES[status.tone];

    if (state === 'collapsed') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link
                        href={attendanceIndex()}
                        prefetch
                        className={cn(
                            'relative mx-auto flex size-8 items-center justify-center rounded-md border border-border text-text-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        )}
                    >
                        <MapPin className="size-4" aria-hidden />
                        <span
                            aria-hidden
                            className={cn(
                                'absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-surface',
                                tone.solid,
                            )}
                        />
                        <span className="sr-only">{status.title}</span>
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                    {status.title} · {status.detail}
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Link
            href={attendanceIndex()}
            prefetch
            className={cn(
                'block rounded-md border px-3 py-2.5 transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                status.tone === 'success'
                    ? 'border-success/30 bg-success/8 hover:bg-success/12'
                    : status.tone === 'warning'
                      ? 'border-warning/30 bg-warning/8 hover:bg-warning/12'
                      : 'border-border bg-surface-2/60 hover:bg-surface-2',
            )}
        >
            <span className="flex items-center gap-2 text-[13px] font-medium text-text">
                <span
                    aria-hidden
                    className={cn('size-2 shrink-0 rounded-full', tone.solid)}
                />
                {status.title}
            </span>
            <span className="mt-0.5 block truncate pl-4 text-[11px] text-text-muted">
                {status.detail}
            </span>
        </Link>
    );
}
