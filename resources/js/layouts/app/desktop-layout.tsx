import type { ReactNode } from 'react';
import { Dock } from '@/components/shell/dock';
import { MenuBar } from '@/components/shell/menu-bar';
import type { BreadcrumbItem } from '@/types';

type Props = {
    children: ReactNode;
    breadcrumbs: BreadcrumbItem[];
    /** 768–1023px (usually touch): the Dock does not magnify. */
    isTablet: boolean;
};

/**
 * Desktop & tablet shell, macOS style (docs/PLATFORM.md §2): a thin translucent
 * menu bar on top, a floating Dock at the bottom, and the page using the whole
 * screen in between with a 10px gutter. Content scrolls under both bars.
 */
export default function DesktopLayout({
    children,
    breadcrumbs,
    isTablet,
}: Props) {
    return (
        <div className="min-h-svh">
            <MenuBar breadcrumbs={breadcrumbs} />
            <main className="min-w-0 px-(--screen-gutter) pt-[calc(var(--menu-bar-height)+var(--screen-gutter))] pb-[calc(var(--dock-space)+var(--screen-gutter))]">
                {children}
            </main>
            <Dock magnify={!isTablet} />
        </div>
    );
}
