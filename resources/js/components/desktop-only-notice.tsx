import { Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
    description?: string;
    className?: string;
};

/** Mobile banner for desktop-only features (docs/PLATFORM.md §3). */
export function DesktopOnlyNotice({ description, className }: Props) {
    return (
        <div
            role="note"
            className={cn(
                'flex items-start gap-3 rounded-lg border border-border bg-surface p-4',
                className,
            )}
        >
            <Monitor
                className="mt-0.5 size-5 shrink-0 text-text-muted"
                strokeWidth={1.75}
                aria-hidden
            />
            <div className="space-y-0.5">
                <p className="text-[15px] font-medium text-text">
                    Fitur ini tersedia di desktop.
                </p>
                {description && (
                    <p className="text-sm text-text-muted">{description}</p>
                )}
            </div>
        </div>
    );
}
