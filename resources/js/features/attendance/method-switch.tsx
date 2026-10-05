import { Camera, QrCode } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Method segmented control (docs/DESIGN.md §6). QR kiosk scanning arrives in
 * Sprint 3; the option is shown but disabled.
 */
export function MethodSwitch({ className }: { className?: string }) {
    const base =
        'flex h-11 flex-1 items-center justify-center gap-2 rounded-md text-[15px] font-medium transition-colors duration-120 ease-brand';

    return (
        <div
            role="radiogroup"
            aria-label="Metode absensi"
            className={cn('flex gap-1 rounded-lg bg-surface-2 p-1', className)}
        >
            <button
                type="button"
                role="radio"
                aria-checked
                className={cn(base, 'bg-surface text-text shadow-card')}
            >
                <Camera className="size-5" strokeWidth={1.75} aria-hidden />
                GPS + Selfie
            </button>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="flex flex-1" tabIndex={0}>
                        <button
                            type="button"
                            role="radio"
                            aria-checked={false}
                            disabled
                            className={cn(base, 'text-text-subtle')}
                        >
                            <QrCode
                                className="size-5"
                                strokeWidth={1.75}
                                aria-hidden
                            />
                            Pindai QR
                        </button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    Pindai QR kiosk segera tersedia.
                </TooltipContent>
            </Tooltip>
        </div>
    );
}
