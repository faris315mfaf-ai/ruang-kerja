import { Monitor } from 'lucide-react';

/**
 * Banner for features that are desktop-only (docs/PLATFORM.md §3): mobile shows
 * this instead of a cramped desktop layout. `feature` adds one explanatory line.
 */
export function DesktopOnlyNotice({ feature }: { feature?: string }) {
    return (
        <div
            role="note"
            className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-text"
        >
            <Monitor
                aria-hidden
                className="mt-0.5 size-5 shrink-0 text-info"
                strokeWidth={1.75}
            />
            <div className="space-y-0.5">
                <p className="text-sm font-medium">
                    Fitur ini tersedia di desktop.
                </p>
                {feature && (
                    <p className="text-sm text-text-muted">{feature}</p>
                )}
            </div>
        </div>
    );
}
