import { MapPin } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Today's attendance status in the sidebar (mockup Main). Attendance arrives in
 * Sprint 2; until then it shows a neutral "belum check-in" state.
 */
export function CheckInStatus() {
    const { state } = useSidebar();

    if (state === 'collapsed') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        tabIndex={0}
                        className="mx-auto flex size-8 items-center justify-center rounded-md border border-border text-text-muted"
                    >
                        <MapPin className="size-4" aria-hidden />
                        <span className="sr-only">Belum check-in</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                    Belum check-in · absensi segera tersedia
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <div className="rounded-md border border-border bg-surface-2/60 px-3 py-2.5">
            <div className="flex items-center gap-2 text-[13px] font-medium text-text">
                <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full bg-text-subtle"
                />
                Belum check-in
            </div>
            <p className="mt-0.5 pl-4 text-[11px] text-text-muted">
                Absensi segera tersedia
            </p>
        </div>
    );
}
