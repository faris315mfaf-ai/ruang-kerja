import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { cn } from '@/lib/utils';
import { HomeIndicator, StatusBar } from './phone-frame';

export type ScreenVariant = 'page' | 'frame';

/**
 * Container of an app-feature screen that renders either in the phone
 * shell (`page`: MobileLayout already draws the app bar, the action bar
 * floats above the tab bar) or inside the desktop phone frame (`frame`:
 * draws its own status bar, title bar and bottom action bar).
 */
export function AppScreen({
    variant,
    title,
    actions,
    children,
    className,
}: {
    variant: ScreenVariant;
    title: string;
    /** Sticky bottom actions (primary button in the thumb zone). */
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    if (variant === 'frame') {
        return (
            <div className="relative flex h-full flex-col bg-background text-text">
                <StatusBar time="07.52" tone="auto" />
                <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
                    <span
                        aria-hidden
                        className={cn(appBarIconButton, 'size-11')}
                    >
                        <ChevronLeft
                            className="size-[22px]"
                            strokeWidth={2.4}
                        />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[17px] font-bold">
                        {title}
                    </span>
                </div>
                <div
                    className={cn(
                        'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-2',
                        actions ? 'pb-44' : 'pb-10',
                        className,
                    )}
                >
                    {children}
                </div>
                {actions && (
                    <div className="glass absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-x-0 border-b-0 px-4 pt-3 pb-7">
                        {actions}
                    </div>
                )}
                <HomeIndicator tone="auto" />
            </div>
        );
    }

    return (
        <>
            <div
                className={cn(
                    'flex flex-col gap-4',
                    actions && 'pb-36',
                    className,
                )}
            >
                {children}
            </div>
            {actions && (
                <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 flex flex-col gap-2 border-x-0 border-b-0 px-4 py-3">
                    {actions}
                </div>
            )}
        </>
    );
}
