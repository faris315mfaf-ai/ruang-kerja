import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { AppShellSkeleton } from '@/components/shell/app-shell-skeleton';
import { MinutesReturnPill } from '@/features/notes/minutes-return-pill';
import { NotificationListener } from '@/features/notifications/notification-listener';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import type { PageWidth } from '@/layouts/app/desktop-layout';
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
    /** Mobile app bar actions replacing search + bell (self-contained element). */
    appBarActions?: ReactNode;
    /** Desktop/tablet content column (default 1280px, wide 1480px, full). */
    width?: PageWidth;
};

const loadDesktopLayout = () => import('@/layouts/app/desktop-layout');

// The desktop/tablet shell (sidebar, topbar, menus) is its own chunk so phones
// never download it (Lighthouse "Absensi" on mobile, Sprint 10). Wide screens
// start fetching it immediately, in parallel with the page.
const DesktopLayout = lazy(loadDesktopLayout);

if (
    typeof window !== 'undefined' &&
    window.matchMedia('(min-width: 768px)').matches
) {
    void loadDesktopLayout();
}

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
    appBarActions,
    width = 'default',
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
                actions={appBarActions}
            >
                <NotificationListener />
                {/* "Kembali ke notulensi" while note-taking mode is on (Catatan). */}
                <MinutesReturnPill />
                {children}
            </MobileLayout>
        );
    }

    return (
        <Suspense fallback={<AppShellSkeleton />}>
            <DesktopLayout
                breadcrumbs={breadcrumbs}
                isTablet={breakpoint === 'tablet'}
                width={width}
            >
                <NotificationListener />
                <MinutesReturnPill />
                {children}
            </DesktopLayout>
        </Suspense>
    );
}
