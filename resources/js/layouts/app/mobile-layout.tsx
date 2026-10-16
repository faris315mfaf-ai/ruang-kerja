import type { ReactNode } from 'react';
import type { AppBarProps } from '@/components/mobile/app-bar';
import { AppBar } from '@/components/mobile/app-bar';
import { DemoAccountStrip } from '@/components/shell/demo-account-switcher';
import { TabBar } from '@/components/mobile/tab-bar';

type Props = AppBarProps & {
    children: ReactNode;
    /** Optional sticky action bar above the tab bar. */
    bottomBar?: ReactNode;
};

/** Mobile shell (< 768px): app bar 56px + glass bottom tabs (docs/PLATFORM.md §2). */
export default function MobileLayout({
    children,
    bottomBar,
    ...appBar
}: Props) {
    return (
        <div className="flex min-h-svh flex-col">
            <DemoAccountStrip className="pt-safe" />
            <AppBar {...appBar} />
            <main className="flex-1 px-4 pt-2 pb-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+24px)] transition-[padding-bottom] duration-180 ease-brand motion-reduce:transition-none">
                {children}
            </main>
            {bottomBar && (
                <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 border-x-0 border-b-0 px-4 py-3">
                    {bottomBar}
                </div>
            )}
            <TabBar />
        </div>
    );
}
