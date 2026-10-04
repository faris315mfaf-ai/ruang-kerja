import type { ReactNode } from 'react';
import { AppShellSkeleton } from '@/components/shell/app-shell-skeleton';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import DesktopLayout from '@/layouts/app/desktop-layout';
import MobileLayout from '@/layouts/app/mobile-layout';
import type { BreadcrumbItem } from '@/types';

export type AppLayoutProps = {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
    /** Mobile app bar title; defaults to the last breadcrumb. */
    title?: string;
    /** Mobile back target for child screens. */
    back?: string;
    /** Mobile app bar style ('greeting' on the home screen). */
    appBar?: 'default' | 'greeting';
};

/**
 * Picks the shell by viewport width, never by user agent (docs/PLATFORM.md §1).
 * Before the client knows its width it renders a neutral skeleton.
 */
export default function AppLayout({
    children,
    breadcrumbs = [],
    title,
    back,
    appBar = 'default',
}: AppLayoutProps) {
    const breakpoint = useBreakpoint();

    if (breakpoint === null) {
        return <AppShellSkeleton />;
    }

    if (breakpoint === 'mobile') {
        return (
            <MobileLayout
                title={title ?? breadcrumbs.at(-1)?.title}
                back={back}
                variant={appBar}
            >
                {children}
            </MobileLayout>
        );
    }

    return (
        <DesktopLayout
            breadcrumbs={breadcrumbs}
            isTablet={breakpoint === 'tablet'}
        >
            {children}
        </DesktopLayout>
    );
}
