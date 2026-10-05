import type { ReactNode } from 'react';
import { CommandPaletteHost } from '@/components/shell/command-palette-host';
import { Dock } from '@/components/shell/dock';
import { MenuBar } from '@/components/shell/menu-bar';
import { Rail } from '@/components/shell/rail';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

export type PageWidth = 'default' | 'wide' | 'full';

type Props = {
    children: ReactNode;
    breadcrumbs: BreadcrumbItem[];
    /** 768–1023px: Rail on the left instead of menu bar + Dock. */
    isTablet: boolean;
    /**
     * Content column: `default` 1280px (most screens), `wide` 1480px (boards,
     * big tables, DBoard), `full` = the page lays out its own column.
     */
    width?: PageWidth;
};

const WIDTHS: Record<PageWidth, string> = {
    default: 'mx-auto w-full max-w-(--page-max)',
    wide: 'mx-auto w-full max-w-(--page-max-wide)',
    full: 'w-full',
};

/**
 * Desktop & tablet shell (docs/PLATFORM.md §2, MenuBar / Dock / Rail.dc.html).
 * Desktop: 64px glass menu bar, content column with 40px padding, floating
 * Dock. Tablet: 96px glass rail and 24px padding. Content scrolls under the
 * chrome; the page background (two corner glows) comes from <body>.
 */
export default function DesktopLayout({
    children,
    breadcrumbs,
    isTablet,
    width = 'default',
}: Props) {
    const padded = width !== 'full';

    if (isTablet) {
        return (
            <div className="min-h-svh pl-(--rail-width)">
                <Rail />
                <main
                    className={cn(
                        'min-w-0',
                        WIDTHS[width],
                        padded && 'p-6 pb-10',
                    )}
                >
                    {children}
                </main>
                <CommandPaletteHost />
            </div>
        );
    }

    return (
        <div className="min-h-svh">
            <MenuBar breadcrumbs={breadcrumbs} />
            <main
                className={cn(
                    'min-w-0 pt-(--menu-bar-height) pb-(--dock-space)',
                    WIDTHS[width],
                    padded &&
                        'px-(--page-pad) pt-[calc(var(--menu-bar-height)+var(--page-pad))]',
                )}
            >
                {children}
            </main>
            <Dock />
            <CommandPaletteHost />
        </div>
    );
}
